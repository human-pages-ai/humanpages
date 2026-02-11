import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { sendProfileNudgeEmail } from './email.js';

// Run every 6 hours
const NUDGE_INTERVAL = 6 * 60 * 60 * 1000;

// Wait at least 24 hours after signup before nudging
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

// Max users to process per run to avoid overloading email provider
const BATCH_SIZE = 50;

interface MissingField {
  key: string;
  label: string;
}

function getIncompleteFields(human: {
  bio: string | null;
  location: string | null;
  skills: string[];
  services: { isActive: boolean }[];
  wallets: { id: string }[];
  contactEmail: string | null;
}): MissingField[] {
  const missing: MissingField[] = [];

  if (!human.location?.trim()) {
    missing.push({ key: 'location', label: 'Add your location so agents can find you nearby' });
  }
  if (!human.skills || human.skills.length === 0) {
    missing.push({ key: 'skills', label: 'Add your skills to match with the right jobs' });
  }
  if (!human.bio?.trim()) {
    missing.push({ key: 'bio', label: 'Write a short bio to introduce yourself' });
  }
  if (!human.services || !human.services.some(s => s.isActive)) {
    missing.push({ key: 'services', label: 'Add at least one service you can offer' });
  }
  if (!human.wallets || human.wallets.length === 0) {
    missing.push({ key: 'wallets', label: 'Connect a wallet to receive payments' });
  }
  if (!human.contactEmail?.trim()) {
    missing.push({ key: 'contactEmail', label: 'Add a contact email for job communications' });
  }

  return missing;
}

function computeCompletionPercent(human: Parameters<typeof getIncompleteFields>[0] & { name: string | null }): number {
  const items = [
    { complete: Boolean(human.name?.trim()), weight: 15 },
    { complete: Boolean(human.bio?.trim()), weight: 15 },
    { complete: Boolean(human.location?.trim()), weight: 15 },
    { complete: Boolean(human.contactEmail?.trim()), weight: 15 },
    { complete: human.skills?.length > 0, weight: 15 },
    { complete: human.services?.some(s => s.isActive) ?? false, weight: 15 },
    { complete: human.wallets.length > 0, weight: 10 },
  ];
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  const completedWeight = items.reduce((sum, i) => sum + (i.complete ? i.weight : 0), 0);
  return Math.round((completedWeight / totalWeight) * 100);
}

async function processProfileNudges() {
  try {
    const cutoff = new Date(Date.now() - MIN_AGE_MS);

    // Find users who:
    // 1. Signed up more than 24 hours ago
    // 2. Haven't received a nudge email yet
    // 3. Have email notifications enabled
    const humans = await prisma.human.findMany({
      where: {
        createdAt: { lt: cutoff },
        profileNudgeSentAt: null,
        emailNotifications: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        contactEmail: true,
        bio: true,
        location: true,
        skills: true,
        preferredLanguage: true,
        services: { select: { isActive: true } },
        wallets: { select: { id: true } },
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    });

    let sent = 0;
    for (const human of humans) {
      const missing = getIncompleteFields(human);

      // Profile is already complete — mark as handled so we don't query them again
      if (missing.length === 0) {
        await prisma.human.update({
          where: { id: human.id },
          data: { profileNudgeSentAt: new Date() },
        });
        continue;
      }

      const completionPercent = computeCompletionPercent(human);

      try {
        const emailSent = await sendProfileNudgeEmail({
          humanName: human.name,
          humanEmail: human.contactEmail || human.email,
          humanId: human.id,
          missingFields: missing.map(f => f.label),
          completionPercent,
          language: human.preferredLanguage,
        });

        // Mark nudge as sent regardless of email delivery success
        // so we don't retry endlessly
        await prisma.human.update({
          where: { id: human.id },
          data: { profileNudgeSentAt: new Date() },
        });

        if (emailSent) sent++;
      } catch (err) {
        logger.error({ err, humanId: human.id }, 'Failed to send profile nudge email');
      }
    }

    if (sent > 0) {
      logger.info({ sent, total: humans.length }, 'Profile nudge emails sent');
    }
  } catch (err) {
    logger.error({ err }, 'Profile nudge processing failed');
  }
}

let nudgeTimer: ReturnType<typeof setInterval> | null = null;

export function startProfileNudgeWorker() {
  logger.info('Starting profile nudge worker');

  // Run once shortly after startup (30 seconds), then every 6 hours
  setTimeout(() => processProfileNudges(), 30 * 1000);
  nudgeTimer = setInterval(() => processProfileNudges(), NUDGE_INTERVAL);
}

export function stopProfileNudgeWorker() {
  if (nudgeTimer) clearInterval(nudgeTimer);
  nudgeTimer = null;
}
