/**
 * Disposable/temporary email domain blocklist.
 * Used to prevent sybil attacks on solver verification.
 * This is a curated subset of the most common disposable providers.
 */

const DISPOSABLE_DOMAINS = new Set([
  // Major disposable services
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'guerrilla.ml', 'grr.la', 'sharklasers.com',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempail.com',
  'throwaway.email', 'throwaway.com', 'dispostable.com', 'yopmail.com',
  'yopmail.fr', 'yopmail.net', 'mailnesia.com', 'maildrop.cc',
  'mailsac.com', 'trashmail.com', 'trashmail.me', 'trashmail.net',
  'trashmail.org', 'trashymail.com', 'trashymail.net', 'fakeinbox.com',
  'tempinbox.com', 'tempmailaddress.com', 'getairmail.com', 'getnada.com',
  'mohmal.com', 'discard.email', 'discardmail.com', 'discardmail.de',
  'harakirimail.com', 'mailcatch.com', 'meltmail.com', 'mintemail.com',
  'mytemp.email', 'mytrashmail.com', 'spambox.us', 'spamgourmet.com',
  'tempr.email', 'tempsky.com', 'wegwerfmail.de', 'wegwerfmail.net',
  'einrot.com', 'emailondeck.com', 'emailfake.com', 'crazymailing.com',
  'mailforspam.com', 'safetymail.info', 'filzmail.com', 'spamfree24.org',
  'jetable.org', 'link2mail.net', 'trash-mail.at', 'mailexpire.com',
  'deadaddress.com', 'sogetthis.com', 'mailinater.com', 'trbvm.com',
  'mailnator.com', 'binkmail.com', 'bobmail.info', 'chammy.info',
  'devnullmail.com', 'spamevader.com', 'mytempemail.com', 'incognitomail.org',
  'mailtemp.info', 'tempomail.fr', 'tempmails.net',
  // 10minutemail and variants
  '10minutemail.com', '10minutemail.co.za', '10minutemail.de',
  '10minutemail.net', '10minmail.com', '10mail.org', '20minutemail.com',
  // Guerrilla variants
  'guerrillamailblock.com', 'spam4.me', 'grr.la',
  // Burner variants
  'burnermail.io', 'burnmail.info',
  // Mailnesia etc
  'mailnesia.com', 'mailtothis.com', 'mailzilla.com', 'nwldx.com',
  // Russian disposable
  'mailru.com', 'cmail.net', 'emailresort.com',
  // Recent popular ones
  'tmpmail.net', 'tmpmail.org', 'tmails.net', 'moakt.com',
  'disbox.net', 'disbox.org', 'mailpoof.com', 'emkei.cz',
  'mailseal.de', 'inboxbear.com', 'dropmail.me',
  // catch-all pattern domains
  'sharklasers.com', 'spam4.me', 'grr.la', 'guerrillamail.info',
  'mailforspam.com', 'safetymail.info', 'trashmail.io',
]);

/**
 * Check if an email domain is a known disposable/temporary provider.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true; // no domain = reject
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Check if email has a plausible non-disposable domain.
 * Allows major providers + custom domains.
 */
export function isValidEmailDomain(email: string): boolean {
  return !isDisposableEmail(email);
}
