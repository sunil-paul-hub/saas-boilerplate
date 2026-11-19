import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { resolveTerms, setRuntimeTerms, t as rawT, branding as defaultBranding, type TermPath, type TermKey, type TermEntry } from '@base/config'
import { api } from '@/lib/api'
import { meQuery } from './session'

type TFn = (path: TermPath, opts?: { lower?: boolean }) => string
const TermContext = React.createContext<{ terms: Record<TermKey, TermEntry>; t: TFn }>({
  terms: resolveTerms({}),
  t: (p, o) => rawT(p, o),
})

/** Loads tenant terminology + branding overrides and exposes useTerm() / useBranding(). */
export function TermProvider({ children }: { children: React.ReactNode }) {
  const { data: me } = useQuery(meQuery)
  const orgId = me?.org?.id
  const { data } = useQuery({ queryKey: ['settings', 'terminology', orgId], queryFn: api.settings.terminology, enabled: !!orgId, staleTime: 5 * 60_000 })
  const value = React.useMemo(() => {
    setRuntimeTerms(data ?? {})
    const terms = resolveTerms(data ?? {})
    return { terms, t: ((p, o) => rawT(p, { ...o, terms })) as TFn }
  }, [data])
  return <TermContext.Provider value={value}>{children}</TermContext.Provider>
}

/** const t = useTerm(); t('unit.plural') -> 'Units' (or the tenant's override). */
export function useTerm(): TFn {
  return React.useContext(TermContext).t
}

export function useBranding() {
  const { data: me } = useQuery(meQuery)
  const orgId = me?.org?.id
  const { data } = useQuery({ queryKey: ['settings', 'branding', orgId], queryFn: api.settings.branding, enabled: !!orgId, staleTime: 5 * 60_000 })
  return {
    productName: data?.productName || defaultBranding.productName,
    accentColor: data?.accentColor || defaultBranding.accentColor,
    supportEmail: data?.supportEmail || defaultBranding.supportEmail,
    logoUrl: data?.logoUrl || defaultBranding.logoUrl,
    logoMark: (data?.productName || defaultBranding.productName).slice(0, 1).toUpperCase() || defaultBranding.logoMark,
  }
}
