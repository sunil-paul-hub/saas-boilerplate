import { Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import type { PoolClient } from '@base/db';
import { pageQuery, platformPlanBody } from '@base/contracts';
import { Audit, Auth, Db, RequirePermission, type AuthCtx } from '../common/context.js';
import { notFound } from '../common/errors.js';
import { decodeCursor, toPage } from '../common/paging.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { BILLING_PROVIDER, type BillingProvider } from '../billing/billing.provider.js';

@Controller('billing')
export class BillingController {
  constructor(@Inject(BILLING_PROVIDER) private readonly provider: BillingProvider) {}

  @Get('plan') @RequirePermission('billing.read')
  async plan(@Db() db: PoolClient, @Auth() a: AuthCtx) {
    const s = (await db.query(
      `SELECT s.id, s.status, s.provider, s.current_period_end, p.code, p.name, p.price_cents, p.currency, p.max_units, p.max_members, p.features, o.status AS org_status, o.trial_ends_at
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id JOIN organisations o ON o.id = s.org_id
        WHERE s.org_id = $1 AND s.status <> 'cancelled' ORDER BY s.created_at DESC LIMIT 1`, [a.orgId])).rows[0];
    if (!s) throw notFound('No subscription');
    const cnt = async (t: string) => Number((await db.query(`SELECT count(*) AS n FROM ${t} WHERE org_id = $1`, [a.orgId])).rows[0].n);
    const plans = (await db.query('SELECT code, name, price_cents, currency, max_units, max_members FROM plans ORDER BY price_cents')).rows;
    return {
      planCode: s.code, planName: s.name, status: s.org_status, subscriptionStatus: s.status, provider: s.provider,
      pricePerMonth: s.price_cents / 100, currency: s.currency,
      renewsAt: s.current_period_end ? new Date(s.current_period_end).toISOString() : null,
      trialEndsAt: s.trial_ends_at ? new Date(s.trial_ends_at).toISOString() : null,
      usage: { units: await cnt('units'), unitsLimit: s.max_units, members: await cnt('memberships'), membersLimit: s.max_members, records: await cnt('records'), recordsLimit: null },
      available: plans.map((p) => ({ code: p.code, name: p.name, pricePerMonth: p.price_cents / 100, currency: p.currency, maxUnits: p.max_units, maxMembers: p.max_members })),
    };
  }

  /** Tenant-initiated plan change (needs billing.manage; executed by a DB function, app_user cannot write subscriptions). */
  @Post('plan') @HttpCode(200) @RequirePermission('billing.manage') @Audit('billing.plan.change', 'subscription')
  async change(@Body(new ZodPipe(platformPlanBody)) b: { planCode: string }, @Db() db: PoolClient) {
    const r = await db.query('SELECT app_private.change_plan($1) AS id', [b.planCode]);
    return { id: r.rows[0].id as string, planCode: b.planCode, provider: this.provider.name };
  }

  @Get('invoices') @RequirePermission('billing.read')
  async invoices(@Query(new ZodPipe(pageQuery)) q: { cursor?: string; limit: number }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const p: unknown[] = [a.orgId];
    let extra = '';
    const cur = decodeCursor(q.cursor);
    if (cur) { p.push(cur.ts, cur.id); extra = ` AND (issued_at, id) < ($2::timestamptz, $3::uuid)`; }
    p.push(q.limit + 1);
    const r = await db.query(
      `SELECT id, number, amount_cents, currency, status, issued_at, due_at, paid_at, issued_at::text AS cursor_ts FROM invoices
        WHERE org_id = $1${extra} ORDER BY issued_at DESC, id DESC LIMIT $${p.length}`, p);
    return toPage(r.rows, q.limit, (i) => ({
      id: i.id, number: i.number, issuedAt: new Date(i.issued_at).toISOString(), amount: i.amount_cents / 100, currency: i.currency, status: i.status,
      dueAt: i.due_at ? new Date(i.due_at).toISOString() : null, paidAt: i.paid_at ? new Date(i.paid_at).toISOString() : null,
    }));
  }
}
