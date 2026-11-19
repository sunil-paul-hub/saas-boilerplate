import * as React from 'react'
import { cn } from '@/lib/utils'

export const Card = ({ className, ...p }: React.ComponentProps<'div'>) => <div data-slot="card" className={cn('flex flex-col gap-3 rounded-xl border bg-card py-4 text-card-foreground shadow-xs', className)} {...p} />
export const CardHeader = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('flex items-start justify-between gap-2 px-4', className)} {...p} />
export const CardTitle = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('text-sm font-semibold leading-snug', className)} {...p} />
export const CardDescription = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('text-xs text-muted-foreground', className)} {...p} />
export const CardContent = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('px-4', className)} {...p} />
export const CardFooter = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('flex items-center gap-2 px-4', className)} {...p} />
