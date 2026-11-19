import { Injectable } from '@nestjs/common';
import type { PoolClient } from '@base/db';
import { notFound } from '../common/errors.js';
import type { BillingProvider, WebhookResult } from './billing.provider.js';

/** Operator-managed billing: no external calls; the platform console changes plans and issues invoices. */
@Injectable()
export class ManualBillingProvider implements BillingProvider {
  readonly name = 'manual';
  async createCustomer(): Promise<{ customerRef: string | null }> { return { customerRef: null }; }

  async startSubscription(db: PoolClient, a: { orgId: string; planCode: string; status: 'trial' | 'active' }) {
    const plan = (await db.query('SELECT id FROM plans WHERE code = $1 AND is_active', [a.planCode])).rows[0];
    if (!plan) throw notFound(`Unknown plan: ${a.planCode}`);
    await db.query(`UPDATE subscriptions SET status = 'cancelled' WHERE org_id = $1 AND status <> 'cancelled'`, [a.orgId]);
    const s = (await db.query(
      `INSERT INTO subscriptions (org_id, plan_id, status, provider) VALUES ($1,$2,$3,'manual') RETURNING id`,
      [a.orgId, plan.id, a.status])).rows[0];
    return { subscriptionId: s.id as string };
  }

  async cancel(db: PoolClient, a: { orgId: string }) {
    await db.query(`UPDATE subscriptions SET status = 'cancelled' WHERE org_id = $1 AND status <> 'cancelled'`, [a.orgId]);
  }

  async handleWebhook(): Promise<WebhookResult> { return { handled: false }; }
}
