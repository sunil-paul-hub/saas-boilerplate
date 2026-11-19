import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { PERMISSIONS, SYSTEM_ROLES } from '@base/permissions';
import { withTenant } from '../src/index.ts';
import { admin, app, platform, buildFixture, denied, type Fx } from './fixture.ts';

let fx: Fx;
beforeAll(async () => { fx = await buildFixture(); });
afterAll(async () => { await fx.cleanup(); await Promise.all([admin.end(), app.end(), platform.end()]); });

const titles = (rows: { title: string }[]) => rows.map((r) => r.title).sort();
const rec = (org: string, unit: string, by: string, title = 'x') =>
  [`INSERT INTO records (org_id,unit_id,title,created_by) VALUES ($1,$2,$3,$4)`, [org, unit, title, by]] as const;

describe('cross-org isolation', () => {
  it('owner of A sees only A records, units, memberships', async () => {
    await fx.as(fx.u.aOwner, fx.A, async (c) => {
      expect(titles((await c.query('SELECT title FROM records')).rows)).toEqual(['A1 rec', 'A2 rec', 'A2 rec 2']);
      expect((await c.query('SELECT org_id FROM units')).rows.every((r) => r.org_id === fx.A)).toBe(true);
      expect((await c.query('SELECT DISTINCT org_id FROM memberships')).rows.map((r) => r.org_id)).toEqual([fx.A]);
    });
  });
  it('forged app.org_id (user is not a member) exposes nothing', async () => {
    await fx.as(fx.u.aOwner, fx.B, async (c) => {
      for (const t of ['records', 'units', 'roles', 'org_settings', 'files', 'conversations', 'subscriptions'])
        expect((await c.query(`SELECT 1 FROM ${t}`)).rowCount, t).toBe(0);
      expect((await c.query('SELECT 1 FROM records WHERE id = $1', [fx.r.b1])).rowCount).toBe(0);
    });
  });
  it('no context at all returns nothing', async () => {
    const c = await app.connect();
    try {
      for (const t of ['records', 'units', 'memberships', 'users', 'organisations', 'notifications'])
        expect((await c.query(`SELECT 1 FROM ${t}`)).rowCount, t).toBe(0);
    } finally { c.release(); }
  });
  it("cannot read by id, update, or delete another org's rows", async () => {
    await fx.asRb(fx.u.aOwner, fx.A, async (c) => {
      expect((await c.query('SELECT 1 FROM records WHERE id=$1', [fx.r.b1])).rowCount).toBe(0);
      expect((await c.query(`UPDATE records SET title='pwned' WHERE id=$1`, [fx.r.b1])).rowCount).toBe(0);
      expect((await c.query('DELETE FROM records WHERE id=$1', [fx.r.b1])).rowCount).toBe(0);
      expect((await c.query(`UPDATE records SET title='pwned' WHERE org_id=$1`, [fx.B])).rowCount).toBe(0);
    });
    expect((await fx.q('SELECT title FROM records WHERE id=$1', [fx.r.b1]))[0].title).toBe('B1 secret');
  });
  it('cannot insert into another org (explicit org_id, or A org with B unit)', async () => {
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(...rec(fx.B, fx.units.b1, fx.u.aOwner))));
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(...rec(fx.A, fx.units.b1, fx.u.aOwner))));
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO units (org_id,name) VALUES ($1,'evil')`, [fx.B])));
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO memberships (user_id,org_id,org_role) VALUES ($1,$2,'member')`, [fx.u.outsider, fx.B])));
  });
  it('cannot move a record to another org', async () => {
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`UPDATE records SET org_id=$1, unit_id=$2 WHERE id=$3`, [fx.B, fx.units.b1, fx.r.a1])));
  });
  it('joins and subqueries cannot leak', async () => {
    await fx.as(fx.u.aOwner, fx.A, async (c) => {
      const j = await c.query(`SELECT r.title, u.name FROM records r JOIN units u ON u.id = r.unit_id`);
      expect(j.rows.some((r) => r.title === 'B1 secret' || r.name === 'B1')).toBe(false);
      expect((await c.query(`SELECT u.name, r.title FROM units u LEFT JOIN records r ON r.unit_id = u.id WHERE u.id = $1`, [fx.units.b1])).rowCount).toBe(0);
      expect((await c.query(`SELECT title FROM records WHERE unit_id IN (SELECT id FROM units WHERE org_id = $1)`, [fx.B])).rowCount).toBe(0);
      const cnt = await c.query(`SELECT (SELECT count(*) FROM records WHERE org_id=$1)::int AS b, (SELECT count(*) FROM memberships WHERE org_id=$1)::int AS bm`, [fx.B]);
      expect(cnt.rows[0]).toEqual({ b: 0, bm: 0 });
      expect((await c.query(`SELECT 1 FROM records r WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = r.created_by AND u.id = $1)`, [fx.u.bOwner])).rowCount).toBe(0);
      const uni = await c.query(`SELECT title FROM records UNION ALL SELECT name FROM units`);
      expect(uni.rows.some((r) => r.title === 'B1 secret' || r.title === 'B1')).toBe(false);
      // membership -> org join cannot reveal B for the shared user
      const mj = await c.query(`SELECT o.slug FROM memberships m JOIN organisations o ON o.id = m.org_id WHERE m.user_id = $1`, [fx.u.shared]);
      expect(mj.rows.map((r) => r.slug)).toEqual([`orga-${fx.tag}`]);
    });
  });
  it('user directory is limited to the current org (and self)', async () => {
    await fx.as(fx.u.aOwner, fx.A, async (c) => {
      const ids = (await c.query('SELECT id FROM users')).rows.map((r) => r.id);
      expect(ids).toContain(fx.u.shared);
      expect(ids).not.toContain(fx.u.bOwner);
      expect(ids).not.toContain(fx.u.outsider);
    });
    await fx.as(fx.u.outsider, fx.A, async (c) => {
      expect((await c.query('SELECT id FROM users')).rows.map((r) => r.id)).toEqual([fx.u.outsider]);
      expect((await c.query('SELECT 1 FROM records')).rowCount).toBe(0);
      expect((await c.query('SELECT 1 FROM organisations')).rowCount).toBe(0);
    });
  });
  it("overlapping user sees only the current org's data", async () => {
    await fx.as(fx.u.shared, fx.A, async (c) => expect(titles((await c.query('SELECT title FROM records')).rows)).toEqual(['A2 rec', 'A2 rec 2']));
    await fx.as(fx.u.shared, fx.B, async (c) => expect(titles((await c.query('SELECT title FROM records')).rows)).toEqual(['B1 secret']));
    await fx.as(fx.u.shared, fx.A, async (c) => expect((await c.query('SELECT 1 FROM organisations')).rowCount).toBe(2)); // org switcher
  });
  it('notifications are private to their recipient', async () => {
    await fx.as(fx.u.aViewer, fx.A, async (c) => expect((await c.query('SELECT title FROM notifications')).rows.map((r) => r.title)).toEqual(['for viewer']));
  });
  it('chat is limited to conversation members', async () => {
    const [conv] = await fx.q(`INSERT INTO conversations (org_id,title,created_by) VALUES ($1,'c',$2) RETURNING id`, [fx.A, fx.u.aOwner]);
    await fx.q(`INSERT INTO conversation_members (conversation_id,org_id,user_id) VALUES ($1,$2,$3)`, [conv.id, fx.A, fx.u.aOwner]);
    await fx.q(`INSERT INTO messages (org_id,conversation_id,sender_id,body) VALUES ($1,$2,$3,'hi')`, [fx.A, conv.id, fx.u.aOwner]);
    await fx.as(fx.u.aOwner, fx.A, async (c) => expect((await c.query('SELECT 1 FROM messages')).rowCount).toBe(1));
    await fx.as(fx.u.aViewer, fx.A, async (c) => expect((await c.query('SELECT 1 FROM messages')).rowCount).toBe(0));
    await denied(fx.as(fx.u.aViewer, fx.A, (c) => c.query(`INSERT INTO messages (org_id,conversation_id,sender_id,body) VALUES ($1,$2,$3,'sneak')`, [fx.A, conv.id, fx.u.aViewer])));
    await fx.as(fx.u.bOwner, fx.B, async (c) => expect((await c.query('SELECT 1 FROM messages')).rowCount).toBe(0));
  });
});

