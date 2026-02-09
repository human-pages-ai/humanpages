import React from 'react';
import { useTranslation } from 'react-i18next';
import { Job, ReviewStats } from './types';

interface Props {
  jobs: Job[];
  jobsLoading: boolean;
  jobFilter: 'all' | 'pending' | 'active' | 'completed';
  setJobFilter: (v: 'all' | 'pending' | 'active' | 'completed') => void;
  reviewStats: ReviewStats | null;
  onAcceptJob: (id: string) => void;
  onRejectJob: (id: string) => void;
  onCompleteJob: (id: string) => void;
  profileId: string;
  profileUsername?: string;
}

export default function JobsSection({
  jobs,
  jobsLoading,
  jobFilter,
  setJobFilter,
  reviewStats,
  onAcceptJob,
  onRejectJob,
  onCompleteJob,
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
                  ? 'bg-indigo-600 text-white'
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
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
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
        <div className="space-y-4">
          {paginatedJobs.map((job) => (
            <div key={job.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{job.title}</h3>
                    <span role="status" className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(job.status)}`}>
                      {t(`dashboard.jobs.status.${job.status}`)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{job.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="font-medium text-green-600">${job.priceUsdc} USDC</span>
                    {job.registeredAgent ? (
                      <span className="flex items-center gap-1.5">
                        <span>{t('dashboard.jobs.from')}: {job.registeredAgent.name}</span>
                        {job.registeredAgent.domainVerified && (
                          <span
                            className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full"
                            title={job.registeredAgent.websiteUrl ? new URL(job.registeredAgent.websiteUrl).hostname : 'Verified'}
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Verified
                          </span>
                        )}
                        {job.registeredAgent.websiteUrl && (
                          <a
                            href={job.registeredAgent.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 text-xs"
                          >
                            {new URL(job.registeredAgent.websiteUrl).hostname}
                          </a>
                        )}
                      </span>
                    ) : job.agentName ? (
                      <span>{t('dashboard.jobs.from')}: {job.agentName}</span>
                    ) : null}
                    {job.category && <span className="bg-gray-100 px-2 py-0.5 rounded">{job.category}</span>}
                    <span>{new Date(job.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>

                  {job.review && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500" aria-hidden="true">{'★'.repeat(job.review.rating)}{'☆'.repeat(5 - job.review.rating)}</span>
                        <span className="sr-only">Rated {job.review.rating} out of 5 stars</span>
                        <span className="text-sm text-gray-600">{t('dashboard.jobs.reviewReceived')}</span>
                      </div>
                      {job.review.comment && (
                        <p className="text-sm text-gray-700 mt-1">"{job.review.comment}"</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  {job.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => onAcceptJob(job.id)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                      >
                        {t('dashboard.jobs.accept')}
                      </button>
                      <button
                        onClick={() => onRejectJob(job.id)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                      >
                        {t('dashboard.jobs.reject')}
                      </button>
                    </>
                  )}
                  {job.status === 'PAID' && (
                    <button
                      onClick={() => onCompleteJob(job.id)}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
                    >
                      {t('dashboard.jobs.markComplete')}
                    </button>
                  )}
                  {job.status === 'ACCEPTED' && (
                    <span className="text-sm text-blue-600">{t('dashboard.jobs.awaitingPayment')}</span>
                  )}
                </div>
              </div>
            </div>
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
