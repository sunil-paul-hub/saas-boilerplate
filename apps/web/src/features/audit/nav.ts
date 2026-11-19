import { ScrollText } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  { id: 'audit', label: () => 'Audit log', to: '/audit', icon: ScrollText, group: 'organisation', permission: 'audit.read', order: 70, keywords: ['history', 'activity', 'events'] },
]
