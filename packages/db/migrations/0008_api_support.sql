-- API support: first-owner invitations, org write gate (suspended = read-only), org activation, mail outbox.

-- ===== 1. First-owner invitations (platform operator only) =====
ALTER TABLE invitations ADD COLUMN grant_owner boolean NOT NULL DEFAULT false;
-- Tenants may not set grant_owner: replace the table-wide INSERT with a column list that omits it.
REVOKE INSERT ON invitations FROM app_user;
GRANT INSERT (org_id, email, org_role, unit_id, role_id, token_hash, invited_by, expires_at) ON invitations TO app_user;

-- memberships_guard: same rules as 0004, plus: the very first owner of an org may be created by accepting a
-- platform-issued (grant_owner) invitation while the org has no active owner.
CREATE OR REPLACE FUNCTION app_private.memberships_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS
$$
DECLARE privileged boolean; other_owners int; org_exists boolean; first_owner_ok boolean := false;
BEGIN
  privileged := app_private.session_is_superuser() OR app_private.is_platform_admin();

  IF TG_OP = 'UPDATE' THEN
    IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'membership org_id and user_id are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT','UPDATE') AND NEW.org_role = 'owner'
     AND (TG_OP = 'INSERT' OR OLD.org_role <> 'owner') THEN
    IF TG_OP = 'INSERT' THEN
      first_owner_ok :=
        NOT EXISTS (SELECT 1 FROM public.memberships WHERE org_id = NEW.org_id AND org_role = 'owner' AND status = 'active')
        AND EXISTS (SELECT 1 FROM public.invitations i JOIN public.users u ON lower(u.email) = lower(i.email)
                    WHERE i.org_id = NEW.org_id AND i.grant_owner AND i.accepted_at IS NULL
                      AND i.expires_at > now() AND u.id = NEW.user_id);
    END IF;
    IF NOT (privileged OR first_owner_ok OR app_private.is_org_owner(NEW.org_id)) THEN
      RAISE EXCEPTION 'only an owner may grant the owner role' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE','DELETE') AND OLD.org_role = 'owner' AND OLD.status = 'active'
     AND (TG_OP = 'DELETE' OR NEW.org_role <> 'owner' OR NEW.status <> 'active') THEN
    IF NOT (privileged OR app_private.is_org_owner(OLD.org_id)) THEN
      RAISE EXCEPTION 'only an owner may change or remove an owner' USING ERRCODE = '42501';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('owners:' || OLD.org_id::text, 0));
    SELECT EXISTS (SELECT 1 FROM public.organisations WHERE id = OLD.org_id) INTO org_exists;
    IF org_exists THEN
      SELECT count(*) INTO other_owners FROM public.memberships
       WHERE org_id = OLD.org_id AND org_role = 'owner' AND status = 'active' AND id <> OLD.id;
      IF other_owners = 0 THEN
        RAISE EXCEPTION 'cannot remove or demote the last owner' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app_private.accept_invitation(p_token_hash text, p_name text, p_password_hash text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS
$$
DECLARE inv public.invitations; uid uuid; new_role public.org_role;
BEGIN
  SELECT * INTO inv FROM public.invitations
   WHERE token_hash = p_token_hash AND accepted_at IS NULL AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid or expired invitation' USING ERRCODE = '22023'; END IF;

  SELECT id INTO uid FROM public.users WHERE lower(email) = lower(inv.email);
  IF uid IS NULL THEN
    INSERT INTO public.users (email, name, password_hash) VALUES (inv.email, p_name, p_password_hash) RETURNING id INTO uid;
  END IF;

  new_role := CASE WHEN inv.grant_owner THEN 'owner'::public.org_role ELSE inv.org_role END;
  INSERT INTO public.memberships (user_id, org_id, org_role) VALUES (uid, inv.org_id, new_role)
  ON CONFLICT (user_id, org_id) DO NOTHING;

  IF inv.unit_id IS NOT NULL AND inv.role_id IS NOT NULL THEN
    INSERT INTO public.unit_role_assignments (org_id, user_id, unit_id, role_id)
    VALUES (inv.org_id, uid, inv.unit_id, inv.role_id) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;
  RETURN uid;
END $$;

-- ===== 2. Org write gate: suspended/archived orgs are read-only for tenant roles =====
CREATE FUNCTION app_private.org_writable() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT COALESCE((SELECT o.status NOT IN ('suspended','archived','rejected')
                    FROM public.organisations o WHERE o.id = app_private.current_org_id()), false) $$;

-- ===== 3. Org activation (setup wizard complete): trial -> active =====
CREATE FUNCTION app_private.activate_org() RETURNS public.org_status
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS
$$
DECLARE st public.org_status;
BEGIN
  IF NOT app_private.has_org_permission('org.manage') THEN
    RAISE EXCEPTION 'org.manage permission required' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO st FROM public.organisations WHERE id = app_private.current_org_id() FOR UPDATE;
  IF st = 'active' THEN RETURN st; END IF;
  IF st IS DISTINCT FROM 'trial' THEN
    RAISE EXCEPTION 'organisation is % and cannot be activated', st USING ERRCODE = '23514';
  END IF;
  UPDATE public.organisations SET status = 'active' WHERE id = app_private.current_org_id();
  UPDATE public.subscriptions SET status = 'active'
   WHERE org_id = app_private.current_org_id() AND status = 'trial';
  RETURN 'active';
END $$;

-- ===== 4. Mail outbox (written by api in the request transaction, drained by the worker as app_owner) =====
CREATE TABLE outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'email',
  recipient text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz,
  sent_at timestamptz
);
CREATE INDEX outbox_pending_idx ON outbox (created_at) WHERE status = 'pending';

