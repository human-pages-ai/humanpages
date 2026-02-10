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
  const [showChecklist, setShowChecklist] = useState(false);

  const completionItems: CompletionItem[] = [
    { labelKey: 'name', complete: Boolean(profile.name?.trim()), weight: 15 },
    { labelKey: 'bio', complete: Boolean(profile.bio?.trim()), weight: 15 },
    { labelKey: 'location', complete: Boolean(profile.location?.trim()), weight: 15 },
    { labelKey: 'contactEmail', complete: Boolean(profile.contactEmail?.trim()), weight: 15 },
    { labelKey: 'skills', complete: profile.skills?.length > 0, weight: 15 },
    { labelKey: 'services', complete: profile.services?.some(s => s.isActive) ?? false, weight: 15 },
    { labelKey: 'paymentInfo', complete: profile.wallets.length > 0, weight: 10 },
  ];

  const completeness = computeProfileCompleteness(profile);

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
  const trustScore = profile.trustScore?.score;
  const trustLevel = profile.trustScore?.level;

  const trustColor =
    trustLevel === 'trusted' ? 'text-green-700 bg-green-100' :
    trustLevel === 'verified' ? 'text-blue-700 bg-blue-100' :
    'text-gray-700 bg-gray-100';

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: name + quick stats */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatar circle */}
          <div className="shrink-0 w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-semibold">
            {profile.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{profile.name || t('common.unnamed')}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-0.5">
              {completeness < 100 && (
                <button
                  type="button"
                  onClick={() => setShowChecklist(!showChecklist)}
                  className="flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <span className="inline-block w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <span
                      className="block h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${completeness}%` }}
                    />
                  </span>
                  <span>{completeness}%</span>
                  <svg className={`w-3 h-3 transition-transform ${showChecklist ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
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

          {/* Trust score */}
          {trustScore !== undefined && (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${trustColor}`}
              aria-label={t('dashboard.trustScoreLabel', { score: trustScore })}
            >
              {trustScore}%
            </span>
          )}

          {/* Availability toggle */}
          <button
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

      {/* Expandable completion checklist */}
      {completeness < 100 && showChecklist && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.title')}</p>
          <ul className="space-y-1.5">
            {completionItems.map((item) => (
              <li key={item.labelKey} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {item.complete ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    </svg>
                  )}
                  <span className={item.complete ? 'text-gray-400 line-through' : 'text-gray-700'}>
                    {getLabel(item.labelKey)}
                  </span>
                  <span className="text-xs text-gray-400">+{item.weight}%</span>
                </span>
                {!item.complete && (
                  <button
                    onClick={() => handleItemClick(item)}
                    className="text-indigo-600 hover:text-indigo-500 text-xs font-medium"
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
  );
}
