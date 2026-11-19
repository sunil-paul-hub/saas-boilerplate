import * as React from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Archive, Copy, FileText, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import type { RecordItem } from '@/lib/types'
import { shortDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState, ErrorState, PageHeader } from '@/components/page'
import { RECORD_STATUSES, RecordStatusBadge, recordStatusLabel } from '@/components/status'
import { ConfirmDialog } from '@/components/confirm'
import { RequirePermission } from '@/components/forbidden'
import { Can, useCan, useMe } from '@/app/session'
import { useTerm } from '@/app/terms'
import { useIsMobile } from '@/hooks/use-media'
import { cn } from '@/lib/utils'
import { PAGE_SIZE, useRecordMutations, useRecords } from './hooks'
import { RecordSheet } from './record-form'

type ColKey = 'status' | 'unit' | 'updatedAt'
const COLS: { key: ColKey; label: string }[] = [
  { key: 'status', label: 'Status' }, { key: 'unit', label: 'Unit' }, { key: 'updatedAt', label: 'Updated' },
]

function RowActions({ r, onEdit, onDelete, onDuplicate, onArchive }: { r: RecordItem; onEdit: () => void; onDelete: () => void; onDuplicate: () => void; onArchive: () => void }) {
  const can = useCan()
  if (!can('record.update') && !can('record.delete') && !can('record.create')) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${r.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {can('record.update') && <DropdownMenuItem onSelect={onEdit}><Pencil />Edit</DropdownMenuItem>}
        {can('record.update') && r.status !== 'archived' && <DropdownMenuItem onSelect={onArchive}><Archive />Archive</DropdownMenuItem>}
        {can('record.create') && <DropdownMenuItem onSelect={onDuplicate}><Copy />Duplicate</DropdownMenuItem>}
        {can('record.delete') && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />Delete</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function RecordsPage() {
  const t = useTerm()
  const can = useCan()
  const nav = useNavigate()
  const search = useSearch({ strict: false }) as { q?: string; new?: boolean }
  const mobile = useIsMobile()
  const [status, setStatus] = React.useState('all')
  const [q, setQ] = React.useState(search.q ?? '')
  const [dq, setDq] = React.useState(q)
  const [cursors, setCursors] = React.useState<(string | null)[]>([null])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [cols, setCols] = React.useState<Record<ColKey, boolean>>({ status: true, unit: true, updatedAt: true })
  const [sheet, setSheet] = React.useState<{ open: boolean; record: RecordItem | null }>({ open: false, record: null })
  const [toDelete, setToDelete] = React.useState<RecordItem[] | null>(null)
  const { create, update, remove } = useRecordMutations()
  const me = useMe()
  const unitName = (id: string) => me.units.find((u) => u.id === id)?.name ?? '-'
  const page = cursors.length - 1
  const { data, isLoading, isError, refetch, isFetching } = useRecords({ status, q: dq, cursor: cursors[page] ?? null })
  const items = data?.items ?? []

  React.useEffect(() => { const h = setTimeout(() => { setDq(q); setCursors([null]) }, 250); return () => clearTimeout(h) }, [q])
  React.useEffect(() => { if (search.new && can('record.create')) { setSheet({ open: true, record: null }); nav({ to: '/records', search: {} as never, replace: true }) } }, [search.new])
  React.useEffect(() => setSelected(new Set()), [status, dq, page])

  const one = t('record.singular'), many = t('record.plural')
  const allSelected = items.length > 0 && items.every((r) => selected.has(r.id))
  const someSelected = items.some((r) => selected.has(r.id))
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((r) => r.id)))
  const duplicate = (r: RecordItem) => create.mutate({ title: `${r.title} (copy)`, status: 'open', notes: r.notes }, { onSuccess: () => toast.success(`${one} duplicated`), onError: (e) => toast.error(e.message) })
  const archive = (r: RecordItem) => update.mutate({ id: r.id, status: 'archived' }, { onSuccess: () => toast.success(`${one} archived`), onError: (e) => toast.error(e.message) })
  const confirmDelete = async () => {
    if (!toDelete) return
    try { await Promise.all(toDelete.map((r) => remove.mutateAsync(r.id))); toast.success(`${toDelete.length} ${toDelete.length === 1 ? one.toLowerCase() : many.toLowerCase()} deleted`); setSelected(new Set()); setCursors([null]) } catch (e) { toast.error((e as Error).message) }
    setToDelete(null)
  }

  return (
    <RequirePermission permission="record.read">
      <PageHeader title={many} description={`Track and manage ${many.toLowerCase()} for the current ${t('unit.singular', { lower: true })}.`}
        actions={<Can permission="record.create"><Button onClick={() => setSheet({ open: true, record: null })} className="max-md:hidden"><Plus />New {one.toLowerCase()}</Button></Can>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${many.toLowerCase()}`} aria-label={`Search ${many.toLowerCase()}`} className="pl-8" />
        </div>
        <div role="group" aria-label="Filter by status" className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5">
          {['all', ...RECORD_STATUSES].map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setCursors([null]) }}
              className={cn('inline-flex h-(--ctl-h) shrink-0 items-center rounded-full border px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', status === s ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-background text-muted-foreground')}>
              {s === 'all' ? 'All' : recordStatusLabel(s as never)}
            </button>
          ))}
        </div>
        {!mobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="ml-auto"><SlidersHorizontal />View</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {COLS.map((c) => <DropdownMenuCheckboxItem key={c.key} checked={cols[c.key]} onCheckedChange={(v) => setCols((p) => ({ ...p, [c.key]: !!v }))} onSelect={(e) => e.preventDefault()}>{c.key === 'unit' ? t('unit.singular') : c.label}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/60 px-3 py-1.5 text-sm" role="status">
          <span className="font-medium">{selected.size} selected</span>
          <Can permission="record.delete"><Button size="sm" variant="outline" onClick={() => setToDelete(items.filter((r) => selected.has(r.id)))}><Trash2 />Delete</Button></Can>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}><X />Clear</Button>
        </div>
      )}

      {isError ? <Card><ErrorState onRetry={() => refetch()} /></Card> : isLoading ? (
        <div className="grid gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={FileText} title={dq || status !== 'all' ? `No ${many.toLowerCase()} match your filters` : `No ${many.toLowerCase()} yet`}
          description={dq || status !== 'all' ? 'Try a different search or clear the status filter.' : `Create your first ${one.toLowerCase()} to get started.`}
          action={can('record.create') && !dq && status === 'all' ? <Button onClick={() => setSheet({ open: true, record: null })}><Plus />New {one.toLowerCase()}</Button> : dq || status !== 'all' ? <Button variant="outline" onClick={() => { setQ(''); setStatus('all') }}>Clear filters</Button> : undefined} /></Card>
      ) : mobile ? (
        <ul className="grid gap-2" aria-label={many}>
          {items.map((r) => (
            <li key={r.id}>
              <Card className="gap-2 py-3">
                <div className="flex items-start gap-2 px-3">
                  <div className="min-w-0 flex-1">
                    
                    <div className="font-semibold leading-snug">{r.title}</div><div className="text-xs text-muted-foreground">{unitName(r.unitId)}</div>
                  </div>
                  <RecordStatusBadge status={r.status} />
                  <RowActions r={r} onEdit={() => setSheet({ open: true, record: r })} onDelete={() => setToDelete([r])} onDuplicate={() => duplicate(r)} onArchive={() => archive(r)} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 text-sm text-muted-foreground">
                  <span>Updated {shortDate(r.updatedAt)}</span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table aria-label={many} className={isFetching ? 'opacity-70' : undefined}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead><Checkbox aria-label="Select all rows" checked={allSelected ? true : someSelected ? 'indeterminate' : false} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>{one}</TableHead>
                {cols.status && <TableHead>Status</TableHead>}
                {cols.unit && <TableHead>{t('unit.singular')}</TableHead>}
                {cols.updatedAt && <TableHead>Updated</TableHead>}
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id} data-state={selected.has(r.id) ? 'selected' : undefined}>
                  <TableCell><Checkbox aria-label={`Select ${r.title}`} checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  {cols.status && <TableCell><RecordStatusBadge status={r.status} /></TableCell>}
                  {cols.unit && <TableCell className="text-muted-foreground">{unitName(r.unitId)}</TableCell>}
                  {cols.updatedAt && <TableCell className="whitespace-nowrap text-muted-foreground">{shortDate(r.updatedAt)}</TableCell>}
                  <TableCell><RowActions r={r} onEdit={() => setSheet({ open: true, record: r })} onDelete={() => setToDelete([r])} onDuplicate={() => duplicate(r)} onArchive={() => archive(r)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {items.length > 0 && (
        <div className="mt-3">
          <Pagination page={page} pageSize={PAGE_SIZE} hasNext={!!data?.nextCursor} onPrev={() => setCursors((c) => c.slice(0, -1))} onNext={() => data?.nextCursor && setCursors((c) => [...c, data.nextCursor])} />
        </div>
      )}

      <Can permission="record.create">
        <Button size="icon" aria-label={`New ${one.toLowerCase()}`} onClick={() => setSheet({ open: true, record: null })} className="fixed right-4 bottom-20 z-20 size-14 rounded-full shadow-lg md:hidden [&_svg]:size-6"><Plus /></Button>
      </Can>

      <RecordSheet open={sheet.open} onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))} record={sheet.record} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} destructive confirmLabel="Delete" pending={remove.isPending}
        title={`Delete ${toDelete?.length === 1 ? one.toLowerCase() : `${toDelete?.length} ${many.toLowerCase()}`}?`}
        description={toDelete?.length === 1 ? `"${toDelete[0]!.title}" will be permanently removed. This cannot be undone.` : 'They will be permanently removed. This cannot be undone.'} onConfirm={confirmDelete} />
    </RequirePermission>
  )
}
