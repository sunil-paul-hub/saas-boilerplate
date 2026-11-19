import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, PartyPopper, X } from 'lucide-react'
import { planCatalogue } from '@base/config'
import { api } from '@/lib/api'
import { cn, inviteLink } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/page'
import { LogoTile } from '@/app/sidebar'
import { useMe } from '@/app/session'
import { useBranding, useTerm } from '@/app/terms'
import { PlanCards } from '../billing/billing-page'

const STEPS = ['Profile', 'First unit', 'Invite team', 'Plan', 'Done']

export function SetupWizard() {
  const me = useMe()
  const t = useTerm()
  const b = useBranding()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = React.useState(0)
  const [f, setF] = React.useState({ name: me.org?.name ?? '', timezone: 'UTC', currency: 'USD', unitName: '', invites: [''], planCode: 'free' })
  const [err, setErr] = React.useState('')
  const [inviteLinks, setInviteLinks] = React.useState<string[]>([])
  const finish = useMutation({
    mutationFn: async () => {
      // Each step is saved separately; the last call activates the organisation.
      await api.org.update({ name: f.name.trim(), profile: { timezone: f.timezone, currency: f.currency } })
      if (!me.units.some((u) => u.name === f.unitName.trim())) await api.units.create({ name: f.unitName.trim() })
      const links: string[] = []
      for (const email of f.invites.filter((e) => e.trim())) {
        const r = await api.members.invite({ email: email.trim(), orgRole: 'member' })
        if (r.inviteToken) links.push(inviteLink(r.inviteToken))
      }
      await api.billing.changePlan(f.planCode)
      await api.onboarding.complete()
      return links
    },
    onSuccess: (links) => { setInviteLinks(links); setStep(4); qc.invalidateQueries() },
    onError: (e) => setErr(e.message),
  })
  const unit = t('unit.singular', { lower: true })
  const next = () => {
    setErr('')
    if (step === 0 && f.name.trim().length < 2) return setErr(`Enter a name for your ${t('organisation.singular', { lower: true })}.`)
    if (step === 1 && f.unitName.trim().length < 2) return setErr(`Name your first ${unit}.`)
    if (step === 2 && f.invites.some((e) => e.trim() && !/^\S+@\S+\.\S+$/.test(e))) return setErr('One of the email addresses is not valid.')
    if (step === 3) return finish.mutate()
    setStep(step + 1)
  }
  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="flex items-center gap-2 border-b bg-background px-4 py-3"><LogoTile /><span className="text-sm font-semibold">{b.productName}</span><span className="ml-auto text-xs text-muted-foreground">Setup</span></header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? 'step' : undefined}>
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', i < step && 'border-primary bg-primary text-primary-foreground', i === step && 'border-primary')}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>
              <span className={cn('hidden text-xs sm:block', i === step ? 'font-semibold' : 'text-muted-foreground')}>{s}</span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>
        <Card><CardContent className="grid gap-5 py-2">
          {step === 0 && <>
            <div><h1 className="page-title">Tell us about your {t('organisation.singular', { lower: true })}</h1><p className="mt-1 text-sm text-muted-foreground">You can change these later in Settings.</p></div>
            <Field label={`${t('organisation.singular')} name`} htmlFor="w-name"><Input id="w-name" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Timezone" htmlFor="w-tz"><Select value={f.timezone} onValueChange={(v) => setF({ ...f, timezone: v })}><SelectTrigger id="w-tz"><SelectValue /></SelectTrigger><SelectContent>{['UTC', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'Australia/Sydney'].map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Currency" htmlFor="w-cur"><Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}><SelectTrigger id="w-cur"><SelectValue /></SelectTrigger><SelectContent>{['USD', 'EUR', 'GBP', 'INR', 'AUD'].map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent></Select></Field>
            </div></>}
          {step === 1 && <>
            <div><h1 className="page-title">Create your first {unit}</h1><p className="mt-1 text-sm text-muted-foreground">A {unit} is a site, branch or team. Roles and {t('record.plural', { lower: true })} belong to a {unit}.</p></div>
            <Field label={`${t('unit.singular')} name`} htmlFor="w-unit"><Input id="w-unit" autoFocus placeholder="Head Office" value={f.unitName} onChange={(e) => setF({ ...f, unitName: e.target.value })} /></Field></>}
          {step === 2 && <>
            <div><h1 className="page-title">Invite your team</h1><p className="mt-1 text-sm text-muted-foreground">Optional. Add emails now or skip and invite people later.</p></div>
            <div className="grid gap-2">{f.invites.map((e, i) => (
              <div key={i} className="flex gap-2"><Input type="email" aria-label={`Invite email ${i + 1}`} placeholder="colleague@company.com" value={e} onChange={(ev) => setF({ ...f, invites: f.invites.map((x, j) => (j === i ? ev.target.value : x)) })} />
                {f.invites.length > 1 && <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setF({ ...f, invites: f.invites.filter((_, j) => j !== i) })}><X /></Button>}</div>
            ))}<div><Button variant="outline" size="sm" onClick={() => setF({ ...f, invites: [...f.invites, ''] })}>Add another</Button></div></div></>}
          {step === 3 && <>
            <div><h1 className="page-title">Choose a {t('plan.singular', { lower: true })}</h1><p className="mt-1 text-sm text-muted-foreground">Start with a free trial. Change it any time.</p></div>
            <PlanCards picked={f.planCode} onPick={(p) => setF({ ...f, planCode: p.code })} /></>}
          {step === 4 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-success-bg text-success"><PartyPopper className="size-7" /></div>
              <h1 className="page-title">You are all set</h1>
              <p className="max-w-sm text-sm text-muted-foreground">{f.name} is ready on the {planCatalogue.find((p) => p.code === f.planCode)?.name} {t('plan.singular', { lower: true })}.</p>
              {inviteLinks.length > 0 && <div className="max-w-md break-all rounded-md border bg-muted p-2 text-left text-xs"><div className="mb-1 font-medium">Dev invite links</div>{inviteLinks.map((l) => <div key={l}>{l}</div>)}</div>}
              <Button size="lg" onClick={async () => { await qc.invalidateQueries({ queryKey: ['me'] }); await qc.refetchQueries({ queryKey: ['me'] }); nav({ to: '/' }) }}>Go to dashboard</Button>
            </div>)}
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          {step < 4 && (
            <div className="flex justify-between border-t pt-4">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
              <div className="flex gap-2">
                {step === 2 && <Button variant="outline" onClick={() => { setF({ ...f, invites: [''] }); setStep(3) }}>Skip</Button>}
                <Button onClick={next} disabled={finish.isPending}>{finish.isPending && <Loader2 className="animate-spin" />}{step === 3 ? 'Finish setup' : 'Continue'}</Button>
              </div>
            </div>)}
        </CardContent></Card>
      </main>
    </div>
  )
}
