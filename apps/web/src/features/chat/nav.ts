import { MessagesSquare } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  { id: 'chat', label: () => 'Chats', to: '/chat', icon: MessagesSquare, group: 'operations', permission: 'chat.use', order: 30, mobilePrimary: true, keywords: ['messages', 'team'] },
]
