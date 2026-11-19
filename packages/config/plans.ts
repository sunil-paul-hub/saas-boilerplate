/** Per-product onboarding switches and plan catalogue. */
export const onboarding = {
  /** Public sign-up form creates a pending organisation request. */
  selfServeAllowed: true,
  /** Operator must approve self-serve requests in the platform console. */
  approvalRequired: true,
  trialDays: 14,
}

export type PlanDef = {
  /** Must match plans.code in the database (seeded by packages/db/src/seed.mjs). */
  code: string
  name: string
  /** Monthly price in major units; 0 = free. */
  pricePerMonth: number
  currency: string
  /** null = unlimited. Display only; the enforced limits live in the plans table. */
  limits: { units: number | null; members: number | null }
  features: string[]
  highlight?: boolean
}

export const planCatalogue: PlanDef[] = [
  { code: 'free', name: 'Free', pricePerMonth: 0, currency: 'USD',
    limits: { units: 3, members: 10 },
    features: ['Up to 3 units', 'Up to 10 members', 'Team chat', 'Audit log'] },
  { code: 'pro', name: 'Pro', pricePerMonth: 49, currency: 'USD', highlight: true,
    limits: { units: null, members: null },
    features: ['Unlimited units', 'Unlimited members', 'Custom roles', 'Custom terminology and branding', 'Priority support'] },
]
