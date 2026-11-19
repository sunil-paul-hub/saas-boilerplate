import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { BillingPage } from './billing-page'

export const routes = ({ shell }: RouteCtx) => [createRoute({ getParentRoute: () => shell, path: '/billing', component: BillingPage })]
