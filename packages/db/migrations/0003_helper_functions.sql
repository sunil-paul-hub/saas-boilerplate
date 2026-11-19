-- All helpers: SECURITY DEFINER (owned by app_definer, which bypasses RLS), search_path = ''.

CREATE FUNCTION app_private.current_org_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

CREATE FUNCTION app_private.current_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE FUNCTION app_private.current_unit_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT nullif(current_setting('app.unit_id', true), '')::uuid $$;

CREATE FUNCTION app_private.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT EXISTS (SELECT 1 FROM public.platform_admins pa
                  JOIN public.users u ON u.id = pa.user_id AND u.is_active
                  WHERE pa.user_id = app_private.current_user_id()) $$;

CREATE FUNCTION app_private.session_is_superuser() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT COALESCE((SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = session_user), false) $$;

-- Current user is an active member of the given org.
CREATE FUNCTION app_private.is_member_of(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT EXISTS (SELECT 1 FROM public.memberships m
                  JOIN public.users u ON u.id = m.user_id AND u.is_active
                  WHERE m.user_id = app_private.current_user_id()
                    AND m.org_id = p_org AND m.status = 'active') $$;

CREATE FUNCTION app_private.is_org_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT app_private.is_member_of(app_private.current_org_id()) $$;

CREATE FUNCTION app_private.is_org_owner(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT EXISTS (SELECT 1 FROM public.memberships m
                  WHERE m.user_id = app_private.current_user_id()
                    AND m.org_id = p_org AND m.status = 'active' AND m.org_role = 'owner') $$;

CREATE FUNCTION app_private.is_org_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT EXISTS (SELECT 1 FROM public.memberships m
                  JOIN public.users u ON u.id = m.user_id AND u.is_active
                  WHERE m.user_id = app_private.current_user_id()
                    AND m.org_id = app_private.current_org_id() AND m.status = 'active'
                    AND m.org_role IN ('owner','admin')) $$;

-- Permission in one unit: org owners/admins hold every permission in every unit of the org;
-- everyone else needs it through a unit_role_assignment on that exact unit.
CREATE FUNCTION app_private.has_permission(p_unit uuid, p_code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT EXISTS (
     SELECT 1
     FROM public.units un
     JOIN public.memberships m ON m.org_id = un.org_id AND m.user_id = app_private.current_user_id()
                              AND m.status = 'active'
     JOIN public.users u ON u.id = m.user_id AND u.is_active
     WHERE un.id = p_unit AND un.org_id = app_private.current_org_id()
       AND (m.org_role IN ('owner','admin')
            OR EXISTS (SELECT 1 FROM public.unit_role_assignments a
                       JOIN public.role_permissions rp ON rp.role_id = a.role_id AND rp.org_id = a.org_id
                       WHERE a.user_id = m.user_id AND a.unit_id = un.id AND a.org_id = un.org_id
                         AND rp.permission_code = p_code))) $$;

-- Org-wide permission: owners/admins always; others if any of their unit roles grants it.
CREATE FUNCTION app_private.has_org_permission(p_code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT EXISTS (
     SELECT 1
     FROM public.memberships m
     JOIN public.users u ON u.id = m.user_id AND u.is_active
     WHERE m.user_id = app_private.current_user_id()
       AND m.org_id = app_private.current_org_id() AND m.status = 'active'
       AND (m.org_role IN ('owner','admin')
            OR EXISTS (SELECT 1 FROM public.unit_role_assignments a
                       JOIN public.role_permissions rp ON rp.role_id = a.role_id AND rp.org_id = a.org_id
                       WHERE a.user_id = m.user_id AND a.org_id = m.org_id
                         AND rp.permission_code = p_code))) $$;

CREATE FUNCTION app_private.can_see_unit(p_unit uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT app_private.is_org_member() AND (
     app_private.is_org_admin()
     OR EXISTS (SELECT 1 FROM public.unit_role_assignments a
                WHERE a.user_id = app_private.current_user_id() AND a.unit_id = p_unit
                  AND a.org_id = app_private.current_org_id())) $$;

CREATE FUNCTION app_private.user_in_current_org(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT app_private.is_org_member() AND EXISTS (
     SELECT 1 FROM public.memberships m
     WHERE m.user_id = p_user AND m.org_id = app_private.current_org_id()) $$;

CREATE FUNCTION app_private.role_is_system(p_role uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT COALESCE((SELECT r.is_system FROM public.roles r
                    WHERE r.id = p_role AND r.org_id = app_private.current_org_id()), true) $$;

CREATE FUNCTION app_private.is_conversation_member(p_conv uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT EXISTS (SELECT 1 FROM public.conversation_members cm
                  WHERE cm.conversation_id = p_conv AND cm.user_id = app_private.current_user_id()
                    AND cm.org_id = app_private.current_org_id()) $$;

CREATE FUNCTION app_private.conversation_created_by_me(p_conv uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT EXISTS (SELECT 1 FROM public.conversations c
                  WHERE c.id = p_conv AND c.created_by = app_private.current_user_id()
                    AND c.org_id = app_private.current_org_id()) $$;

-- ---- Pre-session entry points (no tenant context exists yet) ----

CREATE FUNCTION app_private.auth_lookup(p_email text)
RETURNS TABLE (id uuid, name text, password_hash text, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT u.id, u.name, u.password_hash, u.is_active FROM public.users u WHERE lower(u.email) = lower(p_email) $$;

CREATE FUNCTION app_private.submit_onboarding_request(p_org_name text, p_contact_name text, p_contact_email text, p_details jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS
$$ INSERT INTO public.onboarding_requests (org_name, contact_name, contact_email, details)
   VALUES (p_org_name, p_contact_name, p_contact_email, COALESCE(p_details, '{}'::jsonb)) RETURNING id $$;

CREATE FUNCTION app_private.invitation_info(p_token_hash text)
RETURNS TABLE (org_name text, email text, org_role public.org_role, expires_at timestamptz, user_exists boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT o.name, i.email, i.org_role, i.expires_at,
          EXISTS (SELECT 1 FROM public.users u WHERE lower(u.email) = lower(i.email))
   FROM public.invitations i JOIN public.organisations o ON o.id = i.org_id
   WHERE i.token_hash = p_token_hash AND i.accepted_at IS NULL AND i.expires_at > now() $$;

-- Accept an invitation: creates the user (if new), the membership and the optional unit role.
CREATE FUNCTION app_private.accept_invitation(p_token_hash text, p_name text, p_password_hash text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS
$$
DECLARE inv public.invitations; uid uuid;
BEGIN
  SELECT * INTO inv FROM public.invitations
   WHERE token_hash = p_token_hash AND accepted_at IS NULL AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid or expired invitation' USING ERRCODE = '22023'; END IF;

  SELECT id INTO uid FROM public.users WHERE lower(email) = lower(inv.email);
  IF uid IS NULL THEN
    INSERT INTO public.users (email, name, password_hash) VALUES (inv.email, p_name, p_password_hash) RETURNING id INTO uid;
  END IF;

  INSERT INTO public.memberships (user_id, org_id, org_role) VALUES (uid, inv.org_id, inv.org_role)
  ON CONFLICT (user_id, org_id) DO NOTHING;

  IF inv.unit_id IS NOT NULL AND inv.role_id IS NOT NULL THEN
    INSERT INTO public.unit_role_assignments (org_id, user_id, unit_id, role_id)
    VALUES (inv.org_id, uid, inv.unit_id, inv.role_id) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;
  RETURN uid;
END $$;
