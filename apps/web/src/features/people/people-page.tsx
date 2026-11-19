import * as React from 'react'
import { toast } from 'sonner'
import { Lock, MailPlus, Plus, ShieldCheck, Users } from 'lucide-react'
import type { Member, OrgRole, Role } from '@/lib/types'
import { initials, inviteLink } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, Field, PageHeader } from '@/components/page'
import { RequirePermission } from '@/components/forbidden'
import { Can, useCan } from '@/app/session'
import { useTerm } from '@/app/terms'
import { useIsMobile } from '@/hooks/use-media'
import { useMembers, usePeopleMutations, usePermissions, useRoles, useUnits } from './hooks'

const orgRoleLabel: Record<OrgRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', none: 'No access' }

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTerm()
  const { invite } = usePeopleMutations()
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<'admin' | 'member'>('member')
  const [err, setErr] = React.useState('')
  React.useEffect(() => { if (open) { setEmail(''); setRole('member'); setErr('') } }, [open])
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address')
    invite.mutate({ email, orgRole: role }, { onSuccess: (r) => { toast.success(`Invitation created for ${email}`, r.inviteToken ? { description: `Dev link: ${inviteLink(r.inviteToken)}`, duration: 60000 } : undefined); onOpenChange(false) }, onError: (x) => setErr(x.message) })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite a {t('member.singular', { lower: true })}</DialogTitle><DialogDescription>They are emailed a link to set a password. Assign {t('unit.singular', { lower: true })} access afterwards in the access matrix.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Email" htmlFor="inv-email"><Input id="inv-email" type="email" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} aria-invalid={!!err} />{err && <p role="alert" className="text-xs text-destructive">{err}</p>}</Field>
          <Field label={`${t('organisation.singular')} role`} htmlFor="inv-role" hint="Owners and admins can access every unit. Members only see units they are assigned.">
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'member')}><SelectTrigger id="inv-role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="member">Member</SelectItem></SelectContent></Select>
          </Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={invite.isPending}><MailPlus />Send invite</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MembersTab() {
  const t = useTerm()
  const mobile = useIsMobile()
  const { data, isLoading } = useMembers()
  const units = useUnits()
  const [invite, setInvite] = React.useState(false)
  const list = data ?? []
  const unitCount = (m: Member) => (m.orgRole === 'owner' || m.orgRole === 'admin' ? 'All' : String(m.unitRoles.length))
  return (
    <div className="grid gap-3">
      <div className="flex justify-end"><Can permission="member.invite"><Button onClick={() => setInvite(true)}><Plus />Invite {t('member.singular', { lower: true })}</Button></Can></div>
      {isLoading ? <Skeleton className="h-48" /> : mobile ? (
        <ul className="grid gap-2">{list.map((m) => (
          <li key={m.id}><Card className="py-3"><div className="flex items-center gap-3 px-3">
            <Avatar className="size-9"><AvatarFallback>{initials(m.name || m.email)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><div className="truncate font-semibold">{m.name || m.email}</div><div className="truncate text-xs text-muted-foreground">{m.email}</div></div>
            <Badge variant={m.status === 'invited' ? 'warning' : 'secondary'}>{m.status === 'invited' ? 'Invited' : orgRoleLabel[m.orgRole]}</Badge>
          </div></Card></li>
        ))}</ul>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table aria-label={t('member.plural')}>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead>{t('member.singular')}</TableHead><TableHead>{t('organisation.singular')} role</TableHead><TableHead>{t('unit.plural')}</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{list.map((m) => (
              <TableRow key={m.id}>
                <TableCell><div className="flex items-center gap-2.5"><Avatar className="size-8"><AvatarFallback>{initials(m.name || m.email)}</AvatarFallback></Avatar><div><div className="font-medium">{m.name || m.email}</div>{m.name && <div className="text-xs text-muted-foreground">{m.email}</div>}</div></div></TableCell>
                <TableCell>{orgRoleLabel[m.orgRole]}</TableCell>
                <TableCell>{unitCount(m)}{units.data && m.orgRole === 'member' ? ` of ${units.data.length}` : ''}</TableCell>
                <TableCell><Badge variant={m.status === 'invited' ? 'warning' : m.status === 'suspended' ? 'danger' : 'success'}>{m.status === 'invited' ? 'Invited' : m.status === 'suspended' ? 'Suspended' : 'Active'}</Badge></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Card>
      )}
      <InviteDialog open={invite} onOpenChange={setInvite} />
    </div>
  )
}

function RoleDialog({ open, onOpenChange, role }: { open: boolean; onOpenChange: (o: boolean) => void; role: Role | null }) {
  const perms = usePermissions()
  const { createRole, updateRole } = usePeopleMutations()
  const [name, setName] = React.useState('')
  const [desc, setDesc] = React.useState('')
  const [sel, setSel] = React.useState<Set<string>>(new Set())
  const [err, setErr] = React.useState('')
  React.useEffect(() => { if (open) { setName(role?.name ?? ''); setDesc(role?.description ?? ''); setSel(new Set(role?.permissions ?? [])); setErr('') } }, [open, role])
  const groups = React.useMemo(() => { const g: Record<string, { code: string; label: string }[]> = {}; (perms.data ?? []).forEach((p) => (g[p.group] ??= []).push(p)); return g }, [perms.data])
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setErr('Enter a role name')
    const body = { name: name.trim(), description: desc.trim() || undefined, permissions: [...sel] }
    const opts = { onSuccess: () => { toast.success('Role saved'); onOpenChange(false) }, onError: (x: Error) => setErr(x.message) }
    role ? updateRole.mutate({ id: role.id, ...body, description: desc.trim() || null }, opts) : createRole.mutate(body, opts)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{role ? 'Edit role' : 'New role'}</DialogTitle><DialogDescription>Roles are assigned per unit, so one person can be a Manager in one place and a Viewer in another.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="role-name"><Input id="role-name" value={name} onChange={(e) => { setName(e.target.value); setErr('') }} aria-invalid={!!err} />{err && <p role="alert" className="text-xs text-destructive">{err}</p>}</Field>
          <Field label="Description" htmlFor="role-desc"><Textarea id="role-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <fieldset className="grid gap-3"><legend className="mb-1 text-sm font-medium">Permissions</legend>
            {Object.entries(groups).map(([g, list]) => (
              <div key={g}><div className="mb-1 text-xs font-medium text-muted-foreground">{g}</div>
                <div className="grid gap-1.5 sm:grid-cols-2">{list.map((p) => (
                  <Label key={p.code} className="min-h-8 cursor-pointer font-normal"><Checkbox checked={sel.has(p.code)} onCheckedChange={(v) => setSel((s) => { const n = new Set(s); v ? n.add(p.code) : n.delete(p.code); return n })} />{p.label}</Label>
                ))}</div></div>
            ))}
          </fieldset>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={createRole.isPending || updateRole.isPending}>Save role</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RolesTab() {
  const { data, isLoading } = useRoles()
  const can = useCan()
  const [dlg, setDlg] = React.useState<{ open: boolean; role: Role | null }>({ open: false, role: null })
  return (
    <div className="grid gap-3">
      <div className="flex justify-end"><Can permission="role.manage"><Button onClick={() => setDlg({ open: true, role: null })}><Plus />New role</Button></Can></div>
      {isLoading ? <Skeleton className="h-40" /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(data ?? []).map((r) => (
          <Card key={r.id} className="gap-2">
            <div className="flex items-start gap-2 px-4"><ShieldCheck className="mt-0.5 size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="font-semibold capitalize">{r.name}</div><div className="text-xs text-muted-foreground">{r.description || 'No description'}</div></div>{r.system && <Badge variant="outline"><Lock />Built in</Badge>}</div>
            <div className="flex items-center justify-between px-4 text-sm text-muted-foreground"><span>{r.permissions.length} permissions</span><span>{r.memberCount} assigned</span></div>
            {can('role.manage') && !r.system && <div className="px-4"><Button size="sm" variant="outline" onClick={() => setDlg({ open: true, role: r })}>Edit permissions</Button></div>}
          </Card>
        ))}</div>
      )}
      <RoleDialog open={dlg.open} onOpenChange={(o) => setDlg((d) => ({ ...d, open: o }))} role={dlg.role} />
    </div>
  )
}

function MatrixTab() {
  const t = useTerm()
  const can = useCan()
  const members = useMembers()
  const units = useUnits()
  const roles = useRoles()
  const { setUnitRoles } = usePeopleMutations()
  const editable = can('member.manage')
  const rows = (members.data ?? []).filter((m) => m.orgRole === 'member' && m.status !== 'invited')
  const set = (m: Member, unitId: string, roleId: string) => {
    const rest = m.unitRoles.filter((u) => u.unitId !== unitId)
    const next = roleId === 'none' ? rest : [...rest, { unitId, roleId }]
    setUnitRoles.mutate({ id: m.id, unitRoles: next }, { onSuccess: () => toast.success(`Access updated for ${m.name}`), onError: (e) => toast.error(e.message) })
  }
  if (members.isLoading || units.isLoading || roles.isLoading) return <Skeleton className="h-48" />
  if (!rows.length) return <Card><EmptyState icon={Users} title={`No ${t('member.plural', { lower: true })} to assign`} description="Owners and admins already have access everywhere. Invite members to give them per-unit roles." /></Card>
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Choose a role for each {t('member.singular', { lower: true })} in each {t('unit.singular', { lower: true })}. Owners and admins always have full access and are not listed.</p>
      <Card className="gap-0 overflow-hidden py-0">
        <Table aria-label="Role matrix">
          <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="sticky left-0 bg-card">{t('member.singular')}</TableHead>{(units.data ?? []).map((u) => <TableHead key={u.id}>{u.name}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="sticky left-0 bg-card"><div className="font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{m.email}</div></TableCell>
              {(units.data ?? []).map((u) => {
                const cur = m.unitRoles.find((x) => x.unitId === u.id)?.roleId ?? 'none'
                return (
                  <TableCell key={u.id} className="min-w-36">
                    <Select value={cur} disabled={!editable} onValueChange={(v) => set(m, u.id, v)}>
                      <SelectTrigger aria-label={`${m.name} role in ${u.name}`} className="h-[calc(var(--ctl-h)-4px)] capitalize"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">No access</SelectItem>{(roles.data ?? []).map((r) => <SelectItem key={r.id} value={r.id} className="capitalize">{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}</TableBody>
        </Table>
      </Card>
    </div>
  )
}

export function PeoplePage() {
  const t = useTerm()
  return (
    <RequirePermission permission="member.manage">
      <PageHeader title={`${t('member.plural')} and roles`} description={`Invite people, define roles and decide who can do what in each ${t('unit.singular', { lower: true })}.`} />
      <Tabs defaultValue="members">
        <TabsList><TabsTrigger value="members">{t('member.plural')}</TabsTrigger><TabsTrigger value="roles">Roles</TabsTrigger><TabsTrigger value="matrix">Access by {t('unit.singular', { lower: true })}</TabsTrigger></TabsList>
        <TabsContent value="members"><MembersTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="matrix"><MatrixTab /></TabsContent>
      </Tabs>
    </RequirePermission>
  )
}
