// Slack Incoming Webhook integration for engagement notifications
import { logger } from './logger.js';

const WEBHOOK_URL = process.env.SLACK_ENGAGEMENT_WEBHOOK;

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
