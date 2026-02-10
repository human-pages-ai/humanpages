import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { supportedLanguages, SupportedLanguage } from '../i18n';
import { setUserLanguageChoice } from '../i18n/ipLanguageDetector';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

const NON_LANG_CODES = new Set<string>(supportedLanguages.map(l => l.code));

/** SEO routes that get language-prefixed URLs */
const SEO_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/dev$/,
  /^\/humans\/.+$/,
  /^\/signup$/,
  /^\/blog(\/.*)?$/,
  /^\/privacy$/,
  /^\/terms$/,
];

/** Strip any existing lang prefix from a pathname */
function stripLangPrefix(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (match && NON_LANG_CODES.has(match[1]) && match[1] !== 'en') {
    return match[2] || '/';
  }
  return pathname;
}

/** Check if a path (unprefixed) is a localizable SEO route */
function isLocalizedRoute(pathname: string): boolean {
  return SEO_ROUTE_PATTERNS.some(pattern => pattern.test(pathname));
}

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = supportedLanguages.find(
    (lang) => lang.code === i18n.language
  ) || supportedLanguages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (code: SupportedLanguage) => {
    setUserLanguageChoice(code); // Prevent IP detection from overriding manual choice
    i18n.changeLanguage(code);
    setIsOpen(false);

    // Navigate to lang-prefixed URL if on a SEO page
    const strippedPath = stripLangPrefix(location.pathname);
    if (isLocalizedRoute(strippedPath)) {
      if (code === 'en') {
        navigate(strippedPath + location.search + location.hash);
      } else {
        navigate(`/${code}${strippedPath === '/' ? '' : strippedPath}${location.search}${location.hash}`);
      }
    }

    // Sync language preference to backend if user is logged in
    if (user) {
      api.updateProfile({ preferredLanguage: code }).catch(() => {
        // Silently fail - UI language already changed
      });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Select language"
      >
        <span className="text-lg">{currentLanguage.flag}</span>
        <span className="hidden sm:inline text-gray-700">{currentLanguage.name}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 py-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {supportedLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                lang.code === i18n.language ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.name}</span>
              {lang.code === i18n.language && (
                <svg className="w-4 h-4 ml-auto text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
