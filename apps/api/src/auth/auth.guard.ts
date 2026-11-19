import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import { COOKIE, SessionService } from './session.service.js';
import { ApiError, forbidden } from '../common/errors.js';
import type { ApiRequest } from '../common/context.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const get = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ctx.getHandler(), ctx.getClass()]);
    if (get<boolean>('public')) return true;
    const req = ctx.switchToHttp().getRequest<ApiRequest>();
    const claims = await this.sessions.verify(req.cookies?.[COOKIE]);
    const loaded = claims ? await this.auth.load(claims) : null;
    if (!loaded) throw new ApiError(401, 'unauthorized', 'Sign in required');
    const a = (req.auth = loaded.ctx);

    if (get<boolean>('platform')) {
      if (!a.isPlatformAdmin) throw forbidden('Platform administrators only');
      return true;
    }
    if (get<boolean>('noOrg')) return true;
    if (!a.orgId) throw new ApiError(409, 'no_org', 'No organisation selected');
    if (!READ_METHODS.has(req.method) && (a.orgStatus === 'suspended' || a.orgStatus === 'archived')) {
      throw forbidden('This organisation is suspended and read-only', 'org_suspended');
    }
    const perm = get<string>('permission');
    if (perm) {
      const set = perm.startsWith('record.') ? a.permissions : a.orgPermissions;
      if (!set.includes(perm)) throw forbidden(`Missing permission: ${perm}`);
    }
    return true;
  }
}
