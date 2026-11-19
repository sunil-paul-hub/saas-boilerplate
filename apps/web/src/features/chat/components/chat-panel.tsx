import * as React from 'react'
import { ArrowLeft, Hash, Send } from 'lucide-react'
import type { Conversation, Message } from '@/lib/types'
import { cn, initials, timeAgo } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/page'
import { useMe } from '@/app/session'
import { convName, useConversations, useMessages, useSendMessage } from '../hooks'

function ConvAvatar({ c, name }: { c: Conversation; name: string }) {
  return (
    <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg">{c.kind === 'group' ? <Hash className="size-4" /> : initials(name)}</AvatarFallback></Avatar>
  )
}

export function Inbox({ active, onSelect, className }: { active: string | null; onSelect: (id: string) => void; className?: string }) {
  const { data, isLoading } = useConversations()
  const me = useMe()
  const groups: [string, Conversation[]][] = [
    ['Group chats', (data ?? []).filter((c) => c.kind === 'group')],
    ['Direct messages', (data ?? []).filter((c) => c.kind === 'direct')],
  ]
  return (
    <div className={cn('flex flex-col gap-0.5 overflow-y-auto p-2', className)}>
      {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="my-1 h-11" />)}
      {!isLoading && (data ?? []).length === 0 && <EmptyState title="No conversations yet" description="Conversations you are part of appear here." />}
      {groups.map(([label, list]) => list.length > 0 && (
        <div key={label}>
          <div className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{label}</div>
          {list.map((c) => {
            const name = convName(c, me.user.id)
            return (
              <button key={c.id} type="button" onClick={() => onSelect(c.id)} aria-current={active === c.id ? 'true' : undefined}
                className={cn('flex w-full items-start gap-2.5 rounded-lg p-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', active === c.id && 'bg-accent')}>
                <ConvAvatar c={c} name={name} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1"><span className="truncate text-sm font-medium">{name}</span>{c.lastAt && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.lastAt)}</span>}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.lastMessage ?? 'No messages yet'}</span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <div className={cn('flex max-w-[82%] flex-col', mine ? 'items-end self-end' : 'items-start self-start')}>
      {!mine && <span className="mb-0.5 px-1 text-[0.8em] font-medium text-muted-foreground">{m.authorName ?? 'Former member'}</span>}
      <div className={cn('rounded-2xl px-3 py-1.5 leading-snug', mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border bg-background')}>{m.body}</div>
      <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">{timeAgo(m.at)}</span>
    </div>
  )
}

function Composer({ conversationId }: { conversationId: string }) {
  const [text, setText] = React.useState('')
  const send = useSendMessage(conversationId)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    send.mutate({ body: text.trim() }, { onSuccess: () => setText('') })
  }
  return (
    <form onSubmit={submit} className="border-t p-3">
      {send.error && <p role="alert" className="mb-2 text-xs text-destructive">{send.error.message}</p>}
      <div className="flex items-center gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" aria-label="Message" className="flex-1" />
        <Button type="submit" size="icon" aria-label="Send" disabled={send.isPending || !text.trim()}><Send /></Button>
      </div>
    </form>
  )
}

export function Thread({ conversation, onBack, headerExtra }: { conversation: Conversation | undefined; onBack?: () => void; headerExtra?: React.ReactNode }) {
  const me = useMe()
  const { data, isLoading } = useMessages(conversation?.id ?? null)
  const endRef = React.useRef<HTMLDivElement>(null)
  const count = data?.items.length ?? 0
  React.useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [count, conversation?.id])
  if (!conversation) return <div className="flex flex-1 items-center justify-center"><EmptyState title="Select a conversation" description="Pick a chat to start talking." /></div>
  const name = convName(conversation, me.user.id)
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
        {onBack && <Button variant="ghost" size="icon" className="size-8 md:hidden" onClick={onBack} aria-label="Back to conversations"><ArrowLeft /></Button>}
        <ConvAvatar c={conversation} name={name} />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold leading-tight">{name}</div><div className="text-xs text-muted-foreground">{conversation.kind === 'group' ? `${conversation.members.length} members` : 'Direct message'}</div></div>
        {headerExtra}
      </div>
      <ScrollArea className="min-h-0 flex-1 bg-muted/30">
        <div className="flex flex-col gap-2.5 p-3.5">
          {isLoading ? <Skeleton className="h-16 w-2/3" /> : count === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello.</p> :
            data!.items.map((m) => <Bubble key={m.id} m={m} mine={m.authorId === me.user.id} />)}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <Composer conversationId={conversation.id} />
    </div>
  )
}
