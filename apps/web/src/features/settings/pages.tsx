import * as React from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { defaultTerms, resolveTerms, type TermKey } from '@base/config'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { BrandingSettings, TermOverrideSettings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Field, PageHeader } from '@/components/page'
import { RequirePermission } from '@/components/forbidden'
import { useCan, useMe } from '@/app/session'
import { useBranding, useTerm } from '@/app/terms'
import { usePrefs } from '@/app/prefs'
import { initials } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const tabs = [
  { to: '/settings/profile', label: 'Profile' }, { to: '/settings/organisation', label: 'Organisation' },
  { to: '/settings/terminology', label: 'Terminology', perm: 'settings.manage' }, { to: '/settings/branding', label: 'Branding', perm: 'settings.manage' },
  { to: '/settings/appearance', label: 'Appearance' },
]

export function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const can = useCan()
  return (
    <div>
      <nav aria-label="Settings sections" className="mb-4 flex gap-1.5 overflow-x-auto lg:hidden">
        {tabs.filter((x) => can(x.perm)).map((x) => (
          <Link key={x.to} to={x.to} className={cn('inline-flex h-(--ctl-h) shrink-0 items-center rounded-full border px-3 text-sm font-medium', pathname === x.to ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}>{x.label}</Link>
        ))}
      </nav>
      <div className="max-w-3xl"><Outlet /></div>
    </div>
  )
}

export function ProfilePage() {
  const me = useMe()
  const qc = useQueryClient()
  const [name, setName] = React.useState(me.user.name)
  const save = useMutation({ mutationFn: () => api.auth.updateProfile({ name: name.trim() }), onSuccess: (m) => { qc.setQueryData(['me'], m); toast.success('Profile saved') }, onError: (e) => toast.error(e.message) })
  return (
    <>
      <PageHeader title="Profile" description="How you appear to your team." />
      <Card><CardContent className="grid gap-4">
        <div className="flex items-center gap-3"><Avatar className="size-12"><AvatarFallback className="text-sm">{initials(name)}</AvatarFallback></Avatar><div className="text-sm text-muted-foreground">Your avatar uses your initials.</div></div>
        <Field label="Full name" htmlFor="p-name"><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" htmlFor="p-email" hint="Contact an administrator to change your sign-in email."><Input id="p-email" value={me.user.email} readOnly disabled /></Field>
        <div><Button disabled={save.isPending || name.trim().length < 1} onClick={() => save.mutate()}>Save changes</Button></div>
      </CardContent></Card>
    </>
  )
}

export function OrganisationPage() {
  const t = useTerm()
  const can = useCan()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['org'], queryFn: api.org.get })
  const [f, setF] = React.useState({ name: '', legalName: '', website: '', timezone: 'UTC', currency: 'USD' })
  React.useEffect(() => { if (data) setF({ name: data.name, legalName: data.profile.legalName ?? '', website: data.profile.website ?? '', timezone: data.profile.timezone ?? 'UTC', currency: data.profile.currency ?? 'USD' }) }, [data])
  const save = useMutation({ mutationFn: () => api.org.update({ name: f.name, profile: { ...data?.profile, legalName: f.legalName, website: f.website, timezone: f.timezone, currency: f.currency } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['org'] }); qc.invalidateQueries({ queryKey: ['me'] }); toast.success('Saved') }, onError: (e) => toast.error(e.message) })
  const ro = !can('settings.manage')
  return (
    <>
      <PageHeader title={t('organisation.singular')} description={`Details for your ${t('organisation.singular', { lower: true })}.`} />
      {!data ? <Skeleton className="h-72" /> : (
        <Card><CardContent className="grid gap-4">
          <Field label="Display name" htmlFor="o-name"><Input id="o-name" value={f.name} disabled={ro} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Legal name" htmlFor="o-legal"><Input id="o-legal" value={f.legalName} disabled={ro} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
          <Field label="Website" htmlFor="o-web"><Input id="o-web" type="url" value={f.website} disabled={ro} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Timezone" htmlFor="o-tz"><Select value={f.timezone} onValueChange={(v) => setF({ ...f, timezone: v })} disabled={ro}><SelectTrigger id="o-tz"><SelectValue /></SelectTrigger><SelectContent>{['UTC', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'Australia/Sydney'].map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Currency" htmlFor="o-cur"><Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })} disabled={ro}><SelectTrigger id="o-cur"><SelectValue /></SelectTrigger><SelectContent>{['USD', 'EUR', 'GBP', 'INR', 'AUD'].map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          {!ro && <div><Button disabled={save.isPending} onClick={() => save.mutate()}>Save changes</Button></div>}
        </CardContent></Card>
      )}
    </>
  )
}

