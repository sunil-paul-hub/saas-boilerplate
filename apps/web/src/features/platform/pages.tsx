import * as React from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, Check, Eye, MoreHorizontal, Play, Plus, RefreshCw, X } from 'lucide-react'
import { onboarding, planCatalogue } from '@base/config'
import { api } from '@/lib/api'
import type { OrgSnapshot, PlatformOrg } from '@/lib/types'
import { cn, inviteLink, money, shortDate, timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorState, Field, PageHeader } from '@/components/page'
import { OrgStatusBadge } from '@/components/status'
import { ConfirmDialog } from '@/components/confirm'
import { RequirePermission } from '@/components/forbidden'
import { useIsMobile } from '@/hooks/use-media'
import { AuditTable } from '@/features/audit/audit-page'

const tabs = [{ to: '/platform/orgs', label: 'Organisations' }, { to: '/platform/requests', label: 'Requests' }, { to: '/platform/plans', label: 'Plans' }, { to: '/platform/audit', label: 'Audit' }]

export function PlatformLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <RequirePermission permission="platform.admin">
      <nav aria-label="Platform sections" className="mb-4 flex gap-1.5 overflow-x-auto lg:hidden">
        {tabs.map((x) => <Link key={x.to} to={x.to} className={cn('inline-flex h-(--ctl-h) shrink-0 items-center rounded-full border px-3 text-sm font-medium', pathname === x.to ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}>{x.label}</Link>)}
      </nav>
      <Outlet />
    </RequirePermission>
  )
}

function NewOrgDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [f, setF] = React.useState({ name: '', adminName: '', adminEmail: '', planCode: 'free' })
  const [err, setErr] = React.useState('')
  React.useEffect(() => { if (open) { setF({ name: '', adminName: '', adminEmail: '', planCode: 'free' }); setErr('') } }, [open])
  const create = useMutation({ mutationFn: () => api.platform.createOrg({ name: f.name, adminEmail: f.adminEmail, planCode: f.planCode, adminName: f.adminName || undefined }), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['platform'] }); toast.success('Organisation created. An invite was queued for the first admin.', r.inviteToken ? { description: `Dev link: ${inviteLink(r.inviteToken)}`, duration: 60000 } : undefined); onOpenChange(false) }, onError: (e) => setErr(e.message) })
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (f.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(f.adminEmail) || false) return setErr('Fill in all fields with a valid email.'); create.mutate() }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New organisation</DialogTitle><DialogDescription>Creates the organisation and emails an invite to its first administrator.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <Field label="Organisation name" htmlFor="no-name"><Input id="no-name" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="First admin name (optional)" htmlFor="no-an"><Input id="no-an" value={f.adminName} onChange={(e) => setF({ ...f, adminName: e.target.value })} /></Field>
          <Field label="First admin email" htmlFor="no-ae"><Input id="no-ae" type="email" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} /></Field>
          <Field label="Plan" htmlFor="no-plan"><Select value={f.planCode} onValueChange={(v) => setF({ ...f, planCode: v })}><SelectTrigger id="no-plan"><SelectValue /></SelectTrigger><SelectContent>{planCatalogue.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent></Select></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>Create and invite</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SnapshotDialog({ snapshot, onClose }: { snapshot: OrgSnapshot | null; onClose: () => void }) {
  return (
    <Dialog open={!!snapshot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{snapshot?.org.name}</DialogTitle><DialogDescription>Read-only snapshot. This view is recorded in the platform audit.</DialogDescription></DialogHeader>
        {snapshot && (
          <div className="grid gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><OrgStatusBadge status={snapshot.org.status} /><span className="text-muted-foreground">Plan: {snapshot.subscription?.planCode ?? 'none'}</span></div>
            <div><div className="mb-1 font-medium">Units ({snapshot.units.length})</div><ul className="text-muted-foreground">{snapshot.units.map((u) => <li key={u.id}>{u.name}{u.code ? ` (${u.code})` : ''}{u.isActive ? '' : ' - inactive'}</li>)}</ul></div>
            <div><div className="mb-1 font-medium">Members ({snapshot.members.length})</div><ul className="text-muted-foreground">{snapshot.members.map((m) => <li key={m.id}>{m.name} - {m.email} - {m.orgRole}</li>)}</ul></div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type Act = 'approve' | 'reject' | 'suspend' | 'reactivate'
export function PlatformOrgsPage() {
  const qc = useQueryClient()
  const [snapshot, setSnapshot] = React.useState<OrgSnapshot | null>(null)
  const mobile = useIsMobile()
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['platform', 'orgs'], queryFn: api.platform.orgs })
  const [creating, setCreating] = React.useState(false)
  const [confirm, setConfirm] = React.useState<{ org: PlatformOrg; action: Act } | null>(null)
  const [filter, setFilter] = React.useState('')
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Act }) => api.platform.orgAction(id, action),
    onSuccess: (r, v) => { qc.invalidateQueries({ queryKey: ['platform'] }); toast.success(`Organisation ${v.action}${v.action.endsWith('e') ? 'd' : 'ed'}`, r.inviteToken ? { description: `Dev link: ${inviteLink(r.inviteToken)}`, duration: 60000 } : undefined); setConfirm(null) },
    onError: (e) => toast.error(e.message),
  })
  const plan = useMutation({ mutationFn: ({ id, code }: { id: string; code: string }) => api.platform.setPlan(id, code), onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform'] }); toast.success('Plan updated') } })
  const viewAs = useMutation({
    mutationFn: (id: string) => api.platform.viewAs(id),
    onSuccess: (snap) => setSnapshot(snap),
    onError: (e) => toast.error(e.message),
  })
  const all = data?.items ?? []
  const items = all.filter((o) => (o.name + o.ownerName + o.ownerEmail).toLowerCase().includes(filter.toLowerCase()))
  const count = (s: string) => all.filter((o) => o.status === s).length

  const menu = (o: PlatformOrg) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${o.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {o.status !== 'pending' && o.status !== 'rejected' && <DropdownMenuItem onSelect={() => viewAs.mutate(o.id)}><Eye />View read-only snapshot</DropdownMenuItem>}
        {o.status === 'pending' && <><DropdownMenuItem onSelect={() => setConfirm({ org: o, action: 'approve' })}><Check />Approve</DropdownMenuItem><DropdownMenuItem onSelect={() => setConfirm({ org: o, action: 'reject' })}><X />Reject</DropdownMenuItem></>}
        {(o.status === 'active' || o.status === 'trial' || o.status === 'past_due') && <DropdownMenuItem variant="destructive" onSelect={() => setConfirm({ org: o, action: 'suspend' })}><Ban />Suspend</DropdownMenuItem>}
        {o.status === 'suspended' && <DropdownMenuItem onSelect={() => setConfirm({ org: o, action: 'reactivate' })}><Play />Reactivate</DropdownMenuItem>}
        <DropdownMenuSeparator /><DropdownMenuLabel>Change plan</DropdownMenuLabel>
        {planCatalogue.map((p) => <DropdownMenuItem key={p.code} disabled={p.code === o.planCode} onSelect={() => plan.mutate({ id: o.id, code: p.code })}><RefreshCw />{p.name}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
  const planName = (c: string | null) => (!c ? '-' : (planCatalogue.find((p) => p.code === c)?.name ?? c))

  return (
    <>
      <PageHeader title="Organisations" description="Every customer organisation on the platform." actions={<Button onClick={() => setCreating(true)}><Plus />New organisation</Button>} />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Total', all.length], ['Active', count('active')], ['On trial', count('trial')], ['Needs attention', count('pending') + count('past_due') + count('suspended')]].map(([l, v]) => (
          <Card key={l} className="gap-0.5 py-3"><CardContent><div className="text-xs text-muted-foreground">{l}</div><div className="font-bold tabular-nums" style={{ fontSize: 'calc(var(--fs-title) + 2px)' }}>{isLoading ? '-' : v}</div></CardContent></Card>
        ))}
      </div>
      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or owner" aria-label="Filter organisations" className="mb-3 sm:max-w-xs" />
      {isError ? <Card><ErrorState onRetry={() => refetch()} /></Card> : isLoading ? <Skeleton className="h-60" /> : items.length === 0 ? <Card><EmptyState title="No organisations found" /></Card> : mobile ? (
        <ul className="grid gap-2">{items.map((o) => (
          <li key={o.id}><Card className="gap-1.5 py-3"><div className="flex items-start gap-2 px-3"><div className="min-w-0 flex-1"><div className="font-semibold">{o.name}</div><div className="text-xs text-muted-foreground">{o.ownerEmail ? `${o.ownerName} · ${o.ownerEmail}` : 'First admin invite pending'}</div></div><OrgStatusBadge status={o.status} />{menu(o)}</div>
            <div className="flex gap-4 px-3 text-sm text-muted-foreground"><span>{planName(o.planCode)}</span><span>{o.unitCount} units</span><span>{o.memberCount} members</span></div></Card></li>
        ))}</ul>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table aria-label="Organisations">
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Organisation</TableHead><TableHead>Status</TableHead><TableHead>Plan</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Members</TableHead><TableHead>Created</TableHead><TableHead className="w-10"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>{items.map((o) => (
              <TableRow key={o.id}>
                <TableCell><div className="font-medium">{o.name}</div><div className="text-xs text-muted-foreground">{o.ownerEmail ? `${o.ownerName} · ${o.ownerEmail}` : 'First admin invite pending'}</div></TableCell>
                <TableCell><OrgStatusBadge status={o.status} /></TableCell><TableCell>{planName(o.planCode)}</TableCell>
                <TableCell className="text-right tabular-nums">{o.unitCount}</TableCell><TableCell className="text-right tabular-nums">{o.memberCount}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{shortDate(o.createdAt)}</TableCell><TableCell>{menu(o)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Card>
      )}
      <NewOrgDialog open={creating} onOpenChange={setCreating} />
      <SnapshotDialog snapshot={snapshot} onClose={() => setSnapshot(null)} />
      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} destructive={confirm?.action === 'suspend' || confirm?.action === 'reject'} pending={act.isPending}
        confirmLabel={confirm ? confirm.action[0]!.toUpperCase() + confirm.action.slice(1) : ''} title={confirm ? `${confirm.action[0]!.toUpperCase() + confirm.action.slice(1)} ${confirm.org.name}?` : ''}
        description={confirm?.action === 'suspend' ? 'Its members will be signed out and unable to use the app until reactivated.' : confirm?.action === 'reject' ? 'The requester is notified that the request was declined.' : confirm?.action === 'approve' ? 'The first admin gets an invite and can start the setup wizard.' : 'Members regain access immediately.'}
        onConfirm={() => confirm && act.mutate({ id: confirm.org.id, action: confirm.action })} />
    </>
  )
}

export function PlatformRequestsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['platform', 'requests'], queryFn: api.platform.requests })
  const act = useMutation({ mutationFn: ({ id, a }: { id: string; a: 'approve' | 'reject' }) => api.platform.requestAction(id, a), onSuccess: (r, v) => { qc.invalidateQueries({ queryKey: ['platform'] }); toast.success(v.a === 'approve' ? 'Request approved' : 'Request rejected', r.inviteToken ? { description: `Dev link for the first admin: ${inviteLink(r.inviteToken)}`, duration: 60000 } : undefined) }, onError: (e) => toast.error(e.message) })
  const items = data?.items ?? []
  return (
    <>
      <PageHeader title="Requests" description={onboarding.approvalRequired ? 'Self-serve sign-ups waiting for your decision.' : 'Approval is switched off in plans config; requests are accepted automatically.'} />
      {isLoading ? <Skeleton className="h-40" /> : items.length === 0 ? <Card><EmptyState title="No requests" description="New sign-up requests appear here." /></Card> : (
        <div className="grid gap-3">{items.map((r) => (
          <Card key={r.id} className="gap-2">
            <div className="flex flex-wrap items-start gap-2 px-4"><div className="min-w-0 flex-1"><div className="font-semibold">{r.orgName}</div><div className="text-sm text-muted-foreground">{r.contactName} · {r.email} · {timeAgo(r.createdAt)}</div></div>
              <Badge variant={r.status === 'pending' ? 'warning' : r.status === 'approved' ? 'success' : 'outline'}>{r.status[0]!.toUpperCase() + r.status.slice(1)}</Badge></div>
            {r.message && <p className="px-4 text-sm">{r.message}</p>}
            {r.status === 'pending' && <div className="flex gap-2 px-4"><Button size="sm" onClick={() => act.mutate({ id: r.id, a: 'approve' })} disabled={act.isPending}><Check />Approve</Button><Button size="sm" variant="outline" onClick={() => act.mutate({ id: r.id, a: 'reject' })} disabled={act.isPending}><X />Reject</Button></div>}
          </Card>
        ))}</div>
      )}
    </>
  )
}

export function PlatformPlansPage() {
  const { data } = useQuery({ queryKey: ['platform', 'orgs'], queryFn: api.platform.orgs })
  return (
    <>
      <PageHeader title="Plans" description="The catalogue and onboarding switches for this product. Edit them in packages/config/plans.ts." />
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        {[['Self-serve sign-up', onboarding.selfServeAllowed ? 'Allowed' : 'Off'], ['Approval required', onboarding.approvalRequired ? 'Yes' : 'No'], ['Trial length', `${onboarding.trialDays} days`]].map(([l, v]) => <Card key={l} className="gap-0.5 py-3"><CardContent><div className="text-xs text-muted-foreground">{l}</div><div className="text-base font-semibold">{v}</div></CardContent></Card>)}
      </div>
      <Card className="gap-0 overflow-hidden py-0"><Table aria-label="Plan catalogue">
        <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Plan</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Members</TableHead><TableHead className="text-right">Organisations</TableHead></TableRow></TableHeader>
        <TableBody>{planCatalogue.map((p) => (
          <TableRow key={p.code}><TableCell className="font-medium">{p.name}</TableCell><TableCell>{p.pricePerMonth ? `${money(p.pricePerMonth, p.currency)} / month` : 'Free'}</TableCell><TableCell className="text-right tabular-nums">{p.limits.units ?? 'Unlimited'}</TableCell><TableCell className="text-right tabular-nums">{p.limits.members ?? 'Unlimited'}</TableCell><TableCell className="text-right tabular-nums">{(data?.items ?? []).filter((o) => o.planCode === p.code).length}</TableCell></TableRow>
        ))}</TableBody></Table></Card>
    </>
  )
}

export function PlatformAuditPage() {
  const { data, isLoading } = useQuery({ queryKey: ['platform', 'audit'], queryFn: api.platform.audit })
  return (
    <>
      <PageHeader title="Platform audit" description="Operator actions across all organisations, including every view-as session." />
      {isLoading ? <Skeleton className="h-40" /> : <AuditTable items={data?.items ?? []} />}
    </>
  )
}
