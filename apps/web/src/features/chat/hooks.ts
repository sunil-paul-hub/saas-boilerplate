import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Conversation } from '@/lib/types'
import { useCan } from '@/app/session'

export function useConversations() {
  const can = useCan()
  return useQuery({ queryKey: ['chat', 'conversations'], queryFn: api.chat.conversations, refetchInterval: 15000, enabled: can('chat.use') })
}
export const useMessages = (id: string | null) =>
  useQuery({ queryKey: ['chat', 'messages', id], queryFn: () => api.chat.messages(id!), enabled: !!id, refetchInterval: 5000 })
export function useSendMessage(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { body: string }) => api.chat.send(id, b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chat', 'messages', id] }); qc.invalidateQueries({ queryKey: ['chat', 'conversations'] }) },
  })
}
/** Group chats use their title; direct chats show the other person. */
export function convName(c: Conversation, meId: string) {
  if (c.title) return c.title
  const others = c.members.filter((m) => m.id !== meId).map((m) => m.name)
  return others.length ? others.join(', ') : 'Conversation'
}
