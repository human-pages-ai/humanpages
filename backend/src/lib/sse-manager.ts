import { Response } from 'express';
import { logger } from './logger.js';

interface SSEClient {
  userId: string;
  res: Response;
  heartbeatTimer: ReturnType<typeof setInterval>;
}

const clients = new Map<string, SSEClient>();

export function addSSEClient(userId: string, res: Response): void {
  // Remove existing client for same user
  removeSSEClient(userId);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);

  // 30s heartbeat to keep the connection alive
  const heartbeatTimer = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30_000);

  clients.set(userId, { userId, res, heartbeatTimer });

  // Clean up on disconnect
  res.on('close', () => {
    removeSSEClient(userId);
  });

  logger.info({ userId, clientCount: clients.size }, 'SSE client connected');
}

export function removeSSEClient(userId: string): void {
  const client = clients.get(userId);
  if (client) {
    clearInterval(client.heartbeatTimer);
    clients.delete(userId);
    logger.debug({ userId, clientCount: clients.size }, 'SSE client disconnected');
  }
}

export function broadcastSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients.values()) {
    try {
      client.res.write(payload);
    } catch {
      removeSSEClient(client.userId);
    }
  }
}

export function getSSEClientCount(): number {
  return clients.size;
}

export function disconnectAllSSEClients(): void {
  for (const [userId] of clients) {
    removeSSEClient(userId);
  }
}
