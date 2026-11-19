import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const Tabs = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Root>) => <TabsPrimitive.Root className={cn('flex flex-col gap-3', className)} {...p} />
export const TabsList = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn('inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted p-[3px] text-muted-foreground', className)} {...p} />
)
export const TabsTrigger = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger className={cn('inline-flex h-[calc(var(--ctl-h)-6px)] items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-accent [&_svg]:size-4', className)} {...p} />
)
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Content>) => <TabsPrimitive.Content className={cn('flex-1 outline-none', className)} {...p} />
