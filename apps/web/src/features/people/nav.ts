import { Users } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  { id: 'people', label: (t) => `${t('member.plural')} and roles`, to: '/people', icon: Users, group: 'organisation', permission: 'member.manage', order: 50, keywords: ['users', 'team', 'permissions', 'invite'] },
]
