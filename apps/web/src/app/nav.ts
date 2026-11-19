import { modules } from '@/features'
import type { NavItem, NavGroup } from './module'

let cache: NavItem[] | null = null
/** Lazy so feature modules and the shell can import each other without import-order problems. */
export function getAllNav(): NavItem[] {
  return (cache ??= modules.flatMap((m) => m.nav).sort((a, b) => (a.order ?? 50) - (b.order ?? 50)))
}

export const groupLabels: Record<NavGroup, string> = { operations: 'Operations', organisation: 'Organisation', other: 'Other' }

export function isActivePath(pathname: string, to: string) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(to + '/')
}
