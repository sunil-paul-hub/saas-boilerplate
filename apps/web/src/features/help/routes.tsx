import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { HelpPage } from './help-page'

export const routes = ({ shell }: RouteCtx) => [createRoute({ getParentRoute: () => shell, path: '/help', component: HelpPage })]
