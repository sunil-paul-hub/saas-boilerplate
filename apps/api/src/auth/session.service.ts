import { Inject, Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import type { Response } from 'express';
import { CONFIG, type AppConfig } from '../config.js';

export interface SessionClaims { uid: string; org: string | null; unit: string | null }
export const COOKIE = 'session';
const TTL_S = 60 * 60 * 24 * 7;

@Injectable()
export class SessionService {
  private readonly key: Uint8Array;
  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) { this.key = new TextEncoder().encode(cfg.sessionSecret); }

  sign(c: SessionClaims): Promise<string> {
    return new SignJWT({ org: c.org, unit: c.unit })
      .setProtectedHeader({ alg: 'HS256' }).setSubject(c.uid).setIssuedAt().setExpirationTime(`${TTL_S}s`).sign(this.key);
  }
  async verify(token: string | undefined): Promise<SessionClaims | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      if (!payload.sub) return null;
      return { uid: payload.sub, org: (payload.org as string | null) ?? null, unit: (payload.unit as string | null) ?? null };
    } catch { return null; }
  }
  async set(res: Response, c: SessionClaims) {
    res.cookie(COOKIE, await this.sign(c), { httpOnly: true, sameSite: 'lax', secure: this.cfg.isProd, maxAge: TTL_S * 1000, path: '/' });
  }
  clear(res: Response) { res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: this.cfg.isProd, path: '/' }); }
}
