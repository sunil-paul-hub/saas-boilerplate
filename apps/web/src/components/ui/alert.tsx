import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva('relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5', {
  variants: { variant: { default: 'bg-card text-card-foreground', warning: 'border-transparent bg-warning-bg text-warning', destructive: 'border-transparent bg-danger-bg text-destructive' } },
  defaultVariants: { variant: 'default' },
})
export function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}
export const AlertTitle = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('col-start-2 font-medium', className)} {...p} />
export const AlertDescription = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('col-start-2 text-[0.92em] opacity-90', className)} {...p} />
