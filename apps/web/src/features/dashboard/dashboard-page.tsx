import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { Activity, CheckCircle2, CircleDot, FileText, Loader2 as Spin } from 'lucide-react'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { PageHeader, EmptyState } from '@/components/page'
import { RecordStatusBadge } from '@/components/status'
import { Can, useCan, useMe } from '@/app/session'
import { useBranding, useTerm } from '@/app/terms'

function Kpi({ label, value, hint, icon: Icon, loading }: { label: string; value: string; hint: string; icon: React.ElementType; loading: boolean }) {
  return (
    <Card className="gap-1 py-3">
      <CardHeader className="items-center"><CardTitle className="font-medium text-muted-foreground">{label}</CardTitle><Icon className="size-4 text-muted-foreground" /></CardHeader>
      <CardContent>
        {loading ? <Skeleton className="mt-1 h-7 w-20" /> : <div className="text-xl font-bold tabular-nums" style={{ fontSize: 'calc(var(--fs-title) + 2px)' }}>{value}</div>}
        <div className="text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const me = useMe()
  const t = useTerm()
  const can = useCan()
  const b = useBranding()
  const sum = useQuery({ queryKey: ['dashboard', me.currentUnitId], queryFn: () => api.dashboard.summary(me.currentUnitId), enabled: can('record.read') })
  const audit = useQuery({ queryKey: ['audit', 'recent'], queryFn: () => api.audit.list({}), enabled: can('audit.read') })
  const unit = me.units.find((u) => u.id === me.currentUnitId)
  const d = sum.data
  const months = (d?.monthly ?? []).map((m) => ({ month: new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' }), count: m.count }))
  const recent = d?.recent ?? []
  const many = t('record.plural')

  return (
    <>
      <PageHeader title="Dashboard" description={`${unit?.name ?? me.org?.name ?? ''}: a snapshot of ${many.toLowerCase()} and activity.`}
        actions={<Can permission="record.create"><Button asChild><Link to="/records" search={{ new: true }}>New {t('record.singular', { lower: true })}</Link></Button></Can>} />
      <Tabs defaultValue="overview">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
        <TabsContent value="overview" className="grid gap-3">
          {!can('record.read') ? (
            <Card><EmptyState title="Welcome" description={`You do not have access to ${many.toLowerCase()} in this ${t('unit.singular', { lower: true })}. Use team chat or switch ${t('unit.singular', { lower: true })}.`} /></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label={`Total ${many.toLowerCase()}`} value={String(d?.total ?? 0)} hint={`In ${unit?.name ?? 'this unit'}`} icon={FileText} loading={sum.isLoading} />
                <Kpi label="Open" value={String(d?.byStatus.open ?? 0)} hint="Waiting to start" icon={CircleDot} loading={sum.isLoading} />
                <Kpi label="In progress" value={String(d?.byStatus.in_progress ?? 0)} hint="Being worked on" icon={Spin} loading={sum.isLoading} />
                <Kpi label="Done" value={String(d?.byStatus.done ?? 0)} hint={`${d?.byStatus.archived ?? 0} archived`} icon={CheckCircle2} loading={sum.isLoading} />
              </div>
              <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
                <Card>
                  <CardHeader><div><CardTitle>{many} created</CardTitle><CardDescription>Last 6 months</CardDescription></div></CardHeader>
                  <CardContent>
                    <div className="h-52" role="img" aria-label={`Bar chart of ${many.toLowerCase()} created per month`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={months} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                          <RTooltip cursor={{ fill: 'var(--accent)' }} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--popover-foreground)' }} />
                          <Bar dataKey="count" name={many} fill={b.accentColor === '#18181b' ? 'var(--foreground)' : b.accentColor} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><div><CardTitle>Recent {many.toLowerCase()}</CardTitle><CardDescription>Latest updates</CardDescription></div><Button asChild variant="ghost" size="sm"><Link to="/records">View all</Link></Button></CardHeader>
                  <CardContent>
                    {sum.isLoading ? <Skeleton className="h-40" /> : recent.length === 0 ? <EmptyState title={`No ${many.toLowerCase()} yet`} /> : (
                      <ul className="divide-y">
                        {recent.map((r) => (
                          <li key={r.id} className="flex items-center gap-2 py-2">
                            <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{timeAgo(r.updatedAt)}</div></div>
                            <RecordStatusBadge status={r.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader><div><CardTitle>Recent activity</CardTitle><CardDescription>From the audit log</CardDescription></div></CardHeader>
            <CardContent>
              {!can('audit.read') ? <EmptyState icon={Activity} title="Activity is restricted" description="You need audit access to see organisation activity." /> :
                audit.isLoading ? <Skeleton className="h-40" /> : (
                  <ul className="divide-y">
                    {(audit.data?.items ?? []).slice(0, 8).map((a) => (
                      <li key={a.id} className="flex items-center gap-3 py-2"><span className="size-2 rounded-full bg-foreground/60" /><span className="min-w-0 flex-1 truncate"><span className="font-medium">{a.actor ?? 'System'}</span> <span className="text-muted-foreground">{a.action}{a.entityType ? ` (${a.entityType})` : ''}</span></span><span className="text-xs text-muted-foreground">{timeAgo(a.at)}</span></li>
                    ))}
                  </ul>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
