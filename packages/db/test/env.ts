import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const f = resolve(__dirname, '../../../.env');
if (existsSync(f)) process.loadEnvFile(f);