describe('unit-scoped access', () => {
  it('manager on A2 only sees A2 records and units', async () => {
    await fx.as(fx.u.aManager, fx.A, async (c) => {
      expect(titles((await c.query('SELECT title FROM records')).rows)).toEqual(['A2 rec', 'A2 rec 2']);
      expect((await c.query('SELECT name FROM units')).rows.map((r) => r.name)).toEqual(['A2']);
    });
  });
  it('manager can write in A2 but not A1', async () => {
    await fx.asRb(fx.u.aManager, fx.A, async (c) => {
      await c.query(...rec(fx.A, fx.units.a2, fx.u.aManager, 'mgr rec'));
      expect((await c.query(`UPDATE records SET status='done' WHERE id=$1`, [fx.r.a2])).rowCount).toBe(1);
      expect((await c.query(`UPDATE records SET status='done' WHERE id=$1`, [fx.r.a1])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM records WHERE id=$1`, [fx.r.a1])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM records WHERE id=$1`, [fx.r.a2b])).rowCount).toBe(1);
    });
    await denied(fx.as(fx.u.aManager, fx.A, (c) => c.query(...rec(fx.A, fx.units.a1, fx.u.aManager))));
    await denied(fx.as(fx.u.aManager, fx.A, (c) => c.query(`UPDATE records SET unit_id=$1 WHERE id=$2`, [fx.units.a1, fx.r.a2b])));
  });
  it('manager cannot manage members, roles, units, audit, billing', async () => {
    await denied(fx.as(fx.u.aManager, fx.A, (c) => c.query(`INSERT INTO memberships (user_id,org_id,org_role) VALUES ($1,$2,'member')`, [fx.u.outsider, fx.A])));
    await denied(fx.as(fx.u.aManager, fx.A, (c) => c.query(`INSERT INTO units (org_id,name) VALUES ($1,'new')`, [fx.A])));
    await denied(fx.as(fx.u.aManager, fx.A, (c) => c.query(`INSERT INTO roles (org_id,name) VALUES ($1,'sneaky')`, [fx.A])));
    await denied(fx.as(fx.u.aManager, fx.A, (c) => c.query(`INSERT INTO unit_role_assignments (org_id,user_id,unit_id,role_id) VALUES ($1,$2,$3,$4)`, [fx.A, fx.u.aManager, fx.units.a1, fx.roles.aManager])));
    await fx.as(fx.u.aManager, fx.A, async (c) => {
      expect((await c.query('SELECT 1 FROM subscriptions')).rowCount).toBe(0);
      expect((await c.query('SELECT 1 FROM audit_events')).rowCount).toBe(0);
      expect((await c.query('SELECT 1 FROM invitations')).rowCount).toBe(0);
    });
  });
  it('viewer reads but cannot write', async () => {
    await fx.as(fx.u.aViewer, fx.A, async (c) => {
      expect((await c.query('SELECT 1 FROM records')).rowCount).toBe(3);
      expect((await c.query(`UPDATE records SET title='x' WHERE id=$1`, [fx.r.a1])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM records WHERE id=$1`, [fx.r.a1])).rowCount).toBe(0);
    });
    await denied(fx.as(fx.u.aViewer, fx.A, (c) => c.query(...rec(fx.A, fx.units.a1, fx.u.aViewer))));
  });
  it('admin gets every unit; plain org member without roles gets none', async () => {
    await fx.as(fx.u.aAdmin, fx.A, async (c) => expect((await c.query('SELECT 1 FROM records')).rowCount).toBe(3));
    const nobody = await fx.user('nobody'); await fx.member(nobody, fx.A, 'member');
    await fx.as(nobody, fx.A, async (c) => {
      expect((await c.query('SELECT 1 FROM records')).rowCount).toBe(0);
      expect((await c.query('SELECT 1 FROM units')).rowCount).toBe(0);
    });
  });
  it('suspended membership loses all access', async () => {
    const u = await fx.user('susp'); await fx.member(u, fx.A, 'admin');
    await fx.q(`UPDATE memberships SET status='suspended' WHERE user_id=$1`, [u]);
    await fx.as(u, fx.A, async (c) => expect((await c.query('SELECT 1 FROM records')).rowCount).toBe(0));
  });
});

describe('role escalation and last owner', () => {
  it('admin cannot self-promote to owner', async () => {
    await denied(fx.as(fx.u.aAdmin, fx.A, (c) => c.query(`UPDATE memberships SET org_role='owner' WHERE user_id=$1`, [fx.u.aAdmin])), /only an owner/);
  });
  it('admin cannot make someone else owner, or insert an owner membership', async () => {
    await denied(fx.as(fx.u.aAdmin, fx.A, (c) => c.query(`UPDATE memberships SET org_role='owner' WHERE user_id=$1`, [fx.u.aViewer])), /only an owner/);
    await denied(fx.as(fx.u.aAdmin, fx.A, (c) => c.query(`INSERT INTO memberships (user_id,org_id,org_role) VALUES ($1,$2,'owner')`, [fx.u.outsider, fx.A])), /only an owner/);
  });
  it('admin cannot demote or remove an owner', async () => {
    await denied(fx.as(fx.u.aAdmin, fx.A, (c) => c.query(`UPDATE memberships SET org_role='member' WHERE user_id=$1`, [fx.u.aOwner])), /only an owner/);
    await denied(fx.as(fx.u.aAdmin, fx.A, (c) => c.query(`DELETE FROM memberships WHERE user_id=$1`, [fx.u.aOwner])), /only an owner/);
  });
  it('invitations cannot carry the owner role', async () => {
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO invitations (org_id,email,org_role,token_hash,invited_by,expires_at) VALUES ($1,'x@y.z','owner','h1',$2, now()+interval '1 day')`, [fx.A, fx.u.aOwner])));
  });
  it('sole owner cannot demote, suspend or remove themselves', async () => {
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`UPDATE memberships SET org_role='admin' WHERE user_id=$1`, [fx.u.aOwner])), /last owner/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`UPDATE memberships SET status='suspended' WHERE user_id=$1`, [fx.u.aOwner])), /last owner/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`DELETE FROM memberships WHERE user_id=$1`, [fx.u.aOwner])), /last owner/);
    await denied(fx.q(`DELETE FROM memberships WHERE user_id=$1`, [fx.u.bOwner]), /last owner/);
  });
  it('owner can grant owner; then one of two owners may step down', async () => {
    const O = await fx.org('own'); const o1 = await fx.user('o1'); const o2 = await fx.user('o2');
    await fx.member(o1, O, 'owner');
    await fx.as(o1, O, (c) => c.query(`INSERT INTO memberships (user_id,org_id,org_role) VALUES ($1,$2,'owner')`, [o2, O]));
    await fx.as(o1, O, (c) => c.query(`UPDATE memberships SET org_role='admin' WHERE user_id=$1`, [o1]));
    await denied(fx.as(o2, O, (c) => c.query(`UPDATE memberships SET org_role='admin' WHERE user_id=$1`, [o2])), /last owner/);
  });
  it('concurrent demotion of two owners cannot leave the org ownerless (no write skew)', async () => {
    const O = await fx.org('race'); const o1 = await fx.user('r1'); const o2 = await fx.user('r2');
    await fx.member(o1, O, 'owner'); await fx.member(o2, O, 'owner');
    const hold = () => new Promise((r) => setTimeout(r, 300));
    const results = await Promise.allSettled([
      withTenant(app, { userId: o1, orgId: O }, async (c) => { await c.query(`UPDATE memberships SET org_role='admin' WHERE user_id=$1`, [o2]); await hold(); }),
      withTenant(app, { userId: o2, orgId: O }, async (c) => { await c.query(`UPDATE memberships SET org_role='admin' WHERE user_id=$1`, [o1]); await hold(); }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await fx.q(`SELECT count(*)::int n FROM memberships WHERE org_id=$1 AND org_role='owner'`, [O]))[0].n).toBe(1);
  });
  it('membership org_id/user_id are immutable (column grant for app_user, trigger for everyone else)', async () => {
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`UPDATE memberships SET org_id=$1 WHERE user_id=$2`, [fx.B, fx.u.aViewer])), /permission denied/);
    await denied(fx.q(`UPDATE memberships SET org_id=$1 WHERE user_id=$2`, [fx.B, fx.u.aViewer]), /immutable/);
    await denied(fx.q(`UPDATE memberships SET user_id=$1 WHERE user_id=$2`, [fx.u.outsider, fx.u.aViewer]), /immutable/);
  });
  it('role assignment cannot cross orgs (composite FKs)', async () => {
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO unit_role_assignments (org_id,user_id,unit_id,role_id) VALUES ($1,$2,$3,$4)`, [fx.A, fx.u.aViewer, fx.units.a1, fx.roles.bManager])));
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO unit_role_assignments (org_id,user_id,unit_id,role_id) VALUES ($1,$2,$3,$4)`, [fx.A, fx.u.outsider, fx.units.a1, fx.roles.aManager])));
  });
  it('system roles are immutable for tenants; custom roles are manageable', async () => {
    await fx.asRb(fx.u.aOwner, fx.A, async (c) => {
      expect((await c.query(`UPDATE roles SET name='hax' WHERE org_id=$1 AND is_system`, [fx.A])).rowCount).toBe(0);
      expect((await c.query(`DELETE FROM roles WHERE org_id=$1 AND is_system`, [fx.A])).rowCount).toBe(0);
      await c.query(`INSERT INTO roles (org_id,name) VALUES ($1,'custom')`, [fx.A]);
    });
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO roles (org_id,name,is_system) VALUES ($1,'fake',true)`, [fx.A])));
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO role_permissions (role_id,org_id,permission_code) VALUES ($1,$2,'org.manage')`, [fx.roles.aMember, fx.A])));
  });
});

