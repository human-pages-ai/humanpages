import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';

export default function Welcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
      analytics.identify(data.id);
    } catch (error) {
      console.error('Failed to load profile:', error);
      navigate('/login');
    }
  };

  const getProfileUrl = () => {
    const baseUrl = window.location.origin;
    if (profile?.username) {
      return `${baseUrl}/humans/${profile.username}`;
    }
    return `${baseUrl}/humans/${profile?.id}`;
  };

  const copyProfileLink = async () => {
    const url = getProfileUrl();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    analytics.track('profile_share_copy');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnTwitter = () => {
    const url = getProfileUrl();
    const text = t('welcome.shareText');
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank'
    );
    analytics.track('profile_share_click', { platform: 'twitter' });
  };

  const shareOnLinkedIn = () => {
    const url = getProfileUrl();
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      '_blank'
    );
    analytics.track('profile_share_click', { platform: 'linkedin' });
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-500">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Main Message */}
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          {t('welcome.profileLive')}
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          {t('welcome.subtitle')}
        </p>

        {/* Profile Card Preview */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {profile.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="text-left">
              <h2 className="text-xl font-semibold text-slate-900">{profile.name}</h2>
              {profile.location && (
                <p className="text-slate-500">{profile.location}</p>
              )}
            </div>
          </div>

          {profile.skills?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {profile.skills.slice(0, 5).map((skill: string) => (
                <span
                  key={skill}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
              {profile.skills.length > 5 && (
                <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-sm">
                  {t('welcome.more', { count: profile.skills.length - 5 })}
                </span>
              )}
            </div>
          )}

          <div className="text-sm text-slate-500 font-mono bg-slate-50 rounded-lg px-3 py-2 truncate">
            {getProfileUrl()}
          </div>
        </div>

        {/* Share Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={copyProfileLink}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('welcome.linkCopied')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {t('welcome.copyLink')}
              </>
            )}
          </button>

          <div className="flex gap-3">
            <button
              onClick={shareOnTwitter}
              className="flex-1 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              {t('welcome.shareOnX')}
            </button>
            <button
              onClick={shareOnLinkedIn}
              className="flex-1 py-3 bg-[#0077B5] text-white font-semibold rounded-lg hover:bg-[#006699] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              {t('welcome.shareOnLinkedIn')}
            </button>
          </div>
        </div>

        {/* Add to Bio Tip */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">{t('welcome.bioTipTitle')}</h3>
              <p className="text-sm text-amber-800 mb-3">{t('welcome.bioTipDesc')}</p>
              <div className="flex flex-wrap gap-2">
                {['LinkedIn', 'X / Twitter', 'GitHub', 'Instagram'].map((platform) => (
                  <span key={platform} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-200 rounded-full text-xs font-medium text-amber-800">
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Add a Service CTA */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">{t('welcome.addServiceTitle')}</h3>
              <p className="text-sm text-blue-800 mb-3">{t('welcome.addServiceDesc')}</p>
              <button
                onClick={() => navigate('/dashboard?addService=1')}
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                {t('welcome.addServiceBtn')}
              </button>
            </div>
          </div>
        </div>

        {/* Skip to Dashboard */}
        <button
          onClick={goToDashboard}
          className="text-slate-600 hover:text-slate-800 font-medium"
        >
          {t('welcome.goToDashboard')}
        </button>
      </div>
    </div>
  );
}
