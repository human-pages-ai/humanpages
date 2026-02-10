import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { AffiliateResponse } from '../../lib/api';
import { analytics } from '../../lib/analytics';
import { posthog } from '../../lib/posthog';

interface Props {
  profileUsername?: string;
}

export default function AffiliateSection({ profileUsername }: Props) {
  const { i18n } = useTranslation();
  const [data, setData] = useState<AffiliateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [applyForm, setApplyForm] = useState({
    code: profileUsername || '',
    promotionMethod: '',
    website: '',
    audience: '',
  });
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    loadAffiliate();
  }, []);

  const loadAffiliate = async () => {
    try {
      const resp = await api.getAffiliateDashboard();
      setData(resp);
    } catch {
      setData({ enrolled: false });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyError('');
    try {
      await api.applyAffiliate({
        code: applyForm.code,
        promotionMethod: applyForm.promotionMethod || undefined,
        website: applyForm.website || undefined,
        audience: applyForm.audience || undefined,
      });
      posthog.capture('affiliate_applied' as string);
      analytics.track('affiliate_applied');
      await loadAffiliate();
      setShowApplyForm(false);
    } catch (error: any) {
      setApplyError(error.message || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-2/3" />
        </div>
      </div>
    );
  }

  // Not enrolled — show CTA
  if (!data?.enrolled) {
    return (
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 sm:p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-lg font-semibold">Partner Program</h2>
          </div>
          <p className="text-emerald-100 text-sm mb-1">
            Earn credits for every person you refer who completes their profile.
          </p>
          <p className="text-emerald-200 text-xs">
            Single-tier, no recruitment bonuses. Earn on product usage only.
          </p>
        </div>

        {!showApplyForm ? (
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-lg font-bold text-emerald-600">10</div>
                <div className="text-xs text-slate-500">credits / signup</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-lg font-bold text-emerald-600">+50</div>
                <div className="text-xs text-slate-500">at 10 referrals</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-lg font-bold text-emerald-600">+500</div>
                <div className="text-xs text-slate-500">at 100 referrals</div>
              </div>
            </div>
            <button
              onClick={() => setShowApplyForm(true)}
              className="w-full px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Join Partner Program
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Your referral code *
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 shrink-0">{window.location.origin}/signup?partner=</span>
                <input
                  type="text"
                  value={applyForm.code}
                  onChange={(e) => setApplyForm({ ...applyForm, code: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                  placeholder="your-code"
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  maxLength={30}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                How will you promote? (optional)
              </label>
              <textarea
                value={applyForm.promotionMethod}
                onChange={(e) => setApplyForm({ ...applyForm, promotionMethod: e.target.value })}
                placeholder="Social media, blog, newsletter, etc."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                rows={2}
                maxLength={500}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Website / social link (optional)
              </label>
              <input
                type="url"
                value={applyForm.website}
                onChange={(e) => setApplyForm({ ...applyForm, website: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            {applyError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                {applyError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                disabled={applying || !applyForm.code}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? 'Applying...' : 'Apply'}
              </button>
              <button
                onClick={() => setShowApplyForm(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const { affiliate, milestones, referrals, creditLedger } = data;
  if (!affiliate) return null;

  const affiliateUrl = `${window.location.origin}/signup?partner=${affiliate.code}`;

  // Status banner for non-approved
  if (affiliate.status === 'PENDING') {
    return (
      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-yellow-800 mb-1">Partner Application Pending</h2>
        <p className="text-sm text-yellow-700">Your application is under review. We'll notify you once it's approved.</p>
      </div>
    );
  }

  if (affiliate.status === 'REJECTED') {
    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-1">Application Not Approved</h2>
        <p className="text-sm text-red-700">{affiliate.rejectedReason || 'Your application was not approved. Contact support for details.'}</p>
      </div>
    );
  }

  if (affiliate.status === 'SUSPENDED') {
    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-1">Partner Account Suspended</h2>
        <p className="text-sm text-red-700">{affiliate.suspendedReason || 'Your partner account has been suspended. Contact support.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main affiliate dashboard */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h2 className="text-lg font-semibold">Partner Dashboard</h2>
            </div>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {affiliate.creditsPerReferral} credits/signup
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{affiliate.totalClicks}</div>
              <div className="text-xs text-emerald-100">Clicks</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{affiliate.totalSignups}</div>
              <div className="text-xs text-emerald-100">Signups</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{affiliate.qualifiedSignups}</div>
              <div className="text-xs text-emerald-100">Qualified</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{affiliate.totalCredits}</div>
              <div className="text-xs text-emerald-100">Credits Earned</div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Referral link */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Your partner link</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono truncate">
                {affiliateUrl}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(affiliateUrl);
                  setCopiedLink(true);
                  analytics.track('affiliate_link_copy');
                  posthog.capture('affiliate_link_copied');
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="shrink-0 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {copiedLink ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Credits summary */}
          <div className="flex items-center justify-between py-3 border-t border-slate-100">
            <div>
              <div className="text-sm text-slate-500">Available credits</div>
              <div className="text-lg font-bold text-slate-900">{affiliate.availableCredits}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500">Total earned</div>
              <div className="text-lg font-bold text-emerald-600">{affiliate.totalCredits}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Milestones */}
      {milestones && milestones.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Milestone Bonuses</h3>
          <div className="space-y-3">
            {milestones.map((m, i) => (
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
                      {m.threshold} referrals &mdash; {m.bonus} bonus credits
                    </span>
                    <span className="text-xs text-slate-500">
                      {affiliate.qualifiedSignups}/{m.threshold}
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
      {referrals && referrals.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent Referrals</h3>
          <div className="space-y-2">
            {referrals.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${r.qualified ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  <span className="text-sm text-slate-700">{r.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {r.qualified && (
                    <span className="text-xs font-medium text-emerald-600">+{r.creditsAwarded} credits</span>
                  )}
                  {!r.qualified && (
                    <span className="text-xs text-slate-400">Pending profile</span>
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
      {creditLedger && creditLedger.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Credit History</h3>
          <div className="space-y-2">
            {creditLedger.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <span className="text-sm text-slate-700">+{c.credits} credits</span>
                  {c.description && <span className="text-xs text-slate-400 ml-2">{c.description}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.type === 'referral' ? 'bg-emerald-100 text-emerald-700' :
                    c.type.startsWith('bonus') ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {c.type === 'referral' ? 'Referral' : 'Bonus'}
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
