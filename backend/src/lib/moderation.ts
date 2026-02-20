import OpenAI from 'openai';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  scores: Record<string, number>;
}

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
 * Moderate an image buffer for NSFW/profanity content.
 * Uses OpenAI's omni-moderation-latest model (free).
 */
export async function moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/webp;base64,${base64}`;

  const response = await getOpenAI().moderations.create({
    model: 'omni-moderation-latest',
    input: [
      {
        type: 'image_url',
        image_url: { url: dataUrl },
      },
    ],
  });

  const result = response.results[0];
  return {
    flagged: result.flagged,
    categories: result.categories as unknown as Record<string, boolean>,
    scores: result.category_scores as unknown as Record<string, number>,
  };
}

/**
 * Moderate text content for profanity/harassment/spam.
 * Uses OpenAI's moderation endpoint (free).
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  if (!text || text.trim().length === 0) {
    return { flagged: false, categories: {}, scores: {} };
  }

  const response = await getOpenAI().moderations.create({
    model: 'omni-moderation-latest',
    input: text,
  });

  const result = response.results[0];
  return {
    flagged: result.flagged,
    categories: result.categories as unknown as Record<string, boolean>,
    scores: result.category_scores as unknown as Record<string, number>,
  };
}

/**
 * Queue a content item for async moderation.
 * If moderation is not enabled (no API key), auto-approves the content.
 */
export async function queueModeration(contentType: string, contentId: string): Promise<void> {
  if (!isModerationEnabled()) {
    // Auto-approve when moderation is disabled (e.g., development)
    await autoApprove(contentType, contentId);
    return;
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
