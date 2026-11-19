import { Controller, Get, Inject, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { PoolClient } from '@base/db';
import { pageQuery } from '@base/contracts';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Audit, Auth, Db, RequirePermission, type AuthCtx } from '../common/context.js';
import { badRequest, notFound } from '../common/errors.js';
import { decodeCursor, toPage } from '../common/paging.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { CONFIG, type AppConfig } from '../config.js';

const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const MAX = Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024);
const dto = (f: any) => ({ id: f.id, name: f.name, mimeType: f.mime_type, sizeBytes: Number(f.size_bytes), unitId: f.unit_id, uploadedBy: f.uploaded_by, createdAt: new Date(f.created_at).toISOString() });

@Controller('files')
export class FilesController {
  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  @Get()
  async list(@Query(new ZodPipe(pageQuery)) q: { cursor?: string; limit: number }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const p: unknown[] = [a.orgId];
    let extra = '';
    const cur = decodeCursor(q.cursor);
    if (cur) { p.push(cur.ts, cur.id); extra = ` AND (created_at, id) < ($2::timestamptz, $3::uuid)`; }
    p.push(q.limit + 1);
    const r = await db.query(`SELECT id, name, mime_type, size_bytes, unit_id, uploaded_by, created_at, created_at::text AS cursor_ts FROM files WHERE org_id = $1${extra} ORDER BY created_at DESC, id DESC LIMIT $${p.length}`, p);
    return toPage(r.rows, q.limit, dto);
  }

  @Post() @RequirePermission('files.manage') @Audit('file.upload', 'file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX, files: 1 } }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    if (!file) throw badRequest('multipart field "file" is required', 'file_required');
    if (!ALLOWED.has(file.mimetype)) throw badRequest(`File type not allowed: ${file.mimetype}`, 'file_type_not_allowed');
    const key = `${a.orgId}/${randomUUID()}`;
    const name = path.basename(file.originalname).slice(0, 200) || 'file';
    const r = await db.query(
      `INSERT INTO files (org_id, unit_id, name, mime_type, size_bytes, storage_key, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, name, mime_type, size_bytes, unit_id, uploaded_by, created_at`,
      [a.orgId, a.unitId, name, file.mimetype, file.size, key, a.userId]);
    const full = path.join(this.cfg.uploadsDir, key);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, file.buffer);
    return dto(r.rows[0]);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Db() db: PoolClient, @Auth() a: AuthCtx, @Res({ passthrough: true }) res: Response) {
    const f = (await db.query('SELECT name, mime_type, storage_key FROM files WHERE id = $1 AND org_id = $2', [id, a.orgId])).rows[0];
    if (!f) throw notFound('File not found');
    const full = path.resolve(this.cfg.uploadsDir, f.storage_key);
    if (!full.startsWith(path.resolve(this.cfg.uploadsDir) + path.sep) || !fs.existsSync(full)) throw notFound('File not found');
    res.set({ 'Content-Type': f.mime_type ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(f.name)}"` });
    return new StreamableFile(fs.createReadStream(full));
  }
}
