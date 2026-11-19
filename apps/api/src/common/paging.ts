import { badRequest } from './errors.js';

export interface Cursor { ts: string; id: string }

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.ts}|${c.id}`).toString('base64url');
}
export function decodeCursor(s?: string): Cursor | null {
  if (!s) return null;
  const [ts, id] = Buffer.from(s, 'base64url').toString().split('|');
  if (!ts || !id || Number.isNaN(Date.parse(ts))) throw badRequest('Invalid cursor', 'invalid_cursor');
  return { ts, id };
}
/** rows fetched with LIMIT limit+1 and columns cursor_ts (created_at::text) + id. */
export function toPage<T extends { id: string; cursor_ts: string }, O>(rows: T[], limit: number, map: (r: T) => O) {
  const more = rows.length > limit;
  const slice = more ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  return { items: slice.map(map), nextCursor: more && last ? encodeCursor({ ts: last.cursor_ts, id: last.id }) : null };
}
