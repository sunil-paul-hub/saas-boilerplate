import { LifeBuoy } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  { id: 'help', label: () => 'Help', to: '/help', icon: LifeBuoy, group: 'other', order: 90, keywords: ['support', 'faq', 'contact', 'shortcuts'] },
]
