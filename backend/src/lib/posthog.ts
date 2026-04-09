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

/**
 * Execute a HogQL query against PostHog.
 * Requires POSTHOG_KEY and POSTHOG_PROJECT_ID env vars.
 *
 * @param query - HogQL query string
 * @returns Query results as array of records
 */
export async function queryPostHog(query: string): Promise<any[]> {
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;

  if (!projectId || !apiKey) {
    throw new Error('POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY required for analytics');
  }

  const response = await fetch(`https://us.posthog.com/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PostHog query failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as any;
  return data.results || [];
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
