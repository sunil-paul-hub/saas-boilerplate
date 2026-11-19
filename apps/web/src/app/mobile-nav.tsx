import * as React from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useTerm } from './terms'
import { isActivePath } from './nav'
import { SidebarContent, useVisibleNav } from './sidebar'

export function BottomTabBar({ onMore }: { onMore: () => void }) {
  const items = useVisibleNav()
  const t = useTerm()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const primary = (items.filter((i) => i.mobilePrimary).length ? items.filter((i) => i.mobilePrimary) : items).slice(0, 4)
  const moreActive = !primary.some((i) => isActivePath(pathname, i.to))
  return (
    <nav aria-label="Primary" className="pb-safe fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col border-t bg-background/95 backdrop-blur md:hidden">
      {primary.map((i) => {
        const active = isActivePath(pathname, i.to)
        return (
          <Link key={i.id} to={i.to} aria-current={active ? 'page' : undefined} className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground', active && 'text-foreground')}>
            <i.icon className="size-5" /><span className="max-w-full truncate px-1">{i.label(t)}</span>
          </Link>
        )
      })}
      <button type="button" onClick={onMore} className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground', moreActive && 'text-foreground')}>
        <MoreHorizontal className="size-5" />More
      </button>
    </nav>
  )
}

export function MobileMenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" hideClose className="w-[86%] max-w-sm gap-0 p-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Main navigation</SheetDescription>
        <SidebarContent onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
