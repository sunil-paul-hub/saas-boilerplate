import { execSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
process.loadEnvFile(path.join(root, '.env'));
process.env.API_QUIET = '1';
process.env.UPLOADS_DIR = path.join(root, 'apps/api/uploads/test');
process.env.LOGIN_MAX_ATTEMPTS = '5';
export function resetDb() {
  execSync('pnpm --filter @base/db reset && pnpm --filter @base/db seed', { cwd: root, stdio: 'ignore' });
}
