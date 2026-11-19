import { createRoute, redirect } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { PlatformAuditPage, PlatformLayout, PlatformOrgsPage, PlatformPlansPage, PlatformRequestsPage } from './pages'

export const routes = ({ shell }: RouteCtx) => {
  const layout = createRoute({ getParentRoute: () => shell, path: '/platform', component: PlatformLayout })
  return [
    layout.addChildren([
      createRoute({ getParentRoute: () => layout, path: '/', beforeLoad: () => { throw redirect({ to: '/platform/orgs' }) } }),
      createRoute({ getParentRoute: () => layout, path: '/orgs', component: PlatformOrgsPage }),
      createRoute({ getParentRoute: () => layout, path: '/requests', component: PlatformRequestsPage }),
      createRoute({ getParentRoute: () => layout, path: '/plans', component: PlatformPlansPage }),
      createRoute({ getParentRoute: () => layout, path: '/audit', component: PlatformAuditPage }),
    ]),
  ]
}
