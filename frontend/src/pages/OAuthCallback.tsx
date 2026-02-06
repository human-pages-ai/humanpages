import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';

export default function OAuthCallback() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { provider } = useParams<{ provider: string }>();
  const navigate = useNavigate();

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

    if (!provider || !['google', 'github'].includes(provider)) {
      setError('Invalid OAuth provider');
      return;
    }

    // Get referrer ID if present
    const referrerId = localStorage.getItem('referrer_id') || undefined;

    // Exchange code for token
    api.oauthCallback(provider as 'google' | 'github', code, referrerId)
      .then(({ token, isNew }) => {
        localStorage.removeItem('referrer_id'); // Clean up after use
        localStorage.setItem('token', token);
        if (isNew) {
          analytics.track('signup_complete', { method: provider });
          // New users go to onboarding
          window.location.href = '/onboarding';
        } else {
          // Existing users go to dashboard
          window.location.href = '/dashboard';
        }
      })
      .catch((err) => {
        setError(err.message || 'Authentication failed');
      });
  }, [searchParams, provider, navigate]);

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
