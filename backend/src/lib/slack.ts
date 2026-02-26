// Slack Incoming Webhook integration for notifications
import { logger } from './logger.js';

const WEBHOOK_URL = process.env.SLACK_ENGAGEMENT_WEBHOOK;
const CROSSPOST_WEBHOOK_URL = process.env.SLACK_CROSSPOST_WEBHOOK;

const PLATFORM_EMOJI: Record<string, string> = {
  TWITTER: ':bird:',
  LINKEDIN: ':briefcase:',
  BLOG: ':memo:',
  DEVTO: ':computer:',
  HASHNODE: ':newspaper:',
};

interface EngagementNotification {
  title: string;
  url: string;
  platform: string;
  extra?: string;
}

export async function notifySlackEngagement(data: EngagementNotification): Promise<void> {
  if (!WEBHOOK_URL) return;

  const emoji = PLATFORM_EMOJI[data.platform.toUpperCase()] || ':mega:';

  const payload = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${data.title}*${data.extra ? `\n${data.extra}` : ''}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Go engage!' },
            url: data.url,
            style: 'primary',
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      logger.error({ status: res.status, body: await res.text() }, 'Slack engagement webhook failed');
    }
  } catch (error) {
    logger.error({ err: error }, 'Slack engagement webhook error');
  }
}

export async function notifySlackCrosspost(title: string, slug: string): Promise<void> {
  if (!CROSSPOST_WEBHOOK_URL) return;

  const canonicalUrl = `https://humanpages.ai/blog/${slug}`;

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'New blog post published — cross-post needed',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${title}*\n${canonicalUrl}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            ':white_square: *Medium* — use Import tool, paste canonical URL',
            ':white_square: *Hackernoon* — submit story, set canonical URL (editorial review ~1-3 days)',
            ':white_square: *Tealfeed* — create post, set canonical URL',
            ':white_square: *IndieHackers* — create post, add "Originally published at" link at top',
            ':white_square: *Vocal Media* — create story in Futurism, add "Originally published at" link at bottom',
          ].join('\n'),
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View blog post' },
            url: canonicalUrl,
            style: 'primary',
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(CROSSPOST_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      logger.error({ status: res.status, body: await res.text() }, 'Slack crosspost webhook failed');
    }
  } catch (error) {
    logger.error({ err: error }, 'Slack crosspost webhook error');
  }
}
