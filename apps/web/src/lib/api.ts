import type * as T from './types'
import { ApiError } from './errors'
import { mockRequest } from '@/mocks/handler'

/** The mock is opt-in: set VITE_USE_MOCK=true to run the web app without the API. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export { ApiError }

type Query = Record<string, string | number | boolean | null | undefined>

function qs(q?: Query) {
  if (!q) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function request<R>(method: string, path: string, opts: { body?: unknown; query?: Query } = {}): Promise<R> {
  if (USE_MOCK) return (await mockRequest(method, path, opts.query ?? {}, opts.body)) as R
  const res = await fetch(`/api${path}${qs(opts.query)}`, {
    method,
    credentials: 'include',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  if (res.status === 204) return undefined as R
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(data?.error?.code ?? 'unknown', data?.error?.message ?? res.statusText, res.status)
  }
  return data as R
}

const get = <R>(path: string, query?: Query) => request<R>('GET', path, { query })
const post = <R>(path: string, body?: unknown) => request<R>('POST', path, { body: body ?? {} })
const patch = <R>(path: string, body: unknown) => request<R>('PATCH', path, { body })
const put = <R>(path: string, body: unknown) => request<R>('PUT', path, { body })
const del = <R>(path: string) => request<R>('DELETE', path)
const items = <X>(p: T.Page<X>) => p.items

/** Keep only well-formed overrides ({ singular?, plural? } objects); ignore anything else stored in the settings. */
export function cleanTerms(raw: unknown): T.TermOverrideSettings {
  const out: T.TermOverrideSettings = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const { singular, plural } = v as { singular?: unknown; plural?: unknown }
    const e: { singular?: string; plural?: string } = {}
    if (typeof singular === 'string' && singular.trim()) e.singular = singular
    if (typeof plural === 'string' && plural.trim()) e.plural = plural
    if (e.singular || e.plural) out[k] = e
  }
  return out
}

