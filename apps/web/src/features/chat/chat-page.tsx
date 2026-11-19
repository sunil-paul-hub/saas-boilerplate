import * as React from 'react'
import { useSearch } from '@tanstack/react-router'
import { PageHeader } from '@/components/page'
import { RequirePermission } from '@/components/forbidden'
import { useIsMobile } from '@/hooks/use-media'
import { Inbox, Thread } from './components/chat-panel'
import { useConversations } from './hooks'

export function ChatPage() {
  const search = useSearch({ strict: false }) as { c?: string }
  const { data } = useConversations()
  const mobile = useIsMobile()
  const [active, setActive] = React.useState<string | null>(search.c ?? null)
  const [showThread, setShowThread] = React.useState(!!search.c)
  React.useEffect(() => { if (!active && data?.length && !mobile) setActive(data[0]!.id) }, [data, active, mobile])
  const conv = data?.find((c) => c.id === active)
  return (
    <RequirePermission permission="chat.use">
      <PageHeader title="Chats" description="Talk with your team by channel or directly." />
      <div className="flex h-[calc(100dvh-210px)] min-h-[420px] overflow-hidden rounded-xl border bg-card">
        <Inbox active={active} onSelect={(id) => { setActive(id); setShowThread(true) }} className={`w-full shrink-0 border-r md:w-72 ${mobile && showThread ? 'hidden' : ''}`} />
        <div className={`min-w-0 flex-1 ${mobile && !showThread ? 'hidden' : 'flex'}`}><Thread conversation={conv} onBack={() => setShowThread(false)} /></div>
      </div>
    </RequirePermission>
  )
}
