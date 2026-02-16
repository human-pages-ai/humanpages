import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../lib/analytics';
import { posthog } from '../../lib/posthog';
import { Profile } from './types';

interface Props {
  profile: Profile;
  copiedProfile: boolean;
  setCopiedProfile: (v: boolean) => void;
}

function getCurrentTier(qualifiedSignups: number) {
  if (qualifiedSignups >= 100) return { name: 'Tier 3', color: 'text-amber-600', bg: 'bg-amber-100' };
  if (qualifiedSignups >= 50) return { name: 'Tier 2', color: 'text-purple-600', bg: 'bg-purple-100' };
  if (qualifiedSignups >= 10) return { name: 'Tier 1', color: 'text-emerald-600', bg: 'bg-emerald-100' };
  return { name: 'Starter', color: 'text-slate-600', bg: 'bg-slate-100' };
}

export default function ShareReferralSection({
  profile,
  copiedProfile,
  setCopiedProfile,
}: Props) {
  const { t, i18n } = useTranslation();
  const [copiedReferral, setCopiedReferral] = useState(false);

  const profileUrl = profile.username
    ? `${window.location.origin}/u/${profile.username}`
    : `${window.location.origin}/humans/${profile.id}`;
  const referralUrl = `${window.location.origin}/signup?ref=${profile.referralCode}`;
  const rp = profile.referralProgram;
  const tier = rp ? getCurrentTier(rp.qualifiedSignups) : null;

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
            className="shrink-0 px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
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

      {/* Referral Program */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h2 className="text-lg font-semibold">{t('dashboard.referralProgram')}</h2>
            </div>
            {tier && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.bg} ${tier.color}`}>
                {tier.name}
              </span>
            )}
          </div>
          <p className="text-emerald-100 text-sm">{t('dashboard.referralProgramDesc')}</p>

          {/* Stats grid — only if user has referrals */}
          {rp && rp.totalSignups > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{rp.totalSignups}</div>
                <div className="text-xs text-emerald-100">{t('dashboard.referralSignups')}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{rp.qualifiedSignups}</div>
                <div className="text-xs text-emerald-100">{t('dashboard.referralQualified')}</div>
                <div className="text-xs text-emerald-200/60 mt-0.5">{t('dashboard.referralQualifiedHint')}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{rp.totalCredits}</div>
                <div className="text-xs text-emerald-100">{t('dashboard.referralCreditsEarned')}</div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Referral link */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('dashboard.referralYourLink')}</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono truncate">
                {referralUrl}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralUrl);
                  setCopiedReferral(true);
                  analytics.track('referral_link_copy');
                  posthog.capture('referral_link_copied');
                  setTimeout(() => setCopiedReferral(false), 2000);
                }}
                className="shrink-0 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {copiedReferral ? t('common.copied') : t('dashboard.copyReferralLink')}
              </button>
            </div>
          </div>

          {/* Credit tiers preview (always visible) */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-lg font-bold text-emerald-600">10</div>
              <div className="text-xs text-slate-500">{t('dashboard.referralCreditsPerSignup')}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-lg font-bold text-emerald-600">+50</div>
              <div className="text-xs text-slate-500">{t('dashboard.referralBonusAt10')}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-lg font-bold text-emerald-600">+500</div>
              <div className="text-xs text-slate-500">{t('dashboard.referralBonusAt100')}</div>
            </div>
          </div>

          {/* Available credits (if any) */}
          {rp && rp.totalCredits > 0 && (
            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <div>
                <div className="text-sm text-slate-500">{t('dashboard.referralAvailableCredits')}</div>
                <div className="text-lg font-bold text-slate-900">{rp.availableCredits}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">{t('dashboard.referralTotalEarned')}</div>
                <div className="text-lg font-bold text-emerald-600">{rp.totalCredits}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      {rp && rp.milestones.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('dashboard.referralMilestones')}</h3>
          <div className="space-y-3">
            {rp.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.reached ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {m.reached ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">{m.threshold}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">
                      {m.threshold} {t('dashboard.referralMilestoneReferrals')} &mdash; {m.bonus} {t('dashboard.referralMilestoneBonusCredits')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {rp.qualifiedSignups}/{m.threshold}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${m.reached ? 'bg-emerald-500' : 'bg-emerald-300'}`}
                      style={{ width: `${Math.min(m.progress * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent referrals */}
      {rp && rp.referrals.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('dashboard.referralRecentReferrals')}</h3>
          <div className="space-y-2">
            {rp.referrals.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${r.qualified ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  <span className="text-sm text-slate-700">{r.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {r.qualified && (
                    <span className="text-xs font-medium text-emerald-600">+{r.creditsAwarded} {t('dashboard.referralCredits')}</span>
                  )}
                  {!r.qualified && (
                    <span className="text-xs text-slate-400">{t('dashboard.referralPendingProfile')}</span>
                  )}
                  <span className="text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credit history */}
      {rp && rp.creditLedger.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('dashboard.referralCreditHistory')}</h3>
          <div className="space-y-2">
            {rp.creditLedger.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <span className="text-sm text-slate-700">+{c.credits} {t('dashboard.referralCredits')}</span>
                  {c.description && <span className="text-xs text-slate-400 ml-2">{c.description}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.type === 'referral' ? 'bg-emerald-100 text-emerald-700' :
                    c.type.startsWith('bonus') ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {c.type === 'referral' ? t('dashboard.referralTypeReferral') : t('dashboard.referralTypeBonus')}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
