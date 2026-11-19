import { Inject, Injectable } from '@nestjs/common';
import { PERMISSION_CODES } from '@base/permissions';
import { DbService } from '../db/db.service.js';
import type { AuthCtx, OrgRole } from '../common/context.js';
import type { SessionClaims } from './session.service.js';

export interface MeData {
  ctx: AuthCtx;
  me: Record<string, unknown>;
}

@Injectable()
export class AuthService {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  /** Resolve a session into a fully-loaded context (null = session no longer valid). One read-only tx as the user. */
  async load(claims: SessionClaims): Promise<MeData | null> {
    return this.db.tenant({ userId: claims.uid, orgId: '', unitId: null }, async (c) => {
      const u = (await c.query('SELECT id, name, email, is_active FROM users WHERE id = $1', [claims.uid])).rows[0];
      if (!u || !u.is_active) return null;
      const isPlatformAdmin = (await c.query('SELECT app_private.is_platform_admin() AS v')).rows[0].v as boolean;
      const memberships = (await c.query(
        `SELECT m.org_id, o.name AS org_name, m.org_role, m.status
           FROM memberships m JOIN organisations o ON o.id = m.org_id
          WHERE m.user_id = $1 AND m.status = 'active' ORDER BY m.created_at`, [claims.uid])).rows;
      const cur = claims.org ? memberships.find((m) => m.org_id === claims.org) : undefined;

      const ctx: AuthCtx = {
        userId: u.id, email: u.email, name: u.name, orgId: null, unitId: null, orgRole: 'none', orgStatus: null,
        permissions: [], orgPermissions: [], isPlatformAdmin,
      };
      let org: Record<string, unknown> | null = null;
      let units: Array<Record<string, unknown>> = [];
      if (cur) {
        await c.query(`SELECT set_config('app.org_id', $1, true)`, [cur.org_id]);
        const o = (await c.query('SELECT id, name, slug, status, trial_ends_at FROM organisations WHERE id = $1', [cur.org_id])).rows[0];
        units = (await c.query('SELECT id, name, code, is_active FROM units ORDER BY name')).rows
          .map((r) => ({ id: r.id, name: r.name, code: r.code, isActive: r.is_active }));
        const wanted = claims.unit && units.find((x) => x.id === claims.unit);
        const unit = (wanted ?? units.find((x) => x.isActive) ?? null) as { id: string } | null;
        ctx.orgId = cur.org_id; ctx.orgRole = cur.org_role as OrgRole; ctx.orgStatus = o.status; ctx.unitId = unit?.id ?? null;
        if (cur.org_role === 'owner' || cur.org_role === 'admin') {
          ctx.permissions = [...PERMISSION_CODES]; ctx.orgPermissions = [...PERMISSION_CODES];
        } else {
          const rows = (await c.query(
            `SELECT a.unit_id, rp.permission_code FROM unit_role_assignments a
               JOIN role_permissions rp ON rp.role_id = a.role_id AND rp.org_id = a.org_id
              WHERE a.user_id = $1 AND a.org_id = $2`, [claims.uid, cur.org_id])).rows;
          ctx.orgPermissions = [...new Set<string>(rows.map((r) => r.permission_code))];
          ctx.permissions = [...new Set<string>(rows.filter((r) => r.unit_id === ctx.unitId).map((r) => r.permission_code))];
        }
        org = {
          id: o.id, name: o.name, slug: o.slug, status: o.status,
          trialEndsAt: o.trial_ends_at ? new Date(o.trial_ends_at).toISOString() : null,
          setupComplete: o.status !== 'trial' && o.status !== 'pending',
        };
      }
      const me = {
        user: { id: u.id, name: u.name, email: u.email },
        memberships: memberships.map((m) => ({ orgId: m.org_id, orgName: m.org_name, orgRole: m.org_role, status: m.status })),
        org, orgRole: ctx.orgRole, units, currentUnitId: ctx.unitId, permissions: ctx.permissions, isPlatformAdmin,
      };
      return { ctx, me };
    });
  }

  /** Latest-created active membership, used to pick an org after login/accept. */
  async defaultOrg(userId: string, newest = false): Promise<string | null> {
    return this.db.tenant({ userId, orgId: '', unitId: null }, async (c) => {
      const r = await c.query(
        `SELECT org_id FROM memberships WHERE user_id = $1 AND status = 'active' ORDER BY created_at ${newest ? 'DESC' : 'ASC'} LIMIT 1`, [userId]);
      return (r.rows[0]?.org_id as string | undefined) ?? null;
    });
  }
}
