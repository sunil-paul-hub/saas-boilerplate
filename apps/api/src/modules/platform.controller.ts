import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import type { PoolClient } from '@base/db';
import { randomBytes } from 'node:crypto';
import { pageQuery, platformOrgCreateBody, platformPlanBody, platformReasonBody, type PlatformOrgCreateBody } from '@base/contracts';
import { z } from 'zod';
import { Audit, Auth, Db, PlatformOnly, Req0, type ApiRequest, type AuthCtx } from '../common/context.js';
import { conflict, notFound } from '../common/errors.js';
import { decodeCursor, toPage } from '../common/paging.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { MailService } from '../common/mail.service.js';
import { hashToken } from '../auth/auth.controller.js';
import { BILLING_PROVIDER, type BillingProvider } from '../billing/billing.provider.js';
import { CONFIG, type AppConfig } from '../config.js';

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
const listQuery = pageQuery.extend({ status: z.string().optional(), search: z.string().max(200).optional() });

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'org';

@PlatformOnly()
@Controller('platform')
export class PlatformController {
  constructor(
    @Inject(MailService) private readonly mail: MailService,
    @Inject(BILLING_PROVIDER) private readonly billing: BillingProvider,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  /** Create org (trial) + subscription + first-owner invitation + email. Used by both onboarding routes. */
  private async provision(db: PoolClient, req: ApiRequest, a: AuthCtx, o: { name: string; adminEmail: string; planCode?: string }) {
    const slug = `${slugify(o.name)}-${randomBytes(3).toString('hex')}`;
    const org = (await db.query(
      `INSERT INTO organisations (name, slug, status, trial_ends_at) VALUES ($1,$2,'trial', now() + ($3 || ' days')::interval) RETURNING id`,
      [o.name, slug, String(this.cfg.trialDays)])).rows[0];
    await this.billing.createCustomer(db, { id: org.id, name: o.name });
    await this.billing.startSubscription(db, { orgId: org.id, planCode: o.planCode ?? 'free', status: 'trial' });
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + this.cfg.inviteTtlDays * 86_400_000);
    await db.query(
      `INSERT INTO invitations (org_id, email, org_role, token_hash, invited_by, expires_at, grant_owner) VALUES ($1,$2,'admin',$3,$4,$5,true)`,
      [org.id, o.adminEmail, hashToken(token), a.userId, expires]);
    const link = `${this.cfg.webOrigin}/accept-invite?token=${token}`;
    await this.mail.queue(req, db, {
      to: o.adminEmail, subject: `Your organisation ${o.name} is ready`,
      body: `Your organisation "${o.name}" has been set up.\nSet your password and sign in: ${link}\nThis link expires ${expires.toISOString()}.`,
      payload: { kind: 'org-approved' },
    });
    return { orgId: org.id as string, ...(this.cfg.isProd ? {} : { inviteToken: token }) };
  }

  @Get('orgs')
  async orgs(@Query(new ZodPipe(listQuery)) q: { cursor?: string; limit: number; status?: string; search?: string }, @Db() db: PoolClient) {
    const p: unknown[] = [];
    const where = ['true'];
    if (q.status) { p.push(q.status); where.push(`o.status = $${p.length}::org_status`); }
    if (q.search) { p.push(`%${q.search.replace(/[\\%_]/g, '\\$&')}%`); where.push(`(o.name ILIKE $${p.length} OR o.slug ILIKE $${p.length})`); }
    const cur = decodeCursor(q.cursor);
    if (cur) { p.push(cur.ts, cur.id); where.push(`(o.created_at, o.id) < ($${p.length - 1}::timestamptz, $${p.length}::uuid)`); }
    p.push(q.limit + 1);
    const r = await db.query(
      `SELECT o.id, o.name, o.slug, o.status, o.created_at, o.created_at::text AS cursor_ts,
         (SELECT p.code FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.org_id = o.id AND s.status <> 'cancelled' ORDER BY s.created_at DESC LIMIT 1) AS plan_code,
         (SELECT count(*) FROM units WHERE org_id = o.id) AS unit_count,
         (SELECT count(*) FROM memberships WHERE org_id = o.id) AS member_count,
         (SELECT u.name FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = o.id AND m.org_role = 'owner' ORDER BY m.created_at LIMIT 1) AS owner_name,
         (SELECT u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = o.id AND m.org_role = 'owner' ORDER BY m.created_at LIMIT 1) AS owner_email
       FROM organisations o WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC, o.id DESC LIMIT $${p.length}`, p);
    return toPage(r.rows, q.limit, (o) => ({
      id: o.id, name: o.name, slug: o.slug, status: o.status, planCode: o.plan_code, unitCount: Number(o.unit_count),
      memberCount: Number(o.member_count), ownerName: o.owner_name ?? '', ownerEmail: o.owner_email ?? '', createdAt: iso(o.created_at),
    }));
  }

