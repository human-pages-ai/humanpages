import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import en from './locales/en/translation.json';
import es from './locales/es/translation.json';
import zh from './locales/zh/translation.json';
import tl from './locales/tl/translation.json';
import hi from './locales/hi/translation.json';
import vi from './locales/vi/translation.json';
import tr from './locales/tr/translation.json';
import th from './locales/th/translation.json';
import fr from './locales/fr/translation.json';
import pt from './locales/pt/translation.json';

export const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'tl', name: 'Filipino', flag: '🇵🇭' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
] as const;

export type SupportedLanguage = typeof supportedLanguages[number]['code'];

const supportedCodes: string[] = supportedLanguages.map(l => l.code);

/**
 * Initialize i18next with an optional pre-resolved language from IP geolocation.
 * If geoLanguage is provided and valid, it's used as the initial language
 * (skipping detection). Otherwise, falls back to path → navigator → htmlTag.
 *
 * Safe to call multiple times — only the first call takes effect.
 */
export function initI18n(geoLanguage?: string | null) {
  if (i18n.isInitialized) return;

  // Only use geoLanguage if it's one of our supported languages
  const lng = geoLanguage && supportedCodes.includes(geoLanguage) ? geoLanguage : undefined;

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      ...(lng ? { lng } : {}), // If we have a geo language, set it explicitly (skips detection)

      resources: {
        en: { translation: en },
        es: { translation: es },
        fr: { translation: fr },
        pt: { translation: pt },
        zh: { translation: zh },
        tl: { translation: tl },
        hi: { translation: hi },
        vi: { translation: vi },
        tr: { translation: tr },
        th: { translation: th },
      },
      fallbackLng: 'en',
      supportedLngs: supportedCodes,

      detection: {
        // Only used when lng is not set above.
        // path: URL prefix (e.g., /es/blog) for SEO pages
        // navigator: browser's Accept-Language
        // htmlTag: <html lang="..."> fallback
        order: ['path', 'navigator', 'htmlTag'],
        lookupFromPathIndex: 0,
        caches: [],  // Don't auto-cache; IP detector & language picker handle persistence
      },

      interpolation: {
        escapeValue: false, // React already escapes
      },

      react: {
        useSuspense: false,
      },
    });
}

export default i18n;
