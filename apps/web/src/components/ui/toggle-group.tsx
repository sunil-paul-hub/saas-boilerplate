import * as React from 'react'
import { ToggleGroup as TG } from 'radix-ui'
import { cn } from '@/lib/utils'

export const ToggleGroup = ({ className, ...p }: React.ComponentProps<typeof TG.Root>) => (
  <TG.Root className={cn('inline-flex items-center rounded-md border bg-background shadow-xs', className)} {...p} />
)
export const ToggleGroupItem = ({ className, ...p }: React.ComponentProps<typeof TG.Item>) => (
  <TG.Item className={cn('inline-flex h-[calc(var(--ctl-h)-2px)] items-center justify-center gap-1.5 px-3 text-sm font-medium outline-none transition-colors first:rounded-l-md last:rounded-r-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:size-4', className)} {...p} />
)
