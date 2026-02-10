import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { Profile } from './types';

interface Props {
  profile: Profile;
  onProfileUpdate: (profile: Profile) => void;
}

export default function LinkedInSection({ profile, onProfileUpdate }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { url, state } = await api.getLinkedInVerifyUrl();
      sessionStorage.setItem('linkedin_verify_state', state);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || t('toast.genericError'));
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnectLinkedin();
      onProfileUpdate({ ...profile, linkedinVerified: false });
      toast.success(t('toast.linkedinDisconnected'));
    } catch (err: any) {
      toast.error(err.message || t('toast.genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('dashboard.linkedin.title')}</h2>
            <p className="text-gray-600 text-sm">
              {profile.linkedinVerified
                ? t('dashboard.linkedin.connectedDesc')
                : t('dashboard.linkedin.notConnected')}
            </p>
          </div>
        </div>
        {profile.linkedinVerified ? (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 disabled:opacity-50"
          >
            {t('dashboard.linkedin.connected')}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-4 py-2 bg-[#0A66C2] text-white rounded-lg font-medium hover:bg-[#004182] disabled:opacity-50"
          >
            {loading ? t('auth.redirecting') : t('dashboard.linkedin.connect')}
          </button>
        )}
      </div>
    </div>
  );
}