export function TerminologyPage() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['settings', 'terminology', 'edit'], queryFn: api.settings.terminology })
  const [vals, setVals] = React.useState<TermOverrideSettings>({})
  React.useEffect(() => { if (data) setVals(data) }, [data])
  const save = useMutation({
    mutationFn: () => {
      const clean: TermOverrideSettings = {}
      for (const k of Object.keys(defaultTerms) as TermKey[]) {
        const v = vals[k]; const e: { singular?: string; plural?: string } = {}
        if (v?.singular?.trim() && v.singular.trim() !== defaultTerms[k].singular) e.singular = v.singular.trim()
        if (v?.plural?.trim() && v.plural.trim() !== defaultTerms[k].plural) e.plural = v.plural.trim()
        if (e.singular || e.plural) clean[k] = e
      }
      return api.settings.updateTerminology(clean)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'terminology'] }); toast.success('Terminology saved. The whole app now uses your words.') },
    onError: (e) => toast.error(e.message),
  })
  const preview = resolveTerms(vals)
  const labels: Record<TermKey, string> = { organisation: 'The customer account', unit: 'A site, branch or team', member: 'A person in the account', record: 'The main thing you track', plan: 'The subscription tier' }
  return (
    <RequirePermission permission="settings.manage">
      <PageHeader title="Terminology" description="Rename the words used across the app to match your business. Leave a field empty to use the default."
        actions={<Button variant="outline" onClick={() => setVals({})}><RotateCcw />Reset all</Button>} />
      <div className="grid gap-3">
        <Card><CardContent className="grid gap-4">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr] gap-3 text-xs font-medium text-muted-foreground sm:grid"><span>Concept</span><span>Singular</span><span>Plural</span></div>
          {(Object.keys(defaultTerms) as TermKey[]).map((k) => (
            <div key={k} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-center sm:gap-3">
              <div><div className="text-sm font-medium capitalize">{k}</div><div className="text-xs text-muted-foreground">{labels[k]}</div></div>
              <Input aria-label={`${k} singular`} placeholder={defaultTerms[k].singular} value={vals[k]?.singular ?? ''} onChange={(e) => setVals((v) => ({ ...v, [k]: { ...v[k], singular: e.target.value } }))} />
              <Input aria-label={`${k} plural`} placeholder={defaultTerms[k].plural} value={vals[k]?.plural ?? ''} onChange={(e) => setVals((v) => ({ ...v, [k]: { ...v[k], plural: e.target.value } }))} />
            </div>
          ))}
          <div><Button disabled={save.isPending} onClick={() => save.mutate()}>Save terminology</Button></div>
        </CardContent></Card>
        <Card><CardHeader><div><CardTitle>Preview</CardTitle><CardDescription>How menus and buttons will read</CardDescription></div></CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            {[preview.record.plural, preview.unit.plural, `${preview.member.plural} and roles`, `New ${preview.record.singular.toLowerCase()}`, `Switch ${preview.unit.singular.toLowerCase()}`, `Billing and ${preview.plan.singular.toLowerCase()}`].map((s) => <span key={s} className="rounded-md border bg-muted px-2.5 py-1">{s}</span>)}
          </CardContent></Card>
      </div>
    </RequirePermission>
  )
}

