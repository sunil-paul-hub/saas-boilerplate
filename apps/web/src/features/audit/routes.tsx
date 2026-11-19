import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { AuditPage } from './audit-page'

export const routes = ({ shell }: RouteCtx) => [createRoute({ getParentRoute: () => shell, path: '/audit', component: AuditPage })]
