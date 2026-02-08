import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../lib/analytics';
import { posthog } from '../../lib/posthog';
import { api } from '../../lib/api';
import { Profile } from './types';

interface Props {
  profile: Profile;
  copiedProfile: boolean;
  setCopiedProfile: (v: boolean) => void;
  copiedReferral: boolean;
  setCopiedReferral: (v: boolean) => void;
}

export default function ShareReferralSection({
  profile,
  copiedProfile,
  setCopiedProfile,
  copiedReferral,
  setCopiedReferral,
}: Props) {
  const { t, i18n } = useTranslation();
  const [referrals, setReferrals] = useState<Array<{ id: string; name: string; createdAt: string }>>([]);
  const [referralCount, setReferralCount] = useState(profile.referralCount || 0);

  useEffect(() => {
    api.getReferrals()
      .then((data) => {
        setReferralCount(data.count);
        setReferrals(data.referrals);
      })
      .catch(() => {});
  }, []);

  const profileUrl = `${window.location.origin}/humans/${profile.username || profile.id}`;
  const referralUrl = `${window.location.origin}/signup?ref=${profile.id}`;

  return (
    <div className="space-y-4">
      {/* Share Profile */}
      <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.shareProfile')}</h2>
            <p className="text-slate-500 text-sm">{t('dashboard.shareProfileDesc')}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(profileUrl);
              setCopiedProfile(true);
              analytics.track('profile_share_copy');
              posthog.capture('profile_link_copied');
              setTimeout(() => setCopiedProfile(false), 2000);
            }}
            aria-label={copiedProfile ? t('common.copied') : t('dashboard.copyProfileLink')}
            className="shrink-0 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            {copiedProfile ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span aria-live="polite">{t('common.copied')}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {t('dashboard.copyProfileLink')}
              </>
            )}
          </button>
        </div>
        <div className="mt-3 text-xs text-slate-400 font-mono bg-slate-50 rounded px-3 py-1.5 truncate">
          {profileUrl}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Link
            to="/badge"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {t('dashboard.getBadge')}
          </Link>
        </div>
      </div>

      {/* Referral Program */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg shadow p-4 sm:p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-lg font-semibold">{t('dashboard.referralProgram')}</h2>
            </div>
            <p className="text-amber-100 text-sm mb-2">{t('dashboard.referralProgramDesc')}</p>
            <p className="text-xs text-amber-200">{t('dashboard.referralReward')}</p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => {
                navigator.clipboard.writeText(referralUrl);
                setCopiedReferral(true);
                analytics.track('referral_link_copy');
                posthog.capture('referral_link_copied');
                setTimeout(() => setCopiedReferral(false), 2000);
              }}
              aria-label={copiedReferral ? t('common.copied') : t('dashboard.copyReferralLink')}
              className="px-4 py-2 bg-white text-amber-700 font-medium rounded-lg hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
            >
              {copiedReferral ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span aria-live="polite">{t('common.copied')}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  {t('dashboard.copyReferralLink')}
                </>
              )}
            </button>
            {referralCount > 0 && (
              <div className="text-center px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium">
                {t('dashboard.referrals', { count: referralCount })}
              </div>
            )}
          </div>
        </div>

        {referrals.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <h3 className="text-sm font-medium text-amber-100 mb-2">
              {t('dashboard.yourReferrals')} ({referralCount})
            </h3>
            <div className="space-y-1">
              {referrals.slice(0, 5).map((r) => (
                <div key={r.id} className="flex justify-between text-sm">
                  <span>{r.name}</span>
                  <span className="text-amber-200">
                    {new Date(r.createdAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              ))}
              {referrals.length > 5 && (
                <p className="text-xs text-amber-200">{t('dashboard.moreReferrals', { count: referrals.length - 5 })}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
