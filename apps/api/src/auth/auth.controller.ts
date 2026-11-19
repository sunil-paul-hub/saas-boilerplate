import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Query, Res } from '@nestjs/common';
import { z } from 'zod';
import type { Response } from 'express';
import argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { acceptInviteBody, loginBody, switchBody } from '@base/contracts';
import { Auth, NoOrg, NoTx, Public, Req0, type ApiRequest, type AuthCtx } from '../common/context.js';
import { ApiError, badRequest, forbidden, unprocessable } from '../common/errors.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RateLimiter } from '../common/rate-limit.js';
import { DbService } from '../db/db.service.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import { CONFIG, type AppConfig } from '../config.js';

const profileBody = z.object({ name: z.string().min(1).max(120).optional(), phone: z.string().max(40).nullable().optional() });
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
// Verified against when the email is unknown, so timing does not reveal which emails exist.
let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= argon2.hash('not-a-real-password', { type: argon2.argon2id }));

@Controller('auth')
export class AuthController {
  private readonly limiter: RateLimiter;
  constructor(
    @Inject(DbService) private readonly db: DbService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CONFIG) cfg: AppConfig,
  ) { this.limiter = new RateLimiter(cfg.loginMaxAttempts, cfg.loginWindowMs); }

  @Public() @Post('login') @HttpCode(200)
  async login(@Body(new ZodPipe(loginBody)) body: { email: string; password: string }, @Req0() req: ApiRequest, @Res({ passthrough: true }) res: Response) {
    const key = `${req.ip}:${body.email.toLowerCase()}`;
    if (this.limiter.blocked(key)) throw new ApiError(429, 'rate_limited', 'Too many sign-in attempts. Try again later.');
    const row = (await this.db.app.query('SELECT * FROM app_private.auth_lookup($1)', [body.email])).rows[0];
    let ok = false;
    try { ok = await argon2.verify(row?.password_hash ?? (await dummyHash()), body.password); } catch { ok = false; }
    if (!row || !row.password_hash || !row.is_active || !ok) {
      this.limiter.fail(key);
      throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password');
    }
    this.limiter.reset(key);
    const orgId = await this.auth.defaultOrg(row.id);
    return this.startSession(res, row.id, orgId, null, true);
  }

  @Public() @Post('logout') @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) { this.sessions.clear(res); }

  @NoOrg() @NoTx() @Get('me')
  async me(@Auth() a: AuthCtx) {
    const loaded = await this.auth.load({ uid: a.userId, org: a.orgId, unit: a.unitId });
    return loaded!.me;
  }

  @NoOrg() @NoTx() @Post('switch') @HttpCode(200)
  async switch(@Body(new ZodPipe(switchBody)) body: { orgId: string; unitId?: string }, @Auth() a: AuthCtx, @Res({ passthrough: true }) res: Response) {
    const probe = await this.auth.load({ uid: a.userId, org: body.orgId, unit: body.unitId ?? null });
    const me = probe!.me as { org: { id: string } | null; currentUnitId: string | null; units: Array<{ id: string }> };
    if (!me.org || me.org.id !== body.orgId) throw forbidden('You are not a member of that organisation');
    if (body.unitId && !me.units.some((u) => u.id === body.unitId)) throw forbidden('You do not have access to that unit');
    await this.sessions.set(res, { uid: a.userId, org: body.orgId, unit: me.currentUnitId });
    return probe!.me;
  }

  @NoOrg() @NoTx() @Patch('profile')
  async profile(@Body(new ZodPipe(profileBody)) b: { name?: string; phone?: string | null }, @Auth() a: AuthCtx) {
    const phone = await this.db.tenant({ userId: a.userId, orgId: '', unitId: null }, async (c) => {
      if (b.name !== undefined) await c.query('UPDATE users SET name = $1 WHERE id = $2', [b.name, a.userId]);
      if (b.phone !== undefined) await c.query('UPDATE users SET phone = $1 WHERE id = $2', [b.phone, a.userId]);
      return (await c.query('SELECT phone FROM users WHERE id = $1', [a.userId])).rows[0]?.phone ?? null;
    });
    const l = await this.auth.load({ uid: a.userId, org: a.orgId, unit: a.unitId });
    return { ...l!.me, user: { ...(l!.me.user as object), phone } };
  }

  @Public() @Get('invite-info')
  async inviteInfo(@Query('token') token?: string) {
    if (!token) throw badRequest('token is required');
    const r = (await this.db.app.query('SELECT * FROM app_private.invitation_info($1)', [hashToken(token)])).rows[0];
    if (!r) throw new ApiError(404, 'invalid_invite', 'Invitation is invalid or has expired');
    return { orgName: r.org_name, email: r.email, orgRole: r.org_role, expiresAt: new Date(r.expires_at).toISOString(), userExists: r.user_exists };
  }

  @Public() @Post('accept-invite') @HttpCode(200)
  async acceptInvite(@Body(new ZodPipe(acceptInviteBody)) body: { token: string; name?: string; password?: string }, @Res({ passthrough: true }) res: Response) {
    const th = hashToken(body.token);
    const info = (await this.db.app.query('SELECT * FROM app_private.invitation_info($1)', [th])).rows[0];
    if (!info) throw new ApiError(404, 'invalid_invite', 'Invitation is invalid or has expired');
    if (!body.password) throw unprocessable('password is required', 'password_required');
    let hash = '';
    if (info.user_exists) {
      // Existing account: the invite token alone must not sign someone in; require the account password.
      const u = (await this.db.app.query('SELECT * FROM app_private.auth_lookup($1)', [info.email])).rows[0];
      let ok = false;
      try { ok = !!u?.password_hash && (await argon2.verify(u.password_hash, body.password)); } catch { ok = false; }
      if (!ok) throw new ApiError(401, 'invalid_credentials', 'Incorrect password for the existing account');
    } else {
      if (!body.name) throw unprocessable('name is required for a new account', 'name_required');
      hash = await argon2.hash(body.password, { type: argon2.argon2id });
    }
    const r = await this.db.app.query('SELECT app_private.accept_invitation($1, $2, $3) AS uid', [th, body.name ?? '', hash]);
    const uid = r.rows[0].uid as string;
    const orgId = await this.auth.defaultOrg(uid, true);
    return this.startSession(res, uid, orgId, null, false);
  }

  private async startSession(res: Response, uid: string, orgId: string | null, unitId: string | null, audit: boolean) {
    const loaded = await this.auth.load({ uid, org: orgId, unit: unitId });
    if (!loaded) throw new ApiError(401, 'unauthorized', 'Sign in required');
    const { ctx, me } = loaded;
    if (audit && ctx.orgId) {
      await this.db.tenant({ userId: uid, orgId: ctx.orgId, unitId: ctx.unitId }, (c) =>
        c.query(`INSERT INTO audit_events (org_id, actor_id, action, entity_type, entity_id) VALUES ($1,$2,'auth.login','user',$2::text)`, [ctx.orgId, uid]))
        .catch(() => undefined);
    }
    await this.sessions.set(res, { uid, org: ctx.orgId, unit: ctx.unitId });
    return me;
  }
}
