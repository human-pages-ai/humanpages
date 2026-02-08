import { PostHog } from 'posthog-node';

const POSTHOG_KEY = process.env.POSTHOG_KEY;

let posthogClient: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!POSTHOG_KEY) return null;

  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_KEY, {
      host: 'https://us.i.posthog.com',
      flushAt: 20,
      flushInterval: 10000,
    });
  }

  return posthogClient;
}

export function trackServerEvent(distinctId: string, event: string, properties?: Record<string, any>) {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
