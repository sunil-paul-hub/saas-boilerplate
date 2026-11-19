// Dev only: drop and recreate database "base" (roles are cluster-level and are kept), then migrate.
import pg from 'pg';
import { migrate } from './migrate.mjs';

const url = new URL(process.env.ADMIN_DATABASE_URL);
const dbName = url.pathname.slice(1);
if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) throw new Error('unsafe database name');
url.pathname = '/postgres';
const c = new pg.Client({ connectionString: url.toString() });
await c.connect();
await c.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
await c.query(`CREATE DATABASE ${dbName}`);
await c.end();
await migrate();
