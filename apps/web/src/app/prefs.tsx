import * as React from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type Density = 'compact' | 'comfortable'
type Prefs = { theme: Theme; density: Density }
const KEY = 'base.prefs'

function load(): Prefs {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { theme: s.theme ?? 'light', density: s.density === 'comfortable' ? 'comfortable' : 'compact' }
  } catch { return { theme: 'light', density: 'compact' } }
}

type Ctx = Prefs & { resolvedTheme: 'light' | 'dark'; setTheme: (t: Theme) => void; setDensity: (d: Density) => void; toggleTheme: () => void }
const PrefsContext = React.createContext<Ctx | null>(null)

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = React.useState<Prefs>(load)
  const [sysDark, setSysDark] = React.useState(() => matchMedia('(prefers-color-scheme: dark)').matches)

  React.useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const fn = () => setSysDark(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const resolvedTheme: 'light' | 'dark' = prefs.theme === 'system' ? (sysDark ? 'dark' : 'light') : prefs.theme

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.dataset.density = prefs.density
    try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
  }, [prefs, resolvedTheme])

  const value = React.useMemo<Ctx>(() => ({
    ...prefs, resolvedTheme,
    setTheme: (theme) => setPrefs((p) => ({ ...p, theme })),
    setDensity: (density) => setPrefs((p) => ({ ...p, density })),
    toggleTheme: () => setPrefs((p) => ({ ...p, theme: resolvedTheme === 'dark' ? 'light' : 'dark' })),
  }), [prefs, resolvedTheme])

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs() {
  const c = React.useContext(PrefsContext)
  if (!c) throw new Error('usePrefs outside PrefsProvider')
  return c
}
