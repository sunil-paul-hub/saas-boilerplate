import type * as T from '@/lib/types'

const day = 86_400_000
const ago = (d: number, h = 0) => new Date(Date.now() - d * day - h * 3_600_000).toISOString()

/** Same permission codes as packages/permissions. */
export const PERMISSIONS: T.Permission[] = [
  { code: 'org.manage', label: 'Manage organisation profile', group: 'Organisation' },
  { code: 'unit.manage', label: 'Manage units', group: 'Organisation' },
  { code: 'member.invite', label: 'Invite members', group: 'People' },
  { code: 'member.manage', label: 'Manage members and unit roles', group: 'People' },
  { code: 'role.manage', label: 'Manage roles', group: 'People' },
  { code: 'record.read', label: 'View records', group: 'Records' },
  { code: 'record.create', label: 'Create records', group: 'Records' },
  { code: 'record.update', label: 'Edit records', group: 'Records' },
  { code: 'record.delete', label: 'Delete records', group: 'Records' },
  { code: 'audit.read', label: 'View audit log', group: 'Other' },
  { code: 'billing.read', label: 'View billing', group: 'Billing' },
  { code: 'billing.manage', label: 'Manage billing', group: 'Billing' },
  { code: 'chat.use', label: 'Use chat', group: 'Other' },
  { code: 'settings.manage', label: 'Manage settings', group: 'Other' },
  { code: 'files.manage', label: 'Manage files', group: 'Other' },
]
export const ALL_PERMS = PERMISSIONS.map((p) => p.code)

export const ROLES: T.Role[] = [
  { id: 'role-manager', name: 'manager', description: 'Runs a unit day to day', system: true, memberCount: 0,
    permissions: ['record.read', 'record.create', 'record.update', 'record.delete', 'chat.use', 'files.manage'] },
  { id: 'role-member', name: 'member', description: 'Creates and updates records', system: true, memberCount: 0,
    permissions: ['record.read', 'record.create', 'record.update', 'chat.use'] },
  { id: 'role-viewer', name: 'viewer', description: 'Read-only access', system: true, memberCount: 0,
    permissions: ['record.read', 'chat.use'] },
]

export const USERS: (T.User & { password: string })[] = [
  { id: 'u-priya', name: 'Priya Sharma', email: 'priya@acme.test', password: 'password' },
  { id: 'u-ana', name: 'Ana Costa', email: 'ana@acme.test', password: 'password' },
  { id: 'u-tom', name: 'Tom Becker', email: 'tom@acme.test', password: 'password' },
  { id: 'u-op', name: 'Olivia Operator', email: 'operator@platform.test', password: 'password' },
]

