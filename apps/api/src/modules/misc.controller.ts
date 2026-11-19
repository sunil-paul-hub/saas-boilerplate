import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import type { PoolClient } from '@base/db';
import {
  auditQuery, brandingPatchBody, conversationCreateBody, messageCreateBody, notificationsReadBody,
  pageQuery, terminologyPatchBody,
} from '@base/contracts';
import { Audit, Auth, Db, Req0, RequirePermission, type ApiRequest, type AuthCtx } from '../common/context.js';
import { notFound } from '../common/errors.js';
import { decodeCursor, toPage } from '../common/paging.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ChatGateway } from './chat.gateway.js';

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);

@Controller()
export class MiscController {
  constructor(@Inject(ChatGateway) private readonly gateway: ChatGateway) {}

  /* ---- audit ---- */
  @Get('audit') @RequirePermission('audit.read')
  async audit(@Query(new ZodPipe(auditQuery)) q: { cursor?: string; limit: number; action?: string; entityType?: string }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const p: unknown[] = [a.orgId];
    const where = ['e.org_id = $1'];
    if (q.action) { p.push(q.action); where.push(`e.action = $${p.length}`); }
    if (q.entityType) { p.push(q.entityType); where.push(`e.entity_type = $${p.length}`); }
    const cur = decodeCursor(q.cursor);
    if (cur) { p.push(cur.ts, cur.id); where.push(`(e.created_at, e.id) < ($${p.length - 1}::timestamptz, $${p.length}::uuid)`); }
    p.push(q.limit + 1);
    const r = await db.query(
      `SELECT e.id, e.action, e.entity_type, e.entity_id, e.unit_id, e.metadata, e.created_at, e.created_at::text AS cursor_ts,
              e.actor_id, u.name AS actor_name
         FROM audit_events e LEFT JOIN users u ON u.id = e.actor_id
        WHERE ${where.join(' AND ')} ORDER BY e.created_at DESC, e.id DESC LIMIT $${p.length}`, p);
    return toPage(r.rows, q.limit, (e) => ({
      id: e.id, at: iso(e.created_at), actorId: e.actor_id, actor: e.actor_name ?? null, action: e.action,
      entityType: e.entity_type, entityId: e.entity_id, unitId: e.unit_id, metadata: e.metadata,
    }));
  }

