import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PoolClient } from '@base/db';
import type { PermissionCode } from '@base/permissions';

export type OrgRole = 'owner' | 'admin' | 'member' | 'none';

export interface AuthCtx {
  userId: string; email: string; name: string;
  orgId: string | null; unitId: string | null;
  orgRole: OrgRole; orgStatus: string | null;
  /** permissions in the current unit */
  permissions: string[];
  /** union over all of the user's units (what the DB's has_org_permission() sees) */
  orgPermissions: string[];
  isPlatformAdmin: boolean;
}

export interface ApiRequest extends Request {
  auth?: AuthCtx;
  db?: PoolClient;
  afterCommit?: Array<() => void | Promise<void>>;
  cookies: Record<string, string>;
}

export const Public = () => SetMetadata('public', true);
export const PlatformOnly = () => SetMetadata('platform', true);
export const NoOrg = () => SetMetadata('noOrg', true);
export const NoTx = () => SetMetadata('noTx', true);
export const RequirePermission = (code: PermissionCode) => SetMetadata('permission', code);
export const Audit = (action: string, entityType?: string) => SetMetadata('audit', { action, entityType });

export const Db = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<ApiRequest>().db);
export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<ApiRequest>().auth);
export const Req0 = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<ApiRequest>());
