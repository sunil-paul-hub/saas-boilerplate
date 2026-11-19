/** Wire shapes of the real API (see apps/api and packages/contracts). */
export type Id = string
export type Page<T> = { items: T[]; nextCursor: string | null }

export type OrgRole = 'owner' | 'admin' | 'member' | 'none'
export type OrgStatus = 'pending' | 'trial' | 'active' | 'past_due' | 'suspended' | 'archived' | 'rejected'

export type User = { id: Id; name: string; email: string }
export type Unit = { id: Id; name: string; code: string | null; isActive: boolean; memberCount?: number }
export type Membership = { orgId: Id; orgName: string; orgRole: OrgRole; status?: string }
export type OrgSummary = { id: Id; name: string; slug?: string; status: OrgStatus; setupComplete: boolean; trialEndsAt?: string | null }

export type Me = {
  user: User
  memberships: Membership[]
  org: OrgSummary | null
  orgRole: OrgRole
  units: Unit[]
  currentUnitId: Id | null
  permissions: string[]
  isPlatformAdmin: boolean
}

export type RecordStatus = 'open' | 'in_progress' | 'done' | 'archived'
export type RecordItem = {
  id: Id
  title: string
  status: RecordStatus
  unitId: Id
  notes: string | null
  createdBy: Id | null
  createdAt: string
  updatedAt: string
}
export type RecordInput = { title?: string; status?: RecordStatus; notes?: string | null; unitId?: Id }

export type UnitRoleAssignment = { unitId: Id; roleId: Id }
export type Member = {
  id: Id
  userId: Id | null
  name: string
  email: string
  orgRole: OrgRole
  status: 'active' | 'suspended' | 'invited'
  unitRoles: UnitRoleAssignment[]
}
export type InviteResult = { id: Id; email: string; expiresAt: string; inviteToken?: string }
export type Role = { id: Id; name: string; description: string | null; system: boolean; permissions: string[]; memberCount: number }
export type Permission = { code: string; label: string; group: string }

export type AuditEvent = {
  id: Id
  at: string
  actorId: Id | null
  actor: string | null
  action: string
  entityType: string | null
  entityId: string | null
  unitId?: Id | null
  metadata?: Record<string, unknown> | null
}
export type NotificationItem = { id: Id; title: string; body: string | null; at: string; read: boolean; link?: string | null }

export type Conversation = {
  id: Id
  title: string | null
  kind: 'direct' | 'group'
  lastMessage: string | null
  lastAt: string | null
  members: { id: Id; name: string }[]
}
export type Message = { id: Id; conversationId: Id; authorId: Id | null; authorName: string | null; body: string; at: string }

export type PlanOption = { code: string; name: string; pricePerMonth: number; currency: string; maxUnits: number | null; maxMembers: number | null }
export type PlanInfo = {
  planCode: string
  planName: string
  status: OrgStatus
  subscriptionStatus?: string
  pricePerMonth: number
  currency: string
  renewsAt: string | null
  trialEndsAt: string | null
  usage: { units: number; unitsLimit: number | null; members: number; membersLimit: number | null; records: number; recordsLimit: number | null }
  provider: string
  available: PlanOption[]
}
export type Invoice = { id: Id; number: string; issuedAt: string; amount: number; currency: string; status: 'paid' | 'open' | 'void' | string; dueAt?: string | null; paidAt?: string | null }

export type TermOverrideSettings = Record<string, { singular?: string; plural?: string }>
export type BrandingSettings = { productName?: string; accentColor?: string; supportEmail?: string; logoUrl?: string }
export type OrgProfile = { legalName?: string; website?: string; timezone?: string; currency?: string }
export type OrgDetail = { id: Id; name: string; slug: string; status: OrgStatus; setupComplete: boolean; trialEndsAt: string | null; profile: OrgProfile }

export type PlatformOrg = {
  id: Id
  name: string
  slug?: string
  ownerName: string
  ownerEmail: string
  status: OrgStatus
  planCode: string | null
  unitCount: number
  memberCount: number
  createdAt: string
}
export type PlatformRequest = { id: Id; orgName: string; contactName: string; email: string; message: string; createdAt: string; status: 'pending' | 'approved' | 'rejected' | string; orgId?: Id | null }
export type PlatformAuditEvent = AuditEvent & { orgName: string }
export type ProvisionResult = { id: Id; orgId: Id; status?: string; inviteToken?: string }
export type OrgSnapshot = {
  id: Id
  org: { id: Id; name: string; slug: string; status: OrgStatus; trialEndsAt: string | null }
  units: Unit[]
  members: { id: Id; name: string; email: string; orgRole: OrgRole; status: string }[]
  subscription: { planCode: string; status: string } | null
}

export type DashboardSummary = {
  total: number
  byStatus: Record<RecordStatus, number>
  monthly: { month: string; count: number }[]
  recent: { id: Id; title: string; status: RecordStatus; unitId: Id; updatedAt: string }[]
}
