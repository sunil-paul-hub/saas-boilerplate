import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useMaybeMe } from '@/app/session'
import type { RecordInput } from '@/lib/types'

export const PAGE_SIZE = 10

/** Records of the unit currently selected in the header. */
export function useRecords(p: { status: string; q: string; cursor: string | null }) {
  const unitId = useMaybeMe().data?.currentUnitId
  return useQuery({
    queryKey: ['records', unitId, p],
    queryFn: () => api.records.list({ status: p.status === 'all' ? undefined : p.status, q: p.q, unitId, cursor: p.cursor, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
}
export function useRecordMutations() {
  const qc = useQueryClient()
  const inv = () => { qc.invalidateQueries({ queryKey: ['records'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) }
  return {
    create: useMutation({ mutationFn: (b: RecordInput) => api.records.create(b), onSuccess: inv }),
    update: useMutation({ mutationFn: ({ id, ...b }: RecordInput & { id: string }) => api.records.update(id, b), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id: string) => api.records.remove(id), onSuccess: inv }),
  }
}
