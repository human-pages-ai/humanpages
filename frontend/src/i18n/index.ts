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
 * (LanguageDetector is NOT attached so nothing can override it).
 * Otherwise, falls back to LanguageDetector: path → navigator → htmlTag.
 *
 * Safe to call multiple times — only the first call takes effect.
 */
export function initI18n(geoLanguage?: string | null) {
  if (i18n.isInitialized) {
    // Already initialized (e.g., HMR or module re-import).
    // If geo language differs from current, switch to it.
    if (geoLanguage && supportedCodes.includes(geoLanguage) && i18n.language !== geoLanguage) {
      i18n.changeLanguage(geoLanguage);
    }
    return;
  }

  // Only use geoLanguage if it's one of our supported languages
  const lng = geoLanguage && supportedCodes.includes(geoLanguage) ? geoLanguage : undefined;

  // When we have a definitive language from geo/user-choice, skip LanguageDetector entirely.
  // LanguageDetector can override the explicit `lng` option during init, so we only attach it
  // as a fallback when no geo language is available.
  const instance = i18n.use(initReactI18next);
  if (!lng) {
    instance.use(LanguageDetector);
  }

  instance.init({
    ...(lng ? { lng } : {}),

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
      // Only used when LanguageDetector is attached (no geo language).
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

  // Keep <html lang> in sync with the current i18n language.
  // When LanguageDetector is skipped (geo language provided), the htmlTag
  // cacher isn't active, so we must set it ourselves.
  const syncHtmlLang = (lang: string) => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  };
  syncHtmlLang(i18n.language);
  i18n.on('languageChanged', syncHtmlLang);
}

export default i18n;
