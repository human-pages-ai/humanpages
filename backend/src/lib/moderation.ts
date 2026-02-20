import OpenAI, { APIError, RateLimitError } from 'openai';
import leoProfanity from 'leo-profanity';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  scores: Record<string, number>;
  /** Which layer caught it: 'local' (leo-profanity) or 'openai' */
  source?: 'local' | 'openai';
}

/**
 * Custom error class for OpenAI rate-limit hits that persist after retries.
 * Consumers (e.g. the moderation worker) can check `instanceof` to decide
 * whether to back off before retrying.
 */
export class OpenAIRateLimitError extends Error {
  /** Seconds to wait before retrying (from the Retry-After header, if present). */
  retryAfterSeconds: number | undefined;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'OpenAIRateLimitError';
    this.retryAfterSeconds = retryAfter;
  }
}

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // The SDK retries 429 and 5xx errors automatically with exponential backoff.
      // Default is 2 retries; bump to 3 for resilience in a background worker context.
      maxRetries: 3,
      timeout: 30_000, // 30s per-request timeout
    });
  }
  return openaiClient;
}

/**
 * Check if moderation is configured (has OpenAI API key).
 */
export function isModerationEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Parse the Retry-After value from an OpenAI rate-limit response.
 * Returns seconds to wait, or undefined if not present.
 */
function parseRetryAfter(error: RateLimitError): number | undefined {
  const header = error.headers?.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * Wrap an OpenAI API call with structured error handling.
 * The SDK already retries 429/5xx up to `maxRetries` times with backoff.
 * If it still fails after retries, we log and rethrow with context.
 */
async function callOpenAI<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof RateLimitError) {
      const retryAfter = parseRetryAfter(error);
      logger.warn(
        { retryAfterSeconds: retryAfter, status: error.status, label },
        `OpenAI rate limit hit for ${label} (after SDK retries exhausted)`,
      );
      throw new OpenAIRateLimitError(
        `OpenAI rate limit exceeded for ${label}. ${retryAfter ? `Retry after ${retryAfter}s.` : 'No Retry-After header.'}`,
        retryAfter,
      );
    }

    if (error instanceof APIError) {
      logger.error(
        { status: error.status, code: error.code, type: error.type, label },
        `OpenAI API error during ${label}`,
      );
    }

    throw error;
  }
}

/**
 * Moderate an image buffer for NSFW/profanity content.
 * Uses OpenAI's omni-moderation-latest model (free).
 */
export async function moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/webp;base64,${base64}`;

  const response = await callOpenAI('moderateImage', () =>
    getOpenAI().moderations.create({
      model: 'omni-moderation-latest',
      input: [
        {
          type: 'image_url',
          image_url: { url: dataUrl },
        },
      ],
    }),
  );

  const result = response.results[0];
  return {
    flagged: result.flagged,
    categories: result.categories as unknown as Record<string, boolean>,
    scores: result.category_scores as unknown as Record<string, number>,
  };
}

/**
 * Local profanity check using leo-profanity dictionary (253 words).
 * Instant, zero API calls. Catches obvious slurs/profanity.
 */
export function moderateTextLocal(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { flagged: false, categories: {}, scores: {} };
  }

  if (leoProfanity.check(text)) {
    return {
      flagged: true,
      categories: { profanity: true },
      scores: { profanity: 1.0 },
      source: 'local',
    };
  }

  return { flagged: false, categories: {}, scores: {} };
}

/**
 * Moderate text content for profanity/harassment/spam.
 * Layer 1: local dictionary filter (instant, free).
 * Layer 2: OpenAI moderation (free API call, catches nuanced toxicity).
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  if (!text || text.trim().length === 0) {
    return { flagged: false, categories: {}, scores: {} };
  }

  // Layer 1: local profanity filter — skip OpenAI if obvious
  const localResult = moderateTextLocal(text);
  if (localResult.flagged) {
    logger.info({ source: 'local' }, 'Text flagged by local profanity filter');
    return localResult;
  }

  // Layer 2: OpenAI moderation — catches harassment, hate, sexual, etc.
  const response = await callOpenAI('moderateText', () =>
    getOpenAI().moderations.create({
      model: 'omni-moderation-latest',
      input: text,
    }),
  );

  const result = response.results[0];
  return {
    flagged: result.flagged,
    categories: result.categories as unknown as Record<string, boolean>,
    scores: result.category_scores as unknown as Record<string, number>,
    source: 'openai',
  };
}

const MODERATION_QUEUE_CAP = 500;

/**
 * Queue a content item for async moderation.
 * If moderation is not enabled (no API key), auto-approves the content.
 * If the queue exceeds the cap, skips OpenAI and leaves the item as "pending"
 * (fail-closed: requires manual admin review, never auto-approves under load).
 */
export async function queueModeration(contentType: string, contentId: string): Promise<void> {
  if (!isModerationEnabled()) {
    // Auto-approve when moderation is disabled (e.g., development)
    await autoApprove(contentType, contentId);
    return;
  }

  // Safety valve: if queue is overwhelmed, still create the item but log a warning.
  // The moderation worker will skip processing when backlog > cap, so items stay
  // "pending" until an admin reviews them manually — fail-closed, never auto-approves.
  const pendingCount = await prisma.moderationQueue.count({ where: { status: 'pending' } });
  if (pendingCount >= MODERATION_QUEUE_CAP) {
    logger.warn({ contentType, contentId, pendingCount }, 'Moderation queue cap reached — item queued but will require manual review');
  }

  await prisma.moderationQueue.create({
    data: { contentType, contentId },
  });

  logger.info({ contentType, contentId }, 'Content queued for moderation');
}

/**
 * Auto-approve content when moderation is disabled.
 * Updates the source record directly.
 */
async function autoApprove(contentType: string, contentId: string): Promise<void> {
  switch (contentType) {
    case 'profile_photo':
      await prisma.human.update({
        where: { id: contentId },
        data: { profilePhotoStatus: 'approved' },
      });
      break;
    case 'agent_photo':
      await prisma.agent.update({
        where: { id: contentId },
        data: { profilePhotoStatus: 'approved' },
      });
      break;
    case 'job_posting':
      await prisma.job.update({
        where: { id: contentId },
        data: { moderationStatus: 'approved' },
      });
      break;
    // Reports don't need auto-approval — they stay PENDING for admin review
    default:
      break;
  }

  logger.info({ contentType, contentId }, 'Content auto-approved (moderation disabled)');
}
