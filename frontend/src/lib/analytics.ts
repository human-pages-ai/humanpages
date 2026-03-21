// Analytics tracking with PostHog integration
import { posthog } from './posthog';
import { safeLocalStorage } from './safeStorage';

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
  | 'vouch_link_copy'
  | 'vouch_from_profile'
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
  | 'fiat_payment_method_added'
  | 'fiat_payment_method_deleted'
  | 'wallet_create_embedded'
  | 'listing_viewed'
  | 'listing_signup_clicked'
  | 'listing_applied'
  | 'listing_share'
  | 'telegram_connected_onboarding'
  | 'telegram_skipped_onboarding'
  | 'telegram_connect_attempted'
  | 'push_notifications_granted'
  | 'push_notifications_denied'
  | 'whatsapp_provided_onboarding'
  | 'connect_step_completed'
  | 'onboarding_step_viewed'
  | 'onboarding_step_completed'
  | 'dev_code_copied'
  | 'dev_prompt_copied'
  | 'dev_config_tab_switched'
  | 'dev_platform_nav_clicked'
  | 'dev_docs_link_clicked'
  | 'dev_server_url_copied'
  | 'dev_claim_service_clicked'
  | 'dev_external_link_clicked'
  | 'landing_cta_clicked'
  | 'landing_faq_toggled'
  | 'landing_profile_clicked'
  | 'landing_listing_clicked'
  | 'dashboard_tab_changed'
  | 'dashboard_logout'
  | 'dashboard_resend_verification'
  | 'dashboard_privacy_toggled'
  | 'dashboard_filters_saved'
  | 'dashboard_export_data'
  | 'dashboard_delete_account'
  | 'funding_wallet_copied'
  | 'funding_external_clicked'
  | 'profile_shared'
  | 'profile_reported'
  | 'jobboard_filter_applied'
  | 'jobboard_listing_clicked'
  | 'jobboard_paginated'
  | 'pricing_cta_clicked'
  | 'blog_article_clicked';

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
      try { safeLocalStorage.removeItem('analytics_events'); } catch { /* ignore */ }
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
        const events = JSON.parse(safeLocalStorage.getItem('analytics_events') || '[]');
        events.push(payload);
        // Keep last 100 events
        if (events.length > 100) events.shift();
        safeLocalStorage.setItem('analytics_events', JSON.stringify(events));
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
      return JSON.parse(safeLocalStorage.getItem('analytics_events') || '[]');
    } catch {
      return [];
    }
  }
}

export const analytics = new Analytics();
