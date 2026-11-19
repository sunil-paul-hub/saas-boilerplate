import { Link, useRouterState } from '@tanstack/react-router'
import { Building2, Check, MessageSquare, Menu, Moon, PanelLeft, Search, Settings, Sun, LogOut, User as UserIcon } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useCan, useLogout, useMe, useSwitchUnit } from './session'
import { useTerm } from './terms'
import { usePrefs } from './prefs'
import { usePalette } from './command-palette'
import { useChatDrawer } from './chat-drawer-context'
import { NotificationsPopover } from './notifications'
import { getAllNav, isActivePath } from './nav'
import { LogoTile } from './sidebar'

function UnitSwitcher() {
  const me = useMe()
  const t = useTerm()
  const sw = useSwitchUnit()
  const current = me.units.find((u) => u.id === me.currentUnitId)
  if (me.units.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={`Current ${t('unit.singular', { lower: true })}: ${current?.name ?? 'none'}`} className="max-w-[8rem] max-md:px-2 md:max-w-[13rem]">
          <Building2 className="text-muted-foreground" /><span className="truncate">{current?.name ?? t('unit.singular')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Switch {t('unit.singular', { lower: true })}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={me.currentUnitId ?? ''} onValueChange={(v) => v !== me.currentUnitId && sw.mutate(v)}>
          {me.units.map((u) => <DropdownMenuRadioItem key={u.id} value={u.id}>{u.name}<span className="ml-auto text-xs text-muted-foreground">{u.code}</span></DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ChatButton() {
  const { openChat } = useChatDrawer()
  const can = useCan()

  if (!can('chat.use')) return null
  return (
    <Hint label="Team chat">
      <Button variant="ghost" size="icon" aria-label="Open team chat" onClick={() => openChat()} className="relative max-md:size-9">
        <MessageSquare />
      </Button>
    </Hint>
  )
}

function AvatarMenu() {
  const me = useMe()
  const logout = useLogout()
  const prefs = usePrefs()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
        <Avatar className="size-8"><AvatarFallback>{initials(me.user.name)}</AvatarFallback></Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal"><div className="text-sm font-semibold text-foreground">{me.user.name}</div><div>{me.user.email}</div></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/settings/profile"><UserIcon />Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/settings/appearance"><Settings />Appearance</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={prefs.toggleTheme}>{prefs.resolvedTheme === 'dark' ? <Sun /> : <Moon />}{prefs.resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header({ onToggleSidebar, onOpenMobileMenu }: { onToggleSidebar: () => void; onOpenMobileMenu: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const prefs = usePrefs()
  const palette = usePalette()
  const can = useCan()
  const me = useMe()
  const module = getAllNav().find((i) => i.sub && isActivePath(pathname, i.to))
  const sub = (module?.sub ?? []).filter((s) => can(s.permission))
  const showUnit = !!me.org
  return (
    <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-1.5 border-b bg-background/95 px-2 backdrop-blur md:px-4">
      <Button variant="ghost" size="icon" className="size-9 md:hidden" aria-label="Open menu" onClick={onOpenMobileMenu}><Menu /></Button>
      <Hint label="Toggle sidebar"><Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Toggle sidebar" onClick={onToggleSidebar}><PanelLeft /></Button></Hint>
      <Separator orientation="vertical" className="mx-1 hidden h-5 md:block" />
      
      {sub.length > 0 && (
        <nav aria-label="Section" className="ml-1 hidden items-center gap-4 lg:flex">
          {sub.map((s) => {
            const active = pathname === s.to || pathname.startsWith(s.to + '/')
            return <Link key={s.to} to={s.to} className={cn('text-sm font-medium text-muted-foreground transition-colors hover:text-foreground', active && 'text-foreground')}>{s.label}</Link>
          })}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button" onClick={() => palette.setOpen(true)} aria-label="Search (Ctrl K)"
          className="hidden h-(--ctl-h) w-56 items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:flex"
        >
          <Search className="size-4" /><span>Search</span><kbd className="ml-auto rounded border bg-sidebar px-1.5 text-[10px]">Ctrl K</kbd>
        </button>
        <Button variant="ghost" size="icon" className="size-9 md:hidden" aria-label="Search" onClick={() => palette.setOpen(true)}><Search /></Button>
        {showUnit && <UnitSwitcher />}
        <Separator orientation="vertical" className="mx-0.5 hidden h-5 sm:block" />
        <ChatButton />
        {me.org && <NotificationsPopover />}
        <Hint label="Toggle theme"><Button variant="ghost" size="icon" className="max-sm:hidden" aria-label="Toggle theme" onClick={prefs.toggleTheme}>{prefs.resolvedTheme === 'dark' ? <Sun /> : <Moon />}</Button></Hint>
        <Hint label="Settings"><Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Settings"><Link to="/settings/profile"><Settings /></Link></Button></Hint>
        <AvatarMenu />
      </div>
    </header>
  )
}
