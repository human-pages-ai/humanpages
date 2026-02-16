import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Listing, ListingApplication } from './types';

function formatTimeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

interface Props {
  skills: string[];
}

export default function ListingsSection({ skills }: Props) {
  const { t } = useTranslation();
  const [matchingListings, setMatchingListings] = useState<Listing[]>([]);
  const [applications, setApplications] = useState<ListingApplication[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    // Load matching listings based on user skills
    if (skills.length > 0) {
      api.getListings({ skill: skills.slice(0, 3).join(','), limit: 6 })
        .then(data => setMatchingListings(data.listings))
        .catch(() => {})
        .finally(() => setLoadingListings(false));
    } else {
      api.getListings({ limit: 6 })
        .then(data => setMatchingListings(data.listings))
        .catch(() => {})
        .finally(() => setLoadingListings(false));
    }

    // Load user's applications
    api.getMyApplications()
      .then(setApplications)
      .catch(() => {})
      .finally(() => setLoadingApps(false));
  }, [skills]);

  const appStatusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    OFFERED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-gray-100 text-gray-600',
    WITHDRAWN: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-6">
      {/* Matching Listings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('listings.matching.title')}</h2>
            <p className="text-sm text-gray-500">{t('listings.matching.description')}</p>
          </div>
          <Link
            to="/listings"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            {t('listings.browse')} &rarr;
          </Link>
        </div>

        {loadingListings ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : matchingListings.length === 0 ? (
          <p className="text-sm text-gray-500">{t('listings.noListings')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {matchingListings.map(listing => (
              <Link
                key={listing.id}
                to={`/listings/${listing.id}`}
                className={`block p-4 rounded-lg border hover:shadow-md transition-shadow ${
                  listing.isPro ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-gray-900 text-sm line-clamp-1">{listing.title}</h3>
                  {listing.isPro && (
                    <span className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      PRO
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-green-600 mt-1">${listing.budgetUsdc} USDC</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  {listing.agent?.name && <span>{listing.agent.name}</span>}
                  <span>&middot;</span>
                  <span>{formatTimeUntil(listing.expiresAt)}</span>
                  {listing._count?.applications !== undefined && (
                    <>
                      <span>&middot;</span>
                      <span>{listing._count.applications} {t('listings.card.applicants')}</span>
                    </>
                  )}
                </div>
                {listing.requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {listing.requiredSkills.slice(0, 3).map(skill => (
                      <span key={skill} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {skill}
                      </span>
                    ))}
                    {listing.requiredSkills.length > 3 && (
                      <span className="text-xs text-gray-400">+{listing.requiredSkills.length - 3}</span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* My Applications */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('listings.myApplications.title')}</h2>

        {loadingApps ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : applications.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-3">{t('listings.myApplications.empty')}</p>
            <Link to="/listings" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              {t('listings.browse')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map(app => (
              <div key={app.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="min-w-0">
                  <Link
                    to={`/listings/${app.listingId}`}
                    className="font-medium text-gray-900 text-sm hover:text-blue-600 block truncate"
                  >
                    {app.listing?.title || 'Listing'}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    {app.listing?.agent?.name && <span>{app.listing.agent.name}</span>}
                    {app.listing?.budgetUsdc && (
                      <>
                        <span>&middot;</span>
                        <span className="text-green-600 font-medium">${app.listing.budgetUsdc}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${appStatusColor[app.status] || 'bg-gray-100 text-gray-600'}`}>
                    {t(`listings.myApplications.status.${app.status}`)}
                  </span>
                  {app.status === 'OFFERED' && app.jobId && (
                    <Link
                      to={`/jobs/${app.jobId}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-500"
                    >
                      {t('listings.myApplications.viewJob')}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
