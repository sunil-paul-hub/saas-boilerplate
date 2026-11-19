CREATE FUNCTION app_private.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS
$$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION app_private.touch_updated_at();
CREATE TRIGGER trg_touch BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION app_private.touch_updated_at();
CREATE TRIGGER trg_touch BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION app_private.touch_updated_at();
CREATE TRIGGER trg_touch BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION app_private.touch_updated_at();
CREATE TRIGGER trg_touch BEFORE UPDATE ON records FOR EACH ROW EXECUTE FUNCTION app_private.touch_updated_at();
CREATE TRIGGER trg_touch BEFORE UPDATE ON org_settings FOR EACH ROW EXECUTE FUNCTION app_private.touch_updated_at();

-- Memberships: immutability, owner grants, last-owner protection.
CREATE FUNCTION app_private.memberships_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS
$$
DECLARE privileged boolean; other_owners int; org_exists boolean;
BEGIN
  privileged := app_private.session_is_superuser() OR app_private.is_platform_admin();

  IF TG_OP = 'UPDATE' THEN
    IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'membership org_id and user_id are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Granting owner: only an existing owner of that org (or the platform operator).
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.org_role = 'owner'
     AND (TG_OP = 'INSERT' OR OLD.org_role <> 'owner') THEN
    IF NOT (privileged OR app_private.is_org_owner(NEW.org_id)) THEN
      RAISE EXCEPTION 'only an owner may grant the owner role' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Demoting / suspending / removing an owner: only an owner (or the platform), and never the last one.
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

CREATE TRIGGER trg_memberships_guard BEFORE INSERT OR UPDATE OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION app_private.memberships_guard();

-- Plan limits. No subscription => unlimited (operator-created orgs before a plan is set).
CREATE FUNCTION app_private.plan_limit(p_org uuid, p_kind text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
$$ SELECT CASE p_kind WHEN 'units' THEN p.max_units ELSE p.max_members END
   FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
   WHERE s.org_id = p_org AND s.status IN ('trial','active','past_due')
   ORDER BY s.created_at DESC LIMIT 1 $$;

CREATE FUNCTION app_private.enforce_max_units() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS
$$
DECLARE lim int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('limits:' || NEW.org_id::text, 0));
  lim := app_private.plan_limit(NEW.org_id, 'units');
  IF lim IS NOT NULL AND (SELECT count(*) FROM public.units WHERE org_id = NEW.org_id) >= lim THEN
    RAISE EXCEPTION 'plan limit reached: max_units = %', lim USING ERRCODE = '53400';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_max_units BEFORE INSERT ON units FOR EACH ROW EXECUTE FUNCTION app_private.enforce_max_units();

CREATE FUNCTION app_private.enforce_max_members() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS
$$
DECLARE lim int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('limits:' || NEW.org_id::text, 0));
  lim := app_private.plan_limit(NEW.org_id, 'members');
  IF lim IS NOT NULL AND (SELECT count(*) FROM public.memberships WHERE org_id = NEW.org_id) >= lim THEN
    RAISE EXCEPTION 'plan limit reached: max_members = %', lim USING ERRCODE = '53400';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_max_members BEFORE INSERT ON memberships FOR EACH ROW EXECUTE FUNCTION app_private.enforce_max_members();

-- Audit log is append-only for everyone (owner included).
CREATE FUNCTION app_private.audit_append_only() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS
$$ BEGIN RAISE EXCEPTION 'audit_events is append-only' USING ERRCODE = '42501'; END $$;
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION app_private.audit_append_only();
CREATE TRIGGER trg_audit_no_truncate BEFORE TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION app_private.audit_append_only();

-- New organisation: system roles (from default_role_permissions) + settings row.
CREATE FUNCTION app_private.org_bootstrap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS
$$
DECLARE r text; rid uuid;
BEGIN
  FOR r IN SELECT DISTINCT role_name FROM public.default_role_permissions LOOP
    INSERT INTO public.roles (org_id, name, is_system) VALUES (NEW.id, r, true) RETURNING id INTO rid;
    INSERT INTO public.role_permissions (role_id, org_id, permission_code)
      SELECT rid, NEW.id, permission_code FROM public.default_role_permissions WHERE role_name = r;
  END LOOP;
  INSERT INTO public.org_settings (org_id) VALUES (NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_org_bootstrap AFTER INSERT ON organisations FOR EACH ROW EXECUTE FUNCTION app_private.org_bootstrap();
