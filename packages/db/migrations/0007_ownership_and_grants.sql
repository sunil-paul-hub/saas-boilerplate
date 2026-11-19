-- Ownership: tables/types -> app_owner; app_private functions -> app_definer (BYPASSRLS, NOLOGIN).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO app_owner', r.tablename);
  END LOOP;
  FOR r IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public' AND t.typtype = 'e' LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO app_owner', r.typname);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'app_private' LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO app_definer', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
  END LOOP;
END $$;

-- The definer role reads/writes everything (it bypasses RLS; only reachable through the vetted functions).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_definer;
GRANT USAGE ON TYPE org_role, org_status, membership_status TO app_definer, app_user, app_platform;

-- Policy helpers + pre-session entry points are callable by the runtime roles.
GRANT EXECUTE ON FUNCTION
  app_private.current_org_id(), app_private.current_user_id(), app_private.current_unit_id(),
  app_private.is_platform_admin(), app_private.is_member_of(uuid), app_private.is_org_member(),
  app_private.is_org_admin(), app_private.has_permission(uuid, text), app_private.has_org_permission(text),
  app_private.can_see_unit(uuid), app_private.user_in_current_org(uuid), app_private.role_is_system(uuid),
  app_private.is_conversation_member(uuid), app_private.conversation_created_by_me(uuid)
  TO app_user, app_platform;
GRANT EXECUTE ON FUNCTION
  app_private.auth_lookup(text), app_private.submit_onboarding_request(text, text, text, jsonb),
  app_private.invitation_info(text), app_private.accept_invitation(text, text, text)
  TO app_user;

-- ===== app_user table privileges (RLS narrows rows; column grants hide secrets / freeze columns) =====
GRANT SELECT (id, email, name, is_active, created_at, updated_at) ON users TO app_user;
GRANT UPDATE (name, password_hash) ON users TO app_user;
GRANT SELECT ON permissions, plans TO app_user;
GRANT SELECT (id, name, slug, status, trial_ends_at, profile, created_at, updated_at) ON organisations TO app_user;
GRANT UPDATE (name, profile) ON organisations TO app_user;
GRANT SELECT, INSERT, DELETE ON units TO app_user;
GRANT UPDATE (name, code, is_active) ON units TO app_user;
GRANT SELECT, INSERT, DELETE ON memberships TO app_user;
GRANT UPDATE (org_role, status) ON memberships TO app_user;
GRANT SELECT, INSERT, DELETE ON roles TO app_user;
GRANT UPDATE (name, description) ON roles TO app_user;
GRANT SELECT, INSERT, DELETE ON role_permissions, unit_role_assignments TO app_user;
GRANT SELECT (id, org_id, email, org_role, unit_id, role_id, invited_by, expires_at, accepted_at, created_at) ON invitations TO app_user;
GRANT INSERT, DELETE ON invitations TO app_user;
GRANT SELECT ON subscriptions, invoices TO app_user;
GRANT SELECT, INSERT ON audit_events TO app_user;
GRANT SELECT, INSERT, DELETE ON notifications TO app_user;
GRANT UPDATE (read_at) ON notifications TO app_user;
GRANT SELECT, INSERT ON conversations, messages TO app_user;
GRANT SELECT, INSERT, DELETE ON conversation_members TO app_user;
GRANT SELECT, INSERT, DELETE ON files TO app_user;
GRANT UPDATE (name, unit_id) ON files TO app_user;
GRANT SELECT ON org_settings TO app_user;
GRANT UPDATE (terminology, branding) ON org_settings TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON records TO app_user;
-- No privileges at all for app_user on: platform_admins, onboarding_requests, default_role_permissions, schema_migrations.

-- ===== app_platform =====
GRANT SELECT (id, email, name, is_active, created_at, updated_at), INSERT, UPDATE (name, is_active, password_hash) ON users TO app_platform;
GRANT SELECT ON platform_admins, permissions, default_role_permissions TO app_platform;
GRANT SELECT, INSERT, UPDATE ON organisations, units, memberships, roles, org_settings, onboarding_requests, subscriptions, invoices, plans TO app_platform;
GRANT SELECT, INSERT, DELETE ON role_permissions, unit_role_assignments, invitations TO app_platform;
GRANT SELECT, INSERT ON audit_events TO app_platform;
REVOKE ALL ON public.schema_migrations FROM PUBLIC;
