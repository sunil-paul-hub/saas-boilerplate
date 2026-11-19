import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

export interface AppConfig {
  port: number;
  webOrigin: string;
  databaseUrl: string;
  platformDatabaseUrl: string;
  sessionSecret: string;
  isProd: boolean;
  uploadsDir: string;
  maxUploadBytes: number;
  loginMaxAttempts: number;
  loginWindowMs: number;
  inviteTtlDays: number;
  trialDays: number;
}

export function loadConfig(): AppConfig {
  const sessionSecret = need('SESSION_SECRET');
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && sessionSecret.startsWith('dev_only')) throw new Error('SESSION_SECRET must be changed in production');
  return {
    port: Number(process.env.API_PORT ?? 4000),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    databaseUrl: need('DATABASE_URL'),
    platformDatabaseUrl: need('PLATFORM_DATABASE_URL'),
    sessionSecret,
    isProd,
    uploadsDir: process.env.UPLOADS_DIR ?? path.resolve(here, '..', 'uploads'),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024),
    loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 10),
    loginWindowMs: Number(process.env.LOGIN_WINDOW_MS ?? 15 * 60 * 1000),
    inviteTtlDays: Number(process.env.INVITE_TTL_DAYS ?? 7),
    trialDays: Number(process.env.TRIAL_DAYS ?? 14),
  };
}

export const CONFIG = Symbol('CONFIG');
