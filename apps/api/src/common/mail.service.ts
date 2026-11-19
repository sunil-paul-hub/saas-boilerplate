import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from '@base/db';
import type { ApiRequest } from './context.js';

export interface MailMessage { to: string; subject: string; body: string; payload?: Record<string, unknown> }

/**
 * Emails are never sent from the API. A message is written to the `outbox` table inside the request
 * transaction (so it exists only if the request commits); the worker drains it. In dev the text is also
 * printed to the console after commit.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  async queue(req: ApiRequest, client: PoolClient, m: MailMessage) {
    await client.query(
      `INSERT INTO outbox (kind, recipient, subject, body, payload) VALUES ('email', $1, $2, $3, $4)`,
      [m.to, m.subject, m.body, JSON.stringify(m.payload ?? {})],
    );
    (req.afterCommit ??= []).push(() => { this.log.log(`[outbox] to=${m.to} subject="${m.subject}"\n${m.body}`); });
  }
}
