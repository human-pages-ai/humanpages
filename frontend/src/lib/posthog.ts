import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export function initPostHog() {
  if (!POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    persistence: 'memory', // cookieless - respects privacy policy
    capture_pageview: false, // we'll capture manually with React Router
    capture_pageleave: true,
    autocapture: false, // explicit events only for cleaner data
  });
}

export { posthog };
