import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { UnitsPage } from './units-page'

export const routes = ({ shell }: RouteCtx) => [createRoute({ getParentRoute: () => shell, path: '/units', component: UnitsPage })]
