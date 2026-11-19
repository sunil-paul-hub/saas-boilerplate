// Idempotent demo seed. Runs as the superuser (ADMIN_DATABASE_URL); safe to re-run.
import pg from 'pg';
import argon2 from 'argon2';
import { PERMISSIONS, SYSTEM_ROLES } from '@base/permissions';

const PASSWORD = 'Passw0rd!';

export async function seed(url = process.env.ADMIN_DATABASE_URL) {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];
  try {
    await db.query('BEGIN');
    const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });

    // Catalogue + default role templates (new orgs copy these into their system roles).
    for (const p of PERMISSIONS) {
      await q(`INSERT INTO permissions (code, label, grp) VALUES ($1,$2,$3)
               ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, grp = EXCLUDED.grp`, [p.code, p.label, p.group]);
    }
    await q('DELETE FROM default_role_permissions');
    for (const [role, codes] of Object.entries(SYSTEM_ROLES)) {
      for (const c of codes) await q('INSERT INTO default_role_permissions (role_name, permission_code) VALUES ($1,$2)', [role, c]);
    }

    const plan = async (code, name, price, mu, mm) => (await one(
      `INSERT INTO plans (code, name, price_cents, max_units, max_members, features) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, price_cents = EXCLUDED.price_cents,
         max_units = EXCLUDED.max_units, max_members = EXCLUDED.max_members RETURNING id`,
      [code, name, price, mu, mm, JSON.stringify({ chat: true })])).id;
    const free = await plan('free', 'Free', 0, 3, 10);
    const pro = await plan('pro', 'Pro', 4900, null, null);

    const user = async (email, name) => (await one(
      `INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3)
       ON CONFLICT (lower(email)) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash RETURNING id`,
      [email, name, hash])).id;
    const platformAdmin = await user('admin@platform.test', 'Platform Admin');
    await q('INSERT INTO platform_admins (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [platformAdmin]);

    const org = async (slug, name, status, planId) => {
      const o = await one(
        `INSERT INTO organisations (slug, name, status) VALUES ($1,$2,$3)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status RETURNING id`, [slug, name, status]);
      if (!(await one('SELECT 1 FROM subscriptions WHERE org_id = $1', [o.id]))) {
        await q(`INSERT INTO subscriptions (org_id, plan_id, status) VALUES ($1,$2,$3)`, [o.id, planId, status === 'trial' ? 'trial' : 'active']);
      }
      return o.id;
    };
    const unit = async (orgId, name, code) => (await one(
      `INSERT INTO units (org_id, name, code) VALUES ($1,$2,$3)
       ON CONFLICT (org_id, name) DO UPDATE SET code = EXCLUDED.code RETURNING id`, [orgId, name, code])).id;
    const member = (u, o, role) => q(
      `INSERT INTO memberships (user_id, org_id, org_role) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, org_id) DO UPDATE SET org_role = EXCLUDED.org_role, status = 'active'`, [u, o, role]);
    const roleId = async (orgId, name) => (await one('SELECT id FROM roles WHERE org_id = $1 AND name = $2', [orgId, name])).id;

    // ---- Acme Industries ----
    const acme = await org('acme', 'Acme Industries', 'active', pro);
    const head = await unit(acme, 'Head Office', 'HO');
    const north = await unit(acme, 'North Branch', 'NB');
    const south = await unit(acme, 'South Branch', 'SB');
    const acmeOwner = await user('owner@acme.test', 'Olivia Owner');
    const acmeManager = await user('manager@acme.test', 'Mike Manager');
    const acmeViewer = await user('viewer@acme.test', 'Vera Viewer');
    await member(acmeOwner, acme, 'owner');
    await member(acmeManager, acme, 'member');
    await member(acmeViewer, acme, 'member');
    await q(`INSERT INTO unit_role_assignments (org_id, user_id, unit_id, role_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [acme, acmeManager, north, await roleId(acme, 'manager')]);
    for (const u of [head, north, south]) {
      await q(`INSERT INTO unit_role_assignments (org_id, user_id, unit_id, role_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [acme, acmeViewer, u, await roleId(acme, 'viewer')]);
    }

    // ---- Globex Corp ----
    const globex = await org('globex', 'Globex Corp', 'trial', free);
    const hq = await unit(globex, 'Globex HQ', 'HQ');
    const globexOwner = await user('owner@globex.test', 'Gina Globex');
    await member(globexOwner, globex, 'owner');

    // ---- Demo data (only on first run) ----
    if (!(await one('SELECT 1 FROM records WHERE org_id = $1 LIMIT 1', [acme]))) {
      const recs = [
        [head, 'Quarterly safety review', 'open'], [head, 'Renew insurance policy', 'in_progress'],
        [north, 'Inspect loading dock', 'open'], [north, 'Replace forklift battery', 'done'],
        [north, 'Onboard new supervisor', 'in_progress'], [south, 'Audit stock count', 'open'],
        [south, 'Repaint warehouse floor', 'archived'],
      ];
      for (const [u, title, status] of recs) {
        await q(`INSERT INTO records (org_id, unit_id, title, status, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
          [acme, u, title, status, 'Demo record', acmeOwner]);
      }
      await q(`INSERT INTO records (org_id, unit_id, title, status, created_by) VALUES ($1,$2,$3,'open',$4)`,
        [globex, hq, 'Set up Globex workspace', globexOwner]);

      for (const [u, title] of [[acmeOwner, 'Welcome to Acme'], [acmeManager, 'You were assigned to North Branch'], [acmeViewer, 'Viewer access granted']]) {
        await q(`INSERT INTO notifications (org_id, user_id, title, body) VALUES ($1,$2,$3,'Demo notification')`, [acme, u, title]);
      }

      const conv = await one(`INSERT INTO conversations (org_id, title, kind, created_by) VALUES ($1,'Acme general','group',$2) RETURNING id`, [acme, acmeOwner]);
      for (const u of [acmeOwner, acmeManager, acmeViewer]) {
        await q('INSERT INTO conversation_members (conversation_id, org_id, user_id) VALUES ($1,$2,$3)', [conv.id, acme, u]);
      }
      const msgs = [[acmeOwner, 'Welcome to the team chat.'], [acmeManager, 'Thanks, North Branch is ready.'], [acmeViewer, 'Glad to be here.']];
      for (const [s, body] of msgs) {
        await q('INSERT INTO messages (org_id, conversation_id, sender_id, body) VALUES ($1,$2,$3,$4)', [acme, conv.id, s, body]);
      }
      await q(`INSERT INTO audit_events (org_id, actor_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,'org.seeded','organisation',$3,'{"source":"seed"}')`, [acme, acmeOwner, String(acme)]);
      await q(`INSERT INTO org_settings (org_id) VALUES ($1) ON CONFLICT DO NOTHING`, [acme]);
    }
    await q(`UPDATE org_settings SET terminology = $2, branding = $3 WHERE org_id = $1`,
      [acme, JSON.stringify({ unit: { singular: 'Branch', plural: 'Branches' } }), JSON.stringify({ primaryColor: '#2563eb' })]);

    if (!(await one(`SELECT 1 FROM onboarding_requests WHERE contact_email = 'founder@initech.test'`))) {
      await q(`INSERT INTO onboarding_requests (org_name, contact_name, contact_email, details)
               VALUES ('Initech','Peter Founder','founder@initech.test','{"size":"11-50"}')`);
    }
    await db.query('COMMIT');
    console.log('seed complete (password for all demo users: ' + PASSWORD + ')');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    await db.end();
  }
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seed().catch((e) => { console.error(e); process.exit(1); });
}
