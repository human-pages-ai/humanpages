import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Job, ReviewStats } from './types';

interface Props {
  jobs: Job[];
  jobsLoading: boolean;
  jobFilter: 'all' | 'pending' | 'active' | 'completed';
  setJobFilter: (v: 'all' | 'pending' | 'active' | 'completed') => void;
  reviewStats: ReviewStats | null;
  profileId: string;
  profileUsername?: string;
}

export default function JobsSection({
  jobs,
  jobsLoading,
  jobFilter,
  setJobFilter,
  reviewStats,
  profileId,
  profileUsername,
}: Props) {
  const { t, i18n } = useTranslation();
  const [copiedProfileUrl, setCopiedProfileUrl] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const JOBS_PER_PAGE = 10;

  const handleCopyProfileUrl = () => {
    const url = profileUsername
      ? `${window.location.origin}/u/${profileUsername}`
      : `${window.location.origin}/humans/${profileId}`;
    navigator.clipboard.writeText(url);
    setCopiedProfileUrl(true);
    setTimeout(() => setCopiedProfileUrl(false), 2000);
  };

  const getFilteredJobs = () => {
    switch (jobFilter) {
      case 'pending':
        return jobs.filter(j => j.status === 'PENDING');
      case 'active':
        return jobs.filter(j => ['ACCEPTED', 'PAID'].includes(j.status));
      case 'completed':
        return jobs.filter(j => j.status === 'COMPLETED');
      default:
        return jobs;
    }
  };

  const getStatusBadge = (status: Job['status']) => {
    const styles: Record<Job['status'], string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      ACCEPTED: 'bg-blue-100 text-blue-700',
      REJECTED: 'bg-gray-100 text-gray-700',
      PAID: 'bg-green-100 text-green-700',
      COMPLETED: 'bg-purple-100 text-purple-700',
      CANCELLED: 'bg-gray-100 text-gray-700',
      DISPUTED: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{t('dashboard.jobs.title')}</h2>
          {reviewStats && (
            <p className="text-gray-600 text-sm">
              {t('dashboard.jobs.stats', { completed: reviewStats.completedJobs, reviews: reviewStats.totalReviews })} ·
              {reviewStats.averageRating > 0
                ? ` ${t('dashboard.jobs.avgRating', { rating: reviewStats.averageRating.toFixed(1) })}`
                : ` ${t('dashboard.jobs.noRatings')}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'pending', 'active', 'completed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setJobFilter(filter)}
              className={`px-3 py-1 text-sm rounded-md ${
                jobFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(`dashboard.jobs.${filter}`)}
            </button>
          ))}
        </div>
      </div>

      {jobsLoading ? (
        <p className="text-gray-500 text-sm" role="status" aria-label="Loading">{t('common.loading')}</p>
      ) : getFilteredJobs().length === 0 ? (
        <div className="text-center py-12">
          {jobFilter === 'all' ? (
            <div className="flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-lg font-medium text-gray-900 mb-1">{t('dashboard.jobs.emptyTitle')}</p>
                <p className="text-sm text-gray-500 mb-4">{t('dashboard.jobs.emptyDescription')}</p>
              </div>
              <button
                onClick={handleCopyProfileUrl}
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors flex items-center gap-2"
              >
                {copiedProfileUrl ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('common.copied')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {t('dashboard.jobs.copyProfileUrl')}
                  </>
                )}
              </button>
            </div>
          ) : (
            <p className="text-gray-500">
              {t('dashboard.jobs.noJobsFiltered', { filter: t(`dashboard.jobs.${jobFilter}`) })}
            </p>
          )}
        </div>
      ) : (() => {
        const filtered = getFilteredJobs();
        const totalPages = Math.ceil(filtered.length / JOBS_PER_PAGE);
        const currentPage = Math.min(page, totalPages);
        const paginatedJobs = filtered.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE);

        return (
        <>
        <div className="space-y-2">
          {paginatedJobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="block border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <h3 className="font-medium truncate">{job.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getStatusBadge(job.status)}`}>
                    {t(`dashboard.jobs.status.${job.status}`)}
                  </span>
                  {(job.updateCount ?? 0) > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700 font-medium">
                      {t('dashboard.jobs.updated')}
                    </span>
                  )}
                  {(job._count?.messages ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {job._count!.messages}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <span className="font-medium text-green-600 text-sm">${job.priceUsdc}</span>
                  {job.registeredAgent ? (
                    <span className="text-xs text-gray-500 hidden sm:inline">{job.registeredAgent.name}</span>
                  ) : job.agentName ? (
                    <span className="text-xs text-gray-500 hidden sm:inline">{job.agentName}</span>
                  ) : null}
                  <span className="text-xs text-gray-400 hidden sm:inline">
                    {new Date(job.createdAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.previous')}
            </button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next')}
            </button>
          </div>
        )}
        </>
        );
      })()}
    </div>
  );
}
