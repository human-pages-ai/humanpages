import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import { api } from '../lib/api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import SEO from '../components/SEO';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <SEO title="Reset Password" noindex />
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('auth.resetSent')}</h1>
            <p className="mt-4 text-gray-600">
              {email}
            </p>
          </div>
          <Link
            to="/login"
            className="inline-block text-blue-600 hover:text-blue-500"
          >
            {t('common.back')} {t('auth.signIn')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <SEO title="Reset Password" noindex />
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center"><Link to="/"><Logo size="lg" /></Link></h1>
          <h2 className="mt-2 text-center text-xl text-gray-600">{t('auth.resetPassword')}</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t('common.email')}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
{loading ? (
              <span role="status" aria-label="Loading">{t('auth.sending')}</span>
            ) : (
              t('auth.sendResetLink')
            )}
          </button>
          <p className="text-center text-sm text-gray-600">
            <Link to="/login" className="text-blue-600 hover:text-blue-500">
              {t('common.back')} {t('auth.signIn')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
