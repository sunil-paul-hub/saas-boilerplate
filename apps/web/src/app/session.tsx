import * as React from 'react'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { Me } from '@/lib/types'

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => {
    try { return await api.auth.me() } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  },
  staleTime: 60_000,
  retry: false,
})

/** Current session. Only call inside routes that sit below the auth guard. */
export function useMe(): Me {
  const { data } = useQuery(meQuery)
  if (!data) throw new Error('useMe called without a session')
  return data
}
export function useMaybeMe() {
  return useQuery(meQuery)
}

export function useCan() {
  const { data } = useQuery(meQuery)
  const set = React.useMemo(() => new Set([...(data?.permissions ?? []), ...(data?.isPlatformAdmin ? ['platform.admin'] : [])]), [data])
  return React.useCallback((perm?: string) => !perm || set.has(perm), [set])
}

/** <Can permission="record.create">...</Can> */
export function Can({ permission, children, fallback = null }: { permission?: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  const can = useCan()
  return <>{can(permission) ? children : fallback}</>
}

export function useSwitchUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (unitId: string) => api.auth.switch({ orgId: qc.getQueryData<Me>(['me'])?.org?.id ?? '', unitId }),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me)
      // unit-scoped data must reload for the new unit
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    },
  })
}
export function useSwitchOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orgId: string) => api.auth.switch({ orgId }),
    onSuccess: (me) => { qc.clear(); qc.setQueryData(['me'], me) },
  })
}
export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.auth.logout(),
    // Full navigation: avoids rendering signed-in pages with no session while the cache clears.
    onSuccess: () => { qc.clear(); window.location.assign('/sign-in') },
  })
}
