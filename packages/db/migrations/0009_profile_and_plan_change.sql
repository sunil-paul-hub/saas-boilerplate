-- Profile phone + tenant-initiated plan change (billing.manage) through a vetted DB function.
ALTER TABLE users ADD COLUMN phone text;
GRANT SELECT (phone), UPDATE (phone) ON users TO app_user;
GRANT UPDATE (phone) ON users TO app_platform;

CREATE FUNCTION app_private.change_plan(p_code text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS
$$
DECLARE pid uuid; sid uuid; st text;
BEGIN
  IF NOT app_private.has_org_permission('billing.manage') OR NOT app_private.org_writable() THEN
    RAISE EXCEPTION 'billing.manage permission required' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO pid FROM public.plans WHERE code = p_code AND is_active;
  IF pid IS NULL THEN RAISE EXCEPTION 'unknown plan' USING ERRCODE = '22023'; END IF;
  SELECT CASE WHEN status = 'trial' THEN 'trial' ELSE 'active' END INTO st
    FROM public.organisations WHERE id = app_private.current_org_id();
  UPDATE public.subscriptions SET status = 'cancelled' WHERE org_id = app_private.current_org_id() AND status <> 'cancelled';
  INSERT INTO public.subscriptions (org_id, plan_id, status, provider)
    VALUES (app_private.current_org_id(), pid, st, 'manual') RETURNING id INTO sid;
  RETURN sid;
END $$;
ALTER FUNCTION app_private.change_plan(text) OWNER TO app_definer;
REVOKE ALL ON FUNCTION app_private.change_plan(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.change_plan(text) TO app_user;
