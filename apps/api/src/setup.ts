import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { loadConfig } from './config.js';

export async function createApp() {
  const cfg = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: process.env.API_QUIET ? ['error'] : undefined });
  app.setGlobalPrefix('api');
  app.set('trust proxy', cfg.isProd ? 1 : false);
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.enableCors({ origin: cfg.webOrigin, credentials: true });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();
  return { app, cfg };
}
