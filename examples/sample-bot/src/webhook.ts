import { createHmac, timingSafeEqual } from 'crypto';
import express from 'express';
import { config } from './config.js';
import type { WebhookEvent, WebhookPayload } from './types.js';

// ── Signature verification ──

function verifySignature(rawBody: Buffer, signature: string): boolean {
  const expected = createHmac('sha256', config.webhookSecret)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks (never use ===)
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

// ── Event waiting ──

type EventKey = `${string}:${WebhookEvent}`;

const pendingResolvers = new Map<EventKey, (payload: WebhookPayload) => void>();
const bufferedEvents = new Map<EventKey, WebhookPayload>();

/**
 * Wait for a specific webhook event for a given job.
 * Returns a Promise that resolves when the event arrives (or rejects on timeout).
 * Events that arrive before waitForEvent is called are buffered so they aren't lost.
 */
export function waitForEvent(
  jobId: string,
  event: WebhookEvent,
  timeoutMs = 300_000, // 5 minutes default
): Promise<WebhookPayload> {
  const key: EventKey = `${jobId}:${event}`;

  // Check buffer first — the event may have arrived before we started waiting
  const buffered = bufferedEvents.get(key);
  if (buffered) {
    bufferedEvents.delete(key);
    return Promise.resolve(buffered);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResolvers.delete(key);
      reject(new Error(`Timed out waiting for ${event} on job ${jobId}`));
    }, timeoutMs);

    pendingResolvers.set(key, (payload) => {
      clearTimeout(timer);
      pendingResolvers.delete(key);
      resolve(payload);
    });
  });
}

function dispatchEvent(payload: WebhookPayload): void {
  const key: EventKey = `${payload.jobId}:${payload.event}`;

  const resolver = pendingResolvers.get(key);
  if (resolver) {
    resolver(payload);
  } else {
    // Buffer the event so a later waitForEvent call can pick it up
    bufferedEvents.set(key, payload);
  }
}

// ── Express server ──

export function createWebhookServer(): express.Express {
  const app = express();

  // Use express.raw() to get the raw body buffer for signature verification.
  // This must be BEFORE any json() middleware on this route.
  app.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => {
      const signature = req.headers['x-humanpages-signature'] as string | undefined;

      if (!signature) {
        console.log('  [webhook] Rejected: missing signature header');
        res.status(401).json({ error: 'Missing signature' });
        return;
      }

      const rawBody = req.body as Buffer;

      if (!verifySignature(rawBody, signature)) {
        console.log('  [webhook] Rejected: invalid signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      let payload: WebhookPayload;
      try {
        payload = JSON.parse(rawBody.toString()) as WebhookPayload;
      } catch {
        res.status(400).json({ error: 'Invalid JSON' });
        return;
      }

      console.log(`  [webhook] Received: ${payload.event} for job ${payload.jobId}`);
      dispatchEvent(payload);

      // Acknowledge receipt immediately
      res.status(200).json({ received: true });
    },
  );

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

export function startWebhookServer(): Promise<void> {
  return new Promise((resolve) => {
    const app = createWebhookServer();
    app.listen(config.webhookPort, config.webhookHost, () => {
      console.log(`Webhook server listening on ${config.webhookHost}:${config.webhookPort}`);
      resolve();
    });
  });
}
