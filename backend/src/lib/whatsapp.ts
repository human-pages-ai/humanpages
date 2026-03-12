// WhatsApp (Twilio) integration for notifications
// Feature-flagged: all functions are no-ops when TWILIO_ACCOUNT_SID is not set.
import crypto from 'crypto';
import { logger } from './logger.js';
import { writeToOutbox } from './email.js';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. "whatsapp:+14155238886"

// Template SIDs (registered with Meta via Twilio console)
const TEMPLATE_MESSAGE = process.env.WHATSAPP_TEMPLATE_MESSAGE;
const TEMPLATE_OFFER = process.env.WHATSAPP_TEMPLATE_OFFER;
const TEMPLATE_LOGIN = process.env.WHATSAPP_TEMPLATE_LOGIN;

// Retry config (mirrors telegram.ts)
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isWhatsAppEnabled(): boolean {
  return !!(ACCOUNT_SID && AUTH_TOKEN && WHATSAPP_FROM);
}

export function getWhatsAppNumber(): string | null {
  if (!WHATSAPP_FROM) return null;
  // Strip "whatsapp:" prefix if present for display
  return WHATSAPP_FROM.replace('whatsapp:', '');
}

// Check if we're within the 24h free-form messaging window
export function isWithin24hWindow(lastInboundAt: Date | null): boolean {
  if (!lastInboundAt) return false;
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return Date.now() - lastInboundAt.getTime() < twentyFourHours;
}

interface SendResult {
  success: boolean;
  outsideWindow?: boolean; // true if rejected due to 24h rule
}

async function sendOnce(to: string, body: string): Promise<SendResult> {
  if (!isWhatsAppEnabled()) {
    logger.info('WhatsApp not configured, skipping notification');
    return { success: false };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: WHATSAPP_FROM!,
      To: `whatsapp:${to}`,
      Body: body,
    }),
  });

  const data = await response.json() as { sid?: string; code?: number; message?: string };

  if (!response.ok) {
    // Twilio error 63016 = outside 24h window
    if (data.code === 63016) {
      return { success: false, outsideWindow: true };
    }
    throw new Error(`Twilio error ${data.code}: ${data.message}`);
  }

  logger.info({ to, sid: data.sid }, 'WhatsApp message sent');
  return { success: true };
}

// Send a free-form WhatsApp message (within 24h window)
export async function sendWhatsAppMessage(to: string, body: string): Promise<SendResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await sendOnce(to, body);
    } catch (err) {
      logger.warn({ err, attempt, to }, 'WhatsApp send attempt failed');
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  // All retries exhausted — persist to outbox
  if (isWhatsAppEnabled()) {
    logger.info({ to }, 'Queuing WhatsApp message to outbox after inline failure');
    await writeToOutbox('whatsapp', to, { to, body }).catch(err =>
      logger.error({ err }, 'Failed to write WhatsApp message to outbox')
    );
  }
  return { success: false };
}

// Send a pre-approved template message (works outside 24h window)
async function sendTemplateOnce(to: string, templateSid: string, variables: Record<string, string>): Promise<boolean> {
  if (!isWhatsAppEnabled()) {
    logger.info('WhatsApp not configured, skipping template');
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

  const params: Record<string, string> = {
    From: WHATSAPP_FROM!,
    To: `whatsapp:${to}`,
    ContentSid: templateSid,
  };

  // Add template variables as ContentVariables JSON
  if (Object.keys(variables).length > 0) {
    params.ContentVariables = JSON.stringify(variables);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });

  const data = await response.json() as { sid?: string; code?: number; message?: string };

  if (!response.ok) {
    throw new Error(`Twilio template error ${data.code}: ${data.message}`);
  }

  logger.info({ to, sid: data.sid, templateSid }, 'WhatsApp template sent');
  return true;
}

export async function sendWhatsAppTemplate(to: string, templateSid: string, variables: Record<string, string>): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await sendTemplateOnce(to, templateSid, variables);
    } catch (err) {
      logger.warn({ err, attempt, to }, 'WhatsApp template send attempt failed');
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  if (isWhatsAppEnabled()) {
    logger.info({ to }, 'Queuing WhatsApp template to outbox after failure');
    await writeToOutbox('whatsapp', to, { to, templateSid, variables }).catch(err =>
      logger.error({ err }, 'Failed to write WhatsApp template to outbox')
    );
  }
  return false;
}

// High-level: send a notification to a human via WhatsApp, handling the 24h window automatically.
// If within window: sends free-form. If outside: sends template + queues original to PendingWhatsAppMessage.
export async function sendWhatsAppNotification(opts: {
  to: string;
  humanId: string;
  lastInboundAt: Date | null;
  body: string;
  jobId?: string;
  templateType?: 'message' | 'offer' | 'login';
  templateVars?: Record<string, string>;
  prisma: any; // PrismaClient — passed to avoid circular imports
}): Promise<boolean> {
  if (!isWhatsAppEnabled()) return false;

  if (isWithin24hWindow(opts.lastInboundAt)) {
    const result = await sendWhatsAppMessage(opts.to, opts.body);
    if (result.outsideWindow) {
      // Race condition: window closed between check and send. Fall through to template path.
    } else {
      return result.success;
    }
  }

  // Outside 24h window — send template to wake user, queue original message
  const templateSid = opts.templateType === 'offer' ? TEMPLATE_OFFER
    : opts.templateType === 'login' ? TEMPLATE_LOGIN
    : TEMPLATE_MESSAGE;

  if (!templateSid) {
    logger.warn({ to: opts.to, type: opts.templateType }, 'No WhatsApp template SID configured, cannot send outside 24h window');
    return false;
  }

  // Queue the original message for delivery when user replies
  await opts.prisma.pendingWhatsAppMessage.create({
    data: {
      humanId: opts.humanId,
      jobId: opts.jobId ?? null,
      content: opts.body,
    },
  }).catch((err: unknown) => logger.error({ err }, 'Failed to queue pending WhatsApp message'));

  return sendWhatsAppTemplate(opts.to, templateSid, opts.templateVars ?? { '1': '1' });
}

// Verify Twilio webhook signature (timing-safe)
export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean {
  if (!AUTH_TOKEN) return false;

  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = crypto.createHmac('sha1', AUTH_TOKEN)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  // Timing-safe comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