  @Post('orgs') @HttpCode(201) @Audit('platform.org.create', 'organisation')
  async createOrg(@Body(new ZodPipe(platformOrgCreateBody)) b: PlatformOrgCreateBody, @Db() db: PoolClient, @Auth() a: AuthCtx, @Req0() req: ApiRequest) {
    const r = await this.provision(db, req, a, b);
    return { id: r.orgId, ...r };
  }

  @Get('requests')
  async requests(@Query(new ZodPipe(listQuery)) q: { cursor?: string; limit: number; status?: string }, @Db() db: PoolClient) {
    const p: unknown[] = [];
    const where = ['true'];
    if (q.status) { p.push(q.status); where.push(`status = $${p.length}`); }
    const cur = decodeCursor(q.cursor);
    if (cur) { p.push(cur.ts, cur.id); where.push(`(created_at, id) < ($${p.length - 1}::timestamptz, $${p.length}::uuid)`); }
    p.push(q.limit + 1);
    const r = await db.query(
      `SELECT id, org_name, contact_name, contact_email, details, status, org_id, created_at, created_at::text AS cursor_ts
         FROM onboarding_requests WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT $${p.length}`, p);
    return toPage(r.rows, q.limit, (x) => ({
      id: x.id, orgName: x.org_name, contactName: x.contact_name, email: x.contact_email, message: (x.details?.message as string) ?? '',
      details: x.details, status: x.status, orgId: x.org_id, createdAt: iso(x.created_at),
    }));
  }

