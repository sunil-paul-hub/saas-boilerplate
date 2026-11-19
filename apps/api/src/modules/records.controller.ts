import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import type { PoolClient } from '@base/db';
import {
  recordCreateBody, recordListQuery, recordPatchBody,
  type RecordCreateBody, type RecordListQuery, type RecordPatchBody,
} from '@base/contracts';
import { Audit, Auth, Db, RequirePermission, type AuthCtx } from '../common/context.js';
import { notFound, unprocessable } from '../common/errors.js';
import { decodeCursor, toPage } from '../common/paging.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { z } from 'zod';

const dashboardQuery = z.object({ unitId: z.string().uuid().optional() });
import { setClause } from './org.controller.js';

const COLS = `id, unit_id, title, status, notes, created_by, created_at, updated_at, created_at::text AS cursor_ts`;
const dto = (r: any) => ({
  id: r.id, unitId: r.unit_id, title: r.title, status: r.status, notes: r.notes, createdBy: r.created_by,
  createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
});

@Controller('records')
export class RecordsController {
  @Get() @RequirePermission('record.read')
  async list(@Query(new ZodPipe(recordListQuery)) q: RecordListQuery, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const p: unknown[] = [a.orgId];
    const where = ['org_id = $1'];
    if (q.status) { p.push(q.status); where.push(`status = $${p.length}`); }
    if (q.unitId) { p.push(q.unitId); where.push(`unit_id = $${p.length}`); }
    if (q.search) {
      p.push(`%${q.search.replace(/[\\%_]/g, '\\$&')}%`);
      where.push(`(title ILIKE $${p.length} OR notes ILIKE $${p.length})`);
    }
    const cur = decodeCursor(q.cursor);
    if (cur) { p.push(cur.ts, cur.id); where.push(`(created_at, id) < ($${p.length - 1}::timestamptz, $${p.length}::uuid)`); }
    p.push(q.limit + 1);
    const r = await db.query(`SELECT ${COLS} FROM records WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT $${p.length}`, p);
    return toPage(r.rows, q.limit, dto);
  }

  @Get(':id') @RequirePermission('record.read')
  async get(@Param('id') id: string, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = await db.query(`SELECT ${COLS} FROM records WHERE id = $1 AND org_id = $2`, [id, a.orgId]);
    if (!r.rowCount) throw notFound('Record not found');
    return dto(r.rows[0]);
  }

  @Post() @HttpCode(201) @RequirePermission('record.create') @Audit('record.create', 'record')
  async create(@Body(new ZodPipe(recordCreateBody)) b: RecordCreateBody, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const unitId = b.unitId ?? a.unitId;
    if (!unitId) throw unprocessable('unitId is required (no current unit)', 'unit_required');
    const r = await db.query(
      `INSERT INTO records (org_id, unit_id, title, status, notes, created_by) VALUES ($1,$2,$3,COALESCE($4,'open'),$5,$6) RETURNING ${COLS}`,
      [a.orgId, unitId, b.title, b.status ?? null, b.notes ?? null, a.userId]);
    return dto(r.rows[0]);
  }

  @Patch(':id') @RequirePermission('record.update') @Audit('record.update', 'record')
  async patch(@Param('id') id: string, @Body(new ZodPipe(recordPatchBody)) b: RecordPatchBody, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const s = setClause({ title: b.title, status: b.status, notes: b.notes, unit_id: b.unitId });
    if (!s.n) throw unprocessable('Nothing to update');
    const r = await db.query(`UPDATE records SET ${s.sql} WHERE id = $${s.n + 1} AND org_id = $${s.n + 2} RETURNING ${COLS}`, [...s.values, id, a.orgId]);
    if (!r.rowCount) throw notFound('Record not found');
    return dto(r.rows[0]);
  }

  @Delete(':id') @HttpCode(204) @RequirePermission('record.delete') @Audit('record.delete', 'record')
  async remove(@Param('id') id: string, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = await db.query('DELETE FROM records WHERE id = $1 AND org_id = $2', [id, a.orgId]);
    if (!r.rowCount) throw notFound('Record not found');
  }
}

/** Dashboard numbers computed in SQL (RLS limits them to the units the caller may read). */
@Controller('dashboard')
export class DashboardController {
  @Get('summary') @RequirePermission('record.read')
  async summary(@Query(new ZodPipe(dashboardQuery)) q: { unitId?: string }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const unit = q.unitId ?? null;
    const counts = await db.query(
      `SELECT status, count(*)::int AS n FROM records WHERE org_id = $1 AND ($2::uuid IS NULL OR unit_id = $2) GROUP BY status`, [a.orgId, unit]);
    const byStatus: Record<string, number> = { open: 0, in_progress: 0, done: 0, archived: 0 };
    for (const r of counts.rows) byStatus[r.status] = r.n;
    const monthly = await db.query(
      `SELECT to_char(m, 'YYYY-MM') AS month, count(r.id)::int AS n
         FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
         LEFT JOIN records r ON date_trunc('month', r.created_at) = m AND r.org_id = $1 AND ($2::uuid IS NULL OR r.unit_id = $2)
        GROUP BY m ORDER BY m`, [a.orgId, unit]);
    const recent = await db.query(
      `SELECT id, title, status, unit_id, updated_at FROM records WHERE org_id = $1 AND ($2::uuid IS NULL OR unit_id = $2)
        ORDER BY updated_at DESC, id DESC LIMIT 6`, [a.orgId, unit]);
    return {
      total: Object.values(byStatus).reduce((x, y) => x + y, 0),
      byStatus,
      monthly: monthly.rows.map((m) => ({ month: m.month as string, count: m.n as number })),
      recent: recent.rows.map((r) => ({ id: r.id, title: r.title, status: r.status, unitId: r.unit_id, updatedAt: new Date(r.updated_at).toISOString() })),
    };
  }
}
