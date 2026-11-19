import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import { createPool, withTenant } from '@base/db';
import { resetDb } from './setup.js';

let base = '';
let close: () => Promise<void>;
const PW = 'Passw0rd!';

async function login(email: string, password = PW) {
  const agent = request.agent(base);
  const res = await agent.post('/api/auth/login').send({ email, password });
  return { agent, res, cookie: (res.headers['set-cookie'] as unknown as string[] | undefined)?.[0]?.split(';')[0] ?? '' };
}

beforeAll(async () => {
  resetDb();
  const { createApp } = await import('../src/setup.js');
  const { app } = await createApp();
  await app.listen(0);
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  close = () => app.close();
});
afterAll(async () => { await close?.(); });

describe('auth', () => {
  it('logs in as owner and returns the /auth/me shape', async () => {
    const { agent, res } = await login('owner@acme.test');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    const me = (await agent.get('/api/auth/me')).body;
    expect(me.user.email).toBe('owner@acme.test');
    expect(me.org.name).toBe('Acme Industries');
    expect(me.orgRole).toBe('owner');
    expect(me.units.length).toBe(3);
    expect(me.currentUnitId).toBeTruthy();
    expect(me.permissions).toContain('record.create');
    expect(me.isPlatformAdmin).toBe(false);
    expect(me.memberships[0].orgName).toBe('Acme Industries');
  });
  it('rejects bad credentials, unauthenticated calls, and rate-limits login', async () => {
    expect((await request(base).get('/api/auth/me')).status).toBe(401);
    for (let i = 0; i < 5; i++) {
      const r = await request(base).post('/api/auth/login').send({ email: 'nobody@acme.test', password: 'wrong' });
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('invalid_credentials');
    }
    const blocked = await request(base).post('/api/auth/login').send({ email: 'nobody@acme.test', password: 'wrong' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('rate_limited');
  });
  it('validation errors use the uniform error shape', async () => {
    const r = await request(base).post('/api/auth/login').send({ email: 'nope' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation_error');
  });
});

describe('isolation and permissions', () => {
  it('globex owner cannot see or touch acme data through any endpoint', async () => {
    const acme = await login('owner@acme.test');
    const acmeRecs = (await acme.agent.get('/api/records?limit=100')).body.items as Array<{ id: string }>;
    expect(acmeRecs.length).toBe(7);
    const g = await login('owner@globex.test');
    const recs = (await g.agent.get('/api/records?limit=100')).body.items as Array<{ id: string; title: string }>;
    expect(recs.map((r) => r.title)).toEqual(['Set up Globex workspace']);
    const target = acmeRecs[0].id;
    expect((await g.agent.get(`/api/records/${target}`)).status).toBe(404);
    expect((await g.agent.patch(`/api/records/${target}`).send({ title: 'pwned' })).status).toBe(404);
    expect((await g.agent.delete(`/api/records/${target}`)).status).toBe(404);
    const members = (await g.agent.get('/api/members')).body.items as Array<{ email: string }>;
    expect(members.every((m) => m.email.endsWith('@globex.test'))).toBe(true);
    const audit = (await g.agent.get('/api/audit')).body.items as Array<{ action: string }>;
    expect(audit.some((a) => a.action === 'org.seeded')).toBe(false);
    expect((await g.agent.get('/api/chat/conversations')).body.items).toEqual([]);
    const units = (await g.agent.get('/api/units')).body.items as Array<{ name: string }>;
    expect(units.map((u) => u.name)).toEqual(['Globex HQ']);
    // cannot switch into another org
    const acmeOrg = (await acme.agent.get('/api/org')).body.id;
    expect((await g.agent.post('/api/auth/switch').send({ orgId: acmeOrg })).status).toBe(403);
    // not a platform admin
    expect((await g.agent.get('/api/platform/orgs')).status).toBe(403);
  });
  it('unit-scoped manager sees only North Branch records', async () => {
    const m = await login('manager@acme.test');
    const me = (await m.agent.get('/api/auth/me')).body;
    expect(me.units.map((u: { name: string }) => u.name)).toEqual(['North Branch']);
    const recs = (await m.agent.get('/api/records?limit=100')).body.items as Array<{ unitId: string }>;
    expect(recs.length).toBe(3);
    expect(recs.every((r) => r.unitId === me.currentUnitId)).toBe(true);
    const created = await m.agent.post('/api/records').send({ title: 'Manager made this' });
    expect(created.status).toBe(201);
  });
  it('viewer cannot create records (403) but can read', async () => {
    const v = await login('viewer@acme.test');
    expect((await v.agent.get('/api/records?limit=100')).body.items.length).toBeGreaterThanOrEqual(7);
    const r = await v.agent.post('/api/records').send({ title: 'nope' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('forbidden');
    expect((await v.agent.post('/api/units').send({ name: 'X' })).status).toBe(403);
  });
  it('database errors map to 4xx, not 500 (RLS via unit the user cannot write)', async () => {
    const m = await login('manager@acme.test');
    const owner = await login('owner@acme.test');
    const units = (await owner.agent.get('/api/units')).body.items as Array<{ id: string; name: string }>;
    const south = units.find((u) => u.name === 'South Branch')!;
    const r = await m.agent.post('/api/records').send({ title: 'wrong unit', unitId: south.id });
    expect(r.status).toBe(403);
    const dup = await owner.agent.post('/api/units').send({ name: 'North Branch' });
    expect(dup.status).toBe(409);
    expect((await owner.agent.get('/api/records/not-a-uuid')).status).toBe(400);
  });
});

describe('records, paging, audit', () => {
  it('dashboard summary matches the records the caller can read', async () => {
    const o = await login('owner@acme.test');
    const all = (await o.agent.get('/api/records?limit=100')).body.items as Array<{ status: string; unitId: string }>;
    const s = (await o.agent.get('/api/dashboard/summary')).body;
    expect(s.total).toBe(all.length);
    expect(s.byStatus.done).toBe(all.filter((r) => r.status === 'done').length);
    expect(s.byStatus.archived).toBe(all.filter((r) => r.status === 'archived').length);
    expect(s.monthly.length).toBe(6);
    expect(s.monthly[5].count).toBe(all.length);
    expect(s.recent.length).toBe(6);
    const unit = all[0].unitId;
    expect((await o.agent.get(`/api/dashboard/summary?unitId=${unit}`)).body.total).toBe(all.filter((r) => r.unitId === unit).length);
    const m = await login('manager@acme.test');
    const mine = (await m.agent.get('/api/records?limit=100')).body.items as unknown[];
    expect((await m.agent.get('/api/dashboard/summary')).body.total).toBe(mine.length);
    expect((await request(base).get('/api/dashboard/summary')).status).toBe(401);
  });
  it('filters, searches, pages with a cursor and audits mutations', async () => {
    const o = await login('owner@acme.test');
    const first = (await o.agent.get('/api/records?limit=3')).body;
    expect(first.items.length).toBe(3);
    expect(first.nextCursor).toBeTruthy();
    const second = (await o.agent.get(`/api/records?limit=3&cursor=${first.nextCursor}`)).body;
    expect(second.items.length).toBe(3);
    expect(new Set([...first.items, ...second.items].map((r: { id: string }) => r.id)).size).toBe(6);
    expect((await o.agent.get('/api/records?status=done')).body.items.length).toBe(1);
    expect((await o.agent.get('/api/records?search=forklift')).body.items.length).toBe(1);
    const c = await o.agent.post('/api/records').send({ title: 'Audit me' });
    expect(c.status).toBe(201);
    const id = c.body.id;
    expect((await o.agent.patch(`/api/records/${id}`).send({ status: 'done' })).body.status).toBe('done');
    expect((await o.agent.delete(`/api/records/${id}`)).status).toBe(204);
    const audit = (await o.agent.get('/api/audit?limit=50')).body.items as Array<{ action: string; entityId: string }>;
    const mine = audit.filter((a) => a.entityId === id).map((a) => a.action).sort();
    expect(mine).toEqual(['record.create', 'record.delete', 'record.update']);
  });
});

describe('onboarding, platform, invites', () => {
  it('request -> platform approve -> trial -> invite accept -> activate', async () => {
    const pub = await request(base).post('/api/onboarding/requests')
      .send({ orgName: 'Hooli', contactName: 'Gavin', contactEmail: 'gavin@hooli.test', details: { message: 'hi' } });
    expect(pub.status).toBe(201);
    const p = await login('admin@platform.test');
    expect(p.res.body.isPlatformAdmin).toBe(true);
    const reqs = (await p.agent.get('/api/platform/requests?status=pending')).body.items as Array<{ id: string; orgName: string }>;
    const mine = reqs.find((r) => r.orgName === 'Hooli')!;
    expect(mine).toBeTruthy();
    const ap = await p.agent.post(`/api/platform/requests/${mine.id}/approve`).send({});
    expect(ap.status).toBe(200);
    expect(ap.body.status).toBe('trial');
    const orgs = (await p.agent.get('/api/platform/orgs?search=hooli')).body.items;
    expect(orgs[0].status).toBe('trial');
    // first admin accepts the invite (new user) and becomes owner
    expect((await request(base).post('/api/auth/accept-invite').send({ token: ap.body.inviteToken, name: 'Gavin B', password: 'short' })).status).toBe(400);
    const acc = await request(base).post('/api/auth/accept-invite').send({ token: ap.body.inviteToken, name: 'Gavin B', password: 'Hooli-Passw0rd!' });
    expect(acc.status).toBe(200);
    expect(acc.body.orgRole).toBe('owner');
    expect(acc.body.org.status).toBe('trial');
    expect(acc.body.org.setupComplete).toBe(false);
    const g = await login('gavin@hooli.test', 'Hooli-Passw0rd!');
    expect(g.res.status).toBe(200);
    const act = await g.agent.post('/api/onboarding/complete').send({});
    expect(act.status).toBe(200);
    expect(act.body.status).toBe('active');
    expect((await g.agent.get('/api/auth/me')).body.org.status).toBe('active');
    // token is single-use
    expect((await request(base).post('/api/auth/accept-invite').send({ token: ap.body.inviteToken, name: 'x', password: 'Another-Passw0rd!' })).status).toBe(404);
    // platform audit shows the approval
    const pa = (await p.agent.get('/api/platform/audit?limit=20')).body.items as Array<{ action: string }>;
    expect(pa.some((e) => e.action === 'platform.org.approve')).toBe(true);
  });
  it('rejects a request; operator can create an org directly; tenant cannot activate without org.manage', async () => {
    await request(base).post('/api/onboarding/requests').send({ orgName: 'Spam Co', contactName: 'S', contactEmail: 's@spam.test' });
    const p = await login('admin@platform.test');
    const reqs = (await p.agent.get('/api/platform/requests?status=pending')).body.items as Array<{ id: string; orgName: string }>;
    const spam = reqs.find((r) => r.orgName === 'Spam Co')!;
    expect((await p.agent.post(`/api/platform/requests/${spam.id}/reject`).send({})).body.status).toBe('rejected');
    const created = await p.agent.post('/api/platform/orgs').send({ name: 'Umbrella', adminEmail: 'boss@umbrella.test' });
    expect(created.status).toBe(201);
    expect(created.body.inviteToken).toBeTruthy();
    const v = await login('viewer@acme.test');
    expect((await v.agent.post('/api/org/activate').send({})).status).toBe(403);
  });
  it('owner invites a member, who accepts and appears with the role', async () => {
    const o = await login('owner@acme.test');
    const roles = (await o.agent.get('/api/roles')).body.items as Array<{ id: string; name: string }>;
    const units = (await o.agent.get('/api/units')).body.items as Array<{ id: string; name: string }>;
    const north = units.find((u) => u.name === 'North Branch')!;
    const member = roles.find((r) => r.name === 'member')!;
    const inv = await o.agent.post('/api/members/invite').send({ email: 'newbie@acme.test', unitId: north.id, roleId: member.id });
    expect(inv.status).toBe(201);
    const info = await request(base).get(`/api/auth/invite-info?token=${inv.body.inviteToken}`);
    expect(info.body.orgName).toBe('Acme Industries');
    const acc = await request(base).post('/api/auth/accept-invite').send({ token: inv.body.inviteToken, name: 'Newbie', password: 'Newbie-Passw0rd!' });
    expect(acc.status).toBe(200);
    expect(acc.body.orgRole).toBe('member');
    const list = (await o.agent.get('/api/members')).body.items as Array<{ email: string; status: string; unitRoles: unknown[] }>;
    const nb = list.find((m) => m.email === 'newbie@acme.test')!;
    expect(nb.status).toBe('active');
    expect(nb.unitRoles.length).toBe(1);
  });
  it('custom roles: create, patch, system role is protected', async () => {
    const o = await login('owner@acme.test');
    const r = await o.agent.post('/api/roles').send({ name: 'Auditor', permissions: ['audit.read', 'record.read'] });
    expect(r.status).toBe(201);
    expect(r.body.permissions).toEqual(['audit.read', 'record.read']);
    const up = await o.agent.patch(`/api/roles/${r.body.id}`).send({ permissions: ['record.read'] });
    expect(up.body.permissions).toEqual(['record.read']);
    const sys = ((await o.agent.get('/api/roles')).body.items as Array<{ id: string; system: boolean }>).find((x) => x.system)!;
    expect((await o.agent.patch(`/api/roles/${sys.id}`).send({ name: 'x' })).status).toBe(409);
    expect((await o.agent.post('/api/roles').send({ name: 'Bad', permissions: ['nope.x'] })).status).toBe(422);
  });
});

describe('suspended orgs', () => {
  it('are read-only at the API and in the database', async () => {
    const p = await login('admin@platform.test');
    const g = await login('owner@globex.test');
    const orgId = (await g.agent.get('/api/org')).body.id;
    const hq = (await g.agent.get('/api/units')).body.items[0].id;
    expect((await g.agent.post('/api/records').send({ title: 'before' })).status).toBe(201);
    expect((await p.agent.post(`/api/platform/orgs/${orgId}/suspend`).send({})).status).toBe(200);
    const w = await g.agent.post('/api/records').send({ title: 'after' });
    expect(w.status).toBe(403);
    expect(w.body.error.code).toBe('org_suspended');
    expect((await g.agent.get('/api/records')).status).toBe(200);
    // bypass the API: the database itself refuses the write
    const pool = createPool(process.env.DATABASE_URL);
    const uid = (await g.agent.get('/api/auth/me')).body.user.id;
    await expect(withTenant(pool, { userId: uid, orgId, unitId: hq }, (c) =>
      c.query(`INSERT INTO records (org_id, unit_id, title, created_by) VALUES ($1,$2,'sneaky',$3)`, [orgId, hq, uid])))
      .rejects.toMatchObject({ code: '42501' });
    await pool.end();
    expect((await p.agent.post(`/api/platform/orgs/${orgId}/reactivate`).send({})).status).toBe(200);
    expect((await g.agent.post('/api/records').send({ title: 'back' })).status).toBe(201);
  });
  it('view-as is audited and read-only', async () => {
    const p = await login('admin@platform.test');
    const orgs = (await p.agent.get('/api/platform/orgs?search=acme')).body.items;
    const v = await p.agent.post(`/api/platform/orgs/${orgs[0].id}/view-as`).send({});
    expect(v.status).toBe(200);
    expect(v.body.readOnly).toBe(true);
    expect(v.body.members.length).toBeGreaterThan(0);
    const pa = (await p.agent.get('/api/platform/audit?action=platform.org.view_as')).body.items;
    expect(pa.length).toBeGreaterThan(0);
  });
});

describe('chat, billing, settings, files, notifications', () => {
  it('persists messages and pushes them over /ws to members of the same org only', async () => {
    const o = await login('owner@acme.test');
    const m = await login('manager@acme.test');
    const g = await login('owner@globex.test');
    const conv = (await o.agent.get('/api/chat/conversations')).body.items[0];
    expect(conv.title).toBe('Acme general');
    const open = (cookie: string) => new Promise<{ ws: WebSocket; msgs: any[] }>((resolve, reject) => {
      const ws = new WebSocket(base.replace('http', 'ws') + '/ws', { headers: { cookie } });
      const msgs: any[] = [];
      ws.on('message', (d) => { const j = JSON.parse(d.toString()); if (j.type === 'ready') resolve({ ws, msgs }); else msgs.push(j); });
      ws.on('error', reject); ws.on('close', (c) => { if (c !== 1000) reject(new Error('closed ' + c)); });
    });
    const a = await open(m.cookie);
    const outsider = await open(g.cookie);
    const sent = await o.agent.post(`/api/chat/conversations/${conv.id}/messages`).send({ body: 'hello over ws' });
    expect(sent.status).toBe(201);
    await new Promise((r) => setTimeout(r, 400));
    expect(a.msgs.length).toBe(1);
    expect(a.msgs[0].message.body).toBe('hello over ws');
    expect(outsider.msgs.length).toBe(0);
    a.ws.close(); outsider.ws.close();
    const list = (await o.agent.get(`/api/chat/conversations/${conv.id}/messages`)).body.items as Array<{ body: string }>;
    expect(list[0].body).toBe('hello over ws');
    expect((await g.agent.post(`/api/chat/conversations/${conv.id}/messages`).send({ body: 'intruder' })).status).toBe(403);
    expect((await g.agent.get(`/api/chat/conversations/${conv.id}/messages`)).status).toBe(404);
    // unauthenticated ws is refused
    await expect(open('')).rejects.toThrow();
  });
  it('billing plan + invoices, settings, notifications', async () => {
    const o = await login('owner@acme.test');
    const plan = (await o.agent.get('/api/billing/plan')).body;
    expect(plan.planCode).toBe('pro');
    expect(plan.usage.units).toBe(3);
    expect((await o.agent.get('/api/billing/invoices')).body).toEqual({ items: [], nextCursor: null });
    expect((await o.agent.post('/api/billing/plan').send({ planCode: 'free' })).status).toBe(200);
    expect((await o.agent.get('/api/billing/plan')).body.planCode).toBe('free');
    const v = await login('viewer@acme.test');
    expect((await v.agent.get('/api/billing/plan')).status).toBe(403);
    const t = await o.agent.patch('/api/settings/terminology').send({ terminology: { unit: { singular: 'Depot', plural: 'Depots' } } });
    expect(t.body.terminology.unit.singular).toBe('Depot');
    expect((await v.agent.patch('/api/settings/terminology').send({ terminology: {} })).status).toBe(403);
    expect((await v.agent.get('/api/settings/terminology')).body.terminology.unit.plural).toBe('Depots');
    const b = await o.agent.patch('/api/settings/branding').send({ branding: { accentColor: '#112233' } });
    expect(b.body.branding.accentColor).toBe('#112233');
    const notes = (await v.agent.get('/api/notifications')).body.items;
    expect(notes.length).toBe(1);
    expect(notes[0].read).toBe(false);
    expect((await v.agent.post('/api/notifications/read').send({ all: true })).body.updated).toBe(1);
    const prof = await v.agent.patch('/api/auth/profile').send({ name: 'Vera V', phone: '+1 555 0100' });
    expect(prof.body.user.name).toBe('Vera V');
    expect(prof.body.user.phone).toBe('+1 555 0100');
  });
  it('stores files tenant-scoped with type and size limits', async () => {
    const o = await login('owner@acme.test');
    const g = await login('owner@globex.test');
    const up = await o.agent.post('/api/files').attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(up.status).toBe(201);
    expect(up.body.sizeBytes).toBe(5);
    expect((await o.agent.get('/api/files')).body.items.length).toBe(1);
    expect((await o.agent.get(`/api/files/${up.body.id}/download`)).text).toBe('hello');
    expect((await g.agent.get('/api/files')).body.items.length).toBe(0);
    expect((await g.agent.get(`/api/files/${up.body.id}/download`)).status).toBe(404);
    const bad = await o.agent.post('/api/files').attach('file', Buffer.from('x'), { filename: 'a.exe', contentType: 'application/x-msdownload' });
    expect(bad.status).toBe(400);
    const big = await o.agent.post('/api/files').attach('file', Buffer.alloc(6 * 1024 * 1024), { filename: 'big.txt', contentType: 'text/plain' });
    expect(big.status).toBe(413);
  });
});
