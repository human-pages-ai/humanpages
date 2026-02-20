import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import { api } from '../lib/api';
import { getApplyRedirect } from '../lib/applyIntent';

export default function LinkedInVerifyCallback() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(searchParams.get('error_description') || 'LinkedIn verification was cancelled');
      return;
    }

    if (!code) {
      setError('No authorization code received');
      return;
    }

    const storedState = sessionStorage.getItem('linkedin_verify_state');
    sessionStorage.removeItem('linkedin_verify_state');

    if (!storedState) {
      setError('Verification state missing. Please try again from the dashboard.');
      return;
    }

    api.linkedinVerifyCallback(code, storedState)
      .then(() => {
        const applyRedirect = getApplyRedirect();
        navigate(applyRedirect || '/dashboard?linkedinVerified=true', { replace: true });
      })
      .catch((err) => {
        setError(err.message || 'LinkedIn verification failed');
      });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
          <Link
            to="/dashboard"
            className="text-blue-600 hover:text-blue-500"
          >
            {t('jobDetail.backToDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{t('dashboard.linkedin.verifying', 'Verifying LinkedIn...')}</p>
      </div>
    </div>
  );
}
