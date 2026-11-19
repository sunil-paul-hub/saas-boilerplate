import * as React from 'react'
import { useBranding } from '@/app/terms'
import { LogoTile } from '@/app/sidebar'
import { branding } from '@base/config'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const b = useBranding()
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center gap-2"><LogoTile /><span className="text-sm font-semibold">{b.productName}</span></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="page-title mb-1">{title}</h1>
          {subtitle && <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>}
          {children}
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
        <p className="text-xs text-muted-foreground">Need help? <a className="underline underline-offset-2" href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a></p>
      </div>
      <div className="relative hidden flex-col justify-end overflow-hidden bg-primary p-12 text-primary-foreground lg:flex" aria-hidden>
        <div className="absolute -top-24 -right-24 size-96 rounded-full border border-primary-foreground/10" />
        <div className="absolute -top-8 -right-8 size-96 rounded-full border border-primary-foreground/10" />
        <p className="max-w-md text-2xl leading-snug font-semibold">{branding.tagline}</p>
        <p className="mt-3 max-w-md text-sm opacity-70">Organisations, units, roles, records, chat and billing in one workspace. Every person sees only what their role allows.</p>
      </div>
    </div>
  )
}
