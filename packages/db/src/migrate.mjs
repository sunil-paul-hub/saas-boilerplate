import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

function render(sql) {
  return sql.replace(/\{\{([A-Z_]+)\}\}/g, (_, name) => {
    const v = process.env[name];
    if (v === undefined) throw new Error(`missing env ${name} for migration placeholder`);
    return v.replace(/'/g, "''");
  });
}

export async function migrate(url = process.env.ADMIN_DATABASE_URL) {
  if (!url) throw new Error('ADMIN_DATABASE_URL is required');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = new Map((await client.query('SELECT filename, checksum FROM public.schema_migrations')).rows.map((r) => [r.filename, r.checksum]));
    const files = (await readdir(dir)).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
    let ran = 0;
    for (const f of files) {
      const raw = await readFile(path.join(dir, f), 'utf8');
      const checksum = createHash('sha256').update(raw).digest('hex');
      if (applied.has(f)) {
        if (applied.get(f) !== checksum) throw new Error(`migration ${f} was modified after being applied`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(render(raw));
        await client.query('INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)', [f, checksum]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${f} failed: ${e.message}`);
      }
      console.log(`applied ${f}`);
      ran++;
    }
    console.log(ran ? `${ran} migration(s) applied` : 'up to date');
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate().catch((e) => { console.error(e.message); process.exit(1); });
}
