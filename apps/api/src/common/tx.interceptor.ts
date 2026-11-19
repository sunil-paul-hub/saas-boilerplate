import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, lastValueFrom } from 'rxjs';
import { DbService } from '../db/db.service.js';
import type { ApiRequest } from './context.js';

/**
 * One transaction per authenticated request. app.user_id/org_id/unit_id are set by withTenant; every mutation
 * writes an audit_event inside the same transaction (commit together or not at all).
 */
@Injectable()
export class TxInterceptor implements NestInterceptor {
  constructor(@Inject(DbService) private readonly db: DbService, @Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const get = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<ApiRequest>();
    const a = req.auth;
    if (get<boolean>('public') || get<boolean>('noTx') || !a) return next.handle();

    const isPlatform = !!get<boolean>('platform');
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const meta = get<{ action: string; entityType?: string }>('audit');
    const run = isPlatform ? this.db.platformTx.bind(this.db) : this.db.tenant.bind(this.db);
    const orgId = isPlatform ? '' : (a.orgId ?? '');

    return from((async () => {
      req.afterCommit = [];
      const result = await run({ userId: a.userId, orgId, unitId: a.unitId }, async (client) => {
        req.db = client;
        const out = await lastValueFrom(next.handle(), { defaultValue: undefined });
        if (mutating) {
          const o = (out ?? {}) as { id?: string; orgId?: string };
          const routePath = (req.route?.path as string | undefined) ?? req.path;
          await client.query(
            `INSERT INTO audit_events (org_id, actor_id, action, entity_type, entity_id, unit_id, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              isPlatform ? (o.orgId ?? null) : a.orgId,
              a.userId,
              meta?.action ?? `${req.method.toLowerCase()} ${routePath}`,
              meta?.entityType ?? null,
              o.id ?? req.params?.id ?? null,
              isPlatform ? null : a.unitId,
              JSON.stringify({ method: req.method, path: req.originalUrl.split('?')[0] }),
            ],
          );
        }
        return out;
      });
      for (const fn of req.afterCommit) { try { await fn(); } catch { /* post-commit side effects never fail the request */ } }
      return result;
    })());
  }
}
