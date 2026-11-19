import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { PeoplePage } from './people-page'

export const routes = ({ shell }: RouteCtx) => [createRoute({ getParentRoute: () => shell, path: '/people', component: PeoplePage })]