export const api = {
  auth: {
    login: (b: { email: string; password: string }) => post<T.Me>('/auth/login', b),
    logout: () => post<void>('/auth/logout'),
    me: () => get<T.Me>('/auth/me'),
    switch: (b: { orgId: string; unitId?: string }) => post<T.Me>('/auth/switch', b),
    acceptInvite: (b: { token: string; name?: string; password: string }) => post<T.Me>('/auth/accept-invite', b),
    inviteInfo: (token: string) => get<{ orgName: string; email: string; orgRole: T.OrgRole; expiresAt: string; userExists: boolean }>('/auth/invite-info', { token }),
    updateProfile: (b: { name?: string }) => patch<T.Me>('/auth/profile', b),
  },
  onboarding: {
    request: (b: { orgName: string; contactName: string; contactEmail: string; details?: Record<string, unknown> }) =>
      post<{ id: string; status: string }>('/onboarding/requests', b),
    /** Marks the setup wizard finished (trial -> active). The wizard saves profile, unit, invites and plan first. */
    complete: () => post<{ id: string; status: string }>('/onboarding/complete'),
  },
  org: {
    get: () => get<T.OrgDetail>('/org'),
    update: (b: { name?: string; profile?: T.OrgProfile }) => patch<T.OrgDetail>('/org', b),
  },
  units: {
    list: () => get<T.Page<T.Unit>>('/units').then(items),
    create: (b: { name: string; code?: string | null }) => post<T.Unit>('/units', b),
    update: (id: string, b: { name?: string; code?: string | null; isActive?: boolean }) => patch<T.Unit>(`/units/${id}`, b),
  },
  members: {
    list: () => get<T.Page<T.Member>>('/members').then(items),
    invite: (b: { email: string; orgRole: 'admin' | 'member' | 'none'; unitId?: string; roleId?: string }) => post<T.InviteResult>('/members/invite', b),
    setUnitRoles: (id: string, unitRoles: T.UnitRoleAssignment[]) => put<{ id: string; unitRoles: T.UnitRoleAssignment[] }>(`/members/${id}/unit-roles`, { unitRoles }),
  },
  roles: {
    list: () => get<T.Page<T.Role>>('/roles').then(items),
    create: (b: { name: string; description?: string; permissions: string[] }) => post<T.Role>('/roles', b),
    update: (id: string, b: { name?: string; description?: string | null; permissions?: string[] }) => patch<T.Role>(`/roles/${id}`, b),
    permissions: () => get<T.Page<T.Permission>>('/permissions').then(items),
  },
  records: {
    list: (q: { status?: string; q?: string; unitId?: string | null; cursor?: string | null; limit?: number }) =>
      get<T.Page<T.RecordItem>>('/records', { status: q.status, search: q.q, unitId: q.unitId, cursor: q.cursor, limit: q.limit }),
    get: (id: string) => get<T.RecordItem>(`/records/${id}`),
    create: (b: T.RecordInput) => post<T.RecordItem>('/records', b),
    update: (id: string, b: T.RecordInput) => patch<T.RecordItem>(`/records/${id}`, b),
    remove: (id: string) => del<void>(`/records/${id}`),
  },
  dashboard: { summary: (unitId?: string | null) => get<T.DashboardSummary>('/dashboard/summary', { unitId }) },
  audit: { list: (q: { cursor?: string | null; entityType?: string }) => get<T.Page<T.AuditEvent>>('/audit', q) },
  notifications: {
    list: () => get<T.Page<T.NotificationItem>>('/notifications'),
    markRead: (ids?: string[]) => post<unknown>('/notifications/read', ids ? { ids } : { all: true }),
  },
  chat: {
    conversations: () => get<T.Page<T.Conversation>>('/chat/conversations').then(items),
    /** API returns newest first; the UI shows oldest first. */
    messages: (id: string) => get<T.Page<T.Message>>(`/chat/conversations/${id}/messages`, { limit: 100 }).then((p) => ({ ...p, items: [...p.items].reverse() })),
    send: (id: string, b: { body: string }) => post<T.Message>(`/chat/conversations/${id}/messages`, b),
  },
  billing: {
    plan: () => get<T.PlanInfo>('/billing/plan'),
    invoices: () => get<T.Page<T.Invoice>>('/billing/invoices'),
    changePlan: (planCode: string) => post<unknown>('/billing/plan', { planCode }),
  },
  settings: {
    terminology: () => get<{ terminology: T.TermOverrideSettings }>('/settings/terminology').then((r) => cleanTerms(r.terminology)),
    updateTerminology: (terminology: T.TermOverrideSettings) => patch<{ terminology: T.TermOverrideSettings }>('/settings/terminology', { terminology }).then((r) => cleanTerms(r.terminology)),
    branding: () => get<{ branding: T.BrandingSettings }>('/settings/branding').then((r) => r.branding ?? {}),
    updateBranding: (branding: T.BrandingSettings) => patch<{ branding: T.BrandingSettings }>('/settings/branding', { branding }).then((r) => r.branding ?? {}),
  },
  platform: {
    orgs: () => get<T.Page<T.PlatformOrg>>('/platform/orgs', { limit: 100 }),
    createOrg: (b: { name: string; adminName?: string; adminEmail: string; planCode?: string }) => post<T.ProvisionResult>('/platform/orgs', b),
    orgAction: (id: string, action: 'approve' | 'reject' | 'suspend' | 'reactivate') => post<T.ProvisionResult>(`/platform/orgs/${id}/${action}`),
    requests: () => get<T.Page<T.PlatformRequest>>('/platform/requests', { limit: 100 }),
    setPlan: (id: string, planCode: string) => patch<unknown>(`/platform/orgs/${id}/plan`, { planCode }),
    viewAs: (id: string) => post<T.OrgSnapshot>(`/platform/orgs/${id}/view-as`),
    audit: () => get<T.Page<T.PlatformAuditEvent>>('/platform/audit'),
    requestAction: (id: string, action: 'approve' | 'reject') => post<T.ProvisionResult>(`/platform/requests/${id}/${action}`),
  },
}