  /* ---- notifications (own) ---- */
  @Get('notifications')
  async notifications(@Query(new ZodPipe(pageQuery)) q: { cursor?: string; limit: number }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const p: unknown[] = [a.orgId, a.userId];
    let extra = '';
    const cur = decodeCursor(q.cursor);
    if (cur) { p.push(cur.ts, cur.id); extra = ` AND (created_at, id) < ($3::timestamptz, $4::uuid)`; }
    p.push(q.limit + 1);
    const r = await db.query(
      `SELECT id, title, body, link, read_at, created_at, created_at::text AS cursor_ts FROM notifications
        WHERE org_id = $1 AND user_id = $2${extra} ORDER BY created_at DESC, id DESC LIMIT $${p.length}`, p);
    return toPage(r.rows, q.limit, (n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.read_at, at: iso(n.created_at) }));
  }

  @Post('notifications/read') @HttpCode(200) @Audit('notification.read', 'notification')
  async markRead(@Body(new ZodPipe(notificationsReadBody)) b: { ids?: string[]; all?: boolean }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = b.all || !b.ids
      ? await db.query('UPDATE notifications SET read_at = now() WHERE org_id = $1 AND user_id = $2 AND read_at IS NULL', [a.orgId, a.userId])
      : await db.query('UPDATE notifications SET read_at = now() WHERE org_id = $1 AND user_id = $2 AND read_at IS NULL AND id = ANY($3::uuid[])', [a.orgId, a.userId, b.ids]);
    return { updated: r.rowCount ?? 0 };
  }

  /* ---- chat ---- */
  @Get('chat/conversations') @RequirePermission('chat.use')
  async conversations(@Db() db: PoolClient, @Auth() a: AuthCtx) {
    const r = await db.query(
      `SELECT c.id, c.title, c.kind, c.created_at,
              (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_at,
              COALESCE((SELECT json_agg(json_build_object('id', cm.user_id, 'name', u.name)) FROM conversation_members cm
                         JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = c.id), '[]') AS members
         FROM conversations c WHERE c.org_id = $1 AND app_private.is_conversation_member(c.id)
        ORDER BY COALESCE((SELECT max(created_at) FROM messages m WHERE m.conversation_id = c.id), c.created_at) DESC`, [a.orgId]);
    return {
      items: r.rows.map((c) => ({ id: c.id, title: c.title, kind: c.kind, lastMessage: c.last_message, lastAt: iso(c.last_at), members: c.members })),
      nextCursor: null,
    };
  }

  @Post('chat/conversations') @HttpCode(201) @RequirePermission('chat.use') @Audit('chat.conversation.create', 'conversation')
  async createConversation(@Body(new ZodPipe(conversationCreateBody)) b: { title?: string; kind: 'direct' | 'group'; memberIds: string[] }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const c = (await db.query(`INSERT INTO conversations (org_id, title, kind, created_by) VALUES ($1,$2,$3,$4) RETURNING id`, [a.orgId, b.title ?? null, b.kind, a.userId])).rows[0];
    for (const uid of new Set([a.userId, ...b.memberIds])) {
      await db.query('INSERT INTO conversation_members (conversation_id, org_id, user_id) VALUES ($1,$2,$3)', [c.id, a.orgId, uid]);
    }
    return { id: c.id as string };
  }

  @Get('chat/conversations/:id/messages') @RequirePermission('chat.use')
  async messages(@Param('id') id: string, @Query(new ZodPipe(pageQuery)) q: { cursor?: string; limit: number }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    const conv = await db.query('SELECT 1 FROM conversations WHERE id = $1 AND org_id = $2', [id, a.orgId]);
    if (!conv.rowCount) throw notFound('Conversation not found');
    const p: unknown[] = [id, a.orgId];
    let extra = '';
    const cur = decodeCursor(q.cursor);
    if (cur) { p.push(cur.ts, cur.id); extra = ` AND (m.created_at, m.id) < ($3::timestamptz, $4::uuid)`; }
    p.push(q.limit + 1);
    const r = await db.query(
      `SELECT m.id, m.conversation_id, m.sender_id, u.name AS sender_name, m.body, m.created_at, m.created_at::text AS cursor_ts
         FROM messages m LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1 AND m.org_id = $2${extra} ORDER BY m.created_at DESC, m.id DESC LIMIT $${p.length}`, p);
    return toPage(r.rows, q.limit, msgDto);
  }

  @Post('chat/conversations/:id/messages') @HttpCode(201) @RequirePermission('chat.use') @Audit('chat.message.send', 'message')
  async send(@Param('id') id: string, @Body(new ZodPipe(messageCreateBody)) b: { body: string }, @Db() db: PoolClient, @Auth() a: AuthCtx, @Req0() req: ApiRequest) {
    const r = await db.query(
      `INSERT INTO messages (org_id, conversation_id, sender_id, body) VALUES ($1,$2,$3,$4)
       RETURNING id, conversation_id, sender_id, body, created_at`, [a.orgId, id, a.userId, b.body]);
    const msg = msgDto({ ...r.rows[0], sender_name: a.name });
    const members = (await db.query('SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND org_id = $2', [id, a.orgId])).rows.map((x) => x.user_id as string);
    (req.afterCommit ??= []).push(() => this.gateway.broadcast(a.orgId!, members, { type: 'message', message: msg }));
    return msg;
  }

  /* ---- settings ---- */
  @Get('settings/terminology')
  async getTerm(@Db() db: PoolClient, @Auth() a: AuthCtx) { return this.setting(db, a, 'terminology'); }
  @Patch('settings/terminology') @RequirePermission('settings.manage') @Audit('settings.terminology.update', 'org_settings')
  async patchTerm(@Body(new ZodPipe(terminologyPatchBody)) b: { terminology: unknown }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    return this.saveSetting(db, a, 'terminology', b.terminology);
  }
  @Get('settings/branding')
  async getBranding(@Db() db: PoolClient, @Auth() a: AuthCtx) { return this.setting(db, a, 'branding'); }
  @Patch('settings/branding') @RequirePermission('settings.manage') @Audit('settings.branding.update', 'org_settings')
  async patchBranding(@Body(new ZodPipe(brandingPatchBody)) b: { branding: unknown }, @Db() db: PoolClient, @Auth() a: AuthCtx) {
    return this.saveSetting(db, a, 'branding', b.branding);
  }

  private async setting(db: PoolClient, a: AuthCtx, col: 'terminology' | 'branding') {
    const r = await db.query(`SELECT ${col} AS v FROM org_settings WHERE org_id = $1`, [a.orgId]);
    return { [col]: r.rows[0]?.v ?? {} };
  }
  private async saveSetting(db: PoolClient, a: AuthCtx, col: 'terminology' | 'branding', value: unknown) {
    const r = await db.query(`UPDATE org_settings SET ${col} = $1 WHERE org_id = $2 RETURNING ${col} AS v`, [JSON.stringify(value), a.orgId]);
    if (!r.rowCount) throw notFound('Settings not found');
    return { [col]: r.rows[0].v };
  }
}

const msgDto = (m: any) => ({
  id: m.id, conversationId: m.conversation_id, authorId: m.sender_id, authorName: m.sender_name ?? null, body: m.body, at: iso(m.created_at),
});
