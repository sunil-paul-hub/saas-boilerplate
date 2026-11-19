import { CreditCard } from 'lucide-react'
import type { NavItem } from '@/app/module'

export const nav: NavItem[] = [
  { id: 'billing', label: (t) => `Billing and ${t('plan.singular', { lower: true })}`, to: '/billing', icon: CreditCard, group: 'organisation', permission: 'billing.read', order: 60, keywords: ['invoices', 'subscription', 'payment'] },
]
