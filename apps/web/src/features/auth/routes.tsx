import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { AcceptInvitePage, SignInPage, SignUpPage } from './pages'

const searchStr = (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === 'string' ? s.redirect : undefined, token: typeof s.token === 'string' ? s.token : undefined })

export const routes = ({ root }: RouteCtx) => [
  createRoute({ getParentRoute: () => root, path: '/sign-in', component: SignInPage, validateSearch: searchStr }),
  createRoute({ getParentRoute: () => root, path: '/sign-up', component: SignUpPage }),
  createRoute({ getParentRoute: () => root, path: '/accept-invite', component: AcceptInvitePage, validateSearch: searchStr }),
]
