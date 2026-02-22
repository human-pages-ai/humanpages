import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import SEO from '../components/SEO';

export default function EmailVerified() {
  const { t } = useTranslation();

  return (
    <>
      <SEO title={t('emailVerifiedPage.title')} />
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <Logo className="h-8 mx-auto" />
          <div className="bg-white rounded-lg shadow-sm border p-8 space-y-4">
            <div className="text-5xl">&#10003;</div>
            <h1 className="text-2xl font-bold text-gray-900">{t('emailVerifiedPage.title')}</h1>
            <p className="text-gray-600">{t('emailVerifiedPage.message')}</p>
            <Link
              to="/dashboard"
              className="inline-block mt-4 bg-black text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              {t('emailVerifiedPage.goToDashboard')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
