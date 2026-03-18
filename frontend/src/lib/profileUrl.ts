/**
 * Single source of truth for constructing profile URLs.
 * Always uses /humans/{id} — this is the canonical, always-working URL.
 * The /u/{username} route only works if the username is saved on the server,
 * which may not be the case during onboarding (username is local state only).
 */
export function getProfileUrl(opts: { id: string }): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://humanpages.ai';
  return `${origin}/humans/${opts.id}`;
}

export function getProfileDisplayUrl(opts: { id: string }): string {
  const host = typeof window !== 'undefined' ? window.location.host : 'humanpages.ai';
  return `${host}/humans/${opts.id}`;
}
