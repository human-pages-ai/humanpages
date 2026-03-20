import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../lib/analytics';
import { getProfileUrl } from '../../lib/profileUrl';
import { Profile } from './types';

interface Props {
  profile: Profile;
  copiedProfile: boolean;
  setCopiedProfile: (v: boolean) => void;
}

export default function ShareReferralSection({
  profile,
  copiedProfile,
  setCopiedProfile,
}: Props) {
  const { t } = useTranslation();
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [copiedVouch, setCopiedVouch] = useState(false);

  const profileUrl = getProfileUrl({ username: profile.username, id: profile.id });
  const referralUrl = `${window.location.origin}/signup?ref=${profile.referralCode}`;
  const vouchUrl = `${window.location.origin}/vouch/${profile.username || profile.id}`;
  const rp = profile.referralProgram;

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
        <div className="mt-3 flex items-center gap-2">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-xs text-blue-600 hover:text-blue-800 font-mono bg-slate-50 rounded px-3 py-1.5 truncate underline decoration-slate-300 hover:decoration-blue-400"
          >
            {profileUrl}
          </a>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {t('dashboard.viewPublic', 'View public')}
          </a>
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

      {/* Ask for Vouches */}
      <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ask for vouches</h2>
            <p className="text-slate-500 text-sm">Share this link so people who know you can vouch for your work</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(vouchUrl);
              setCopiedVouch(true);
              analytics.track('vouch_link_copy');
              setTimeout(() => setCopiedVouch(false), 2000);
            }}
            className="shrink-0 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            {copiedVouch ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('common.copied')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Copy vouch link
              </>
            )}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 text-xs text-slate-600 font-mono bg-slate-50 rounded px-3 py-1.5 truncate">
            {vouchUrl}
          </div>
        </div>
      </div>

      {/* Invite Friends */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 sm:p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-lg font-semibold">Invite friends</h2>
          </div>
          <p className="text-emerald-100 text-sm">Help people you trust get discovered by AI agents</p>

          {/* Stats — only show when user has referrals (hide zeros) */}
          {rp && rp.totalSignups > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{rp.totalSignups}</div>
                <div className="text-xs text-emerald-100">People invited</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{rp.qualifiedSignups}</div>
                <div className="text-xs text-emerald-100">Completed profiles</div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Invite link */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Your invite link</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono truncate">
                {referralUrl}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralUrl);
                  setCopiedReferral(true);
                  analytics.track('referral_link_copy');
                  setTimeout(() => setCopiedReferral(false), 2000);
                }}
                className="shrink-0 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {copiedReferral ? t('common.copied') : t('dashboard.copyReferralLink')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent referrals — only show when there are some */}
      {rp && rp.referrals.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">People you invited</h3>
          <div className="space-y-2">
            {rp.referrals.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${r.qualified ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  <span className="text-sm text-slate-700">{r.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {r.qualified && (
                    <span className="text-xs font-medium text-emerald-600">Profile complete</span>
                  )}
                  {!r.qualified && (
                    <span className="text-xs text-slate-400">{t('dashboard.referralPendingProfile')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
