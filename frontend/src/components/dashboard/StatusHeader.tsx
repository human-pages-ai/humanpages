import { useTranslation } from 'react-i18next';
import { Profile, Job, ReviewStats } from './types';

interface Props {
  profile: Profile;
  jobs: Job[];
  reviewStats: ReviewStats | null;
  saving: boolean;
  onToggleAvailability: () => void;
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
}: Props) {
  const { t } = useTranslation();

  const completeness = computeProfileCompleteness(profile);
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
                <span className="flex items-center gap-1">
                  <span className="inline-block w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <span
                      className="block h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${completeness}%` }}
                    />
                  </span>
                  <span>{completeness}%</span>
                </span>
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
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${trustColor}`}>
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
    </div>
  );
}
