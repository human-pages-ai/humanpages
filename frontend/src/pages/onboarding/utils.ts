import type { LanguageEntry } from './types';
import { isInAppBrowser as isInAppBrowserDetected } from '../../lib/deviceDetection';

/** Parse "English (Native)" → { language: "English", proficiency: "Native" } */
export function parseLanguageString(s: string): LanguageEntry {
  const match = s.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (match) return { language: match[1].trim(), proficiency: match[2].trim() };
  return { language: s.trim(), proficiency: '' };
}

/** Serialize { language: "English", proficiency: "Native" } → "English (Native)" */
export function serializeLanguageEntry(entry: LanguageEntry): string {
  return entry.proficiency ? `${entry.language} (${entry.proficiency})` : entry.language;
}

/** Detect in-app browsers (FB, IG, TikTok, etc.) that block window.open */
export function isInAppBrowser(): boolean {
  return isInAppBrowserDetected();
}

/** Scroll an error alert into view and focus it for screen readers */
export function scrollToError(): void {
  requestAnimationFrame(() => {
    const alert = document.querySelector('[role="alert"]') as HTMLElement;
    if (alert) {
      alert.scrollIntoView({ behavior: window.innerWidth < 640 ? 'auto' : 'smooth', block: 'center' });
      alert.focus();
    }
  });
}

/** Detect platform name from URL for display */
export function getPlatformLabel(url: string): { name: string; icon: string } {
  const u = url.toLowerCase();
  if (u.includes('fiverr')) return { name: 'Fiverr', icon: '🟢' };
  if (u.includes('upwork')) return { name: 'Upwork', icon: '🟢' };
  if (u.includes('behance')) return { name: 'Behance', icon: '🎨' };
  if (u.includes('dribbble')) return { name: 'Dribbble', icon: '🏀' };
  if (u.includes('stackoverflow') || u.includes('stackexchange')) return { name: 'Stack Overflow', icon: '📚' };
  if (u.includes('medium.com')) return { name: 'Medium', icon: '✍️' };
  if (u.includes('deviantart')) return { name: 'DeviantArt', icon: '🎨' };
  if (u.includes('kaggle')) return { name: 'Kaggle', icon: '📊' };
  if (u.includes('producthunt')) return { name: 'Product Hunt', icon: '🚀' };
  try {
    return { name: new URL(url).hostname.replace('www.', ''), icon: '🔗' };
  } catch {
    // Invalid URL format — return as-is
    return { name: url, icon: '🔗' };
  }
}
