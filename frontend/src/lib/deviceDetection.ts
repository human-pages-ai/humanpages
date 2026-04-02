/**
 * Detect if running in a mobile browser
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect if running inside an in-app browser (e.g., Facebook, Instagram, Twitter app webviews)
 */
export function isInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /FBAN|FBAV|FBSS|FBW/i.test(ua) ||  // Facebook
         /Instagram/i.test(ua) ||             // Instagram
         /Twitter/i.test(ua) ||               // Twitter
         /TweetDeck/i.test(ua) ||             // TweetDeck
         /Telegram/i.test(ua) ||              // Telegram
         /CriOS|FxiOS|Version.*Safari/i.test(ua); // Other in-app browsers
}

/**
 * Get device context for analytics tracking
 * Returns an object with device-specific properties
 */
export function getDeviceContext(): Record<string, string | number | boolean> {
  return {
    is_mobile: isMobile(),
    is_in_app_browser: isInAppBrowser(),
  };
}
