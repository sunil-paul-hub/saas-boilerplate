# Adding a module

A module is a folder under `src/features/<name>/`. Records (`src/features/records`) is the worked example: copy it.

## 1. Create the folder

```
src/features/vehicles/
  nav.ts            menu entry (or several)
  routes.tsx        TanStack Router routes
  hooks.ts          TanStack Query hooks (calls src/lib/api.ts)
  vehicles-page.tsx the page(s)
```

## 2. Menu entry: `nav.ts`

```ts
import { Truck } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [{
  id: 'vehicles',
  label: (t) => t('vehicle.plural'),      // never hard-code a noun
  to: '/vehicles',
  icon: Truck,
  group: 'operations',                    // operations | organisation | other
  permission: 'vehicle.read',             // hidden from users without it
  order: 25,
  mobilePrimary: false,                   // true = bottom tab bar (max 4)
  sub: [{ label: 'Fleet', to: '/vehicles' }],   // optional header sub-tabs
}]
```

## 3. Routes: `routes.tsx`

```tsx
import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { VehiclesPage } from './vehicles-page'

// shell = inside sidebar + header (needs sign-in), bare = signed in, no shell, root = public
export const routes = ({ shell }: RouteCtx) => [
  createRoute({ getParentRoute: () => shell, path: '/vehicles', component: VehiclesPage }),
]
```

## 4. Permission gate

Wrap the page in `<RequirePermission permission="vehicle.read">` (renders the 403 view) and gate
buttons with `<Can permission="vehicle.create">` or `const can = useCan(); can('vehicle.update')`.
Permission codes come from the API (`/auth/me` returns `permissions[]` for the current unit). Add new codes to
`packages/permissions` and the database seed; the optional mock catalogue lives in `src/mocks/data.ts`.

## 5. Terminology keys

Every user-visible noun goes through `useTerm()`: `t('vehicle.plural')`, `t('vehicle.singular', { lower: true })`.
Add the key to `packages/config/terminology.ts` (`defaultTerms`), e.g. `vehicle: { singular: 'Vehicle', plural: 'Vehicles' }`.
Tenants can then rename it in Settings > Terminology (add the key there is automatic: the editor lists `defaultTerms`).

## 6. Data

Add typed calls to `src/lib/api.ts` (and types to `src/lib/types.ts`), then query hooks in `hooks.ts`
(`useQuery({ queryKey: ['vehicles', ...], queryFn: api.vehicles.list })`). Invalidate the key after mutations.
For local work without the API add handlers to `src/mocks/handler.ts` (enabled only when `VITE_USE_MOCK=true`).
Unit-scoped data should use a query key that is invalidated on unit switch (handled globally: every non-`me` query refetches).

## 7. Register

Append to `src/features/index.ts`:

```ts
import * as vehicles from './vehicles/routes'
import { nav as vehiclesNav } from './vehicles/nav'
// ...
{ id: 'vehicles', nav: vehiclesNav, routes: vehicles.routes },
```

## UI conventions

- Page title: `<PageHeader title=... description=... actions=... />`; empty and error states: `EmptyState`, `ErrorState`.
- Lists: table on desktop (`useIsMobile()` false), card list on phones, floating `+` button for the primary create action.
- Create/edit in a `Sheet`; confirmations in `ConfirmDialog`; toasts via `sonner`.
- Controls take height from `--ctl-h`; table rows use `row-h` so density (Compact/Comfortable) applies automatically.