export function BrandingPage() {
  const qc = useQueryClient()
  const cur = useBranding()
  const { data } = useQuery({ queryKey: ['settings', 'branding', 'edit'], queryFn: api.settings.branding })
  const [f, setF] = React.useState({ productName: '', accentColor: '#18181b', supportEmail: '', logoUrl: '' })
  React.useEffect(() => { if (data) setF({ productName: data.productName ?? '', accentColor: data.accentColor || '#18181b', supportEmail: data.supportEmail ?? '', logoUrl: data.logoUrl ?? '' }) }, [data])
  const save = useMutation({ mutationFn: () => api.settings.updateBranding(Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== '')) as BrandingSettings), onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'branding'] }); toast.success('Branding saved') }, onError: (e) => toast.error(e.message) })
  return (
    <RequirePermission permission="settings.manage">
      <PageHeader title="Branding" description="Your name, logo and accent colour. Leave the name empty to keep the product default." />
      <Card><CardContent className="grid gap-4">
        <Field label="Product name" htmlFor="b-name"><Input id="b-name" placeholder={cur.productName} value={f.productName} onChange={(e) => setF({ ...f, productName: e.target.value })} /></Field>
        <Field label="Logo URL" htmlFor="b-logo" hint="Square image, at least 64 pixels."><Input id="b-logo" type="url" placeholder="https://" value={f.logoUrl} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} /></Field>
        <Field label="Accent colour" htmlFor="b-accent" hint="Used for charts and highlights. Buttons stay black and white."><div className="flex items-center gap-2"><input id="b-accent" type="color" value={f.accentColor} onChange={(e) => setF({ ...f, accentColor: e.target.value })} className="h-(--ctl-h) w-12 cursor-pointer rounded-md border bg-transparent p-0.5" /><Input aria-label="Accent colour hex" value={f.accentColor} onChange={(e) => setF({ ...f, accentColor: e.target.value })} className="max-w-32 font-mono" /></div></Field>
        <Field label="Support email" htmlFor="b-mail"><Input id="b-mail" type="email" value={f.supportEmail} onChange={(e) => setF({ ...f, supportEmail: e.target.value })} /></Field>
        <div><Button disabled={save.isPending} onClick={() => save.mutate()}>Save branding</Button></div>
      </CardContent></Card>
    </RequirePermission>
  )
}

export function AppearancePage() {
  const p = usePrefs()
  return (
    <>
      <PageHeader title="Appearance" description="These choices are saved on this device for your account only." />
      <div className="grid gap-3">
        <Card><CardHeader><div><CardTitle>Theme</CardTitle><CardDescription>White by default, with a dark option.</CardDescription></div></CardHeader>
          <CardContent><ToggleGroup type="single" value={p.theme} onValueChange={(v) => v && p.setTheme(v as never)} aria-label="Theme">
            <ToggleGroupItem value="light"><Sun />Light</ToggleGroupItem><ToggleGroupItem value="dark"><Moon />Dark</ToggleGroupItem><ToggleGroupItem value="system"><Monitor />System</ToggleGroupItem>
          </ToggleGroup></CardContent></Card>
        <Card><CardHeader><div><CardTitle>Density</CardTitle><CardDescription>Compact fits more on screen. Comfortable uses larger text and rows. Phones always use large touch targets.</CardDescription></div></CardHeader>
          <CardContent className="grid gap-3"><ToggleGroup type="single" value={p.density} onValueChange={(v) => v && p.setDensity(v as never)} aria-label="Density">
            <ToggleGroupItem value="compact">Compact</ToggleGroupItem><ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
          </ToggleGroup>
          <div className="rounded-lg border">
            {['Sample row one', 'Sample row two'].map((r) => <div key={r} className="row-h flex items-center justify-between border-b px-3 last:border-0"><span>{r}</span><span className="text-muted-foreground">Open</span></div>)}
          </div></CardContent></Card>
      </div>
    </>
  )
}
