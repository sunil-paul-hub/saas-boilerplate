/**
 * Terminology: every user-visible noun in the UI comes from here.
 * Defaults are industry-neutral. A product fork overrides them in `overrides`
 * (or tenants override them at runtime through Settings > Terminology).
 */
export type TermEntry = { singular: string; plural: string }

export const defaultTerms = {
  organisation: { singular: 'Organisation', plural: 'Organisations' },
  unit: { singular: 'Unit', plural: 'Units' },
  member: { singular: 'Member', plural: 'Members' },
  record: { singular: 'Record', plural: 'Records' },
  plan: { singular: 'Plan', plural: 'Plans' },
} as const satisfies Record<string, TermEntry>

export type TermKey = keyof typeof defaultTerms
export type TermOverrides = Partial<Record<TermKey, Partial<TermEntry>>>
/** e.g. 'unit.plural' | 'record.singular' */
export type TermPath = `${TermKey}.${'singular' | 'plural'}`

/*
 * Example product overrides (uncomment ONE block in `overrides` below):
 *
 * Transport:  { organisation: { singular: 'Operator', plural: 'Operators' },
 *               unit: { singular: 'Depot', plural: 'Depots' },
 *               member: { singular: 'Driver', plural: 'Drivers' },
 *               record: { singular: 'Trip', plural: 'Trips' } }
 *
 * Hotel:      { organisation: { singular: 'Hotel Group', plural: 'Hotel Groups' },
 *               unit: { singular: 'Property', plural: 'Properties' },
 *               member: { singular: 'Staff', plural: 'Staff' },
 *               record: { singular: 'Booking', plural: 'Bookings' } }
 *
 * School:     { organisation: { singular: 'Trust', plural: 'Trusts' },
 *               unit: { singular: 'Campus', plural: 'Campuses' },
 *               member: { singular: 'Teacher', plural: 'Teachers' },
 *               record: { singular: 'Enrolment', plural: 'Enrolments' } }
 */
export const overrides: TermOverrides = {}

let runtime: TermOverrides = {}

/** Called by the app after loading GET /settings/terminology. */
export function setRuntimeTerms(o: TermOverrides) {
  runtime = o ?? {}
}
export function getRuntimeTerms(): TermOverrides {
  return runtime
}

export function resolveTerms(extra: TermOverrides = runtime): Record<TermKey, TermEntry> {
  const out = {} as Record<TermKey, TermEntry>
  for (const k of Object.keys(defaultTerms) as TermKey[]) {
    out[k] = { ...defaultTerms[k], ...overrides[k], ...extra[k] } as TermEntry
  }
  return out
}

/** t('unit.plural') -> 'Units'. Options: lower -> 'units'. */
export function t(path: TermPath, opts?: { lower?: boolean; terms?: Record<TermKey, TermEntry> }): string {
  const [k, form] = path.split('.') as [TermKey, 'singular' | 'plural']
  const terms = opts?.terms ?? resolveTerms()
  const v = terms[k]?.[form] ?? path
  return opts?.lower ? v.toLowerCase() : v
}
