// Simple analytics tracking
// In production, replace with your analytics provider (Mixpanel, Amplitude, PostHog, etc.)

type EventName =
  | 'page_view'
  | 'signup_start'
  | 'signup_complete'
  | 'onboarding_step_1'
  | 'onboarding_step_2'
  | 'onboarding_step_3'
  | 'onboarding_complete'
  | 'onboarding_skip'
  | 'profile_share_click'
  | 'profile_share_copy'
  | 'referral_link_copy'
  | 'profile_view'
  | 'login_success';

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

class Analytics {
  private userId: string | null = null;

  identify(userId: string) {
    this.userId = userId;
    console.log('[Analytics] Identified user:', userId);
  }

  track(event: EventName, properties?: EventProperties) {
    const payload = {
      event,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      ...properties,
    };

    // Log to console in development
    console.log('[Analytics]', event, properties || {});

    // In production, send to your analytics backend
    // Example: fetch('/api/analytics', { method: 'POST', body: JSON.stringify(payload) });

    // Store in localStorage for debugging
    try {
      const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
      events.push(payload);
      // Keep last 100 events
      if (events.length > 100) events.shift();
      localStorage.setItem('analytics_events', JSON.stringify(events));
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Helper to get stored events (for debugging)
  getEvents(): EventProperties[] {
    try {
      return JSON.parse(localStorage.getItem('analytics_events') || '[]');
    } catch {
      return [];
    }
  }
}

export const analytics = new Analytics();
