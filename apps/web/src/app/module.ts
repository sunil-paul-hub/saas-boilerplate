import type { AnyRoute } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import type { TermPath } from '@base/config'

export type NavGroup = 'operations' | 'organisation' | 'other'
export type TFn = (path: TermPath, opts?: { lower?: boolean }) => string

export type NavItem = {
  id: string
  /** Receives t() so labels come from terminology. */
  label: (t: TFn) => string
  to: string
  icon: LucideIcon
  group: NavGroup
  /** Item is hidden when the user lacks this permission. */
  permission?: string
  order?: number
  /** Show in the mobile bottom bar (first four by order win; the rest go under More). */
  mobilePrimary?: boolean
  /** Extra search words for the command palette. */
  keywords?: string[]
  /** Section tabs shown in the header while this module is active. */
  sub?: { label: string; to: string; permission?: string }[]
}

export type RouteCtx = {
  /** Unauthenticated pages (sign in, sign up, accept invite). */
  root: AnyRoute
  /** Authenticated pages inside the app shell (sidebar + header). */
  shell: AnyRoute
  /** Authenticated pages without the shell (setup wizard). */
  bare: AnyRoute
}

export type FeatureModule = {
  id: string
  nav: NavItem[]
  routes: (ctx: RouteCtx) => AnyRoute[]
}
