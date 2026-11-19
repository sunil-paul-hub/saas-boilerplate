/**
 * In-app mock of the API contract. Enabled only with VITE_USE_MOCK=true (default is the real API).
 * It returns the same wire shapes as apps/api. State lives in memory; the session is kept in localStorage.
 * Demo logins: priya@acme.test (owner), ana@acme.test (member), operator@platform.test (platform admin); password "password".
 */
import type * as T from '@/lib/types'
import { ApiError } from '@/lib/errors'
import { ALL_PERMS, PERMISSIONS, USERS, db } from './data'

const KEY = 'base.mock.session'
type Session = { userId: string; unitId: string | null } | null

function getSession(): Session {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}
function setSession(s: Session) {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY) } catch { /* ignore */ }
}

class MockError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message) }
}
const fail = (status: number, code: string, message: string): never => { throw new MockError(code, message, status) }
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()

function audit(actor: T.User, action: string, entityType: string, entityId: string) {
  db.audit.unshift({ id: uid('a'), at: now(), actorId: actor.id, actor: actor.name, action, entityType, entityId })
}

function permsFor(userId: string, unitId: string | null): string[] {
  const m = db.members.find((x) => x.id === userId)
  if (!m) return []
  if (m.orgRole === 'owner' || m.orgRole === 'admin') return ALL_PERMS
  const a = m.unitRoles.find((u) => u.unitId === unitId)
  const role = a && db.roles.find((r) => r.id === a.roleId)
  return role?.permissions ?? []
}
function unitsFor(userId: string): T.Unit[] {
  const m = db.members.find((x) => x.id === userId)
  if (!m) return []
  if (m.orgRole === 'owner' || m.orgRole === 'admin') return db.units
  return db.units.filter((u) => m.unitRoles.some((r) => r.unitId === u.id))
}

function buildMe(): T.Me {
  const s = getSession()
  if (!s) fail(401, 'unauthorized', 'Sign in required')
  const user = USERS.find((u) => u.id === s!.userId)!
  const base = { user: { id: user.id, name: user.name, email: user.email }, isPlatformAdmin: user.id === 'u-op' }
  if (user.id === 'u-op') return { ...base, memberships: [], org: null, orgRole: 'none', units: [], currentUnitId: null, permissions: [] }
  const member = db.members.find((m) => m.id === user.id)!
  const units = unitsFor(user.id)
  const currentUnitId = units.find((u) => u.id === s!.unitId)?.id ?? units[0]?.id ?? null
  return {
    ...base,
    memberships: [{ orgId: db.org.id, orgName: db.org.name, orgRole: member.orgRole, status: 'active' }],
    org: { id: db.org.id, name: db.org.name, slug: db.org.slug, status: db.org.status, setupComplete: db.org.setupComplete, trialEndsAt: null },
    orgRole: member.orgRole, units, currentUnitId, permissions: permsFor(user.id, currentUnitId),
  }
}

const need = (me: T.Me, perm: string) => { if (!me.permissions.includes(perm)) fail(403, 'forbidden', 'You do not have permission to do that') }
const requireOp = (me: T.Me) => { if (!me.isPlatformAdmin) fail(403, 'forbidden', 'Platform administrators only.') }

function page<X>(items: X[], q: Q, def = 25) {
  const limit = Number(q.limit ?? def)
  const start = Number(q.cursor ?? 0) || 0
  return { items: items.slice(start, start + limit), nextCursor: start + limit < items.length ? String(start + limit) : null }
}
const wrap = <X>(items: X[]) => ({ items, nextCursor: null })

type Q = Record<string, string | number | boolean | null | undefined>
type B = any

export async function mockRequest(method: string, path: string, q: Q, body: B): Promise<unknown> {
  await sleep(60 + Math.random() * 80)
  try {
    return route(method, path, q, body ?? {})
  } catch (e) {
    if (e instanceof MockError) throw new ApiError(e.code, e.message, e.status)
    throw e
  }
}

