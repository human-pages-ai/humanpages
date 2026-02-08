import { createHmac } from 'crypto';
import { URL } from 'url';
import dns from 'dns/promises';
import { logger } from './logger.js';

/**
 * Check if a URL is safe to call (not pointing to private/internal networks).
 * Blocks: private IPs, localhost, link-local, non-http(s) schemes.
 */
export async function isAllowedUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname;

    // Block localhost variants
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]'
    ) {
      return false;
    }

    // Resolve hostname and check resulting IPs
    try {
      const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
      const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);
      const allAddresses = [...addresses, ...addresses6];

      for (const addr of allAddresses) {
        if (isPrivateIP(addr)) {
          return false;
        }
      }
    } catch {
      // If DNS resolution fails for an IP literal, check it directly
      if (isPrivateIP(hostname)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (/^127\./.test(ip)) return true;                    // Loopback
  if (/^10\./.test(ip)) return true;                     // Class A private
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return true; // Class B private
  if (/^192\.168\./.test(ip)) return true;               // Class C private
  if (/^169\.254\./.test(ip)) return true;               // Link-local
  if (ip === '0.0.0.0') return true;                     // Unspecified
  // IPv6 private
  if (ip === '::1') return true;                         // Loopback
  if (/^fe80:/i.test(ip)) return true;                   // Link-local
  if (/^fc00:/i.test(ip)) return true;                   // Unique local
  if (/^fd/i.test(ip)) return true;                      // Unique local
  return false;
}

/**
 * Sign a payload string with HMAC-SHA256 and return hex digest.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Deliver a webhook with retries and exponential backoff.
 * Fire-and-forget: logs failures but never throws.
 */
export async function deliverWebhook(
  url: string,
  payload: object,
  secret?: string | null,
): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'HumanPages-Webhook/1.0',
  };

  if (secret) {
    headers['X-HumanPages-Signature'] = signPayload(body, secret);
  }

  const delays = [1000, 4000, 16000]; // 3 attempts with exponential backoff

  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        logger.info({ url, attempt: attempt + 1 }, 'Webhook delivered');
        return;
      }

      logger.warn(
        { url, status: res.status, attempt: attempt + 1 },
        'Webhook delivery failed with non-OK status',
      );
    } catch (err) {
      logger.warn(
        { url, err, attempt: attempt + 1 },
        'Webhook delivery attempt failed',
      );
    }

    // Wait before retry (except on last attempt)
    if (attempt < delays.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }

  logger.error({ url }, 'Webhook delivery failed after all retries');
}

interface WebhookJob {
  id: string;
  title: string;
  description: string;
  priceUsdc: { toString(): string };
  callbackUrl: string | null;
  callbackSecret: string | null;
  humanId: string;
  status: string;
}

/**
 * Fire a webhook for a job status change.
 * Runs async (don't await in caller) — fire-and-forget.
 */
export function fireWebhook(
  job: WebhookJob,
  event: string,
  extra?: Record<string, unknown>,
): void {
  if (!job.callbackUrl) return;

  const payload = {
    event,
    jobId: job.id,
    status: job.status,
    timestamp: new Date().toISOString(),
    data: {
      title: job.title,
      description: job.description,
      priceUsdc: job.priceUsdc.toString(),
      humanId: job.humanId,
      ...extra,
    },
  };

  // Fire-and-forget: don't await
  deliverWebhook(job.callbackUrl, payload, job.callbackSecret).catch((err) =>
    logger.error({ err, jobId: job.id, event }, 'Webhook fire error'),
  );
}
