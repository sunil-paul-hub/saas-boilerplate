import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { PoolClient } from '@base/db';
import { isPermissionCode } from '@base/permissions';
import {
  inviteBody, orgPatchBody, roleCreateBody, rolePatchBody, unitCreateBody, unitPatchBody, unitRolesBody,
  type InviteBody, type RoleCreateBody,
} from '@base/contracts';
import { Audit, Auth, Db, Req0, RequirePermission, type ApiRequest, type AuthCtx } from '../common/context.js';
import { conflict, notFound, unprocessable } from '../common/errors.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { MailService } from '../common/mail.service.js';
import { hashToken } from '../auth/auth.controller.js';
import { CONFIG, type AppConfig } from '../config.js';

import { z } from 'zod';
const roleMemberPatch = z.object({ orgRole: z.enum(['owner', 'admin', 'member', 'none']).optional(), status: z.enum(['active', 'suspended']).optional() });

const orgDto = (o: any) => ({
  id: o.id, name: o.name, slug: o.slug, status: o.status, profile: o.profile,
  trialEndsAt: o.trial_ends_at ? new Date(o.trial_ends_at).toISOString() : null,
  setupComplete: o.status !== 'trial' && o.status !== 'pending',
});
const unitDto = (u: any) => ({ id: u.id, name: u.name, code: u.code, isActive: u.is_active });

/** Build `SET a = $1, b = $2` from the defined keys of a patch. */
export function setClause(cols: Record<string, unknown>, startAt = 1) {
  const keys = Object.keys(cols).filter((k) => cols[k] !== undefined);
  return { sql: keys.map((k, i) => `${k} = $${i + startAt}`).join(', '), values: keys.map((k) => cols[k]), n: keys.length };
}

@Controller()
export class OrgController {
  constructor(@Inject(MailService) private readonly mail: MailService, @Inject(CONFIG) private readonly cfg: AppConfig) {}

  /* ---- org ---- */
  @Get('org')
  async getOrg(@Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = await db.query('SELECT id, name, slug, status, trial_ends_at, profile FROM organisations WHERE id = $1', [a.orgId]);
    return orgDto(r.rows[0]);
  }

  @Patch('org') @RequirePermission('org.manage') @Audit('org.update', 'organisation')
  async patchOrg(@Body(new ZodPipe(orgPatchBody)) b: { name?: string; profile?: Record<string, unknown> }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const s = setClause({ name: b.name, profile: b.profile === undefined ? undefined : JSON.stringify(b.profile) });
    if (!s.n) return this.getOrg(db, a);
    const r = await db.query(`UPDATE organisations SET ${s.sql} WHERE id = $${s.n + 1} RETURNING id, name, slug, status, trial_ends_at, profile`, [...s.values, a.orgId]);
    if (!r.rowCount) throw notFound();
    return orgDto(r.rows[0]);
  }

  /** Setup wizard finished: trial -> active (DB function; app_user cannot write organisations.status). */
  @Post('org/activate') @HttpCode(200) @RequirePermission('org.manage') @Audit('org.activate', 'organisation')
  async activate(@Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = await db.query('SELECT app_private.activate_org() AS status');
    return { id: a.orgId, orgId: a.orgId, status: r.rows[0].status as string };
  }

  /* ---- units ---- */
  @Get('units')
  async units(@Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = await db.query(
      `SELECT u.id, u.name, u.code, u.is_active, u.created_at::text AS cursor_ts,
              (SELECT count(DISTINCT user_id) FROM unit_role_assignments x WHERE x.unit_id = u.id) AS member_count
         FROM units u WHERE u.org_id = $1 ORDER BY u.name`, [a.orgId]);
    return { items: r.rows.map((u) => ({ ...unitDto(u), memberCount: Number(u.member_count) })), nextCursor: null };
  }

  @Post('units') @HttpCode(201) @RequirePermission('unit.manage') @Audit('unit.create', 'unit')
  async createUnit(@Body(new ZodPipe(unitCreateBody)) b: { name: string; code?: string | null }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = await db.query('INSERT INTO units (org_id, name, code) VALUES ($1,$2,$3) RETURNING id, name, code, is_active', [a.orgId, b.name, b.code ?? null]);
    return unitDto(r.rows[0]);
  }

  @Patch('units/:id') @RequirePermission('unit.manage') @Audit('unit.update', 'unit')
  async patchUnit(@Param('id') id: string, @Body(new ZodPipe(unitPatchBody)) b: { name?: string; code?: string | null; isActive?: boolean }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const s = setClause({ name: b.name, code: b.code, is_active: b.isActive });
    if (!s.n) throw unprocessable('Nothing to update');
    const r = await db.query(`UPDATE units SET ${s.sql} WHERE id = $${s.n + 1} AND org_id = $${s.n + 2} RETURNING id, name, code, is_active`, [...s.values, id, a.orgId]);
    if (!r.rowCount) throw notFound('Unit not found');
    return unitDto(r.rows[0]);
  }