function route(method: string, path: string, q: Q, b: B): unknown {
  const seg = path.split('/').filter(Boolean)
  const key = `${method} /${seg.join('/')}`

  if (key === 'POST /auth/login') {
    const u = USERS.find((x) => x.email.toLowerCase() === String(b.email).toLowerCase())
    if (!u || b.password !== u.password) fail(401, 'invalid_credentials', 'Incorrect email or password')
    setSession({ userId: u!.id, unitId: null })
    return buildMe()
  }
  if (key === 'POST /auth/logout') { setSession(null); return undefined }
  if (key === 'POST /onboarding/requests') {
    const id = uid('req')
    db.platformRequests.unshift({ id, orgName: b.orgName, contactName: b.contactName, email: b.contactEmail, message: b.details?.message ?? '', createdAt: now(), status: 'pending' })
    return { id, status: 'pending' }
  }
  if (key === 'GET /auth/invite-info') return { orgName: db.org.name, email: 'new.person@acme.test', orgRole: 'member', expiresAt: now(), userExists: false }
  if (key === 'POST /auth/accept-invite') { setSession({ userId: 'u-ana', unitId: null }); return buildMe() }

  const me = buildMe()
  const user = me.user

  switch (key) {
    case 'GET /auth/me': return me
    case 'PATCH /auth/profile': { const u = USERS.find((x) => x.id === user.id)!; if (b.name) u.name = b.name; const m = db.members.find((x) => x.id === user.id); if (m && b.name) m.name = b.name; return buildMe() }
    case 'POST /auth/switch': { const s = getSession()!; setSession({ ...s, unitId: b.unitId ?? s.unitId }); return buildMe() }
    case 'POST /onboarding/complete': db.org.status = 'active'; db.org.setupComplete = true; return { id: db.org.id, status: 'active' }
    case 'GET /org': return { id: db.org.id, name: db.org.name, slug: db.org.slug, status: db.org.status, setupComplete: db.org.setupComplete, trialEndsAt: null, profile: db.org.profile }
    case 'PATCH /org': { need(me, 'org.manage'); if (b.name) db.org.name = b.name; if (b.profile) db.org.profile = b.profile; audit(user, 'org.update', 'organisation', db.org.id); return route('GET', '/org', {}, {}) }
    case 'GET /units': return wrap(db.units)
    case 'POST /units': {
      need(me, 'unit.manage')
      const u: T.Unit = { id: uid('unit'), name: b.name, code: b.code ?? null, isActive: true, memberCount: 0 }
      db.units.push(u); audit(user, 'unit.create', 'unit', u.id); return u
    }
    case 'GET /members': return wrap(db.members)
    case 'POST /members/invite': {
      need(me, 'member.invite')
      const m: T.Member = { id: uid('inv'), userId: null, name: '', email: b.email, orgRole: b.orgRole ?? 'member', status: 'invited', unitRoles: [] }
      db.members.push(m); audit(user, 'member.invite', 'invitation', m.id)
      return { id: m.id, email: b.email, expiresAt: now(), inviteToken: 'mock-token-0123456789' }
    }
    case 'GET /roles': return wrap(db.roles.map((r) => ({ ...r, memberCount: db.members.filter((m) => m.unitRoles.some((u) => u.roleId === r.id)).length })))
    case 'POST /roles': {
      need(me, 'role.manage')
      const r: T.Role = { id: uid('role'), name: b.name, description: b.description ?? null, system: false, permissions: b.permissions ?? [], memberCount: 0 }
      db.roles.push(r); audit(user, 'role.create', 'role', r.id); return r
    }
    case 'GET /permissions': return wrap(PERMISSIONS)
    case 'GET /records': {
      need(me, 'record.read')
      let items = db.records.filter((r) => (q.unitId ? r.unitId === q.unitId : me.units.some((u) => u.id === r.unitId)))
      if (q.status) items = items.filter((r) => r.status === q.status)
      if (q.search) { const s = String(q.search).toLowerCase(); items = items.filter((r) => r.title.toLowerCase().includes(s) || (r.notes ?? '').toLowerCase().includes(s)) }
      items = [...items].sort((a, c) => c.createdAt.localeCompare(a.createdAt))
      return page(items, q, 10)
    }
    case 'POST /records': {
      need(me, 'record.create')
      const r: T.RecordItem = { id: uid('rec'), title: b.title, status: b.status ?? 'open', unitId: b.unitId ?? me.currentUnitId!, notes: b.notes ?? null, createdBy: user.id, createdAt: now(), updatedAt: now() }
      db.records.unshift(r); audit(user, 'record.create', 'record', r.id); return r
    }
    case 'GET /dashboard/summary': {
      need(me, 'record.read')
      const rs = db.records.filter((r) => (q.unitId ? r.unitId === q.unitId : me.units.some((u) => u.id === r.unitId)))
      const byStatus = { open: 0, in_progress: 0, done: 0, archived: 0 }
      rs.forEach((r) => { byStatus[r.status]++ })
      const monthly = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return { month: k, count: rs.filter((r) => r.createdAt.startsWith(k)).length }
      })
      const recent = [...rs].sort((a, c) => c.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map(({ id, title, status, unitId, updatedAt }) => ({ id, title, status, unitId, updatedAt }))
      return { total: rs.length, byStatus, monthly, recent } satisfies T.DashboardSummary
    }
  }

  if (seg[0] === 'records' && seg[1]) {
    const r = db.records.find((x) => x.id === seg[1])
    if (!r || !me.units.some((u) => u.id === r.unitId)) fail(404, 'not_found', 'Record not found')
    if (method === 'GET') { need(me, 'record.read'); return r }
    if (method === 'PATCH') { need(me, 'record.update'); Object.assign(r!, b, { updatedAt: now() }); audit(user, 'record.update', 'record', r!.id); return r }
    if (method === 'DELETE') { need(me, 'record.delete'); db.records.splice(db.records.indexOf(r!), 1); audit(user, 'record.delete', 'record', r!.id); return undefined }
  }
  if (seg[0] === 'units' && seg[1] && method === 'PATCH') {
    need(me, 'unit.manage'); const u = db.units.find((x) => x.id === seg[1]); if (!u) fail(404, 'not_found', 'Unit not found'); Object.assign(u!, b); audit(user, 'unit.update', 'unit', u!.id); return u
  }
  if (seg[0] === 'members' && seg[2] === 'unit-roles' && method === 'PUT') {
    need(me, 'member.manage'); const m = db.members.find((x) => x.id === seg[1]); if (!m) fail(404, 'not_found', 'Member not found')
    m!.unitRoles = b.unitRoles ?? []; audit(user, 'member.unit_roles.set', 'membership', m!.id); return { id: m!.id, unitRoles: m!.unitRoles }
  }
  if (seg[0] === 'roles' && seg[1] && method === 'PATCH') {
    need(me, 'role.manage'); const r = db.roles.find((x) => x.id === seg[1]); if (!r) fail(404, 'not_found', 'Role not found')
    if (r!.system) fail(409, 'system_role', 'System roles cannot be changed')
    Object.assign(r!, b); audit(user, 'role.update', 'role', r!.id); return r
  }

  switch (key) {
    case 'GET /audit': { need(me, 'audit.read'); let items = db.audit; if (q.entityType) items = items.filter((a) => a.entityType === q.entityType); return page(items, q, 25) }
    case 'GET /notifications': return wrap(db.notifications)
    case 'POST /notifications/read': db.notifications.forEach((n) => { if (b.all || !b.ids || b.ids.includes(n.id)) n.read = true }); return { updated: 1 }
    case 'GET /chat/conversations': return wrap(db.conversations)
    case 'GET /billing/plan': {
      need(me, 'billing.read')
      const pro = db.org.planCode === 'pro'
      return {
        planCode: db.org.planCode, planName: pro ? 'Pro' : 'Free', status: db.org.status, subscriptionStatus: 'active', pricePerMonth: pro ? 49 : 0, currency: 'USD', renewsAt: null, trialEndsAt: null,
        usage: { units: db.units.length, unitsLimit: pro ? null : 3, members: db.members.length, membersLimit: pro ? null : 10, records: db.records.length, recordsLimit: null }, provider: 'manual',
        available: [{ code: 'free', name: 'Free', pricePerMonth: 0, currency: 'USD', maxUnits: 3, maxMembers: 10 }, { code: 'pro', name: 'Pro', pricePerMonth: 49, currency: 'USD', maxUnits: null, maxMembers: null }],
      } satisfies T.PlanInfo
    }
    case 'POST /billing/plan': { need(me, 'billing.manage'); db.org.planCode = b.planCode; audit(user, 'billing.plan.change', 'subscription', db.org.id); return { id: db.org.id, planCode: b.planCode, provider: 'manual' } }
    case 'GET /billing/invoices': { need(me, 'billing.read'); return wrap(db.invoices) }
    case 'GET /settings/terminology': return { terminology: db.terminology }
    case 'PATCH /settings/terminology': { need(me, 'settings.manage'); db.terminology = b.terminology; audit(user, 'settings.terminology.update', 'org_settings', db.org.id); return { terminology: db.terminology } }
    case 'GET /settings/branding': return { branding: db.branding }
    case 'PATCH /settings/branding': { need(me, 'settings.manage'); db.branding = b.branding; audit(user, 'settings.branding.update', 'org_settings', db.org.id); return { branding: db.branding } }
    case 'GET /platform/orgs': requireOp(me); return wrap(db.platformOrgs)
    case 'POST /platform/orgs': {
      requireOp(me)
      const o: T.PlatformOrg = { id: uid('org'), name: b.name, ownerName: b.adminName ?? '', ownerEmail: b.adminEmail, status: 'trial', planCode: b.planCode ?? 'free', unitCount: 0, memberCount: 0, createdAt: now() }
      db.platformOrgs.unshift(o); return { id: o.id, orgId: o.id, inviteToken: 'mock-token-0123456789' }
    }
    case 'GET /platform/requests': requireOp(me); return wrap(db.platformRequests)
    case 'GET /platform/audit': requireOp(me); return wrap(db.platformAudit)
  }

  if (seg[0] === 'chat' && seg[1] === 'conversations' && seg[3] === 'messages') {
    const id = seg[2]!
    if (method === 'GET') return wrap(db.messages.filter((m) => m.conversationId === id).reverse())
    const m: T.Message = { id: uid('m'), conversationId: id, authorId: user.id, authorName: user.name, body: b.body, at: now() }
    db.messages.push(m)
    const c = db.conversations.find((x) => x.id === id)!
    c.lastMessage = b.body; c.lastAt = m.at
    return m
  }
  if (seg[0] === 'platform' && seg[1] === 'orgs' && seg[2]) {
    requireOp(me)
    const o = db.platformOrgs.find((x) => x.id === seg[2]); if (!o) fail(404, 'not_found', 'Organisation not found')
    const act = seg[3]
    const map: Record<string, T.OrgStatus> = { approve: 'trial', reject: 'rejected', suspend: 'suspended', reactivate: 'active' }
    const log = (action: string) => db.platformAudit.unshift({ id: uid('pa'), at: now(), actorId: user.id, actor: user.name, action: `platform.org.${action}`, entityType: 'organisation', entityId: o!.id, orgName: o!.name })
    if (act && map[act]) { o!.status = map[act]!; log(act); return { id: o!.id, orgId: o!.id, status: o!.status } }
    if (act === 'plan') { o!.planCode = b.planCode; log('plan'); return { id: o!.id, planCode: b.planCode } }
    if (act === 'view-as') {
      log('view_as')
      return { id: o!.id, org: { id: o!.id, name: o!.name, slug: o!.name.toLowerCase(), status: o!.status, trialEndsAt: null }, units: o!.id === db.org.id ? db.units : [], members: o!.id === db.org.id ? db.members.map((m) => ({ id: m.id, name: m.name, email: m.email, orgRole: m.orgRole, status: m.status })) : [], subscription: { planCode: o!.planCode ?? 'free', status: o!.status } } satisfies T.OrgSnapshot
    }
  }
  if (seg[0] === 'platform' && seg[1] === 'requests' && seg[2]) {
    requireOp(me)
    const r = db.platformRequests.find((x) => x.id === seg[2])
    if (r && (seg[3] === 'approve' || seg[3] === 'reject')) {
      r.status = seg[3] === 'approve' ? 'approved' : 'rejected'
      if (seg[3] === 'approve') db.platformOrgs.unshift({ id: uid('org'), name: r.orgName, ownerName: r.contactName, ownerEmail: r.email, status: 'trial', planCode: 'free', unitCount: 0, memberCount: 0, createdAt: now() })
      return { id: r.id, status: r.status, ...(seg[3] === 'approve' ? { inviteToken: 'mock-token-0123456789' } : {}) }
    }
  }
  return fail(404, 'not_found', `No mock for ${method} ${path}`)
}
