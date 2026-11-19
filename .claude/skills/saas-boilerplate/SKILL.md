---
name: saas-boilerplate
description: Explains and guides work in this industry-neutral multi-tenant SaaS boilerplate (organisations, units, per-unit roles enforced by PostgreSQL RLS, NestJS API, React web, worker). Use when starting a new product from it, adding a module, table, permission or API endpoint, renaming terminology/branding, working on onboarding, billing, the platform console, or running/testing it locally.
---

# SaaS boilerplate

A reusable base for vertical SaaS products (transport, hotels, schools, ...). It contains **no industry logic**: only multi-tenancy, database-enforced roles and permissions, and the supporting SaaS features. Industry modules are added on top. Product names and nouns come from config, never from code.

Controlling docs: `docs/superpowers/specs/2026-11-19-saas-boilerplate-design.md` (design), `README.md` (run, folder map, recipes), `apps/web/docs/ADDING_A_MODULE.md`, `packages/db/README.md`.

## The model in one minute

- **Organisation** (tenant) has **units** (a flat list: branch, property, campus...). A user has an account once and can belong to several organisations.
- **Roles are per unit.** `unit_role_assignments` ties (user, unit, role). A role is a named set of permission codes. Org owners and admins hold every permission in every unit. Other members need a unit role.
- **The database enforces it.** Every tenant table has `org_id` (and `unit_id` if unit-scoped), `ENABLE` + `FORCE ROW LEVEL SECURITY`, and policies keyed on `app.org_id` / `app.user_id` that call hardened `app_private` functions (`has_permission`, `has_org_permission`, ...). The API cannot leak across tenants even if a handler forgets a filter.
- **Roles:** `app_owner` (owns objects; migrations hand ownership to it), `app_user` (runtime, NOBYPASSRLS), `app_platform` (operator console, platform-admin only), `app_definer` (NOLOGIN, owns the SECURITY DEFINER helpers). Migrations run as the superuser from `ADMIN_DATABASE_URL`.
- **Org lifecycle:** pending -> trial -> active -> past_due -> suspended -> archived (or rejected). Suspended orgs are read-only (enforced in the DB). `app_user` cannot change org status or subscriptions: those go through DB functions (`activate_org`, `change_plan`) or the platform role.
- **Onboarding, two routes:** self-serve request (`POST /onboarding/requests`) approved by the operator, or operator-created org with an invited first owner. Both end in the setup wizard (`POST /onboarding/complete`) which makes the org active.

## Request flow

Browser -> Vite proxy `/api` -> NestJS (cookie session) -> **one transaction per request** via `withTenant` (sets `app.user_id`, `app.org_id`, `app.unit_id` with `set_config(..., true)`) -> Postgres RLS. Permission guard `@RequirePermission('x.y')` gives clean 403s; DB errors (42501, trigger/check errors) map to 403/409/422. Platform routes use the separate platform connection and require a platform admin. Mutations write `audit_events` (append-only).

## Where things live

| Need | Location |
|---|---|
| New UI module | `apps/web/src/features/<module>/` (`nav.ts`, `routes.tsx`, hooks, pages), register in `features/index.ts` |
| Web API calls and wire types | `apps/web/src/lib/api.ts`, `lib/types.ts` (only place that calls the API) |
| API endpoints | `apps/api/src/modules/*.controller.ts`, register in `app.module.ts` |
| Request validation | `packages/contracts` (zod) |
| Permission codes, default roles | `packages/permissions/src/index.ts` (single source of truth) |
| Terminology, branding, plans | `packages/config/` (`terminology.ts`, `branding.ts`, `plans.ts`) |
| Tables, RLS, grants | `packages/db/migrations/NNNN_name.sql` (new file; never edit applied ones) |
| Demo data | `packages/db/src/seed.mjs` |
| Tenancy tests | `packages/db/test/isolation.test.ts` (hostile fixture) |
| API tests | `apps/api/test/e2e.test.ts` |
| Background jobs, email | `apps/worker` (pg-boss; API writes an `outbox` row, worker sends) |
| Billing | `apps/api/src/billing/` (`BillingProvider` interface, `manual` provider) |

