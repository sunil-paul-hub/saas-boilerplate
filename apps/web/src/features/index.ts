import type { FeatureModule } from '@/app/module'
import * as auth from './auth/routes'
import { nav as authNav } from './auth/nav'
import * as onboarding from './onboarding/routes'
import { nav as onboardingNav } from './onboarding/nav'
import * as dashboard from './dashboard/routes'
import { nav as dashboardNav } from './dashboard/nav'
import * as records from './records/routes'
import { nav as recordsNav } from './records/nav'
import * as chat from './chat/routes'
import { nav as chatNav } from './chat/nav'
import * as units from './units/routes'
import { nav as unitsNav } from './units/nav'
import * as people from './people/routes'
import { nav as peopleNav } from './people/nav'
import * as billing from './billing/routes'
import { nav as billingNav } from './billing/nav'
import * as audit from './audit/routes'
import { nav as auditNav } from './audit/nav'
import * as settings from './settings/routes'
import { nav as settingsNav } from './settings/nav'
import * as help from './help/routes'
import { nav as helpNav } from './help/nav'
import * as platform from './platform/routes'
import { nav as platformNav } from './platform/nav'

/**
 * Feature registry. To add a module: create src/features/<name>/{routes.tsx,nav.ts},
 * import both here and append to the array. See apps/web/docs/ADDING_A_MODULE.md.
 */
export const modules: FeatureModule[] = [
  { id: 'auth', nav: authNav, routes: auth.routes },
  { id: 'onboarding', nav: onboardingNav, routes: onboarding.routes },
  { id: 'dashboard', nav: dashboardNav, routes: dashboard.routes },
  { id: 'records', nav: recordsNav, routes: records.routes },
  { id: 'chat', nav: chatNav, routes: chat.routes },
  { id: 'units', nav: unitsNav, routes: units.routes },
  { id: 'people', nav: peopleNav, routes: people.routes },
  { id: 'billing', nav: billingNav, routes: billing.routes },
  { id: 'audit', nav: auditNav, routes: audit.routes },
  { id: 'settings', nav: settingsNav, routes: settings.routes },
  { id: 'help', nav: helpNav, routes: help.routes },
  { id: 'platform', nav: platformNav, routes: platform.routes },
]
