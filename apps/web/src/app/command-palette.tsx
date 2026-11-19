import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Moon, Plus, Rows3, Sun } from 'lucide-react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command'
import { api } from '@/lib/api'
import { useCan } from './session'
import { useTerm } from './terms'
import { usePrefs } from './prefs'
import { useVisibleNav } from './sidebar'
import { useChatDrawer } from './chat-drawer-context'

const Ctx = React.createContext<{ open: boolean; setOpen: (o: boolean) => void }>({ open: false, setOpen: () => {} })
export const usePalette = () => React.useContext(Ctx)

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o) }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])
  return <Ctx.Provider value={{ open, setOpen }}>{children}<CommandPalette /></Ctx.Provider>
}

function CommandPalette() {
  const { open, setOpen } = usePalette()
  const nav = useNavigate()
  const t = useTerm()
  const can = useCan()
  const items = useVisibleNav()
  const prefs = usePrefs()
  const chat = useChatDrawer()
  const [q, setQ] = React.useState('')
  const records = useQuery({ queryKey: ['palette', 'records', q], queryFn: () => api.records.list({ q, limit: 5 }), enabled: open && q.length >= 2 && can('record.read') })
  const run = (fn: () => void) => { setOpen(false); setQ(''); fn() }
  return (
    <CommandDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ('') }}>
      <CommandInput placeholder={`Search pages, ${t('record.plural', { lower: true })} and actions`} value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {items.map((i) => (
            <CommandItem key={i.id} value={`${i.label(t)} ${(i.keywords ?? []).join(' ')}`} onSelect={() => run(() => nav({ to: i.to }))}>
              <i.icon />{i.label(t)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          {can('record.create') && <CommandItem value={`new ${t('record.singular', { lower: true })} create`} onSelect={() => run(() => nav({ to: '/records', search: { new: true } as never }))}><Plus />New {t('record.singular', { lower: true })}</CommandItem>}
          <CommandItem value="open chat messages" onSelect={() => run(() => chat.openChat())}><Rows3 />Open team chat</CommandItem>
          <CommandItem value="toggle theme dark light" onSelect={() => run(prefs.toggleTheme)}>{prefs.resolvedTheme === 'dark' ? <Sun /> : <Moon />}Switch to {prefs.resolvedTheme === 'dark' ? 'light' : 'dark'} theme<CommandShortcut>Theme</CommandShortcut></CommandItem>
        </CommandGroup>
        {(records.data?.items.length ?? 0) > 0 && (
          <CommandGroup heading={t('record.plural')}>
            {records.data!.items.map((r) => (
              <CommandItem key={r.id} value={`${r.id} ${r.title}`} onSelect={() => run(() => nav({ to: '/records', search: { q: r.title } as never }))}>
                {r.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
