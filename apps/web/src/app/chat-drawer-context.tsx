import * as React from 'react'

type Ctx = { open: boolean; conversationId: string | null; openChat: (conversationId?: string) => void; setOpen: (o: boolean) => void }
const C = React.createContext<Ctx | null>(null)

export function ChatDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [conversationId, setConv] = React.useState<string | null>(null)
  const value = React.useMemo<Ctx>(() => ({ open, conversationId, setOpen, openChat: (id) => { if (id) setConv(id); setOpen(true) } }), [open, conversationId])
  return <C.Provider value={value}>{children}</C.Provider>
}
export function useChatDrawer() {
  const c = React.useContext(C)
  if (!c) throw new Error('useChatDrawer outside provider')
  return c
}