  /* approve / reject accept either an onboarding-request id or an organisation id */
  private async approve(id: string, db: PoolClient, a: AuthCtx, req: ApiRequest) {
    const rq = (await db.query('SELECT * FROM onboarding_requests WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (rq) {
      if (rq.status !== 'pending') throw conflict(`Request already ${rq.status}`, 'already_reviewed');
      const r = await this.provision(db, req, a, { name: rq.org_name, adminEmail: rq.contact_email });
      await db.query(`UPDATE onboarding_requests SET status = 'approved', org_id = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3`, [r.orgId, a.userId, id]);
      return { id, orgId: r.orgId, status: 'trial', ...(r.inviteToken ? { inviteToken: r.inviteToken } : {}) };
    }
    const o = (await db.query('SELECT status FROM organisations WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!o) throw notFound('Request or organisation not found');
    if (o.status !== 'pending') throw conflict(`Organisation is ${o.status}`, 'invalid_state');
    await db.query(`UPDATE organisations SET status = 'trial', trial_ends_at = now() + ($2 || ' days')::interval WHERE id = $1`, [id, String(this.cfg.trialDays)]);
    return { id, orgId: id, status: 'trial' };
  }

  private async reject(id: string, db: PoolClient, a: AuthCtx) {
    const rq = (await db.query('SELECT status FROM onboarding_requests WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (rq) {
      if (rq.status !== 'pending') throw conflict(`Request already ${rq.status}`, 'already_reviewed');
      await db.query(`UPDATE onboarding_requests SET status = 'rejected', reviewed_by = $2, reviewed_at = now() WHERE id = $1`, [id, a.userId]);
      return { id, status: 'rejected' };
    }
    const r = await db.query(`UPDATE organisations SET status = 'rejected' WHERE id = $1 AND status = 'pending' RETURNING id`, [id]);
    if (!r.rowCount) throw notFound('Pending request or organisation not found');
    return { id, orgId: id, status: 'rejected' };
  }

  @Post('orgs/:id/approve') @HttpCode(200) @Audit('platform.org.approve', 'organisation')
  approveOrg(@Param('id') id: string, @Db() db: PoolClient, @Auth() a: AuthCtx, @Req0() req: ApiRequest) { return this.approve(id, db, a, req); }
  @Post('requests/:id/approve') @HttpCode(200) @Audit('platform.org.approve', 'organisation')
  approveReq(@Param('id') id: string, @Db() db: PoolClient, @Auth() a: AuthCtx, @Req0() req: ApiRequest) { return this.approve(id, db, a, req); }
  @Post('orgs/:id/reject') @HttpCode(200) @Audit('platform.org.reject', 'organisation')
  rejectOrg(@Param('id') id: string, @Db() db: PoolClient, @Auth() a: AuthCtx) { return this.reject(id, db, a); }
  @Post('requests/:id/reject') @HttpCode(200) @Audit('platform.org.reject', 'organisation')
  rejectReq(@Param('id') id: string, @Db() db: PoolClient, @Auth() a: AuthCtx) { return this.reject(id, db, a); }

  @Post('orgs/:id/suspend') @HttpCode(200) @Audit('platform.org.suspend', 'organisation')
  async suspend(@Param('id') id: string, @Body(new ZodPipe(platformReasonBody)) _b: { reason?: string }, @Db() db: PoolClient) {
    const r = await db.query(`UPDATE organisations SET status = 'suspended' WHERE id = $1 AND status IN ('trial','active','past_due') RETURNING id`, [id]);
    if (!r.rowCount) throw conflict('Only trial, active or past_due organisations can be suspended', 'invalid_state');
    return { id, orgId: id, status: 'suspended' };
  }

  @Post('orgs/:id/reactivate') @HttpCode(200) @Audit('platform.org.reactivate', 'organisation')
  async reactivate(@Param('id') id: string, @Db() db: PoolClient) {
    const trial = (await db.query(`SELECT 1 FROM subscriptions WHERE org_id = $1 AND status = 'trial'`, [id])).rowCount;
    const to = trial ? 'trial' : 'active';
    const r = await db.query(`UPDATE organisations SET status = $2::org_status WHERE id = $1 AND status = 'suspended' RETURNING id`, [id, to]);
    if (!r.rowCount) throw conflict('Organisation is not suspended', 'invalid_state');
    return { id, orgId: id, status: to };
  }

  @Patch('orgs/:id/plan') @Audit('platform.org.plan', 'organisation')
  async plan(@Param('id') id: string, @Body(new ZodPipe(platformPlanBody)) b: { planCode: string }, @Db() db: PoolClient) {
    const o = (await db.query('SELECT status FROM organisations WHERE id = $1', [id])).rows[0];
    if (!o) throw notFound('Organisation not found');
    await this.billing.startSubscription(db, { orgId: id, planCode: b.planCode, status: o.status === 'trial' ? 'trial' : 'active' });
    return { id, orgId: id, planCode: b.planCode };
  }

  /** Read-only snapshot of an org for the operator. Stateless and audited; the DB gives app_platform no record/chat access. */
  @Post('orgs/:id/view-as') @HttpCode(200) @Audit('platform.org.view_as', 'organisation')
  async viewAs(@Param('id') id: string, @Db() db: PoolClient) {
    const o = (await db.query('SELECT id, name, slug, status, trial_ends_at, profile FROM organisations WHERE id = $1', [id])).rows[0];
    if (!o) throw notFound('Organisation not found');
    const units = (await db.query('SELECT id, name, code, is_active FROM units WHERE org_id = $1 ORDER BY name', [id])).rows;
    const members = (await db.query(
      `SELECT m.id, u.name, u.email, m.org_role, m.status FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 ORDER BY u.name`, [id])).rows;
    const sub = (await db.query(
      `SELECT p.code, s.status FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.org_id = $1 AND s.status <> 'cancelled' ORDER BY s.created_at DESC LIMIT 1`, [id])).rows[0];
    return {
      id, orgId: id, readOnly: true, viewingAs: true,
      org: { id: o.id, name: o.name, slug: o.slug, status: o.status, trialEndsAt: iso(o.trial_ends_at), profile: o.profile },
      units: units.map((u) => ({ id: u.id, name: u.name, code: u.code, isActive: u.is_active })),
      members: members.map((m) => ({ id: m.id, name: m.name, email: m.email, orgRole: m.org_role, status: m.status })),
      subscription: sub ? { planCode: sub.code, status: sub.status } : null,
    };
  }

  @Post('exit-view-as') @HttpCode(200) @Audit('platform.exit_view_as', 'organisation')
  async exitViewAs() { return { ok: true, viewingAs: false }; }

  @Get('audit')
  async audit(@Query(new ZodPipe(pageQuery.extend({ orgId: z.string().uuid().optional(), action: z.string().optional() }))) q: { cursor?: string; limit: number; orgId?: string; action?: string }, @Db() db: PoolClient) {
    const p: unknown[] = [];
    const where = ['true'];
    if (q.orgId) { p.push(q.orgId); where.push(`e.org_id = $${p.length}`); }
    if (q.action) { p.push(q.action); where.push(`e.action = $${p.length}`); }
    const cur = decodeCursor(q.cursor);
    if (cur) { p.push(cur.ts, cur.id); where.push(`(e.created_at, e.id) < ($${p.length - 1}::timestamptz, $${p.length}::uuid)`); }
    p.push(q.limit + 1);
    const r = await db.query(
      `SELECT e.id, e.org_id, o.name AS org_name, e.actor_id, u.name AS actor_name, e.action, e.entity_type, e.entity_id, e.metadata, e.created_at, e.created_at::text AS cursor_ts
         FROM audit_events e LEFT JOIN organisations o ON o.id = e.org_id LEFT JOIN users u ON u.id = e.actor_id
        WHERE ${where.join(' AND ')} ORDER BY e.created_at DESC, e.id DESC LIMIT $${p.length}`, p);
    return toPage(r.rows, q.limit, (e) => ({
      id: e.id, at: iso(e.created_at), orgId: e.org_id, orgName: e.org_name ?? '', actorId: e.actor_id, actor: e.actor_name ?? null,
      action: e.action, entityType: e.entity_type, entityId: e.entity_id, metadata: e.metadata,
    }));
  }
}
