import type { PoolClient } from '@base/db';

export const BILLING_PROVIDER = Symbol('BILLING_PROVIDER');

export interface WebhookResult { handled: boolean; orgId?: string }

/** Plug-in point. Razorpay / Stripe implement this later; only `manual` ships in v1. */
export interface BillingProvider {
  readonly name: string;
  /** Create (or look up) the customer record at the provider. Returns the provider's customer reference. */
  createCustomer(db: PoolClient, org: { id: string; name: string }): Promise<{ customerRef: string | null }>;
  /** Start a subscription on a plan, superseding any live one. Runs on the platform (operator) connection. */
  startSubscription(db: PoolClient, args: { orgId: string; planCode: string; status: 'trial' | 'active' }): Promise<{ subscriptionId: string }>;
  cancel(db: PoolClient, args: { orgId: string }): Promise<void>;
  /** Verify + apply a provider webhook. `manual` has none. */
  handleWebhook(rawBody: Buffer | string, headers: Record<string, string | string[] | undefined>): Promise<WebhookResult>;
}
