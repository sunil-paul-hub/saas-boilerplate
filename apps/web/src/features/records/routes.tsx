import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { RecordsPage } from './records-page'

export const routes = ({ shell }: RouteCtx) => [
  createRoute({
    getParentRoute: () => shell, path: '/records', component: RecordsPage,
    validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === 'string' ? s.q : undefined, new: s.new === true || s.new === 'true' ? true : undefined }),
  }),
]
