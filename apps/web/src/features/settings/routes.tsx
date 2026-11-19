import { createRoute, redirect } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { AppearancePage, BrandingPage, OrganisationPage, ProfilePage, SettingsLayout, TerminologyPage } from './pages'

export const routes = ({ shell }: RouteCtx) => {
  const layout = createRoute({ getParentRoute: () => shell, path: '/settings', component: SettingsLayout })
  return [
    layout.addChildren([
      createRoute({ getParentRoute: () => layout, path: '/', beforeLoad: () => { throw redirect({ to: '/settings/profile' }) } }),
      createRoute({ getParentRoute: () => layout, path: '/profile', component: ProfilePage }),
      createRoute({ getParentRoute: () => layout, path: '/organisation', component: OrganisationPage }),
      createRoute({ getParentRoute: () => layout, path: '/terminology', component: TerminologyPage }),
      createRoute({ getParentRoute: () => layout, path: '/branding', component: BrandingPage }),
      createRoute({ getParentRoute: () => layout, path: '/appearance', component: AppearancePage }),
    ]),
  ]
}
