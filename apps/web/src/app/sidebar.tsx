import * as React from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Check, ChevronsUpDown, LogOut, Plus, Settings } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { meQuery, useCan, useLogout, useMe, useSwitchOrg } from './session'
import { useBranding, useTerm } from './terms'
import { getAllNav, groupLabels, isActivePath } from './nav'
import type { NavGroup, NavItem } from './module'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useVisibleNav(): NavItem[] {
  const can = useCan()
  const { data } = useQuery(meQuery)
  // A platform operator without an organisation only sees platform pages.
  if (data && !data.org) return getAllNav().filter((i) => i.permission === 'platform.admin')
  return getAllNav().filter((i) => can(i.permission))
}

export function LogoTile({ className }: { className?: string }) {
  const b = useBranding()
  return (
    <div className={cn('flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-bold text-primary-foreground', className)} aria-hidden>
      {b.logoUrl ? <img src={b.logoUrl} alt="" className="size-full object-cover" /> : b.logoMark}
    </div>
  )
}

function OrgSwitcher() {
  const me = useMe()
  const t = useTerm()
  const switchOrg = useSwitchOrg()
  const b = useBranding()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg p-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
        <LogoTile />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{me.org?.name ?? b.productName}</div>
          <div className="truncate text-xs text-muted-foreground">{b.productName}</div>
        </div>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t('organisation.plural')}</DropdownMenuLabel>
        {me.memberships.map((m) => (
          <DropdownMenuItem key={m.orgId} onSelect={() => m.orgId !== me.org?.id && switchOrg.mutate(m.orgId)}>
            <span className="flex size-6 items-center justify-center rounded-md border bg-muted text-xs font-semibold">{m.orgName[0]}</span>
            <span className="flex-1 truncate">{m.orgName}</span>
            {m.orgId === me.org?.id && <Check />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/sign-up"><Plus />Request another {t('organisation.singular', { lower: true })}</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MenuLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const t = useTerm()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = isActivePath(pathname, item.to)
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn('flex min-h-[calc(var(--ctl-h)-2px)] items-center gap-2.5 rounded-md px-2 text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring', active && 'bg-sidebar-accent font-semibold text-foreground')}
    >
      <item.icon className="size-4 shrink-0" />
      <span className="truncate">{item.label(t)}</span>
    </Link>
  )
}

function UserCard() {
  const me = useMe()
  const logout = useLogout()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg p-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-[30px] rounded-lg"><AvatarFallback className="rounded-lg">{initials(me.user.name)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{me.user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{me.user.email}</div>
        </div>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuItem asChild><Link to="/settings/profile"><Settings />Account settings</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const items = useVisibleNav()
  const groups: NavGroup[] = ['operations', 'organisation', 'other']
  return (
    <div className="flex h-full flex-col bg-sidebar p-2">
      <OrgSwitcher />
      <nav aria-label="Main" className="mt-1 flex-1 overflow-y-auto">
        {groups.map((g) => {
          const list = items.filter((i) => i.group === g)
          if (!list.length) return null
          return (
            <div key={g}>
              <div className="px-2 pt-4 pb-1 text-xs font-medium text-muted-foreground">{groupLabels[g]}</div>
              <div className="flex flex-col gap-px">{list.map((i) => <MenuLink key={i.id} item={i} onNavigate={onNavigate} />)}</div>
            </div>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border pt-2"><UserCard /></div>
    </div>
  )
}
