import { Badge } from '@/components/ui/badge'
import type { OrgStatus, RecordStatus } from '@/lib/types'

const rec: Record<RecordStatus, { label: string; v: 'success' | 'warning' | 'secondary' | 'danger' | 'outline' }> = {
  open: { label: 'Open', v: 'secondary' }, in_progress: { label: 'In progress', v: 'warning' },
  done: { label: 'Done', v: 'success' }, archived: { label: 'Archived', v: 'outline' },
}
export const recordStatusLabel = (s: RecordStatus) => rec[s].label
export const RECORD_STATUSES = Object.keys(rec) as RecordStatus[]
export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  return <Badge variant={rec[status].v}>{rec[status].label}</Badge>
}

const org: Record<OrgStatus, { label: string; v: 'success' | 'warning' | 'secondary' | 'danger' | 'outline' }> = {
  pending: { label: 'Pending', v: 'warning' }, trial: { label: 'Trial', v: 'secondary' }, active: { label: 'Active', v: 'success' },
  past_due: { label: 'Past due', v: 'danger' }, suspended: { label: 'Suspended', v: 'danger' }, archived: { label: 'Archived', v: 'outline' }, rejected: { label: 'Rejected', v: 'outline' },
}
export function OrgStatusBadge({ status }: { status: OrgStatus }) {
  return <Badge variant={org[status].v}>{org[status].label}</Badge>
}
