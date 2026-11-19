import { Inject, Injectable } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type WebSocket from 'ws';
import { AuthService } from '../auth/auth.service.js';
import { COOKIE, SessionService } from '../auth/session.service.js';
import { CONFIG, type AppConfig } from '../config.js';

interface Conn { userId: string; orgId: string }

/** Live chat: ws://host/ws, authenticated by the session cookie. Messages are sent via REST; the server pushes them. */
@Injectable()
@WebSocketGateway({ path: '/ws' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly conns = new Map<WebSocket, Conn>();
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async handleConnection(client: WebSocket, req: IncomingMessage) {
    const origin = req.headers.origin;
    if (origin && origin !== this.cfg.webOrigin) return client.close(4403, 'origin not allowed');
    const raw = req.headers.cookie ?? '';
    const token = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const claims = await this.sessions.verify(token ? decodeURIComponent(token) : undefined);
    const loaded = claims ? await this.auth.load(claims) : null;
    if (!loaded?.ctx.orgId) return client.close(4401, 'unauthorized');
    this.conns.set(client, { userId: loaded.ctx.userId, orgId: loaded.ctx.orgId });
    client.send(JSON.stringify({ type: 'ready' }));
  }
  handleDisconnect(client: WebSocket) { this.conns.delete(client); }

  /** Push to the given conversation members that are connected to the same org. */
  broadcast(orgId: string, memberIds: string[], event: unknown) {
    const payload = JSON.stringify(event);
    const set = new Set(memberIds);
    for (const [ws, c] of this.conns) if (c.orgId === orgId && set.has(c.userId) && ws.readyState === 1) ws.send(payload);
  }
}
