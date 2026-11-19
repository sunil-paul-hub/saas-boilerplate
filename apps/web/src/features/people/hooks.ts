import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { UnitRoleAssignment } from '@/lib/types'

export const useMembers = () => useQuery({ queryKey: ['members'], queryFn: api.members.list })
export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: api.roles.list })
export const usePermissions = () => useQuery({ queryKey: ['permissions'], queryFn: api.roles.permissions, staleTime: Infinity })
export const useUnits = () => useQuery({ queryKey: ['units'], queryFn: api.units.list })

export function usePeopleMutations() {
  const qc = useQueryClient()
  const inv = (k: string) => qc.invalidateQueries({ queryKey: [k] })
  return {
    invite: useMutation({ mutationFn: (b: { email: string; orgRole: 'admin' | 'member' }) => api.members.invite(b), onSuccess: () => inv('members') }),
    setUnitRoles: useMutation({ mutationFn: ({ id, unitRoles }: { id: string; unitRoles: UnitRoleAssignment[] }) => api.members.setUnitRoles(id, unitRoles), onSuccess: () => { inv('members'); inv('roles') } }),
    createRole: useMutation({ mutationFn: api.roles.create, onSuccess: () => inv('roles') }),
    updateRole: useMutation({ mutationFn: ({ id, ...b }: { id: string; name?: string; description?: string | null; permissions?: string[] }) => api.roles.update(id, b), onSuccess: () => inv('roles') }),
  }
}
