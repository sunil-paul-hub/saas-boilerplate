import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { SetupWizard } from './wizard'

export const routes = ({ bare }: RouteCtx) => [createRoute({ getParentRoute: () => bare, path: '/onboarding/setup', component: SetupWizard })]
