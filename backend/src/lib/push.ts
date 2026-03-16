// Web Push notification integration
import webPush from 'web-push';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@humanpages.ai';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

// SSRF protection: only allow known push service domains
const ALLOWED_PUSH_DOMAINS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'notify.windows.com',
  'web.push.apple.com',
];

export function isValidPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_PUSH_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

// Concurrency-limited Promise.allSettled — processes in batches
async function allSettledCapped<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

const PUSH_CONCURRENCY = 10;

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string; id: string },
  payload: PushPayload,
): Promise<boolean> {
  if (!isPushConfigured()) return false;

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 }, // 1 hour
    );
    return true;
  } catch (err: any) {
    // 410 Gone or 404 = subscription expired/invalid — delete it
    if (err.statusCode === 410 || err.statusCode === 404) {
      logger.info({ subscriptionId: subscription.id }, 'Deleting stale push subscription');
      await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
    } else {
      logger.warn({ err, subscriptionId: subscription.id }, 'Push notification send failed');
    }
    return false;
  }
}

async function sendPushToHuman(humanId: string, payload: PushPayload): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { humanId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  // Concurrency-capped to avoid saturating the event loop on many subscriptions
  await allSettledCapped(
    subscriptions.map((sub) => () => sendPushNotification(sub, payload)),
    PUSH_CONCURRENCY,
  );

  // If all subscriptions were deleted (stale), turn off pushNotifications
  if (subscriptions.length > 0) {
    const remaining = await prisma.pushSubscription.count({ where: { humanId } });
    if (remaining === 0) {
      await prisma.human.update({
        where: { id: humanId },
        data: { pushNotifications: false },
      }).catch(() => {});
    }
  }
}

// Lock-screen-safe: generic text, no details
export async function sendJobOfferPush(humanId: string, jobId: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  await sendPushToHuman(humanId, {
    title: 'New job offer on HumanPages',
    body: 'You have a new job offer. Tap to view details.',
    url: `${frontendUrl}/jobs/${jobId}`,
  });
}

export async function sendJobOfferUpdatedPush(humanId: string, jobId: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  await sendPushToHuman(humanId, {
    title: 'Job offer updated on HumanPages',
    body: 'A job offer has been updated. Tap to review.',
    url: `${frontendUrl}/jobs/${jobId}`,
  });
}

export async function sendJobMessagePush(humanId: string, jobId: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  await sendPushToHuman(humanId, {
    title: 'New message on HumanPages',
    body: 'You have a new message. Tap to read.',
    url: `${frontendUrl}/jobs/${jobId}`,
  });
}
