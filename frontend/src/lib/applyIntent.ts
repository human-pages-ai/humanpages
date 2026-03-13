import { safeLocalStorage } from './safeStorage';
/**
 * Apply Intent — durable storage for the careers & listing application flows.
 *
 * Stored in localStorage so it survives:
 *   - OAuth redirects (Google/LinkedIn leave the app entirely)
 *   - Page refreshes, tab closes, email verification delays
 *   - The full Signup → Onboarding → Careers/Listing chain
 *
 * Careers flow:
 * 1. User clicks "Apply" on /careers → intent saved here
 * 2. Auth flow happens (signup, OAuth, login)
 * 3. After auth, Onboarding/Login/OAuthCallback check for intent
 * 4. If intent exists → redirect to /careers
 * 5. CareersPage reads intent → auto-opens apply modal → clears intent
 *
 * Listing flow:
 * 1. User clicks "Apply" on /listings/:id → listing intent saved here
 * 2. Auth flow happens (signup, OAuth, login)
 * 3. After auth, Onboarding auto-applies with a default pitch
 * 4. OAuthCallback/Login redirect to /listings/:id
 */

const APPLY_INTENT_KEY = 'hp_apply_intent';
const LISTING_APPLY_INTENT_KEY = 'hp_listing_apply_intent';

interface ApplyIntent {
  positionId: string;
  positionTitle?: string;
  suggestedSkills?: string[];
  timestamp: number;
}

interface ListingApplyIntent {
  listingId: string;
  listingTitle?: string;
  requiredSkills?: string[];
  timestamp: number;
}

/** 24 hours in milliseconds */
const INTENT_TTL = 24 * 60 * 60 * 1000;

/**
 * Maps each careers-page position to relevant onboarding skills.
 * When a user applies for a role before signing up, these skills
 * are pre-selected on the onboarding page so they don't have to hunt.
 */
export const POSITION_SKILL_HINTS: Record<string, string[]> = {
  'digital-marketer':     ['Social Media Management', 'Content Writing', 'SEO & SEM', 'Email Marketing'],
  'content-creator':      ['Content Writing', 'Video Production', 'Photo & Image Editing', 'Social Media Management'],
  'virtual-assistant':    ['Virtual Assistant', 'Email & Calendar Management', 'Data Entry', 'Scheduling'],
  'influencer-outreach':  ['Social Media Management', 'Cold Outreach', 'Community Management', 'Influencer Marketing'],
  'customer-relations':   ['Customer Support', 'Chat & Email Support', 'Community Management'],
  'community-manager':    ['Community Management', 'Social Media Management', 'Discord & Telegram Management', 'Event Planning'],
  'graphic-designer':     ['Graphic Design', 'Photo & Image Editing', 'UI/UX Design', 'Logo Design'],
  'copywriter':           ['Copywriting', 'Content Writing', 'SEO & SEM', 'Proofreading & Editing'],
  'sales-development':    ['Sales & Lead Generation', 'Cold Outreach', 'Market Research'],
  'software-engineer':    ['Software Development', 'Web Development', 'Code Review', 'QA & Bug Testing'],
  'video-editor':         ['Video Production', 'Video Editing', 'Animation & Motion Graphics', 'Photo & Image Editing'],
  'general':              [],
  // Legacy IDs kept for backwards compat with stored intents
  'product-designer':     ['Graphic Design', 'Photo & Image Editing', 'UI/UX Design', 'Prototyping & Wireframing'],
  'qa-tester':            ['QA & Bug Testing', 'Software Development', 'Code Review'],
};

// ─── Career Apply Intent ─────────────────────────────────────────────────────

export function setApplyIntent(positionId: string, positionTitle?: string): void {
  const suggestedSkills = POSITION_SKILL_HINTS[positionId] || [];
  safeLocalStorage.setItem(APPLY_INTENT_KEY, JSON.stringify({
    positionId,
    positionTitle,
    suggestedSkills,
    timestamp: Date.now(),
  }));
}

export function getApplyIntent(): ApplyIntent | null {
  try {
    const raw = safeLocalStorage.getItem(APPLY_INTENT_KEY);
    if (!raw) return null;
    const parsed: ApplyIntent = JSON.parse(raw);
    // Expire after 24 hours
    if (Date.now() - parsed.timestamp > INTENT_TTL) {
      safeLocalStorage.removeItem(APPLY_INTENT_KEY);
      return null;
    }
    return parsed;
  } catch {
    safeLocalStorage.removeItem(APPLY_INTENT_KEY);
    return null;
  }
}

export function clearApplyIntent(): void {
  safeLocalStorage.removeItem(APPLY_INTENT_KEY);
}

// ─── Listing Apply Intent ────────────────────────────────────────────────────

export function setListingApplyIntent(
  listingId: string,
  listingTitle?: string,
  requiredSkills?: string[],
): void {
  safeLocalStorage.setItem(LISTING_APPLY_INTENT_KEY, JSON.stringify({
    listingId,
    listingTitle,
    requiredSkills: requiredSkills || [],
    timestamp: Date.now(),
  }));
}

export function getListingApplyIntent(): ListingApplyIntent | null {
  try {
    const raw = safeLocalStorage.getItem(LISTING_APPLY_INTENT_KEY);
    if (!raw) return null;
    const parsed: ListingApplyIntent = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > INTENT_TTL) {
      safeLocalStorage.removeItem(LISTING_APPLY_INTENT_KEY);
      return null;
    }
    return parsed;
  } catch {
    safeLocalStorage.removeItem(LISTING_APPLY_INTENT_KEY);
    return null;
  }
}

export function clearListingApplyIntent(): void {
  safeLocalStorage.removeItem(LISTING_APPLY_INTENT_KEY);
}

// ─── Redirect Helper ─────────────────────────────────────────────────────────

/**
 * Called by Onboarding/OAuthCallback/Login to get the post-auth redirect.
 * Listing intents take priority over career intents.
 * Returns the redirect path or null.
 * Does NOT clear the intent — the destination page does that.
 */
export function getApplyRedirect(): string | null {
  const listingIntent = getListingApplyIntent();
  if (listingIntent) return `/listings/${listingIntent.listingId}`;
  const intent = getApplyIntent();
  return intent ? '/careers' : null;
}
