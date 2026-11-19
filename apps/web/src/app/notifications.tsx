import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/page'

export function NotificationsPopover() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications.list, refetchInterval: 30000 })
  const read = useMutation({ mutationFn: (ids?: string[]) => api.notifications.markRead(ids), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
  const items = data?.items ?? []
  const unread = items.filter((n) => !n.read).length
  return (
    <Popover>
      <Hint label="Notifications">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative max-md:size-9">
            <Bell />
            {unread > 0 && <span className="absolute top-1 right-1 size-2.5 rounded-full border-2 border-background bg-destructive" />}
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold">Notifications</div>
          <Button variant="ghost" size="sm" disabled={!unread} onClick={() => read.mutate(undefined)}><CheckCheck />Mark all read</Button>
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? <EmptyState title="You are all caught up" description="New activity will show up here." /> : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className="border-b last:border-0">
                  <Link to={(n.link ?? '/') as never} onClick={() => read.mutate([n.id])} className="flex gap-2.5 px-3 py-2.5 hover:bg-accent focus-visible:bg-accent">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-primary'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight">{n.title}</span>
                      {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                      <span className="mt-0.5 block text-[0.8em] text-muted-foreground">{timeAgo(n.at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
