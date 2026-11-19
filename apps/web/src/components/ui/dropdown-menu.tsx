import * as React from 'react'
import { DropdownMenu as M } from 'radix-ui'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DropdownMenu = M.Root
export const DropdownMenuTrigger = M.Trigger
export const DropdownMenuGroup = M.Group
export const DropdownMenuSub = M.Sub
export const DropdownMenuRadioGroup = M.RadioGroup

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content sideOffset={sideOffset} className={cn('z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[10rem] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', className)} {...props} />
    </M.Portal>
  )
}
const itemBase = 'relative flex min-h-(--ctl-h) cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg:not([class*=text-])]:text-muted-foreground'
export function DropdownMenuItem({ className, inset, variant, ...props }: React.ComponentProps<typeof M.Item> & { inset?: boolean; variant?: 'destructive' }) {
  return <M.Item className={cn(itemBase, inset && 'pl-8', variant === 'destructive' && 'text-destructive focus:bg-danger-bg focus:text-destructive [&_svg]:!text-destructive', className)} {...props} />
}
export function DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem checked={checked} className={cn(itemBase, 'pl-8', className)} {...props}>
      <span className="absolute left-2 flex size-3.5 items-center justify-center"><M.ItemIndicator><Check className="size-4" /></M.ItemIndicator></span>
      {children}
    </M.CheckboxItem>
  )
}
export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof M.RadioItem>) {
  return (
    <M.RadioItem className={cn(itemBase, 'pl-8', className)} {...props}>
      <span className="absolute left-2 flex size-3.5 items-center justify-center"><M.ItemIndicator><Circle className="size-2 fill-current" /></M.ItemIndicator></span>
      {children}
    </M.RadioItem>
  )
}
export const DropdownMenuLabel = ({ className, inset, ...p }: React.ComponentProps<typeof M.Label> & { inset?: boolean }) => <M.Label className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', inset && 'pl-8', className)} {...p} />
export const DropdownMenuSeparator = ({ className, ...p }: React.ComponentProps<typeof M.Separator>) => <M.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...p} />
export const DropdownMenuShortcut = ({ className, ...p }: React.ComponentProps<'span'>) => <span className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...p} />
export function DropdownMenuSubTrigger({ className, children, ...props }: React.ComponentProps<typeof M.SubTrigger>) {
  return <M.SubTrigger className={cn(itemBase, 'data-[state=open]:bg-accent', className)} {...props}>{children}<ChevronRight className="ml-auto" /></M.SubTrigger>
}
export const DropdownMenuSubContent = ({ className, ...p }: React.ComponentProps<typeof M.SubContent>) => <M.SubContent className={cn('z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 shadow-lg', className)} {...p} />
