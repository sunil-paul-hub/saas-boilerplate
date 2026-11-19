import pg from 'pg';

export type { Pool, PoolClient } from 'pg';

export interface TenantContext {
  userId: string;
  orgId: string;
  unitId?: string | null;
}

/**
 * Runs `fn` in one transaction with app.user_id / app.org_id / app.unit_id applied
 * (set_config(..., true) = transaction-local, so pooled connections never leak context).
 * Commits on success, rolls back on throw.
 */
export async function withTenant<T>(
  pool: pg.Pool,
  ctx: TenantContext,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('app.user_id', $1, true), set_config('app.org_id', $2, true), set_config('app.unit_id', $3, true)`,
      [ctx.userId, ctx.orgId, ctx.unitId ?? ''],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* connection already broken */ }
    throw e;
  } finally {
    client.release();
  }
}

export function createPool(connectionString: string = process.env.DATABASE_URL ?? ''): pg.Pool {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  return new pg.Pool({ connectionString });
}
