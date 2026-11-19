import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Maximize2, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { useChatDrawer } from '@/app/chat-drawer-context'
import { useCan } from '@/app/session'
import { Inbox, Thread } from './chat-panel'
import { useConversations } from '../hooks'

export function ChatDrawer() {
  const { open, setOpen, conversationId } = useChatDrawer()
  const can = useCan()
  const { data } = useConversations()
  const [active, setActive] = React.useState<string | null>(null)
  const [showThread, setShowThread] = React.useState(false)
  React.useEffect(() => { if (open && conversationId) { setActive(conversationId); setShowThread(true) } }, [open, conversationId])
  React.useEffect(() => { if (open && !active && data?.length && window.matchMedia('(min-width: 640px)').matches) setActive(data[0]!.id) }, [open, data, active])
  if (!can('chat.use')) return null
  const conv = data?.find((c) => c.id === active)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent hideClose className="w-full gap-0 p-0 sm:max-w-[640px]">
        <SheetTitle className="sr-only">Team chat</SheetTitle>
        <SheetDescription className="sr-only">Conversations with your team</SheetDescription>
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
          <div className="text-sm font-semibold">Team chat</div>
          <div className="ml-auto flex items-center gap-1">
            <Hint label="Open full page"><Button asChild variant="ghost" size="icon" aria-label="Open full page"><Link to="/chat" search={active ? { c: active } : {}} onClick={() => setOpen(false)}><Maximize2 /></Link></Button></Hint>
            <Button variant="ghost" size="icon" aria-label="Close chat" onClick={() => setOpen(false)}><X /></Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <Inbox active={active} onSelect={(id) => { setActive(id); setShowThread(true) }} className={`w-full shrink-0 border-r sm:w-60 ${showThread ? 'max-sm:hidden' : ''}`} />
          <div className={`min-w-0 flex-1 ${showThread ? 'flex' : 'max-sm:hidden flex'}`}>
            <Thread conversation={conv} onBack={() => setShowThread(false)} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