## Rules to keep it well-defined

1. **Never bypass RLS.** No superuser or `app_owner` connection at runtime; no `BYPASSRLS` roles in the app path. Platform actions use `app_platform`.
2. **New table = new migration** with `org_id`, ENABLE + FORCE RLS, policies for every operation (USING and WITH CHECK), explicit grants, ownership hand-off (tables -> `app_owner`, `app_private` functions -> `app_definer`, `search_path = ''` on definer functions), **and an isolation test** in the same change. Copy `records` in `0006_rls_policies.sql` / `0007_ownership_and_grants.sql`.
3. **New permission** = add the code in `packages/permissions`, assign it to default roles, update the seed, gate the endpoint (`@RequirePermission`) and the UI (`permission:` in `nav.ts`, button visibility). The database policy is still the real check.
4. **No hard-coded nouns** in the UI: use `t('unit.plural')` / `useTerm()`. Product vocabulary goes in `packages/config/terminology.ts`; organisations can override at runtime (Settings > Terminology).
5. **Keep it industry-neutral.** Industry concepts (LR, rooms, classes) belong in the product built on top, as new modules, not in the core tables.
6. **One entry point for the web app:** all HTTP goes through `lib/api.ts`; hooks use TanStack Query.
7. **Plans are data**: `plans` table plus `packages/config/plans.ts` (codes must match). Per-product switches: self-serve allowed, approval required, trial days.

## Commands

```sh
docker compose up -d postgres            # PostgreSQL 16 on 127.0.0.1:5442
pnpm install                             # pnpm approve-builds if argon2/esbuild are ignored
cp .env.example .env                     # dev-only values (the .env file is not committed)
pnpm db:reset && pnpm db:seed            # DESTRUCTIVE: drops/recreates dev DB "base"; restart the API afterwards
pnpm dev:api    # :4000/api            pnpm dev:web    # :5173 (VITE_USE_MOCK=true runs without the API)
pnpm dev:worker # delivers queued email (dev: console + dev-mailbox.log)
pnpm typecheck && pnpm db:test && pnpm --filter @base/api test   # api tests reset+reseed the dev DB
```

Demo logins (password `Passw0rd!`): `owner@acme.test`, `manager@acme.test` (North Branch only), `viewer@acme.test`, `owner@globex.test` (trial, setup wizard), `admin@platform.test` (platform console).

## Starting a new product from this base

1. Clone or use as template; rename in `packages/config/branding.ts` (product name, logo, accent, support email).
2. Set vocabulary in `packages/config/terminology.ts` (e.g. unit -> Branch/Property/Campus; record -> your main noun).
3. Define the plan catalogue and onboarding switches in `packages/config/plans.ts` and the seed.
4. Add industry modules one at a time using the recipes above (UI module + controller + migration with RLS + isolation test).
5. Keep the core folders (`packages/db` policies, `apps/api/src/common`) free of product-specific code so base updates can be merged.

## Not built yet (do not assume it exists)

Razorpay/Stripe providers and billing webhook route, GST/tax plug-in, real email/SMS providers (dev logs only), AI assistant and support chat (team chat only; polling, WebSocket gateway exists), file magic-byte checks, in-memory rate limiter is single-instance, per-org branding replaces the whole object on save, no way to start a new chat conversation in the UI, no UI tests. Self-hosted production recipe and security review are phase 3.

## Gotchas

- The API dev server dies if the database is reset underneath it.
- `app_user` cannot write subscriptions or org status; use `change_plan()` / `activate_org()` or the platform role.
- Seeded Acme terminology must use `{ unit: { singular, plural } }`.
- Record status values are `open | in_progress | done | archived`.
