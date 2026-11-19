// Typed schema export (Drizzle). SQL migrations in ../migrations are the source of truth;
// keep this in sync by hand for the columns the API touches.
import { pgTable, uuid, text, boolean, timestamp, jsonb, integer, pgEnum, primaryKey } from 'drizzle-orm/pg-core';

export const orgStatus = pgEnum('org_status', ['pending', 'trial', 'active', 'past_due', 'suspended', 'archived', 'rejected']);
export const orgRole = pgEnum('org_role', ['owner', 'admin', 'member', 'none']);
export const membershipStatus = pgEnum('membership_status', ['active', 'suspended']);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(), email: text('email').notNull(), name: text('name').notNull(),
  passwordHash: text('password_hash'), isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(), updatedAt: updatedAt(),
});

export const organisations = pgTable('organisations', {
  id: id(), name: text('name').notNull(), slug: text('slug').notNull(),
  status: orgStatus('status').notNull().default('pending'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  profile: jsonb('profile').notNull().default({}), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const units = pgTable('units', {
  id: id(), orgId: uuid('org_id').notNull(), name: text('name').notNull(), code: text('code'),
  isActive: boolean('is_active').notNull().default(true), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const memberships = pgTable('memberships', {
  id: id(), userId: uuid('user_id').notNull(), orgId: uuid('org_id').notNull(),
  orgRole: orgRole('org_role').notNull().default('member'),
  status: membershipStatus('status').notNull().default('active'),
  createdAt: createdAt(), updatedAt: updatedAt(),
});

export const permissions = pgTable('permissions', {
  code: text('code').primaryKey(), label: text('label').notNull(), grp: text('grp').notNull(),
});

export const roles = pgTable('roles', {
  id: id(), orgId: uuid('org_id').notNull(), name: text('name').notNull(),
  description: text('description'), isSystem: boolean('is_system').notNull().default(false), createdAt: createdAt(),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull(), orgId: uuid('org_id').notNull(), permissionCode: text('permission_code').notNull(),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionCode] })]);

export const unitRoleAssignments = pgTable('unit_role_assignments', {
  id: id(), orgId: uuid('org_id').notNull(), userId: uuid('user_id').notNull(),
  unitId: uuid('unit_id').notNull(), roleId: uuid('role_id').notNull(), createdAt: createdAt(),
});

export const plans = pgTable('plans', {
  id: id(), code: text('code').notNull(), name: text('name').notNull(),
  priceCents: integer('price_cents').notNull().default(0), currency: text('currency').notNull().default('USD'),
  maxUnits: integer('max_units'), maxMembers: integer('max_members'),
  features: jsonb('features').notNull().default({}), isActive: boolean('is_active').notNull().default(true),
});

export const auditEvents = pgTable('audit_events', {
  id: id(), orgId: uuid('org_id'), actorId: uuid('actor_id'), action: text('action').notNull(),
  entityType: text('entity_type'), entityId: text('entity_id'), unitId: uuid('unit_id'),
  metadata: jsonb('metadata').notNull().default({}), createdAt: createdAt(),
});

export const records = pgTable('records', {
  id: id(), orgId: uuid('org_id').notNull(), unitId: uuid('unit_id').notNull(),
  title: text('title').notNull(), status: text('status').notNull().default('open'), notes: text('notes'),
  createdBy: uuid('created_by'), createdAt: createdAt(), updatedAt: updatedAt(),
});
