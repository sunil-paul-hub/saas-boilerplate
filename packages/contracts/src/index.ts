import { z } from 'zod';

/* ---------- shared ---------- */
export const id = z.string().uuid();
export const orgRole = z.enum(['owner', 'admin', 'member', 'none']);
export const orgStatus = z.enum(['pending', 'trial', 'active', 'past_due', 'suspended', 'archived', 'rejected']);
export const recordStatus = z.enum(['open', 'in_progress', 'done', 'archived']);

export const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export const page = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable() });
export const pageQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/* ---------- auth ---------- */
export const loginBody = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });
export const switchBody = z.object({ orgId: id, unitId: id.optional() });
export const acceptInviteBody = z.object({
  token: z.string().min(10),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8).max(200).optional(),
});
export const userRef = z.object({ id, name: z.string(), email: z.string() });
export const unitDto = z.object({ id, name: z.string(), code: z.string().nullable(), isActive: z.boolean() });
export const meResponse = z.object({
  user: userRef,
  memberships: z.array(z.object({ orgId: id, orgName: z.string(), orgRole, status: z.string() })),
  org: z.object({ id, name: z.string(), slug: z.string(), status: orgStatus, trialEndsAt: z.string().nullable(), setupComplete: z.boolean() }).nullable(),
  orgRole,
  units: z.array(unitDto),
  currentUnitId: id.nullable(),
  permissions: z.array(z.string()),
  isPlatformAdmin: z.boolean(),
});

/* ---------- onboarding ---------- */
export const onboardingRequestBody = z.object({
  orgName: z.string().min(2).max(120),
  contactName: z.string().min(1).max(120),
  contactEmail: z.string().email(),
  details: z.record(z.unknown()).optional(),
});

/* ---------- org ---------- */
export const orgPatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  profile: z.record(z.unknown()).optional(),
});
export const unitCreateBody = z.object({ name: z.string().min(1).max(120), code: z.string().max(20).nullish() });
export const unitPatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().max(20).nullable().optional(),
  isActive: z.boolean().optional(),
});
export const inviteBody = z.object({
  email: z.string().email(),
  orgRole: z.enum(['admin', 'member', 'none']).default('member'),
  unitId: id.optional(),
  roleId: id.optional(),
});
export const unitRolesBody = z.object({ unitRoles: z.array(z.object({ unitId: id, roleId: id })).max(500) });
export const roleCreateBody = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  permissions: z.array(z.string()).default([]),
});
export const rolePatchBody = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(300).nullable().optional(),
  permissions: z.array(z.string()).optional(),
});

/* ---------- records ---------- */
export const recordCreateBody = z.object({
  title: z.string().min(1).max(200),
  unitId: id.optional(),
  status: recordStatus.optional(),
  notes: z.string().max(5000).nullish(),
});
export const recordPatchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  status: recordStatus.optional(),
  notes: z.string().max(5000).nullable().optional(),
  unitId: id.optional(),
});
export const recordListQuery = pageQuery.extend({
  status: recordStatus.optional(),
  unitId: id.optional(),
  search: z.string().max(200).optional(),
});
export const recordDto = z.object({
  id, unitId: id, title: z.string(), status: recordStatus, notes: z.string().nullable(),
  createdBy: id.nullable(), createdAt: z.string(), updatedAt: z.string(),
});

/* ---------- other ---------- */
export const auditQuery = pageQuery.extend({ action: z.string().optional(), entityType: z.string().optional() });
export const notificationsReadBody = z.object({ ids: z.array(id).optional(), all: z.boolean().optional() });
export const messageCreateBody = z.object({ body: z.string().min(1).max(4000) });
export const conversationCreateBody = z.object({
  title: z.string().max(120).optional(),
  kind: z.enum(['direct', 'group']).default('group'),
  memberIds: z.array(id).max(200).default([]),
});
export const termOverrides = z.record(z.object({ singular: z.string().max(60).optional(), plural: z.string().max(60).optional() }));
export const terminologyPatchBody = z.object({ terminology: termOverrides });
export const brandingPatchBody = z.object({
  branding: z.object({
    productName: z.string().max(80).optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    supportEmail: z.string().email().optional(),
    logoUrl: z.string().max(500).optional(),
  }).passthrough(),
});

/* ---------- platform ---------- */
export const platformOrgCreateBody = z.object({
  name: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  adminName: z.string().max(120).optional(),
  planCode: z.string().optional(),
});
export const platformPlanBody = z.object({ planCode: z.string().min(1) });
export const platformReasonBody = z.object({ reason: z.string().max(500).optional() });

/* ---------- inferred types ---------- */
export type LoginBody = z.infer<typeof loginBody>;
export type MeResponse = z.infer<typeof meResponse>;
export type OnboardingRequestBody = z.infer<typeof onboardingRequestBody>;
export type RecordDto = z.infer<typeof recordDto>;
export type RecordCreateBody = z.infer<typeof recordCreateBody>;
export type RecordPatchBody = z.infer<typeof recordPatchBody>;
export type RecordListQuery = z.infer<typeof recordListQuery>;
export type Page<T> = { items: T[]; nextCursor: string | null };
export type ErrorBody = z.infer<typeof errorBody>;
export type InviteBody = z.infer<typeof inviteBody>;
export type RoleCreateBody = z.infer<typeof roleCreateBody>;
export type PlatformOrgCreateBody = z.infer<typeof platformOrgCreateBody>;
