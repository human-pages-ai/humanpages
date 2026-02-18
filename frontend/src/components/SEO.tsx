import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
  path?: string;
  lang?: string;
}

const SITE_NAME = 'Human Pages';
const DEFAULT_DESCRIPTION = "Stop chasing clients. List your skills and let AI bring them to you.";
const SITE_URL = 'https://humanpages.ai';
const DEFAULT_OG_IMAGE = `${SITE_URL}/api/og/default`;

function getLangUrl(langCode: string, pagePath: string): string {
  if (langCode === 'en') return `${SITE_URL}${pagePath}`;
  return `${SITE_URL}/${langCode}${pagePath}`;
}

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  noindex = false,
  jsonLd,
  path,
  lang
}: SEOProps) {
  const { i18n } = useTranslation();
  const currentLang = lang || i18n.language || 'en';
  const pageTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — AI's Hiring. Are You Listed?`;
  const ogTitle = title ? `${title} | ${SITE_NAME}` : "AI's Hiring. Are You Listed?";
  const canonicalUrl = canonical || (path ? getLangUrl(currentLang, path) : SITE_URL);

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* hreflang tags */}
      {path && (
        <>
          <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${path}`} />
          {supportedLanguages.map(l => (
            <link key={l.code} rel="alternate" hrefLang={l.code} href={getLangUrl(l.code, path)} />
          ))}
        </>
      )}

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
