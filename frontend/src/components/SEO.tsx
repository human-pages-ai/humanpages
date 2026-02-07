import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
  path?: string;
}

const SITE_NAME = 'Human Pages';
const DEFAULT_DESCRIPTION = 'Find real humans for real-world tasks. AI agents and developers use Human Pages to discover people by skill and location.';
const SITE_URL = 'https://humanpages.ai';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  noindex = false,
  jsonLd,
  path
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - AI-to-Human Marketplace`;
  const canonicalUrl = canonical || SITE_URL;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* hreflang tags */}
      {path && (
        <>
          <link rel="alternate" hrefLang="x-default" href={`https://humanpages.ai${path}`} />
          <link rel="alternate" hrefLang="en" href={`https://humanpages.ai${path}`} />
          <link rel="alternate" hrefLang="es" href={`https://humanpages.ai${path}`} />
          <link rel="alternate" hrefLang="zh" href={`https://humanpages.ai${path}`} />
          <link rel="alternate" hrefLang="tl" href={`https://humanpages.ai${path}`} />
          <link rel="alternate" hrefLang="hi" href={`https://humanpages.ai${path}`} />
          <link rel="alternate" hrefLang="vi" href={`https://humanpages.ai${path}`} />
          <link rel="alternate" hrefLang="tr" href={`https://humanpages.ai${path}`} />
          <link rel="alternate" hrefLang="th" href={`https://humanpages.ai${path}`} />
        </>
      )}

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
