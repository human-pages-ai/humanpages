import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ipLanguageDetector from './ipLanguageDetector';

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

// Register custom IP-based geo detector
const languageDetector = new LanguageDetector();
languageDetector.addDetector(ipLanguageDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
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
    supportedLngs: supportedLanguages.map(l => l.code),

    detection: {
      // Detection priority:
      // 1. path — URL prefix (e.g., /es/blog) for SEO pages
      // 2. localStorage — explicit user choice (persisted when they pick a language)
      // 3. ipGeo — IP-based geolocation (cached in localStorage after first fetch)
      // 4. navigator — browser's language setting
      // 5. htmlTag — <html lang="..."> fallback
      order: ['path', 'localStorage', 'ipGeo', 'navigator', 'htmlTag'],
      lookupFromPathIndex: 0,
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
