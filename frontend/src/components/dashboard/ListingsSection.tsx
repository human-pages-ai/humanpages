import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
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

  // Edit pitch state
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editPitch, setEditPitch] = useState('');
  const [savingPitch, setSavingPitch] = useState(false);

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

  const startEditing = (app: ListingApplication) => {
    setEditingAppId(app.id);
    setEditPitch(app.pitch || '');
  };

  const cancelEditing = () => {
    setEditingAppId(null);
    setEditPitch('');
  };

  const savePitch = async (app: ListingApplication) => {
    if (!editPitch.trim()) {
      toast.error('Please enter a cover letter');
      return;
    }
    setSavingPitch(true);
    try {
      await api.updateListingApplication(app.listingId, editPitch.trim());
      // Update local state
      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, pitch: editPitch.trim() } : a)
      );
      setEditingAppId(null);
      setEditPitch('');
      toast.success('Cover letter saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSavingPitch(false);
    }
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
                className={`flex flex-col p-4 rounded-lg border hover:shadow-md transition-shadow ${
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
                <p className="text-lg font-bold text-green-600 mt-1">${listing.budgetUsdc}{listing.budgetFlexible && '+'}</p>
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
                <div className="mt-auto pt-2">
                  {listing.requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
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
                </div>
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
              <div key={app.id} className="p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
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

                {/* Cover letter / pitch section */}
                {(app.status === 'PENDING' || app.status === 'PENDING_RECONFIRM') && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {editingAppId === app.id ? (
                      /* Editing mode */
                      <div>
                        <textarea
                          value={editPitch}
                          onChange={(e) => setEditPitch(e.target.value)}
                          placeholder="Tell them why you're a great fit for this role..."
                          rows={3}
                          maxLength={500}
                          autoFocus
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">{editPitch.length}/500</span>
                          <div className="flex gap-2">
                            <button
                              onClick={cancelEditing}
                              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => savePitch(app)}
                              disabled={savingPitch || !editPitch.trim()}
                              className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded disabled:opacity-50"
                            >
                              {savingPitch ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : app.pitch ? (
                      /* Has pitch — show it with edit button */
                      <div className="flex items-start gap-2">
                        <p className="text-xs text-gray-600 flex-1 line-clamp-2">{app.pitch}</p>
                        <button
                          onClick={() => startEditing(app)}
                          className="text-xs text-blue-600 hover:text-blue-500 font-medium shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    ) : (
                      /* No pitch — show CTA to add one */
                      <button
                        onClick={() => startEditing(app)}
                        className="text-xs text-blue-600 hover:text-blue-500 font-medium flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Add a cover letter to stand out
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
