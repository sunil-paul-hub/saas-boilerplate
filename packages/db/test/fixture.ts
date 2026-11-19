import { expect } from 'vitest';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { withTenant } from '../src/index.ts';

export const admin = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL, max: 4 });
export const app = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 6 });
export const platform = new pg.Pool({ connectionString: process.env.PLATFORM_DATABASE_URL, max: 3 });

export type Fx = Awaited<ReturnType<typeof buildFixture>>;

class Rollback extends Error {}

/** Hostile fixture: two orgs, overlapping user, an outsider, unit-scoped roles. */
export async function buildFixture() {
  const tag = randomBytes(4).toString('hex');
  const q = async <T = any>(sql: string, p: unknown[] = []) => (await admin.query(sql, p)).rows as T[];
  const user = async (n: string) => (await q(`INSERT INTO users (email, name) VALUES ($1,$1) RETURNING id`, [`${n}.${tag}@fx.test`]))[0].id as string;
  const org = async (n: string) => (await q(`INSERT INTO organisations (slug, name, status) VALUES ($1,$1,'active') RETURNING id`, [`${n}-${tag}`]))[0].id as string;
  const unit = async (o: string, n: string) => (await q(`INSERT INTO units (org_id, name) VALUES ($1,$2) RETURNING id`, [o, n]))[0].id as string;
  const member = (u: string, o: string, r: string) => q(`INSERT INTO memberships (user_id, org_id, org_role) VALUES ($1,$2,$3)`, [u, o, r]);
  const role = async (o: string, n: string) => (await q(`SELECT id FROM roles WHERE org_id=$1 AND name=$2`, [o, n]))[0].id as string;
  const assign = (o: string, u: string, un: string, r: string) => q(`INSERT INTO unit_role_assignments (org_id,user_id,unit_id,role_id) VALUES ($1,$2,$3,$4)`, [o, u, un, r]);
  const rec = async (o: string, un: string, title: string, by: string) => (await q(`INSERT INTO records (org_id,unit_id,title,created_by) VALUES ($1,$2,$3,$4) RETURNING id`, [o, un, title, by]))[0].id as string;

  const A = await org('orga'), B = await org('orgb');
  const [a1, a2, b1] = [await unit(A, 'A1'), await unit(A, 'A2'), await unit(B, 'B1')];
  const u = {
    aOwner: await user('aowner'), aAdmin: await user('aadmin'), aManager: await user('amanager'),
    aViewer: await user('aviewer'), bOwner: await user('bowner'), shared: await user('shared'), outsider: await user('outsider'),
  };
  await member(u.aOwner, A, 'owner'); await member(u.aAdmin, A, 'admin'); await member(u.aManager, A, 'member');
  await member(u.aViewer, A, 'member'); await member(u.bOwner, B, 'owner');
  await member(u.shared, A, 'member'); await member(u.shared, B, 'member');
  await assign(A, u.aManager, a2, await role(A, 'manager'));
  await assign(A, u.aViewer, a1, await role(A, 'viewer'));
  await assign(A, u.aViewer, a2, await role(A, 'viewer'));
  await assign(A, u.shared, a2, await role(A, 'manager'));
  await assign(B, u.shared, b1, await role(B, 'manager'));
  const r = {
    a1: await rec(A, a1, 'A1 rec', u.aOwner), a2: await rec(A, a2, 'A2 rec', u.aOwner),
    a2b: await rec(A, a2, 'A2 rec 2', u.aOwner), b1: await rec(B, b1, 'B1 secret', u.bOwner),
  };
  await q(`INSERT INTO notifications (org_id,user_id,title) VALUES ($1,$2,'for owner'),($1,$3,'for viewer')`, [A, u.aOwner, u.aViewer]);
  const roles = { aManager: await role(A, 'manager'), aMember: await role(A, 'member'), bManager: await role(B, 'manager') };

  /** Runs as app_user with tenant context; commits. */
  const as = <T>(userId: string, orgId: string, fn: (c: pg.PoolClient) => Promise<T>) =>
    withTenant(app, { userId, orgId }, fn);
  /** Same, but always rolls back (for write tests that must not disturb shared fixture state). */
  const asRb = async <T>(userId: string, orgId: string, fn: (c: pg.PoolClient) => Promise<T>) => {
    let out!: T;
    try {
      await withTenant(app, { userId, orgId }, async (c) => { out = await fn(c); throw new Rollback(); });
    } catch (e) { if (!(e instanceof Rollback)) throw e; }
    return out;
  };

  const cleanup = async () => {
    await q(`DELETE FROM records WHERE org_id IN (SELECT id FROM organisations WHERE slug LIKE '%-' || $1)`, [tag]);
    await q(`DELETE FROM organisations WHERE slug LIKE '%-' || $1`, [tag]);
    await q(`DELETE FROM users WHERE email LIKE '%.' || $1 || '@fx.test'`, [tag]);
    await q(`DELETE FROM onboarding_requests WHERE contact_email LIKE '%' || $1 || '%'`, [tag]);
  };
  return { tag, A, B, units: { a1, a2, b1 }, u, r, roles, q, as, asRb, cleanup, org, user, member, unit };
}

export const denied = (p: Promise<unknown>, re: RegExp = /row-level security|permission denied|only an owner|last owner|immutable|append-only|plan limit|violates/i) =>
  expect(p).rejects.toThrow(re);