describe('audit_events append-only', () => {
  it('app_user can insert own-org events and read them with audit.read', async () => {
    await fx.as(fx.u.aOwner, fx.A, async (c) => {
      await c.query(`INSERT INTO audit_events (org_id,actor_id,action) VALUES ($1,$2,'test.create')`, [fx.A, fx.u.aOwner]);
      expect((await c.query(`SELECT 1 FROM audit_events WHERE action='test.create'`)).rowCount).toBe(1);
    });
    await fx.as(fx.u.aViewer, fx.A, async (c) => expect((await c.query('SELECT 1 FROM audit_events')).rowCount).toBe(0));
    await fx.as(fx.u.bOwner, fx.B, async (c) => expect((await c.query('SELECT 1 FROM audit_events')).rowCount).toBe(0));
  });
  it('cannot forge actor or org', async () => {
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO audit_events (org_id,actor_id,action) VALUES ($1,$2,'forged')`, [fx.A, fx.u.aViewer])));
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO audit_events (org_id,actor_id,action) VALUES ($1,$2,'forged')`, [fx.B, fx.u.aOwner])));
  });
  it('no UPDATE / DELETE / TRUNCATE for app_user, owner or superuser', async () => {
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`UPDATE audit_events SET action='x'`)), /permission denied/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`DELETE FROM audit_events`)), /permission denied/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`TRUNCATE audit_events`)), /permission denied/);
    await denied(fx.q(`UPDATE audit_events SET action='x' WHERE org_id=$1`, [fx.A]), /append-only/);
    await denied(fx.q(`DELETE FROM audit_events WHERE org_id=$1`, [fx.A]), /append-only/);
    await denied(fx.q(`TRUNCATE audit_events`), /append-only/);
  });
});

