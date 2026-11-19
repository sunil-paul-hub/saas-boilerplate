import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPool, withTenant, type Pool, type PoolClient, type TenantContext } from '@base/db';
import { CONFIG, type AppConfig } from '../config.js';

/** Two pools: app_user (tenant requests, pre-session entry points) and app_platform (operator). Never a superuser. */
@Injectable()
export class DbService implements OnModuleDestroy {
  readonly app: Pool;
  readonly platform: Pool;
  constructor(@Inject(CONFIG) cfg: AppConfig) {
    this.app = createPool(cfg.databaseUrl);
    this.platform = createPool(cfg.platformDatabaseUrl);
  }
  tenant<T>(ctx: TenantContext, fn: (c: PoolClient) => Promise<T>) { return withTenant(this.app, ctx, fn); }
  platformTx<T>(ctx: TenantContext, fn: (c: PoolClient) => Promise<T>) { return withTenant(this.platform, ctx, fn); }
  async onModuleDestroy() { await Promise.all([this.app.end(), this.platform.end()]); }
}
