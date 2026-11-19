/** Per-product branding. Tenants can override name/accent at runtime (Settings > Branding). */
export const branding = {
  productName: 'Your Product',
  tagline: 'Run your operations in one place',
  /** Single letter / short mark shown in the logo tile when no logoUrl is set. */
  logoMark: 'Y',
  logoUrl: '' as string,
  /** Accent used for charts and highlights (hex). Primary buttons stay black/white. */
  accentColor: '#18181b',
  supportEmail: 'support@example.com',
} as const

export type Branding = { -readonly [K in keyof typeof branding]: (typeof branding)[K] extends string ? string : never }
