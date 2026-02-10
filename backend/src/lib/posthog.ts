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

/**
 * Track a server-side event in PostHog.
 *
 * Pass the Express `req` object (or at minimum a client IP string) so
 * PostHog can geolocate the event to a country/city automatically.
 *
 * @param distinctId  - user ID or IP for anonymous events
 * @param event       - event name
 * @param properties  - custom event properties
 * @param req         - Express request (used to extract client IP for geolocation)
 */
export function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>,
  req?: { headers: Record<string, any>; ip?: string },
) {
  const ph = getPostHog();
  if (!ph) return;

  // Extract real client IP for PostHog GeoIP resolution.
  // PostHog uses $ip to determine $geoip_country_name, $geoip_city_name, etc.
  let ip: string | undefined;
  if (req) {
    ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      undefined;
  }

  ph.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      ...(ip ? { $ip: ip } : {}),
    },
  });
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
