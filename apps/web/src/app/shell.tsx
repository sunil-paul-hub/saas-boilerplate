import * as React from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { SidebarContent } from './sidebar'
import { Header } from './header'
import { BottomTabBar, MobileMenuSheet } from './mobile-nav'
import { ChatDrawer } from '@/features/chat/components/chat-drawer'

const KEY = 'base.sidebar'


export function AppShell() {
  const [collapsed, setCollapsed] = React.useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(KEY, c ? '0' : '1') } catch { /* ignore */ } return !c })
  React.useEffect(() => setMobileOpen(false), [pathname])
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <div className="flex min-h-0 flex-1">
        <aside className={cn('sticky top-0 hidden h-dvh w-[232px] shrink-0 border-r border-sidebar-border bg-sidebar md:block', collapsed && 'md:hidden')} aria-label="Sidebar">
          <SidebarContent />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onToggleSidebar={toggle} onOpenMobileMenu={() => setMobileOpen(true)} />
          <main id="main" className="min-w-0 flex-1 px-3 pt-4 pb-24 md:px-5 md:pb-8">
            <div className="mx-auto w-full max-w-[1400px]"><Outlet /></div>
          </main>
        </div>
      </div>
      <BottomTabBar onMore={() => setMobileOpen(true)} />
      <MobileMenuSheet open={mobileOpen} onOpenChange={setMobileOpen} />
      <ChatDrawer />
    </div>
  )
}
