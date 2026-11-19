# SaaS boilerplate

A multi-tenant SaaS starter: organisations ("tenants") with units (sites/branches), per-unit roles, records, chat,
audit log, billing/plans, and an operator (platform) console. Every row is protected by PostgreSQL row-level
security, so a bug in the API cannot leak data between organisations or units.

- **API**: NestJS (`apps/api`, port 4000, prefix `/api`, cookie session, WebSocket at `/ws`)
- **Web**: React + Vite + TanStack Router/Query + Tailwind (`apps/web`, proxies `/api` to the API)
- **Worker**: sends queued email from the outbox (`apps/worker`)
- **Database**: PostgreSQL 16 in Docker (`packages/db`: migrations, seed, RLS tests)

Design notes: `docs/superpowers/specs/2026-11-19-saas-boilerplate-design.md`.

## Prerequisites

- Node.js 22+
- pnpm (`corepack enable` or `npm i -g pnpm`)
- Docker (for PostgreSQL)

## First run

```sh
cp .env.example .env                 # dev-only values
docker compose up -d postgres      # PostgreSQL on 127.0.0.1:5442 (container base-postgres)
pnpm install
pnpm approve-builds                # only if pnpm reports ignored build scripts (argon2, esbuild); approve them
pnpm db:reset && pnpm db:seed      # drop/create the dev database, run migrations, load demo data

pnpm dev:api                       # http://localhost:4000/api
pnpm dev:web                       # http://localhost:5173 (Vite picks the next free port if 5173 is taken)
pnpm dev:worker                    # optional: delivers queued emails
```

`.env` (copy `.env.example` to `.env`; dev-only values, not committed) holds the database URLs and the session secret.
`db:reset` is destructive: it drops and recreates the `base` database. Use it only in development.
If you reset the database while the API is running, restart the API.

The web app talks to the real API by default. To run the UI without the API, set `VITE_USE_MOCK=true` in
`apps/web/.env` (an in-memory mock of the same API lives in `apps/web/src/mocks`).

In development the API returns `inviteToken` for invitations, and the web app shows the accept-invite link in a
toast (emails are only queued in the outbox).

## Demo logins

Password for every demo user: `Passw0rd!`

| Email | What they are | Try this |
|---|---|---|
| `owner@acme.test` | Owner of Acme Industries (active, Pro) | Everything: units, people, billing, audit, settings |
| `manager@acme.test` | Manager in North Branch only | Sees only North Branch records, no admin menu |
| `viewer@acme.test` | Viewer in all three branches | Read-only: no create/edit buttons |
| `owner@globex.test` | Owner of Globex Corp (trial) | Tenant isolation: sees none of Acme's data |
| `admin@platform.test` | Platform operator | Platform console: approve requests, create/suspend orgs, plans, audit |

Sign-up flow: `/sign-up` creates a request, the operator approves it (a first-admin invite link appears), the
admin opens the link, sets a password, and finishes the setup wizard.

## Folder map: where things go

| Path | Purpose |
|---|---|
| `apps/web/src/features/<module>/` | One folder per UI module (`routes.tsx`, `nav.ts`, pages). Register in `features/index.ts` |
| `apps/web/src/lib/api.ts`, `lib/types.ts` | The only place the web app calls the API; wire types |
| `apps/web/src/mocks/` | Optional offline mock of the API |
| `apps/api/src/modules/` | API controllers (records, org, billing, chat, platform, ...) |
| `apps/api/src/common/`, `auth/` | Guards, transaction-per-request, errors, sessions |
| `apps/api/test/` | End-to-end tests (resets and re-seeds the dev database) |
| `packages/contracts/` | Zod schemas for request bodies/queries shared by API and clients |
| `packages/permissions/` | Permission codes and default role templates (single source of truth) |
| `packages/config/` | Terminology, branding defaults, plan catalogue shown in the UI |
| `packages/db/migrations/` | SQL migrations (tables, RLS policies, grants). Never edit applied ones; add a new file |
| `packages/db/src/seed.mjs` | Demo data |
| `packages/db/test/` | RLS isolation tests |
| `docs/` | Specs and screenshots |

## Rename terminology and branding

- Product defaults: `packages/config/terminology.ts` (`overrides`) and `packages/config/branding.ts`.
  Example: set `record` to Trip and `unit` to Depot and the whole UI follows.
- Per organisation, at runtime: Settings > Terminology and Settings > Branding (stored in `org_settings`).
- Plans shown in the UI: `packages/config/plans.ts`. The `code` values must match the `plans` table (seeded in
  `packages/db/src/seed.mjs`).

## Add a module

Follow `apps/web/docs/ADDING_A_MODULE.md` (UI side). For the API side: add a controller in
`apps/api/src/modules/`, register it in `app.module.ts`, protect handlers with `@RequirePermission('x.y')`,
validate input with a Zod schema from `packages/contracts`, and add any new permission code to
`packages/permissions` (and the seed's role templates). If the module needs data, add a table (below).

## Add a table safely

Every tenant table must have `org_id`, RLS enabled and forced, and policies that tie rows to the current org
(and unit, if unit-scoped). Put it in a **new** migration file (`packages/db/migrations/00NN_<name>.sql`):

```sql
CREATE TABLE widgets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  unit_id    uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE widgets FORCE ROW LEVEL SECURITY;
CREATE POLICY widgets_select ON widgets FOR SELECT TO app_user
  USING (org_id = app_private.current_org_id() AND app_private.has_permission(unit_id, 'widget.read'));
-- same shape for INSERT (WITH CHECK), UPDATE, DELETE; copy the records policies in 0006_rls_policies.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON widgets TO app_user;
```

Copy the pattern of `records` in `0006_rls_policies.sql` and the grants in `0007_ownership_and_grants.sql`.
Then add an isolation test to `packages/db/test/isolation.test.ts`, using the hostile fixture (two orgs, an
outsider, unit-scoped roles):

```ts
it('widgets: other org and other unit are invisible', async () => {
  await fx.as(fx.u.aOwner, fx.A, async (c) => {
    expect((await c.query('SELECT 1 FROM widgets WHERE org_id = $1', [fx.B])).rowCount).toBe(0);
  });
  await fx.asRb(fx.u.aOwner, fx.A, async (c) => {
    expect((await c.query(`UPDATE widgets SET name = 'x' WHERE org_id = $1`, [fx.B])).rowCount).toBe(0);
  });
});
```

Also assert that a user with no role in the unit sees nothing and cannot insert. Run `pnpm db:test`.

## Checks

```sh
pnpm typecheck                     # all packages
pnpm db:test                       # RLS tests (resets nothing; uses its own fixture)
pnpm --filter @base/api test       # API e2e (RESETS and re-seeds the dev database)
pnpm --filter @base/web build
```

## Screenshots

See `docs/screenshots/`.
