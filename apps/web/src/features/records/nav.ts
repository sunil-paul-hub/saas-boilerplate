import { FileText } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  { id: 'records', label: (t) => t('record.plural'), to: '/records', icon: FileText, group: 'operations', permission: 'record.read', order: 20, mobilePrimary: true, keywords: ['list', 'items'] },
]
