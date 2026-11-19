import { createRoute } from '@tanstack/react-router'
import type { RouteCtx } from '@/app/module'
import { ChatPage } from './chat-page'

export const routes = ({ shell }: RouteCtx) => [
  createRoute({ getParentRoute: () => shell, path: '/chat', component: ChatPage, validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === 'string' ? s.c : undefined }) }),
]
