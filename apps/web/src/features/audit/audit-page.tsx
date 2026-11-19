import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { api } from '@/lib/api'
import type { AuditEvent } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorState, PageHeader } from '@/components/page'
import { RequirePermission } from '@/components/forbidden'
import { useIsMobile } from '@/hooks/use-media'

const target = (a: AuditEvent) => [a.entityType, a.entityId ? a.entityId.slice(0, 8) : null].filter(Boolean).join(' ') || '-'

export function AuditTable({ items }: { items: (AuditEvent & { orgName?: string })[] }) {
  const mobile = useIsMobile()
  if (mobile) {
    return (
      <ul className="grid gap-2">
        {items.map((a) => (
          <li key={a.id}><Card className="gap-1 py-3"><div className="flex items-center gap-2 px-3"><Badge variant="secondary">{a.action}</Badge><span className="ml-auto text-xs text-muted-foreground">{timeAgo(a.at)}</span></div><div className="px-3 text-sm"><span className="font-medium">{a.actor ?? 'System'}</span> <span className="text-muted-foreground">{target(a)}</span></div></Card></li>
        ))}
      </ul>
    )
  }
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table aria-label="Audit events">
        <TableHeader><TableRow className="hover:bg-transparent"><TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead>{items[0]?.orgName !== undefined && <TableHead>Organisation</TableHead>}</TableRow></TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground" title={new Date(a.at).toLocaleString()}>{timeAgo(a.at)}</TableCell>
              <TableCell className="font-medium">{a.actor ?? 'System'}</TableCell>
              <TableCell><Badge variant="secondary" className="font-mono">{a.action}</Badge></TableCell>
              <TableCell>{target(a)}</TableCell>
              {a.orgName !== undefined && <TableCell>{a.orgName}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

export function AuditPage() {
  const [type, setType] = React.useState('all')
  const [cursors, setCursors] = React.useState<(string | null)[]>([null])
  const page = cursors.length - 1
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['audit', type, cursors[page]], queryFn: () => api.audit.list({ entityType: type === 'all' ? undefined : type, cursor: cursors[page] }), placeholderData: keepPreviousData })
  return (
    <RequirePermission permission="audit.read">
      <PageHeader title="Audit log" description="Every important change, who made it and when. Entries cannot be edited or deleted." />
      <div className="mb-3 sm:max-w-xs">
        <Select value={type} onValueChange={(v) => { setType(v); setCursors([null]) }}>
          <SelectTrigger aria-label="Filter by type"><SelectValue /></SelectTrigger>
          <SelectContent>{['all', 'record', 'unit', 'membership', 'invitation', 'role', 'organisation', 'org_settings', 'subscription', 'conversation', 'user'].map((x) => <SelectItem key={x} value={x}>{x === 'all' ? 'All activity' : x.replace('_', ' ')}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {isError ? <Card><ErrorState onRetry={() => refetch()} /></Card> : isLoading ? <div className="grid gap-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
        !data?.items.length ? <Card><EmptyState icon={ScrollText} title="No events found" description="Try a different filter." /></Card> : (
          <>
            <AuditTable items={data.items} />
            <div className="mt-3"><Pagination page={page} pageSize={25} hasNext={!!data.nextCursor} onPrev={() => setCursors((c) => c.slice(0, -1))} onNext={() => setCursors((c) => [...c, data.nextCursor])} /></div>
          </>
        )}
    </RequirePermission>
  )
}
