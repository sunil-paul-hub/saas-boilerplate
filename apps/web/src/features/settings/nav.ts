import { Settings } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  {
    id: 'settings', label: () => 'Settings', to: '/settings', icon: Settings, group: 'other', order: 80, keywords: ['preferences', 'profile', 'terminology', 'branding', 'appearance'],
    sub: [
      { label: 'Profile', to: '/settings/profile' },
      { label: 'Organisation', to: '/settings/organisation' },
      { label: 'Terminology', to: '/settings/terminology', permission: 'settings.manage' },
      { label: 'Branding', to: '/settings/branding', permission: 'settings.manage' },
      { label: 'Appearance', to: '/settings/appearance' },
    ],
  },
]
