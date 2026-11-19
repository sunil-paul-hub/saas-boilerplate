import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { DashboardPage } from './dashboard-page'

export const routes = ({ shell }: RouteCtx) => [createRoute({ getParentRoute: () => shell, path: '/', component: DashboardPage })]
