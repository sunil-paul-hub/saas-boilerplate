import { Shield } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  {
    id: 'platform', label: (t) => `Platform console`, to: '/platform', icon: Shield, group: 'operations', permission: 'platform.admin', order: 5, mobilePrimary: true, keywords: ['operator', 'admin', 'tenants'],
    sub: [
      { label: 'Organisations', to: '/platform/orgs' }, { label: 'Requests', to: '/platform/requests' },
      { label: 'Plans', to: '/platform/plans' }, { label: 'Audit', to: '/platform/audit' },
    ],
  },
]
