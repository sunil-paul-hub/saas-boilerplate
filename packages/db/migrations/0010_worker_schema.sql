-- pg-boss (worker) creates its own "pgboss" schema using the owner connection.
DO $$ BEGIN EXECUTE format('GRANT CREATE ON DATABASE %I TO app_owner', current_database()); END $$;
