import { createHmac, timingSafeEqual } from 'crypto';
import express from 'express';
import { config } from './config.js';
import { getJob, getMessages } from './api.js';
import type { Message, WebhookEvent, WebhookPayload } from './types.js';

// ── Status polling (fallback when no webhook URL) ──

const EVENT_TO_STATUS: Record<string, string> = {
  'job.accepted': 'ACCEPTED',
  'job.rejected': 'REJECTED',
  'job.paid': 'PAID',
  'job.completed': 'COMPLETED',
};

const POLL_INTERVAL_MS = 5_000;

async function pollForStatus(
  jobId: string,
  event: WebhookEvent,
  timeoutMs: number,
): Promise<WebhookPayload> {
  const targetStatus = EVENT_TO_STATUS[event];
  if (!targetStatus) throw new Error(`Cannot poll for event: ${event}`);

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await getJob(jobId);

    if (job.status === targetStatus) {
      return {
        event,
        jobId,
        status: job.status,
        timestamp: new Date().toISOString(),
        data: {
          title: job.title,
          description: job.description,
          priceUsdc: job.priceUsdc,
          humanId: job.humanId,
          humanName: job.human?.name,
        },
      };
    }

    // If waiting for acceptance but job was rejected, fail fast
    if (event === 'job.accepted' && job.status === 'REJECTED') {
      throw new Error('Job was rejected by the human');
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for ${event} on job ${jobId}`);
}

/**
 * Wait for a status change while also monitoring messages.
 *
 * Each poll cycle checks both the job status AND the messages endpoint.
 * When a new human message arrives, `onMessage` is called so the bot can reply
 * without blocking the status wait.
 *
 * Returns when the target status is reached (same as waitForEvent).
 */
export async function waitForEventWithMessages(
  jobId: string,
  event: WebhookEvent,
  knownMessageIds: Set<string>,
  onMessage: (msg: Message) => Promise<void>,
  timeoutMs = 300_000,
): Promise<WebhookPayload> {
  const targetStatus = EVENT_TO_STATUS[event];
  if (!targetStatus) throw new Error(`Cannot poll for event: ${event}`);

  console.log(`  (Polling for ${event} + messages every ${POLL_INTERVAL_MS / 1000}s)`);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Check status
    const job = await getJob(jobId);

    if (job.status === targetStatus) {
      return {
        event,
        jobId,
        status: job.status,
        timestamp: new Date().toISOString(),
        data: {
          title: job.title,
          description: job.description,
          priceUsdc: job.priceUsdc,
          humanId: job.humanId,
          humanName: job.human?.name,
        },
      };
    }

    if (event === 'job.accepted' && job.status === 'REJECTED') {
      throw new Error('Job was rejected by the human');
    }

    // Check for new messages
    try {
      const msgs = await getMessages(jobId);
      for (const msg of msgs) {
        if (msg.senderType === 'human' && !knownMessageIds.has(msg.id)) {
          knownMessageIds.add(msg.id);
          await onMessage(msg);
        }
      }
    } catch {
      // Silently retry on transient errors
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for ${event} on job ${jobId}`);
}

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
 *
 * When a WEBHOOK_URL is configured, listens for real-time webhook delivery.
 * Otherwise, falls back to polling GET /api/jobs/:id every 5 seconds —
 * so the bot works out of the box with zero infrastructure.
 *
 * Events that arrive before waitForEvent is called are buffered so they aren't lost.
 */
export function waitForEvent(
  jobId: string,
  event: WebhookEvent,
  timeoutMs = 300_000, // 5 minutes default
): Promise<WebhookPayload> {
  // No webhook server → poll the API instead
  if (!config.webhookUrl) {
    console.log(`  (No webhook configured — polling for ${event} every ${POLL_INTERVAL_MS / 1000}s)`);
    return pollForStatus(jobId, event, timeoutMs);
  }

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
