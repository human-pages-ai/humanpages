import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';

export default function OAuthCallback() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [requiresTerms, setRequiresTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [oauthData, setOauthData] = useState<{
    provider: 'google' | 'linkedin';
    code: string;
    state: string;
    referrerId?: string;
  } | null>(null);
  const [searchParams] = useSearchParams();
  const { provider } = useParams<{ provider: string }>();
  const navigate = useNavigate();

  const completeOAuth = async (
    oauthProvider: 'google' | 'linkedin',
    code: string,
    state: string,
    referrerId?: string,
    termsAcceptedFlag?: boolean,
  ) => {
    const result = await api.oauthCallback(oauthProvider, code, state, referrerId, termsAcceptedFlag);

    if (result.requiresTerms) {
      setOauthData({ provider: oauthProvider, code, state, referrerId });
      setRequiresTerms(true);
      return;
    }

    localStorage.removeItem('referrer_id');
    localStorage.setItem('token', result.token);
    if (result.isNew) {
      analytics.track('signup_complete', { method: oauthProvider });
      window.location.href = '/onboarding';
    } else {
      window.location.href = '/dashboard';
    }
  };

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(searchParams.get('error_description') || 'Authentication was cancelled');
      return;
    }

    if (!code) {
      setError('No authorization code received');
      return;
    }

    if (!provider || !['google', 'linkedin'].includes(provider)) {
      setError('Invalid OAuth provider');
      return;
    }

    // Retrieve and consume the stored OAuth state
    const storedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');

    if (!storedState) {
      setError('OAuth state missing. Please try logging in again.');
      return;
    }

    const referrerId = localStorage.getItem('referrer_id') || undefined;

    completeOAuth(provider as 'google' | 'linkedin', code, storedState, referrerId)
      .catch((err) => {
        setError(err.message || 'Authentication failed');
      });
  }, [searchParams, provider]);

  const handleTermsAccept = async () => {
    if (!oauthData || !termsAccepted) return;
    setTermsLoading(true);
    try {
      await completeOAuth(oauthData.provider, oauthData.code, oauthData.state, oauthData.referrerId, true);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setRequiresTerms(false);
    } finally {
      setTermsLoading(false);
    }
  };

  if (requiresTerms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">{t('auth.acceptTermsTitle')}</h2>
            <p className="mt-2 text-gray-600">{t('auth.acceptTermsDesc')}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <div className="flex items-start">
              <input
                id="oauth-terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="h-4 w-4 mt-0.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="oauth-terms" className="ml-2 text-sm text-gray-600">
                {t('auth.agreeToTerms')}{' '}
                <Link to="/terms" target="_blank" className="text-indigo-600 hover:text-indigo-500">
                  {t('auth.termsOfUse')}
                </Link>{' '}
                {t('common.and')}{' '}
                <Link to="/privacy" target="_blank" className="text-indigo-600 hover:text-indigo-500">
                  {t('auth.privacyPolicy')}
                </Link>
              </label>
            </div>
            <button
              onClick={handleTermsAccept}
              disabled={!termsAccepted || termsLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {termsLoading ? t('auth.creatingAccount') : t('auth.continueSignUp')}
            </button>
          </div>
          <p className="text-center text-sm text-gray-500">
            <button onClick={() => navigate('/login')} className="text-indigo-600 hover:text-indigo-500">
              {t('auth.backToLogin')}
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-indigo-600 hover:text-indigo-500"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{t('auth.completingSignIn')}</p>
      </div>
    </div>
  );
}
