import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { planCatalogue, type PlanDef } from '@base/config'
import { api } from '@/lib/api'
import { money, shortDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorState, PageHeader } from '@/components/page'
import { OrgStatusBadge } from '@/components/status'
import { RequirePermission } from '@/components/forbidden'
import { useCan } from '@/app/session'
import { useTerm } from '@/app/terms'

export function PlanCards({ current, onPick, pending, canPick = true, picked }: { current?: string; onPick: (p: PlanDef) => void; pending?: boolean; canPick?: boolean; picked?: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {planCatalogue.map((p) => {
        const isCurrent = p.code === current
        return (
          <Card key={p.code} className={p.highlight || picked === p.code ? 'border-primary ring-1 ring-primary' : ''}>
            <CardHeader><div><CardTitle className="flex items-center gap-2">{p.name}{p.highlight && <Badge>Popular</Badge>}</CardTitle><CardDescription>{p.pricePerMonth === 0 ? 'Free forever' : `${money(p.pricePerMonth, p.currency)} per month`}</CardDescription></div></CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <ul className="grid gap-1.5 text-sm">{p.features.map((f) => <li key={f} className="flex items-center gap-2"><Check className="size-4 text-success" />{f}</li>)}</ul>
              <Button className="mt-auto" variant={isCurrent || picked === p.code ? 'secondary' : 'default'} disabled={isCurrent || !canPick || pending} onClick={() => onPick(p)}>
                {isCurrent ? 'Current plan' : picked === p.code ? 'Selected' : 'Choose'}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground tabular-nums">{limit ? `${used.toLocaleString()} of ${limit.toLocaleString()}` : `${used.toLocaleString()} (no limit)`}</span></div>
      <Progress value={pct} aria-label={`${label} usage`} />
    </div>
  )
}

export function BillingPage() {
  const t = useTerm()
  const can = useCan()
  const qc = useQueryClient()
  const plan = useQuery({ queryKey: ['billing', 'plan'], queryFn: api.billing.plan })
  const inv = useQuery({ queryKey: ['billing', 'invoices'], queryFn: api.billing.invoices })
  const change = useMutation({
    mutationFn: (code: string) => api.billing.changePlan(code),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing'] }); qc.invalidateQueries({ queryKey: ['me'] }); toast.success(`${t('plan.singular')} changed`) },
    onError: (e) => toast.error(e.message),
  })
  const p = plan.data
  return (
    <RequirePermission permission="billing.read">
      <PageHeader title={`Billing and ${t('plan.singular', { lower: true })}`} description="Your subscription, usage and invoices." />
      <div className="grid gap-3">
        <Alert><AlertDescription>Payments are handled manually in this build. Contact support to arrange payment; online payment providers plug in later.</AlertDescription></Alert>
        {plan.isError ? <Card><ErrorState onRetry={() => plan.refetch()} /></Card> : (
          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            <Card>
              <CardHeader><div><CardTitle>Current {t('plan.singular', { lower: true })}</CardTitle><CardDescription>{p?.trialEndsAt ? `Trial ends ${shortDate(p.trialEndsAt)}` : p?.renewsAt ? `Renews ${shortDate(p.renewsAt)}` : ''}</CardDescription></div>{p && <OrgStatusBadge status={p.status} />}</CardHeader>
              <CardContent>{p ? <div className="text-xl font-bold">{p.planName} <span className="text-sm font-normal text-muted-foreground">{p.pricePerMonth ? `${money(p.pricePerMonth, p.currency)} / month` : 'Free'}</span></div> : <Skeleton className="h-7 w-40" />}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {p ? <><Usage label={t('unit.plural')} used={p.usage.units} limit={p.usage.unitsLimit} /><Usage label={t('member.plural')} used={p.usage.members} limit={p.usage.membersLimit} /><Usage label={t('record.plural')} used={p.usage.records} limit={p.usage.recordsLimit} /></> : <Skeleton className="h-24" />}
              </CardContent>
            </Card>
          </div>
        )}
        <h2 className="mt-2 text-sm font-semibold">Available {t('plan.plural', { lower: true })}</h2>
        <PlanCards current={p?.planCode} canPick={can('billing.manage')} pending={change.isPending} onPick={(pl) => change.mutate(pl.code)} />
        <h2 className="mt-2 text-sm font-semibold">Invoices</h2>
        <Card className="gap-0 overflow-hidden py-0">
          <Table aria-label="Invoices">
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {(inv.data?.items ?? []).map((i) => (
                <TableRow key={i.id}><TableCell className="font-mono text-xs">{i.number}</TableCell><TableCell>{shortDate(i.issuedAt)}</TableCell><TableCell><Badge variant={i.status === 'paid' ? 'success' : i.status === 'open' ? 'warning' : 'outline'}>{i.status[0]!.toUpperCase() + i.status.slice(1)}</Badge></TableCell><TableCell className="text-right tabular-nums">{money(i.amount, i.currency)}</TableCell></TableRow>
              ))}
              {inv.data && inv.data.items.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </RequirePermission>
  )
}
