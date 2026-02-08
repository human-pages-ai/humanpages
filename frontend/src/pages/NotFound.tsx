import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import SEO from '../components/SEO';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <SEO title="Page Not Found" noindex />
      <div className="text-center max-w-md px-4">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t('notFound.title')}</h2>
        <p className="text-gray-600 mb-6">{t('notFound.message')}</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {t('notFound.goHome')}
        </Link>
      </div>
    </main>
  );
}
