import { LayoutDashboard } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  { id: 'dashboard', label: () => 'Dashboard', to: '/', icon: LayoutDashboard, group: 'operations', order: 10, mobilePrimary: true, keywords: ['home', 'overview'] },
]
