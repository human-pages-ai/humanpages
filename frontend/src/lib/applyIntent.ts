/**
 * Apply Intent — durable storage for the careers application flow.
 *
 * Stored in localStorage so it survives:
 *   - OAuth redirects (Google/LinkedIn leave the app entirely)
 *   - Page refreshes, tab closes, email verification delays
 *   - The full Signup → Onboarding → Careers chain
 *
 * Flow:
 * 1. User clicks "Apply" on /careers → intent saved here
 * 2. Auth flow happens (signup, OAuth, login)
 * 3. After auth, Onboarding/Login/OAuthCallback check for intent
 * 4. If intent exists → redirect to /careers
 * 5. CareersPage reads intent → auto-opens apply modal → clears intent
 */

const APPLY_INTENT_KEY = 'hp_apply_intent';

interface ApplyIntent {
  positionId: string;
  positionTitle?: string;
  suggestedSkills?: string[];
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
  'virtual-assistant':    ['Email & Calendar Management', 'Data Entry', 'Scheduling', 'Document Management'],
  'influencer-outreach':  ['Social Media Management', 'Cold Outreach', 'Community Management', 'Content Writing'],
  'customer-relations':   ['Customer Support', 'Chat & Email Support', 'Community Management'],
  'community-manager':    ['Community Management', 'Social Media Management', 'Content Writing', 'Event Coordination'],
  'graphic-designer':     ['Graphic Design', 'Photo & Image Editing', 'UI/UX Design', 'Prototyping & Wireframing'],
  'copywriter':           ['Copywriting', 'Content Writing', 'SEO & SEM', 'Proofreading & Editing'],
  'sales-development':    ['Sales & Lead Generation', 'Cold Outreach', 'Market Research'],
  'software-engineer':    ['Software Development', 'QA & Bug Testing', 'Code Review', 'Technical Writing'],
  'video-editor':         ['Video Production', 'Photo & Image Editing', 'Graphic Design', 'Content Writing'],
  'general':              [],
  // Legacy IDs kept for backwards compat with stored intents
  'product-designer':     ['Graphic Design', 'Photo & Image Editing', 'UI/UX Design', 'Prototyping & Wireframing'],
  'qa-tester':            ['QA & Bug Testing', 'Software Development', 'Technical Writing'],
};

export function setApplyIntent(positionId: string, positionTitle?: string): void {
  const suggestedSkills = POSITION_SKILL_HINTS[positionId] || [];
  localStorage.setItem(APPLY_INTENT_KEY, JSON.stringify({
    positionId,
    positionTitle,
    suggestedSkills,
    timestamp: Date.now(),
  }));
}

export function getApplyIntent(): ApplyIntent | null {
  try {
    const raw = localStorage.getItem(APPLY_INTENT_KEY);
    if (!raw) return null;
    const parsed: ApplyIntent = JSON.parse(raw);
    // Expire after 24 hours
    if (Date.now() - parsed.timestamp > INTENT_TTL) {
      localStorage.removeItem(APPLY_INTENT_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(APPLY_INTENT_KEY);
    return null;
  }
}

export function clearApplyIntent(): void {
  localStorage.removeItem(APPLY_INTENT_KEY);
}

/**
 * Called by Onboarding/OAuthCallback/Login to get the post-auth redirect.
 * Returns '/careers' if an apply intent exists, null otherwise.
 * Does NOT clear the intent — CareersPage does that after opening the modal.
 */
export function getApplyRedirect(): string | null {
  const intent = getApplyIntent();
  return intent ? '/careers' : null;
}
