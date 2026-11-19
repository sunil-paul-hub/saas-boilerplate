# @base/db

SQL migrations (source of truth), seed, RLS isolation tests, and `withTenant`.

    pnpm --filter @base/db migrate   # applies migrations/*.sql in order as ADMIN_DATABASE_URL (superuser), tracked in schema_migrations
    pnpm --filter @base/db seed      # idempotent demo data (password for all demo users: Passw0rd!)
    pnpm --filter @base/db test      # hostile-fixture isolation tests, connects as app_user / app_platform
    pnpm --filter @base/db reset     # dev only: DROP + CREATE database "base", then migrate (run seed afterwards)

Manual reset: `DROP DATABASE base WITH (FORCE); CREATE DATABASE base;` on the `postgres` database, then migrate + seed.
Roles are cluster-level and survive a reset (migration 0001 re-sets their passwords from .env).

New migrations: add `NNNN_name.sql`; they run as superuser, so end each with ownership/grants for new tables
(tables -> app_owner, app_private functions -> app_definer, ENABLE + FORCE RLS, explicit grants to app_user/app_platform).
Applied files are checksummed; never edit one after it has run.
