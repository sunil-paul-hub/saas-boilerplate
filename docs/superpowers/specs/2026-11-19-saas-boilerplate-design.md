# SaaS boilerplate: design (v1)

Private, reusable, industry-neutral multi-tenant SaaS base. Forked per product (transport, hotels, schools, ...). Built and reviewed locally first.

## Intent
Everything a SaaS needs except the industry: organisations onboarded by two routes, per-unit roles enforced in the database, a platform console for the operator, billing, audit, notifications, chat, settings, renaming and branding. Industry modules are added later on top, using one worked example module.

## Goals
- Tenant isolation and RBAC enforced **in PostgreSQL** (RLS), not only in app code. Runs on any plain PostgreSQL 16; no vendor-specific services.
- Industry-neutral code and names (`org`, `unit`, `record`). Visible words come from a terminology file.
- Rich, compact, mobile-friendly UI in the shadcn-admin style, plain white, dark mode toggle.
- Clear module locations so product teams know where things go.

## Non-goals (v1)
Industry features; real payment-provider integrations (interface plus a `manual` provider only; Razorpay/Stripe/GST plug-ins are next); native mobile apps; AI assistant and support chat (team chat only).

## Approach (chosen)
Monorepo, three apps: NestJS API, React web (Vite, TanStack Router, shadcn/ui, Tailwind), pg-boss worker. Rejected: one Next.js app (poor fit for mobile/API reuse), self-hosted Supabase (heavy, vendor-tied).

```
apps/api        NestJS: every request runs in one DB transaction that sets app.user_id/org_id/unit_id
apps/web        React SPA: app shell, pages, features/*
apps/worker     pg-boss jobs: email, webhooks, retention
packages/db     Drizzle schema, SQL migrations (incl. RLS), seed, isolation tests
packages/contracts   zod schemas shared by api+web
packages/permissions permission catalogue + role defaults
packages/config      terminology.ts, branding.ts, plans.ts (per product)
```

## Data model (core)
users, organisations (status: pending|trial|active|past_due|suspended|archived, rejected), units (flat list per org), memberships (user in org; org_role: owner|admin|member|none), roles (per org, name, system flag), role_permissions, unit_role_assignments (user, unit, role), permissions catalogue (code, label), onboarding_requests, invitations, plans, subscriptions, invoices, audit_events (append-only), notifications, conversations, conversation_members, messages, files, org_settings (terminology overrides, branding), platform_admins, records (worked example: title, status, unit_id).
Every tenant table has `org_id`; unit-scoped tables also `unit_id`.

## Database enforcement
- Roles: `app_owner` (migrations), `app_user` (runtime, NOBYPASSRLS), `FORCE ROW LEVEL SECURITY` on every tenant table.
- Policies key on `current_setting('app.org_id')` and `app.user_id`; unit-scoped writes/reads also require `app_private.has_permission(unit_id, 'code')`. Helpers are SECURITY DEFINER with `search_path = ''`.
- `audit_events` has INSERT-only for the app role. Last-owner and role-escalation rules (only an owner can grant `owner`) are triggers.
- Platform operations use a separate `app_platform` role.
- Test suite: hostile fixture (several orgs, overlapping users, one outsider) proving cross-org and cross-unit reads/writes fail, incl. joins; a template for testing each new table.

## Onboarding
Route 1 self-serve: public form creates a `pending` organisation request; operator approves/rejects in the console. Route 2: operator creates org + first admin (invite). Then the setup wizard (profile, first unit, invite team, plan) makes it `active`. Per-product switches in `config/plans.ts`: self-serve allowed, approval required, trial days.

## API contract (v1, JSON, httpOnly cookie session, base `/api`)
Auth: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` (user, memberships, current org, units, currentUnitId, permissions[], isPlatformAdmin), `POST /auth/switch {orgId, unitId?}`, `POST /auth/accept-invite`.
Onboarding: `POST /onboarding/requests` (public).
Org: `GET/PATCH /org`, `GET/POST/PATCH /units`, `GET /members`, `POST /members/invite`, `PUT /members/:id/unit-roles`, `GET/POST/PATCH /roles`, `GET /permissions`.
Records (example module): `GET/POST /records`, `GET/PATCH/DELETE /records/:id` (filter by status, search, cursor paging).
Other: `GET /audit`, `GET /notifications`, `POST /notifications/read`, `GET /chat/conversations`, `GET/POST /chat/conversations/:id/messages` (+ WebSocket `/ws` for live), `GET /billing/plan`, `GET /billing/invoices`, `GET/PATCH /settings/terminology`, `GET/PATCH /settings/branding`, `GET /files`, `POST /files`.
Platform (platform admins only): `GET /platform/orgs`, `POST /platform/orgs`, `POST /platform/orgs/:id/{approve|reject|suspend|reactivate}`, `GET /platform/requests`, `PATCH /platform/orgs/:id/plan`, `POST /platform/orgs/:id/view-as` (audited).
Errors: `{ error: { code, message } }`; lists: `{ items, nextCursor }`.

## Web UI
Sidebar shell: org switcher on top, grouped menu (Operations = product modules, Organisation = core pages, Other), user card at bottom. Header: sidebar toggle, unit switcher, Ctrl K command search, chat icon (drawer), notifications, theme toggle, settings, avatar. Compact density default (13px body), Comfortable switch in user settings; mobile 15-16px with bottom tab bar, card lists instead of tables, floating action button. Pages: Dashboard, Records (data table with filters, view options, row actions, pagination), Chats, Units, People and roles, Billing and plan, Audit log, Settings (profile, organisation, terminology, branding, appearance), Help, Sign in, Sign up (request), Accept invite, Setup wizard, error pages, Platform console (organisations, requests, plans, audit). Every user-visible noun comes from `config/terminology.ts` through a `t()` helper. Module location: `apps/web/src/features/<module>/` with `routes.tsx` and `nav.ts`; new modules register in `features/index.ts`.

## Build phases
1. **Local review build (now):** all above running locally with seeded demo data; billing = `manual` provider; chat via polling + simple WebSocket.
2. Billing plug-ins (Razorpay, Stripe), GST tax plug-in, email/SMS providers.
3. Hardening: security review, more DB tests, deployment recipe.

## Left to builders
Exact component composition, seed names, styling details, test layout. Choices made by me (not yet agreed): own minimal email+password auth (argon2) behind an interface instead of an auth library; flat units (no tree); pg-boss for jobs.
