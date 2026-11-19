import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Breadcrumb = (p: React.ComponentProps<'nav'>) => <nav aria-label="breadcrumb" {...p} />
export const BreadcrumbList = ({ className, ...p }: React.ComponentProps<'ol'>) => <ol className={cn('flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground', className)} {...p} />
export const BreadcrumbItem = ({ className, ...p }: React.ComponentProps<'li'>) => <li className={cn('inline-flex items-center gap-1.5', className)} {...p} />
export const BreadcrumbPage = ({ className, ...p }: React.ComponentProps<'span'>) => <span aria-current="page" className={cn('font-medium text-foreground', className)} {...p} />
export const BreadcrumbSeparator = () => <li role="presentation" aria-hidden="true"><ChevronRight className="size-3.5" /></li>
