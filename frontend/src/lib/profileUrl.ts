/**
 * Single source of truth for constructing profile URLs.
 * Prefers /u/{username} when available (shorter, more memorable).
 * Falls back to /humans/{id} as the canonical, always-working URL.
 */
export function getProfileUrl(opts: { username?: string; id: string }): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://humanpages.ai';
  if (opts.username) return `${origin}/u/${opts.username}`;
  return `${origin}/humans/${opts.id}`;
}

export function getProfileDisplayUrl(opts: { username?: string; id: string }): string {
  const host = typeof window !== 'undefined' ? window.location.host : 'humanpages.ai';
  if (opts.username) return `${host}/u/${opts.username}`;
  return `${host}/humans/${opts.id}`;
}