describe('app_user cannot bypass RLS or reach platform data', () => {
  it('is a plain role', async () => {
    const c = await app.connect();
    try {
      const r = (await c.query(`SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user`)).rows[0];
      expect(r).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false });
      await denied(c.query('SET ROLE app_owner'), /permission denied/);
      await denied(c.query('SET ROLE app_definer'), /permission denied/);
      await denied(c.query(`SET session_replication_role = replica`), /permission denied/);
      await denied(c.query('ALTER TABLE records DISABLE ROW LEVEL SECURITY'), /must be owner/);
      await denied(c.query('DROP POLICY records_select ON records'), /must be owner/);
      await denied(c.query('CREATE TABLE public.x (a int)'), /permission denied/);
    } finally { c.release(); }
  });
  it('cannot read platform tables or secrets', async () => {
    for (const t of ['platform_admins', 'onboarding_requests', 'default_role_permissions', 'schema_migrations'])
      await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`SELECT * FROM ${t}`)), /permission denied/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query('SELECT password_hash FROM users')), /permission denied/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query('SELECT token_hash FROM invitations')), /permission denied/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`UPDATE organisations SET status='archived'`)), /permission denied/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO organisations (slug,name) VALUES ('x','x')`)), /permission denied/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO subscriptions (org_id,plan_id) SELECT $1, id FROM plans`, [fx.A])), /permission denied/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO plans (code,name) VALUES ('x','x')`)), /permission denied/);
    await denied(fx.as(fx.u.aOwner, fx.A, (c) => c.query(`INSERT INTO platform_admins (user_id) VALUES ($1)`, [fx.u.aOwner])), /permission denied/);
  });
  it('can read plans and the permission catalogue only', async () => {
    await fx.as(fx.u.aViewer, fx.A, async (c) => {
      expect((await c.query('SELECT 1 FROM plans')).rowCount).toBeGreaterThan(0);
      expect((await c.query('SELECT 1 FROM permissions')).rowCount).toBe(PERMISSIONS.length);
    });
  });
  it('org owners/admins (and only they, here) can edit the org profile', async () => {
    await fx.asRb(fx.u.aOwner, fx.A, async (c) => {
      expect((await c.query(`UPDATE organisations SET name='Renamed' WHERE id=$1`, [fx.A])).rowCount).toBe(1);
    });
    await fx.as(fx.u.aViewer, fx.A, async (c) => expect((await c.query(`UPDATE organisations SET name='Hacked' WHERE id=$1`, [fx.A])).rowCount).toBe(0));
    await fx.as(fx.u.aManager, fx.A, async (c) => expect((await c.query(`UPDATE organisations SET name='Hacked' WHERE id=$1`, [fx.A])).rowCount).toBe(0));
  });
  it('billing visible to roles with billing.read only', async () => {
    const p = (await fx.q(`SELECT id FROM plans WHERE code='pro'`))[0].id;
    await fx.q(`INSERT INTO subscriptions (org_id,plan_id) VALUES ($1,$2)`, [fx.A, p]);
    await fx.as(fx.u.aAdmin, fx.A, async (c) => expect((await c.query('SELECT 1 FROM subscriptions')).rowCount).toBe(1));
    await fx.as(fx.u.aViewer, fx.A, async (c) => expect((await c.query('SELECT 1 FROM subscriptions')).rowCount).toBe(0));
    await fx.as(fx.u.bOwner, fx.B, async (c) => expect((await c.query('SELECT 1 FROM subscriptions')).rowCount).toBe(0));
    await fx.q(`DELETE FROM subscriptions WHERE org_id=$1`, [fx.A]);
  });
});

describe('plan limits', () => {
  it('enforces max_units and max_members from the active plan', async () => {
    const [plan] = await fx.q(`INSERT INTO plans (code,name,max_units,max_members) VALUES ($1,'tiny',1,2) RETURNING id`, ['tiny-' + fx.tag]);
    const O = await fx.org('lim'); const u1 = await fx.user('l1'); const u2 = await fx.user('l2'); const u3 = await fx.user('l3');
    await fx.q(`INSERT INTO subscriptions (org_id,plan_id) VALUES ($1,$2)`, [O, plan.id]);
    await fx.unit(O, 'only');
    await denied(fx.unit(O, 'second'), /max_units/);
    await fx.member(u1, O, 'owner'); await fx.member(u2, O, 'member');
    await denied(fx.member(u3, O, 'member'), /max_members/);
    await fx.q(`DELETE FROM subscriptions WHERE org_id=$1`, [O]);
    await fx.q(`DELETE FROM plans WHERE id=$1`, [plan.id]);
  });
});

describe('platform role', () => {
  let padmin: string;
  beforeAll(async () => {
    padmin = await fx.user('padmin');
    await fx.q('INSERT INTO platform_admins (user_id) VALUES ($1)', [padmin]);
  });
  const asPlatform = <T>(userId: string, fn: (c: pg.PoolClient) => Promise<T>) => withTenant(platform, { userId, orgId: '' }, fn);
  it('platform admin lists all orgs and onboarding requests, approves/suspends', async () => {
    await fx.q(`INSERT INTO onboarding_requests (org_name,contact_name,contact_email) VALUES ('Req','n',$1)`, [`${fx.tag}@req.test`]);
    await asPlatform(padmin, async (c) => {
      const orgs = (await c.query('SELECT id FROM organisations')).rows.map((r) => r.id);
      expect(orgs).toEqual(expect.arrayContaining([fx.A, fx.B]));
      expect((await c.query(`SELECT 1 FROM onboarding_requests WHERE contact_email = $1`, [`${fx.tag}@req.test`])).rowCount).toBe(1);
      expect((await c.query(`UPDATE organisations SET status='suspended' WHERE id=$1`, [fx.B])).rowCount).toBe(1);
      await c.query(`UPDATE organisations SET status='active' WHERE id=$1`, [fx.B]);
      await c.query(`INSERT INTO audit_events (org_id, actor_id, action) VALUES ($1,$2,'platform.suspend')`, [fx.B, padmin]);
    });
    await denied(asPlatform(padmin, (c) => c.query(`UPDATE audit_events SET action='x'`)), /permission denied/);
  });
  it('platform role has no access to tenant business data', async () => {
    await denied(asPlatform(padmin, (c) => c.query('SELECT 1 FROM records')), /permission denied/);
    await denied(asPlatform(padmin, (c) => c.query('SELECT 1 FROM messages')), /permission denied/);
    await denied(asPlatform(padmin, (c) => c.query('SELECT password_hash FROM users')), /permission denied/);
  });
  it('platform role without a platform-admin user sees nothing', async () => {
    await asPlatform(fx.u.aOwner, async (c) => {
      expect((await c.query('SELECT 1 FROM organisations')).rowCount).toBe(0);
      expect((await c.query('SELECT 1 FROM onboarding_requests')).rowCount).toBe(0);
    });
    const c = await platform.connect();
    try { expect((await c.query('SELECT 1 FROM organisations')).rowCount).toBe(0); } finally { c.release(); }
  });
  it('platform-admin id used through app_user grants nothing', async () => {
    await fx.as(padmin, fx.A, async (c) => {
      expect((await c.query('SELECT 1 FROM records')).rowCount).toBe(0);
      expect((await c.query('SELECT 1 FROM organisations')).rowCount).toBe(0);
    });
  });
  it('new organisations get system roles and settings', async () => {
    await asPlatform(padmin, async (c) => {
      const o = (await c.query(`INSERT INTO organisations (slug,name,status) VALUES ($1,'N','pending') RETURNING id`, ['nn-' + fx.tag])).rows[0].id;
      expect((await c.query('SELECT name FROM roles WHERE org_id=$1 ORDER BY name', [o])).rows.map((r) => r.name)).toEqual(['admin', 'manager', 'member', 'owner', 'viewer']);
      expect((await c.query('SELECT 1 FROM org_settings WHERE org_id=$1', [o])).rowCount).toBe(1);
    });
  });
});

describe('entry points', () => {
  it('auth_lookup works for app_user; accept_invitation creates membership + unit role', async () => {
    const r = await fx.as(fx.u.aOwner, fx.A, (c) => c.query('SELECT * FROM app_private.auth_lookup($1)', [`aowner.${fx.tag}@fx.test`]));
    expect(r.rows[0].id).toBe(fx.u.aOwner);
    await fx.as(fx.u.aOwner, fx.A, (c) => c.query(
      `INSERT INTO invitations (org_id,email,org_role,unit_id,role_id,token_hash,invited_by,expires_at) VALUES ($1,$2,'member',$3,$4,$5,$6, now()+interval '1 day')`,
      [fx.A, `new.${fx.tag}@fx.test`, fx.units.a1, fx.roles.aManager, 'hash-' + fx.tag, fx.u.aOwner]));
    const nc = await app.connect();
    let uid: string;
    try {
      uid = (await nc.query('SELECT app_private.accept_invitation($1,$2,$3) AS id', ['hash-' + fx.tag, 'New Person', 'argon-hash'])).rows[0].id;
      await denied(nc.query('SELECT app_private.accept_invitation($1,$2,$3)', ['hash-' + fx.tag, 'x', 'y']), /invalid or expired/);
    } finally { nc.release(); }
    await fx.as(uid, fx.A, async (c) => expect(titles((await c.query('SELECT title FROM records')).rows)).toEqual(['A1 rec']));
  });
  it('submit_onboarding_request works for app_user but requests stay hidden', async () => {
    const c = await app.connect();
    try {
      await c.query(`SELECT app_private.submit_onboarding_request('Pub Org','P',$1)`, [`pub.${fx.tag}@x.test`]);
      await denied(c.query('SELECT 1 FROM onboarding_requests'), /permission denied/);
    } finally { c.release(); }
  });
  it('withTenant rolls back on error and leaks no context to the next use of the connection', async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    await expect(withTenant(pool, { userId: fx.u.aOwner, orgId: fx.A }, async (c) => {
      await c.query(...rec(fx.A, fx.units.a1, fx.u.aOwner, 'tx'));
      throw new Error('boom');
    })).rejects.toThrow('boom');
    const c = await pool.connect();
    try {
      expect((await c.query(`SELECT current_setting('app.org_id', true) AS o`)).rows[0].o ?? '').toBe('');
      expect((await c.query('SELECT 1 FROM records')).rowCount).toBe(0);
    } finally { c.release(); }
    await pool.end();
    expect((await fx.q(`SELECT 1 FROM records WHERE title='tx'`)).length).toBe(0);
  });
});

describe('permission catalogue', () => {
  it('SQL reference data mirrors @base/permissions', async () => {
    const codes = (await fx.q('SELECT code FROM permissions ORDER BY code')).map((r) => r.code);
    expect(codes).toEqual(PERMISSIONS.map((p) => p.code).sort());
    const rows = await fx.q('SELECT role_name, permission_code FROM default_role_permissions');
    for (const [role, list] of Object.entries(SYSTEM_ROLES)) {
      expect(rows.filter((r) => r.role_name === role).map((r) => r.permission_code).sort()).toEqual([...list].sort());
    }
  });
});
