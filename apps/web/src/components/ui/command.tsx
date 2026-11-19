import * as React from 'react'
import { Command as C } from 'cmdk'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog'

export const Command = ({ className, ...p }: React.ComponentProps<typeof C>) => <C className={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)} {...p} />

export function CommandDialog({ title = 'Command palette', description = 'Search for a page or action', children, ...props }: React.ComponentProps<typeof Dialog> & { title?: string; description?: string }) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <DialogContent hideClose className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">{children}</Command>
      </DialogContent>
    </Dialog>
  )
}
export function CommandInput({ className, ...props }: React.ComponentProps<typeof C.Input>) {
  return (
    <div className="flex h-11 items-center gap-2 border-b px-3">
      <Search className="size-4 shrink-0 opacity-50" />
      <C.Input className={cn('flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50', className)} {...props} />
    </div>
  )
}
export const CommandList = ({ className, ...p }: React.ComponentProps<typeof C.List>) => <C.List className={cn('max-h-[320px] overflow-x-hidden overflow-y-auto p-1', className)} {...p} />
export const CommandEmpty = (p: React.ComponentProps<typeof C.Empty>) => <C.Empty className="py-6 text-center text-sm text-muted-foreground" {...p} />
export const CommandGroup = ({ className, ...p }: React.ComponentProps<typeof C.Group>) => <C.Group className={cn('overflow-hidden text-foreground', className)} {...p} />
export const CommandSeparator = ({ className, ...p }: React.ComponentProps<typeof C.Separator>) => <C.Separator className={cn('-mx-1 h-px bg-border', className)} {...p} />
export const CommandItem = ({ className, ...p }: React.ComponentProps<typeof C.Item>) => (
  <C.Item className={cn("relative flex min-h-(--ctl-h) cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-muted-foreground", className)} {...p} />
)
export const CommandShortcut = ({ className, ...p }: React.ComponentProps<'span'>) => <span className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...p} />
