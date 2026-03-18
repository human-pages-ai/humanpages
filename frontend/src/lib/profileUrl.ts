/**
 * Single source of truth for constructing profile URLs.
 * Uses username if available, falls back to /humans/{id}.
 * Uses window.location.origin for dev/staging compatibility.
 */
export function getProfileUrl(opts: { username?: string; id: string }): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://humanpages.ai';
  if (opts.username) return `${origin}/u/${opts.username}`;
  return `${origin}/humans/${opts.id}`;
}

export function getProfileDisplayUrl(opts: { username?: string; id: string }): string {
  if (opts.username) return `humanpages.ai/u/${opts.username}`;
  return `humanpages.ai/humans/${opts.id}`;
}
