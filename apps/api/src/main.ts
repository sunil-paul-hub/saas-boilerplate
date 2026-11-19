import { Logger } from '@nestjs/common';
import { createApp } from './setup.js';

const { app, cfg } = await createApp();
await app.listen(cfg.port);
new Logger('Bootstrap').log(`API listening on http://localhost:${cfg.port}/api (ws: /ws)`);