  /* ---- members ---- */
  @Get('members')
  async members(@Db() db: PoolClient, @Auth() a: AuthCtx) {
    const m = await db.query(
      `SELECT m.id, u.id AS user_id, u.name, u.email, m.org_role, m.status, m.created_at
         FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 ORDER BY u.name`, [a.orgId]);
    const ura = await db.query('SELECT user_id, unit_id, role_id FROM unit_role_assignments WHERE org_id = $1', [a.orgId]);
    const inv = await db.query(
      `SELECT id, email, org_role, expires_at, created_at FROM invitations WHERE org_id = $1 AND accepted_at IS NULL AND expires_at > now() ORDER BY created_at DESC`, [a.orgId]);
    const items = [
      ...m.rows.map((r) => ({
        id: r.id, userId: r.user_id, name: r.name, email: r.email, orgRole: r.org_role, status: r.status as string,
        unitRoles: ura.rows.filter((x) => x.user_id === r.user_id).map((x) => ({ unitId: x.unit_id, roleId: x.role_id })),
      })),
      ...inv.rows.map((r) => ({ id: r.id, userId: null, name: '', email: r.email, orgRole: r.org_role, status: 'invited', unitRoles: [] as unknown[] })),
    ];
    return { items, nextCursor: null };
  }

  @Post('members/invite') @HttpCode(201) @RequirePermission('member.invite') @Audit('member.invite', 'invitation')
  async invite(@Body(new ZodPipe(inviteBody)) b: InviteBody, @Db() db: PoolClient, @Auth() a: AuthCtx, @Req0() req: ApiRequest) {
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + this.cfg.inviteTtlDays * 86_400_000);
    const r = await db.query(
      `INSERT INTO invitations (org_id, email, org_role, unit_id, role_id, token_hash, invited_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [a.orgId, b.email, b.orgRole, b.unitId ?? null, b.roleId ?? null, hashToken(token), a.userId, expires]);
    const org = (await db.query('SELECT name FROM organisations WHERE id = $1', [a.orgId])).rows[0];
    const link = `${this.cfg.webOrigin}/accept-invite?token=${token}`;
    await this.mail.queue(req, db, {
      to: b.email, subject: `You're invited to ${org.name}`,
      body: `${a.name} invited you to join ${org.name}.\nAccept: ${link}\nThis link expires ${expires.toISOString()}.`,
      payload: { kind: 'invitation' },
    });
    return { id: r.rows[0].id as string, email: b.email, expiresAt: expires.toISOString(), ...(this.cfg.isProd ? {} : { inviteToken: token }) };
  }

  @Put('members/:id/unit-roles') @RequirePermission('member.manage') @Audit('member.unit_roles.set', 'membership')
  async setUnitRoles(@Param('id') id: string, @Body(new ZodPipe(unitRolesBody)) b: { unitRoles: Array<{ unitId: string; roleId: string }> }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const m = (await db.query('SELECT user_id FROM memberships WHERE id = $1 AND org_id = $2', [id, a.orgId])).rows[0];
    if (!m) throw notFound('Member not found');
    await db.query('DELETE FROM unit_role_assignments WHERE user_id = $1 AND org_id = $2', [m.user_id, a.orgId]);
    for (const x of b.unitRoles) {
      await db.query('INSERT INTO unit_role_assignments (org_id, user_id, unit_id, role_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [a.orgId, m.user_id, x.unitId, x.roleId]);
    }
    return { id, unitRoles: b.unitRoles };
  }

  @Patch('members/:id') @RequirePermission('member.manage') @Audit('member.update', 'membership')
  async patchMember(@Param('id') id: string, @Body(new ZodPipe(roleMemberPatch)) b: { orgRole?: string; status?: string }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const s = setClause({ org_role: b.orgRole, status: b.status });
    if (!s.n) throw unprocessable('Nothing to update');
    const r = await db.query(`UPDATE memberships SET ${s.sql} WHERE id = $${s.n + 1} AND org_id = $${s.n + 2} RETURNING id, org_role, status`, [...s.values, id, a.orgId]);
    if (!r.rowCount) throw notFound('Member not found');
    return { id: r.rows[0].id, orgRole: r.rows[0].org_role, status: r.rows[0].status };
  }

  /* ---- roles & permissions ---- */
  @Get('permissions')
  async permissions(@Db() db: PoolClient) {
    const r = await db.query('SELECT code, label, grp FROM permissions ORDER BY grp, code');
    return { items: r.rows.map((p) => ({ code: p.code, label: p.label, group: p.grp })), nextCursor: null };
  }

  @Get('roles')
  async roles(@Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = await db.query(
      `SELECT r.id, r.name, r.description, r.is_system,
              COALESCE((SELECT array_agg(permission_code ORDER BY permission_code) FROM role_permissions rp WHERE rp.role_id = r.id), '{}') AS permissions,
              (SELECT count(DISTINCT user_id) FROM unit_role_assignments x WHERE x.role_id = r.id) AS member_count
         FROM roles r WHERE r.org_id = $1 ORDER BY r.is_system DESC, r.name`, [a.orgId]);
    return { items: r.rows.map(roleDto), nextCursor: null };
  }

  @Post('roles') @HttpCode(201) @RequirePermission('role.manage') @Audit('role.create', 'role')
  async createRole(@Body(new ZodPipe(roleCreateBody)) b: RoleCreateBody, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    checkCodes(b.permissions);
    const r = await db.query('INSERT INTO roles (org_id, name, description, is_system) VALUES ($1,$2,$3,false) RETURNING id', [a.orgId, b.name, b.description ?? null]);
    await setRolePerms(db, a.orgId!, r.rows[0].id, b.permissions);
    return this.oneRole(db, r.rows[0].id);
  }

  @Patch('roles/:id') @RequirePermission('role.manage') @Audit('role.update', 'role')
  async patchRole(@Param('id') id: string, @Body(new ZodPipe(rolePatchBody)) b: { name?: string; description?: string | null; permissions?: string[] }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const cur = (await db.query('SELECT is_system FROM roles WHERE id = $1 AND org_id = $2', [id, a.orgId])).rows[0];
    if (!cur) throw notFound('Role not found');
    if (cur.is_system) throw conflict('System roles cannot be changed', 'system_role');
    if (b.permissions) checkCodes(b.permissions);
    const s = setClause({ name: b.name, description: b.description });
    if (s.n) await db.query(`UPDATE roles SET ${s.sql} WHERE id = $${s.n + 1} AND org_id = $${s.n + 2}`, [...s.values, id, a.orgId]);
    if (b.permissions) await setRolePerms(db, a.orgId!, id, b.permissions);
    return this.oneRole(db, id);
  }

  @Delete('roles/:id') @HttpCode(204) @RequirePermission('role.manage') @Audit('role.delete', 'role')
  async deleteRole(@Param('id') id: string, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const cur = (await db.query('SELECT is_system FROM roles WHERE id = $1 AND org_id = $2', [id, a.orgId])).rows[0];
    if (!cur) throw notFound('Role not found');
    if (cur.is_system) throw conflict('System roles cannot be deleted', 'system_role');
    await db.query('DELETE FROM roles WHERE id = $1 AND org_id = $2', [id, a.orgId]);
  }

  private async oneRole(db: PoolClient, id: string) {
    const r = await db.query(
      `SELECT r.id, r.name, r.description, r.is_system,
              COALESCE((SELECT array_agg(permission_code ORDER BY permission_code) FROM role_permissions rp WHERE rp.role_id = r.id), '{}') AS permissions,
              0 AS member_count FROM roles r WHERE r.id = $1`, [id]);
    return roleDto(r.rows[0]);
  }
}


const roleDto = (r: any) => ({ id: r.id, name: r.name, description: r.description, system: r.is_system, permissions: r.permissions as string[], memberCount: Number(r.member_count) });
function checkCodes(codes: string[]) {
  const bad = codes.filter((c) => !isPermissionCode(c));
  if (bad.length) throw unprocessable(`Unknown permission(s): ${bad.join(', ')}`, 'unknown_permission');
}
async function setRolePerms(db: PoolClient, orgId: string, roleId: string, codes: string[]) {
  await db.query('DELETE FROM role_permissions WHERE role_id = $1 AND org_id = $2', [roleId, orgId]);
  for (const c of new Set(codes)) await db.query('INSERT INTO role_permissions (role_id, org_id, permission_code) VALUES ($1,$2,$3)', [roleId, orgId, c]);
}

@Controller('onboarding')
export class OnboardingCompleteController {
  /** Setup wizard "finish" (alias of POST /org/activate used by the web app). */
  @Post('complete') @HttpCode(200) @RequirePermission('org.manage') @Audit('org.activate', 'organisation')
  async complete(@Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = await db.query('SELECT app_private.activate_org() AS status');
    return { id: a.orgId, orgId: a.orgId, status: r.rows[0].status as string };
  }
}
