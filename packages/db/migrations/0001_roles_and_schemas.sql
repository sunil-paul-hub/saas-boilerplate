-- Roles are cluster-level: create if missing, always (re)set dev passwords.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
    CREATE ROLE app_owner LOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform') THEN
    CREATE ROLE app_platform LOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_definer') THEN
    CREATE ROLE app_definer NOLOGIN NOSUPERUSER BYPASSRLS;
  END IF;
END $$;

ALTER ROLE app_owner    WITH PASSWORD '{{OWNER_DB_PASSWORD}}' NOBYPASSRLS;
ALTER ROLE app_user     WITH PASSWORD '{{APP_DB_PASSWORD}}' NOBYPASSRLS;
ALTER ROLE app_platform WITH PASSWORD '{{PLATFORM_DB_PASSWORD}}' NOBYPASSRLS;

-- Lock down defaults.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO app_owner;
GRANT USAGE ON SCHEMA public TO app_user, app_platform, app_definer;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO app_user, app_platform, app_definer, app_owner;

DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_owner, app_user, app_platform', current_database());
  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database());
END $$;
