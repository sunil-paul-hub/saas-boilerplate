import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Building2, MoreHorizontal, Pencil, Plus, Users } from 'lucide-react'
import { api } from '@/lib/api'
import type { Unit } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { EmptyState, ErrorState, PageHeader } from '@/components/page'
import { RequirePermission } from '@/components/forbidden'
import { Can, useCan } from '@/app/session'
import { useTerm } from '@/app/terms'

const schema = z.object({ name: z.string().min(2, 'Enter a name'), code: z.string().max(20).optional() })

function UnitDialog({ open, onOpenChange, unit }: { open: boolean; onOpenChange: (o: boolean) => void; unit: Unit | null }) {
  const t = useTerm()
  const qc = useQueryClient()
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: '', code: '' } })
  React.useEffect(() => { if (open) form.reset({ name: unit?.name ?? '', code: unit?.code ?? '' }) }, [open, unit, form])
  const save = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => (unit ? api.units.update(unit.id, { name: v.name, code: v.code || null }) : api.units.create({ name: v.name, code: v.code || null })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); qc.invalidateQueries({ queryKey: ['me'] }); toast.success(`${t('unit.singular')} saved`); onOpenChange(false) },
    onError: (e) => toast.error(e.message),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{unit ? `Edit ${t('unit.singular', { lower: true })}` : `New ${t('unit.singular', { lower: true })}`}</DialogTitle><DialogDescription>Members get roles per {t('unit.singular', { lower: true })}.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>Short code</FormLabel><FormControl><Input maxLength={20} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={save.isPending}>Save</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function UnitsPage() {
  const t = useTerm()
  const can = useCan()
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['units'], queryFn: api.units.list })
  const qc = useQueryClient()
  const toggle = useMutation({ mutationFn: (u: Unit) => api.units.update(u.id, { isActive: !u.isActive }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); qc.invalidateQueries({ queryKey: ['me'] }) }, onError: (e) => toast.error(e.message) })
  const [dlg, setDlg] = React.useState<{ open: boolean; unit: Unit | null }>({ open: false, unit: null })
  const many = t('unit.plural')
  return (
    <RequirePermission permission="unit.manage">
      <PageHeader title={many} description={`Sites, branches or teams inside your ${t('organisation.singular', { lower: true })}.`}
        actions={<Can permission="unit.manage"><Button onClick={() => setDlg({ open: true, unit: null })}><Plus />New {t('unit.singular', { lower: true })}</Button></Can>} />
      {isError ? <Card><ErrorState onRetry={() => refetch()} /></Card> : isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div> :
        !data?.length ? <Card><EmptyState icon={Building2} title={`No ${many.toLowerCase()} yet`} description={`Create a ${t('unit.singular', { lower: true })} to start assigning people and ${t('record.plural', { lower: true })}.`} /></Card> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((u) => (
              <Card key={u.id} className="gap-3">
                <div className="flex items-start gap-3 px-4">
                  <div className="flex size-9 items-center justify-center rounded-lg border bg-muted text-xs font-bold">{u.code ?? u.name.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold">{u.name}</div><Badge variant={u.isActive ? 'success' : 'outline'} className="mt-0.5">{u.isActive ? 'Active' : 'Inactive'}</Badge></div>
                  {can('unit.manage') && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${u.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setDlg({ open: true, unit: u })}><Pencil />Edit</DropdownMenuItem><DropdownMenuItem onSelect={() => toggle.mutate(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="grid gap-1 px-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><Users className="size-3.5" />{u.memberCount ?? 0} {u.memberCount === 1 ? t('member.singular', { lower: true }) : t('member.plural', { lower: true })}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      <UnitDialog open={dlg.open} onOpenChange={(o) => setDlg((d) => ({ ...d, open: o }))} unit={dlg.unit} />
    </RequirePermission>
  )
}