export const db = {
  org: { id: 'org-acme', name: 'Acme Industries', slug: 'acme', status: 'active' as T.OrgStatus, setupComplete: true, planCode: 'pro', profile: { legalName: 'Acme Industries Pvt Ltd', website: 'https://acme.example', timezone: 'Asia/Kolkata', currency: 'USD' } as T.OrgProfile },
  units: [
    { id: 'unit-ho', name: 'Head Office', code: 'HO', isActive: true, memberCount: 3 },
    { id: 'unit-north', name: 'North Branch', code: 'NB', isActive: true, memberCount: 2 },
    { id: 'unit-south', name: 'South Branch', code: 'SB', isActive: true, memberCount: 1 },
  ] as T.Unit[],
  members: [
    { id: 'u-priya', userId: 'u-priya', name: 'Priya Sharma', email: 'priya@acme.test', orgRole: 'owner', status: 'active', unitRoles: [] },
    { id: 'u-ana', userId: 'u-ana', name: 'Ana Costa', email: 'ana@acme.test', orgRole: 'member', status: 'active', unitRoles: [{ unitId: 'unit-ho', roleId: 'role-manager' }, { unitId: 'unit-north', roleId: 'role-member' }] },
    { id: 'u-tom', userId: 'u-tom', name: 'Tom Becker', email: 'tom@acme.test', orgRole: 'member', status: 'active', unitRoles: [{ unitId: 'unit-north', roleId: 'role-viewer' }] },
  ] as T.Member[],
  roles: ROLES,
  records: [] as T.RecordItem[],
  audit: [] as T.AuditEvent[],
  notifications: [
    { id: 'n1', title: 'Welcome', body: 'This is mock data.', at: ago(0, 2), read: false, link: '/records' },
    { id: 'n2', title: 'Role updated', body: 'The member role changed.', at: ago(4), read: true, link: '/people' },
  ] as T.NotificationItem[],
  conversations: [
    { id: 'c-all', title: 'Acme general', kind: 'group', lastMessage: 'Welcome to the team chat.', lastAt: ago(0, 1), members: [{ id: 'u-priya', name: 'Priya Sharma' }, { id: 'u-ana', name: 'Ana Costa' }] },
    { id: 'c-ana', title: null, kind: 'direct', lastMessage: 'Thanks, will review today.', lastAt: ago(1, 4), members: [{ id: 'u-priya', name: 'Priya Sharma' }, { id: 'u-ana', name: 'Ana Costa' }] },
  ] as T.Conversation[],
  messages: [] as T.Message[],
  invoices: [] as T.Invoice[],
  terminology: {} as T.TermOverrideSettings,
  branding: {} as T.BrandingSettings,
  platformOrgs: [
    { id: 'org-acme', name: 'Acme Industries', ownerName: 'Priya Sharma', ownerEmail: 'priya@acme.test', status: 'active', planCode: 'pro', unitCount: 3, memberCount: 3, createdAt: ago(120) },
    { id: 'org-globex', name: 'Globex Corp', ownerName: 'Gina Globex', ownerEmail: 'gina@globex.test', status: 'trial', planCode: 'free', unitCount: 1, memberCount: 1, createdAt: ago(9) },
  ] as T.PlatformOrg[],
  platformRequests: [
    { id: 'req-1', orgName: 'Initech', contactName: 'Peter Founder', email: 'founder@initech.test', message: 'We run three workshops.', createdAt: ago(1), status: 'pending' },
  ] as T.PlatformRequest[],
  platformAudit: [] as T.PlatformAuditEvent[],
}

const TITLES = ['Quarterly safety review', 'Renew insurance policy', 'Inspect loading dock', 'Replace forklift battery', 'Onboard new supervisor', 'Audit stock count', 'Repaint warehouse floor', 'Vendor contract renewal', 'Inventory reconciliation', 'Staff training schedule', 'Equipment calibration', 'Monthly compliance report']
const STATUSES: T.RecordStatus[] = ['open', 'in_progress', 'done', 'open', 'in_progress', 'archived']
TITLES.forEach((title, i) => {
  db.records.push({
    id: `rec-${i + 1}`, title, status: STATUSES[i % STATUSES.length]!, unitId: ['unit-ho', 'unit-north', 'unit-south'][i % 3]!,
    notes: 'Mock data', createdBy: 'u-priya', createdAt: ago(i * 9 + 1), updatedAt: ago(i * 3),
  })
})
for (let i = 0; i < 20; i++) {
  db.audit.push({ id: `a-${i}`, at: ago(0, i * 5 + 1), actorId: 'u-priya', actor: 'Priya Sharma', action: ['record.create', 'record.update', 'unit.update'][i % 3]!, entityType: ['record', 'record', 'unit'][i % 3]!, entityId: `rec-${i}` })
}
db.messages.push(
  { id: 'm-1', conversationId: 'c-all', authorId: 'u-priya', authorName: 'Priya Sharma', body: 'Welcome to the team chat.', at: ago(0, 3) },
  { id: 'm-2', conversationId: 'c-all', authorId: 'u-ana', authorName: 'Ana Costa', body: 'Glad to be here.', at: ago(0, 2) },
)
