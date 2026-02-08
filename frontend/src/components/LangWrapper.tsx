import { useEffect } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';
import NotFound from '../pages/NotFound';

const supportedCodes = supportedLanguages.map(l => l.code);

export default function LangWrapper({ children }: { children: React.ReactNode }) {
  const { lang } = useParams<{ lang: string }>();
  const { i18n } = useTranslation();
  const location = useLocation();

  const isValid = lang && supportedCodes.includes(lang as typeof supportedCodes[number]);

  useEffect(() => {
    if (isValid && lang !== 'en' && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n, isValid]);

  // Redirect /en/* to unprefixed path
  if (lang === 'en') {
    const unprefixedPath = location.pathname.replace(/^\/en/, '') || '/';
    return <Navigate to={unprefixedPath + location.search + location.hash} replace />;
  }

  // Invalid language code — show 404
  if (!isValid) {
    return <NotFound />;
  }

  return <>{children}</>;
}
