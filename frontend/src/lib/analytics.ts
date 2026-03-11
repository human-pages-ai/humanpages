// Analytics tracking with PostHog integration
import { posthog } from './posthog';

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
  | 'login_success'
  | 'affiliate_applied'
  | 'affiliate_link_copy'
  | 'careers_apply_click'
  | 'careers_apply_signup_redirect'
  | 'careers_apply_submit'
  | 'careers_referral_copy'
  | 'careers_referral_share'
  | 'careers_hero_signup'
  | 'careers_copy_apply_link'
  | 'careers_deeplink_landed'
  | 'wallet_section_viewed'
  | 'wallet_not_detected'
  | 'wallet_install_link_clicked'
  | 'wallet_deeplink_clicked'
  | 'wallet_connect_started'
  | 'wallet_connect_success'
  | 'wallet_connect_rejected'
  | 'wallet_connect_failed'
  | 'wallet_sign_rejected'
  | 'wallet_sign_failed'
  | 'wallet_added'
  | 'wallet_added_manual'
  | 'wallet_deleted'
  | 'listing_viewed'
  | 'listing_signup_clicked'
  | 'listing_applied'
  | 'listing_share';

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

class Analytics {
  private userId: string | null = null;
  private optedOut: boolean = false;

  setOptOut(optedOut: boolean) {
    this.optedOut = optedOut;
    if (optedOut) {
      posthog.reset();
      try { localStorage.removeItem('analytics_events'); } catch { /* ignore */ }
    }
  }

  identify(userId: string) {
    this.userId = userId;
    if (this.optedOut) return;

    console.log('[Analytics] Identified user:', userId);
    posthog.identify(userId);
  }

  track(event: EventName, properties?: EventProperties) {
    const payload = {
      event,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      ...properties,
    };

    console.log('[Analytics]', event, properties || {});

    if (!this.optedOut) {
      posthog.capture(event, properties);
    }

    // Store in localStorage for debugging (skip if opted out)
    if (!this.optedOut) {
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
  }

  reset() {
    this.userId = null;
    posthog.reset();
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
