import { Building2 } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  { id: 'units', label: (t) => t('unit.plural'), to: '/units', icon: Building2, group: 'organisation', permission: 'unit.manage', order: 40, mobilePrimary: true, keywords: ['branches', 'sites', 'locations'] },
]
