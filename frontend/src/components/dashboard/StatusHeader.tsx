import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile, Job, ReviewStats } from './types';

interface CompletionItem {
  labelKey: string;
  complete: boolean;
  weight: number;
}

interface Props {
  profile: Profile;
  jobs: Job[];
  reviewStats: ReviewStats | null;
  saving: boolean;
  onToggleAvailability: () => void;
  onCompleteProfile?: (field?: string) => void;
  onAddService?: () => void;
  onScrollToWallets?: () => void;
}

function computeProfileCompleteness(profile: Profile): number {
  const items = [
    { complete: Boolean(profile.name?.trim()), weight: 15 },
    { complete: Boolean(profile.bio?.trim()), weight: 15 },
    { complete: Boolean(profile.location?.trim()), weight: 15 },
    { complete: Boolean(profile.contactEmail?.trim()), weight: 15 },
    { complete: profile.skills?.length > 0, weight: 15 },
    { complete: profile.services?.some(s => s.isActive) ?? false, weight: 15 },
    { complete: profile.wallets.length > 0, weight: 10 },
  ];
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  const completedWeight = items.reduce((sum, i) => sum + (i.complete ? i.weight : 0), 0);
  return Math.round((completedWeight / totalWeight) * 100);
}

export default function StatusHeader({
  profile,
  jobs,
  reviewStats,
  saving,
  onToggleAvailability,
  onCompleteProfile,
  onAddService,
  onScrollToWallets,
}: Props) {
  const { t } = useTranslation();
  const completeness = computeProfileCompleteness(profile);
  const [showChecklist, setShowChecklist] = useState(completeness < 50);

  const completionItems: CompletionItem[] = [
    { labelKey: 'name', complete: Boolean(profile.name?.trim()), weight: 15 },
    { labelKey: 'bio', complete: Boolean(profile.bio?.trim()), weight: 15 },
    { labelKey: 'location', complete: Boolean(profile.location?.trim()), weight: 15 },
    { labelKey: 'contactEmail', complete: Boolean(profile.contactEmail?.trim()), weight: 15 },
    { labelKey: 'skills', complete: profile.skills?.length > 0, weight: 15 },
    { labelKey: 'services', complete: profile.services?.some(s => s.isActive) ?? false, weight: 15 },
    { labelKey: 'paymentInfo', complete: profile.wallets.length > 0, weight: 10 },
  ];

  const getLabel = (key: string): string => {
    const labels: Record<string, string> = {
      name: t('common.name'),
      bio: t('dashboard.profile.bio'),
      location: t('dashboard.profile.location'),
      contactEmail: t('dashboard.profile.contactEmail'),
      skills: t('dashboard.profile.skills'),
      services: t('dashboard.services.title'),
      paymentInfo: t('dashboard.profile.paymentInfo'),
    };
    return labels[key] || key;
  };

  const fieldIdMap: Record<string, string> = {
    name: 'profile-name',
    bio: 'profile-bio',
    location: 'profile-location',
    contactEmail: 'profile-contact-email',
    skills: 'profile-skills',
  };

  const handleItemClick = (item: CompletionItem) => {
    if (item.labelKey === 'services') {
      onAddService?.();
    } else if (item.labelKey === 'paymentInfo') {
      onScrollToWallets?.();
    } else {
      onCompleteProfile?.(fieldIdMap[item.labelKey]);
    }
    setShowChecklist(false);
  };
  const pendingJobs = jobs.filter(j => j.status === 'PENDING').length;

  return (
    <div className="space-y-0">
      <div className="bg-white rounded-lg shadow p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: name + quick stats */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Avatar circle */}
            <div className="shrink-0 w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold">
              {profile.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{profile.name || t('common.unnamed')}</h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-0.5">
                {reviewStats && reviewStats.completedJobs > 0 && (
                  <span>{reviewStats.completedJobs} {t('dashboard.jobs.status.COMPLETED').toLowerCase()} · {reviewStats.averageRating.toFixed(1)}★</span>
                )}
                {profile.wallets.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {profile.wallets.length} {profile.wallets.length === 1 ? 'wallet' : 'wallets'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: status indicators + availability toggle */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Pending jobs badge */}
            {pendingJobs > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {pendingJobs} pending
              </span>
            )}

            {/* Referral credits */}
            {profile.referralProgram && profile.referralProgram.totalCredits > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"
                title={t('dashboard.referralAvailableCredits')}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {profile.referralProgram.totalCredits}
              </span>
            )}

            {/* Availability toggle */}
            <button
              data-testid="status-availability"
              onClick={onToggleAvailability}
              disabled={saving}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
                profile.isAvailable
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {profile.isAvailable ? t('dashboard.workStatus.active') : t('dashboard.workStatus.paused')}
            </button>
          </div>
        </div>
      </div>

      {/* Prominent completion banner */}
      {completeness < 100 && (
        <div className="bg-blue-600 rounded-lg shadow mt-3 p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setShowChecklist(!showChecklist)}
            className="w-full"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">{t('onboarding.title')}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-100">{completeness}%</span>
                <svg className={`w-4 h-4 text-blue-200 transition-transform ${showChecklist ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className="w-full h-2.5 bg-blue-400/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
          </button>

          {/* Expandable completion checklist */}
          {showChecklist && (
            <div className="mt-4 pt-3 border-t border-blue-500/40">
              <ul className="space-y-2">
                {completionItems.map((item) => (
                  <li key={item.labelKey} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {item.complete ? (
                        <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" strokeWidth={2} />
                        </svg>
                      )}
                      <span className={item.complete ? 'text-blue-300 line-through' : 'text-white'}>
                        {getLabel(item.labelKey)}
                      </span>
                      <span className="text-xs text-blue-300">+{item.weight}%</span>
                    </span>
                    {!item.complete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                        className="text-white hover:text-blue-200 text-xs font-medium bg-blue-500 hover:bg-blue-400 px-2.5 py-1 rounded-full transition-colors"
                      >
                        {t('common.add')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
