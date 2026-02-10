import { Router, Request, Response } from 'express';

const router = Router();

// Country code → default language mapping
// For countries with multiple official languages, we list the primary one.
// The Accept-Language header is used to disambiguate (e.g., French Canada).
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  // Spanish-speaking countries
  MX: 'es', AR: 'es', CO: 'es', ES: 'es', PE: 'es', VE: 'es', CL: 'es',
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es',

  // Chinese-speaking
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh', SG: 'zh',

  // Filipino / Tagalog
  PH: 'tl',

  // Hindi-speaking
  IN: 'hi',

  // Vietnamese
  VN: 'vi',

  // Turkish
  TR: 'tr',

  // Thai
  TH: 'th',

  // French-speaking countries
  FR: 'fr', BE: 'fr', CH: 'fr', LU: 'fr', MC: 'fr',
  SN: 'fr', CI: 'fr', ML: 'fr', BF: 'fr', NE: 'fr', TD: 'fr',
  GN: 'fr', RW: 'fr', BJ: 'fr', TG: 'fr', CF: 'fr', CG: 'fr',
  CD: 'fr', CM: 'fr', GA: 'fr', DJ: 'fr', KM: 'fr', MG: 'fr',
  HT: 'fr', MQ: 'fr', GP: 'fr', RE: 'fr', GF: 'fr', NC: 'fr', PF: 'fr',

  // Portuguese-speaking countries
  BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',
};

// Countries with multiple major languages where Accept-Language should disambiguate
const MULTILINGUAL_COUNTRIES: Record<string, string[]> = {
  CA: ['en', 'fr'],       // Canada: English or French
  BE: ['fr', 'en'],       // Belgium: French, Dutch (→ English fallback), German
  CH: ['fr', 'en'],       // Switzerland: French, German (→ English fallback), Italian
  SG: ['zh', 'en'],       // Singapore: Chinese, English, Malay, Tamil
  IN: ['hi', 'en'],       // India: Hindi, English, many others
  PH: ['tl', 'en'],       // Philippines: Filipino, English
};

const SUPPORTED_LANGUAGES = ['en', 'es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th', 'fr', 'pt'];

/**
 * Parse Accept-Language header and return the first language code that we support.
 * e.g., "fr-CA,fr;q=0.9,en-US;q=0.8,en;q=0.7" → "fr"
 */
function getPreferredFromAcceptLanguage(acceptLanguage: string | undefined): string | null {
  if (!acceptLanguage) return null;

  const entries = acceptLanguage.split(',').map(entry => {
    const [lang, qPart] = entry.trim().split(';');
    const q = qPart ? parseFloat(qPart.replace('q=', '')) : 1;
    return { lang: lang.trim().toLowerCase(), q };
  }).sort((a, b) => b.q - a.q);

  for (const { lang } of entries) {
    // Try exact match first (e.g., "fr")
    if (SUPPORTED_LANGUAGES.includes(lang)) return lang;
    // Try base language (e.g., "fr-CA" → "fr")
    const base = lang.split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(base)) return base;
  }

  return null;
}

function getClientIp(req: Request): string {
  // Trust proxy is set, so req.ip should be correct
  const ip = req.ip || req.socket.remoteAddress || '';
  // Strip IPv6 prefix from IPv4-mapped addresses
  return ip.replace(/^::ffff:/, '');
}

interface IpApiResponse {
  status: string;
  countryCode?: string;
  country?: string;
}

// Simple in-memory cache to avoid hammering ip-api.com
const cache = new Map<string, { language: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * GET /api/geo/language
 *
 * Detects the user's preferred language based on their IP address country.
 * Uses ip-api.com (free, no API key, handles regional variants).
 * Falls back to Accept-Language header for multilingual countries (e.g., Canada).
 */
router.get('/language', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);

    // For localhost / private IPs, fall back to Accept-Language
    if (!clientIp || clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('192.168.') || clientIp.startsWith('10.')) {
      const fromHeader = getPreferredFromAcceptLanguage(req.headers['accept-language']);
      return res.json({ language: fromHeader || 'en', source: 'accept-language' });
    }

    // Check cache
    const cached = cache.get(clientIp);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({ language: cached.language, source: 'cache' });
    }

    // Call ip-api.com (free tier: 45 req/min, no key needed)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      `http://ip-api.com/json/${clientIp}?fields=status,countryCode,country`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const fromHeader = getPreferredFromAcceptLanguage(req.headers['accept-language']);
      return res.json({ language: fromHeader || 'en', source: 'accept-language' });
    }

    const data = await response.json() as IpApiResponse;

    if (data.status !== 'success' || !data.countryCode) {
      const fromHeader = getPreferredFromAcceptLanguage(req.headers['accept-language']);
      return res.json({ language: fromHeader || 'en', source: 'accept-language' });
    }

    const countryCode = data.countryCode.toUpperCase();
    let language: string;

    // Check if this is a multilingual country
    if (MULTILINGUAL_COUNTRIES[countryCode]) {
      const acceptLangPref = getPreferredFromAcceptLanguage(req.headers['accept-language']);
      const options = MULTILINGUAL_COUNTRIES[countryCode];
      // If their browser preference matches one of the country's languages, use it
      if (acceptLangPref && options.includes(acceptLangPref)) {
        language = acceptLangPref;
      } else {
        // Default to the first option for that country
        language = options[0];
      }
    } else {
      language = COUNTRY_TO_LANGUAGE[countryCode] || 'en';
    }

    // Ensure the language is in our supported list
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      language = 'en';
    }

    // Cache the result
    cache.set(clientIp, { language, timestamp: Date.now() });

    // Clean old cache entries periodically (keep max 10k entries)
    if (cache.size > 10000) {
      const now = Date.now();
      for (const [key, value] of cache) {
        if (now - value.timestamp > CACHE_TTL) cache.delete(key);
      }
    }

    return res.json({ language, country: countryCode, source: 'ip' });
  } catch (error) {
    // On any error, gracefully fall back to Accept-Language
    const fromHeader = getPreferredFromAcceptLanguage(req.headers['accept-language']);
    return res.json({ language: fromHeader || 'en', source: 'accept-language' });
  }
});

export default router;
