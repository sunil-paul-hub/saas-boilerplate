import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import PgBoss from 'pg-boss';

// pg-boss owns its own schema ("pgboss"), so it needs the owner/migrate connection, never app_user.
const url = process.env.MIGRATE_DATABASE_URL;
if (!url) throw new Error('MIGRATE_DATABASE_URL is required');
const mailboxFile = process.env.DEV_MAILBOX_FILE ?? path.resolve(process.cwd(), 'dev-mailbox.log');
const pollMs = Number(process.env.OUTBOX_POLL_MS ?? 5000);

const boss = new PgBoss(url);
const pool = new pg.Pool({ connectionString: url, max: 2 });
boss.on('error', (e: Error) => console.error('[worker] pg-boss error', e));

interface EmailJob { outboxId: string; to: string; subject: string; body: string }

/** Dev transport: console + append to a mailbox file. Swap for SMTP/SES/Resend in phase 2. */
async function deliver(m: EmailJob) {
  const text = `--- ${new Date().toISOString()} ---\nTo: ${m.to}\nSubject: ${m.subject}\n\n${m.body}\n\n`;
  console.log(`[worker] send-email to=${m.to} subject="${m.subject}"`);
  await fs.promises.appendFile(mailboxFile, text);
}

/** Move pending outbox rows into the queue (claimed with SKIP LOCKED so several workers never double-send). */
async function drainOutbox() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const rows = (await c.query(
      `SELECT id, recipient, subject, body FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED`)).rows;
    for (const r of rows) {
      await boss.send('send-email', { outboxId: r.id, to: r.recipient, subject: r.subject, body: r.body } satisfies EmailJob, { retryLimit: 3, retryBackoff: true });
      await c.query(`UPDATE outbox SET status = 'queued', queued_at = now() WHERE id = $1`, [r.id]);
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    console.error('[worker] outbox drain failed', e);
  } finally { c.release(); }
}

await boss.start();
await boss.createQueue('send-email');
await boss.createQueue('retention');

await boss.work<EmailJob>('send-email', async (jobs: PgBoss.Job<EmailJob>[]) => {
  for (const j of jobs) {
    await deliver(j.data);
    await pool.query(`UPDATE outbox SET status = 'sent', sent_at = now() WHERE id = $1`, [j.data.outboxId]);
  }
});

// Retention stub: runs nightly at 03:00; real policies (audit archive, expired invitations, old files) go here.
await boss.schedule('retention', '0 3 * * *');
await boss.work('retention', async () => {
  const r = await pool.query(`DELETE FROM invitations WHERE expires_at < now() - interval '30 days' AND accepted_at IS NULL`);
  console.log(`[worker] retention: removed ${r.rowCount} stale invitations`);
});

const timer = setInterval(() => { void drainOutbox(); }, pollMs);
void drainOutbox();
console.log('[worker] started (queues: send-email, retention)');

let stopping = false;
async function shutdown(sig: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] ${sig}: shutting down`);
  clearInterval(timer);
  try { await boss.stop({ graceful: true, timeout: 10_000 }); await pool.end(); } finally { process.exit(0); }
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
