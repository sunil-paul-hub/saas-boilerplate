import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { modules } from '@/features'
import { meQuery } from './session'
import { AppShell } from './shell'
import { ForbiddenPage, MaintenancePage, NotFoundPage, ServerErrorPage } from './errors'
import type { RouteCtx } from './module'

const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error, reset }) => <ServerErrorPage error={error} reset={reset} />,
})

async function requireSession(ctx: { context: { queryClient: QueryClient }; location: { pathname: string; href: string } }) {
  const me = await ctx.context.queryClient.ensureQueryData(meQuery)
  if (!me) throw redirect({ to: '/sign-in', search: { redirect: ctx.location.pathname === '/' ? undefined : ctx.location.href } as never })
  return me
}

const shell = createRoute({
  getParentRoute: () => root,
  id: 'shell',
  component: AppShell,
  notFoundComponent: NotFoundPage,
  beforeLoad: async (ctx) => {
    const me = await requireSession(ctx)
    const path = ctx.location.pathname
    if (me.isPlatformAdmin && !me.org && !path.startsWith('/platform') && path !== '/help') throw redirect({ to: '/platform' })
    if (me.org && !me.org.setupComplete && ['owner', 'admin'].includes(me.orgRole)) throw redirect({ to: '/onboarding/setup' })
  },
})
const bare = createRoute({
  getParentRoute: () => root, id: 'bare', component: Outlet,
  beforeLoad: async (ctx) => { await requireSession(ctx) },
})

const ctx: RouteCtx = { root, shell, bare }
const extra = [
  createRoute({ getParentRoute: () => root, path: '/403', component: ForbiddenPage }),
  createRoute({ getParentRoute: () => root, path: '/500', component: () => <ServerErrorPage /> }),
  createRoute({ getParentRoute: () => root, path: '/maintenance', component: MaintenancePage }),
]

const all = modules.flatMap((m) => m.routes(ctx))
const childrenOf = (p: unknown) => all.filter((r) => r.options.getParentRoute() === p)

const tree = root.addChildren([
  ...childrenOf(root),
  shell.addChildren(childrenOf(shell)),
  bare.addChildren(childrenOf(bare)),
  ...extra,
])

export const router = createRouter({ routeTree: tree, context: { queryClient: undefined! }, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
