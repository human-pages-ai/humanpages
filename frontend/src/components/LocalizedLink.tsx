import { Link as RouterLink, LinkProps } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SEO_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/dev$/,
  /^\/humans\/.+$/,
  /^\/signup$/,
  /^\/blog(\/.*)?$/,
  /^\/privacy$/,
  /^\/terms$/,
];

function isLocalizedRoute(pathname: string): boolean {
  return SEO_ROUTE_PATTERNS.some(pattern => pattern.test(pathname));
}

function prefixPath(path: string, lang: string): string {
  if (lang === 'en' || !isLocalizedRoute(path)) return path;
  if (path === '/') return `/${lang}`;
  return `/${lang}${path}`;
}

export default function LocalizedLink({ to, ...props }: LinkProps) {
  const { i18n } = useTranslation();

  if (typeof to === 'string') {
    return <RouterLink to={prefixPath(to, i18n.language)} {...props} />;
  }

  if (typeof to === 'object' && to.pathname) {
    return <RouterLink to={{ ...to, pathname: prefixPath(to.pathname, i18n.language) }} {...props} />;
  }

  return <RouterLink to={to} {...props} />;
}
