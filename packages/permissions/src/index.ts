export interface PermissionDef {
  code: string;
  label: string;
  group: string;
}

export const PERMISSIONS = [
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
] as const satisfies readonly PermissionDef[];

export type PermissionCode = (typeof PERMISSIONS)[number]['code'];

export const PERMISSION_CODES: PermissionCode[] = PERMISSIONS.map((p) => p.code);

export type SystemRoleName = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

const all = PERMISSION_CODES;

export const SYSTEM_ROLES: Record<SystemRoleName, PermissionCode[]> = {
  owner: [...all],
  admin: all.filter((c) => c !== 'org.manage' && c !== 'billing.manage'),
  manager: ['record.read', 'record.create', 'record.update', 'record.delete', 'chat.use', 'files.manage'],
  member: ['record.read', 'record.create', 'record.update', 'chat.use'],
  viewer: ['record.read', 'chat.use'],
};

export const SYSTEM_ROLE_NAMES = Object.keys(SYSTEM_ROLES) as SystemRoleName[];

export function isPermissionCode(code: string): code is PermissionCode {
  return (PERMISSION_CODES as string[]).includes(code);
}