-- ===== Ownership + grants (README rule) =====
ALTER TABLE outbox OWNER TO app_owner;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox FORCE ROW LEVEL SECURITY;
-- Insert-only for runtime roles (no SELECT: bodies contain invitation links). The worker connects as app_owner.
CREATE POLICY outbox_insert_user ON outbox FOR INSERT TO app_user
  WITH CHECK (app_private.is_org_member() AND app_private.org_writable());
CREATE POLICY outbox_insert_platform ON outbox FOR INSERT TO app_platform WITH CHECK (app_private.is_platform_admin());
CREATE POLICY outbox_owner_all ON outbox FOR ALL TO app_owner USING (true) WITH CHECK (true);
GRANT INSERT (kind, recipient, subject, body, payload) ON outbox TO app_user, app_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON outbox TO app_definer;

-- Restrictive write policies for tenant tables (AND-ed with the permissive ones above).
DO $$
DECLARE t text; cmd text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organisations','units','memberships','roles','role_permissions','unit_role_assignments',
    'invitations','notifications','conversations','conversation_members','messages','files','org_settings','records']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO app_user WITH CHECK (app_private.org_writable())', t || '_writable_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO app_user USING (app_private.org_writable()) WITH CHECK (app_private.org_writable())', t || '_writable_upd', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO app_user USING (app_private.org_writable())', t || '_writable_del', t);
  END LOOP;
END $$;

-- Function ownership / grants for the new app_private functions.
ALTER FUNCTION app_private.org_writable() OWNER TO app_definer;
ALTER FUNCTION app_private.activate_org() OWNER TO app_definer;
ALTER FUNCTION app_private.memberships_guard() OWNER TO app_definer;
ALTER FUNCTION app_private.accept_invitation(text, text, text) OWNER TO app_definer;
REVOKE ALL ON FUNCTION app_private.org_writable(), app_private.activate_org() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.org_writable(), app_private.activate_org() TO app_user, app_platform;
GRANT EXECUTE ON FUNCTION app_private.accept_invitation(text, text, text) TO app_user;
