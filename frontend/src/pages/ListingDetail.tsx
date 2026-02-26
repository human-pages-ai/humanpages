import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import SEO from '../components/SEO';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Listing } from '../components/dashboard/types';
import Footer from '../components/Footer';
import ReportAgentModal from '../components/ReportAgentModal';

function formatTimeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default function ListingDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [pitch, setPitch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadListing();
    }
  }, [id]);

  const loadListing = async () => {
    setLoading(true);
    try {
      const data = await api.getListing(id!);
      setListing(data);
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!pitch.trim()) {
      toast.error('Please enter a pitch');
      return;
    }
    if (pitch.length > 500) {
      toast.error('Pitch must be 500 characters or less');
      return;
    }

    setSubmitting(true);
    try {
      await api.applyToListing(id!, pitch.trim());
      toast.success(t('listings.detail.applicationSubmitted'));
      setPitch('');
      await loadListing(); // Reload to update application status
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {t('common.loading')}
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Listing not found</p>
        <Link to="/listings" className="text-blue-600 hover:text-blue-800">
          {t('common.back')} to listings
        </Link>
      </div>
    );
  }

  const isExpired = new Date(listing.expiresAt) <= new Date();
  const isClosed = listing.status !== 'OPEN' || isExpired;
  const hasApplied = listing.hasApplied || !!listing.myApplication;
  const canApply = user && !hasApplied && !isClosed;

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={listing.title}
        description={listing.description?.substring(0, 160)}
        path={`/listings/${listing.id}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": listing.title,
          "description": listing.description,
          "datePosted": listing.createdAt,
          "validThrough": listing.expiresAt,
          ...(listing.location && {
            "jobLocation": {
              "@type": "Place",
              "address": listing.location
            }
          }),
          ...(listing.workMode && {
            "jobLocationType": listing.workMode === 'REMOTE' ? "TELECOMMUTE" : undefined
          }),
          ...(listing.budgetUsdc && {
            "baseSalary": {
              "@type": "MonetaryAmount",
              "currency": "USD",
              "value": listing.budgetUsdc
            }
          }),
          "hiringOrganization": {
            "@type": "Organization",
            "name": listing.agent?.name || "AI Agent",
            ...(listing.agent?.domainVerified && { "url": `https://humanpages.ai/agents/${listing.agent.id}` })
          },
          "employmentType": "TEMPORARY",
          ...(listing.requiredSkills?.length > 0 && {
            "skills": listing.requiredSkills.join(", ")
          })
        }}
      />

      {/* Nav bar */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="whitespace-nowrap">
            <Link to="/"><Logo /></Link>
          </h1>
          <div className="flex items-center gap-4 whitespace-nowrap">
            <LanguageSwitcher />
            {user ? (
              <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
                {t('nav.dashboard')}
              </Link>
            ) : (
              <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          to="/listings"
          className="text-sm text-blue-600 hover:text-blue-800 mb-6 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('common.back')} to listings
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Left column - Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main card */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Cover image */}
              {listing.imageUrl && (
                <img
                  src={listing.imageUrl}
                  alt={listing.title}
                  className="w-full h-56 object-cover"
                />
              )}

              <div className="p-6">
              {/* PRO badge */}
              {listing.isPro && (
                <div className="mb-3">
                  <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded">
                    {t('listings.card.proAgent')}
                  </span>
                </div>
              )}

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                {listing.title}
              </h1>

              {/* Budget */}
              <div className="mb-6">
                <p className="text-3xl font-bold text-green-600">
                  ${listing.budgetUsdc}{listing.budgetFlexible && '+'}
                </p>
                {listing.budgetFlexible && (
                  <p className="text-sm text-gray-500 mt-1">Budget is negotiable</p>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Description
                </h2>
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {listing.description}
                </p>
              </div>

              {/* Requirements section */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {t('listings.detail.requirements')}
                </h2>

                {/* Required skills */}
                {listing.requiredSkills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      {t('listings.detail.skills')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {listing.requiredSkills.map((skill, idx) => (
                        <span key={idx} className="inline-block bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Required equipment */}
                {listing.requiredEquipment.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      {t('listings.detail.equipment')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {listing.requiredEquipment.map((item, idx) => (
                        <span key={idx} className="inline-block bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Location */}
                {listing.location && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {t('listings.detail.location')}
                    </p>
                    <p className="text-gray-800">
                      {listing.location}
                      {listing.radiusKm && ` (${listing.radiusKm}km radius)`}
                    </p>
                  </div>
                )}

                {/* Work mode */}
                {listing.workMode && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {t('listings.detail.workMode')}
                    </p>
                    <p className="text-gray-800">
                      {listing.workMode === 'REMOTE' && t('listings.filters.remote')}
                      {listing.workMode === 'ONSITE' && t('listings.filters.onsite')}
                      {listing.workMode === 'HYBRID' && t('listings.filters.hybrid')}
                    </p>
                  </div>
                )}
              </div>

              {/* Expiry and applicant count */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div>
                    <span className="font-medium">{t('listings.detail.expiresAt')}:</span>{' '}
                    {formatTimeUntil(listing.expiresAt)}
                  </div>
                  <div>
                    <span className="font-medium">{t('listings.detail.applicants')}:</span>{' '}
                    {listing._count?.applications || 0}
                  </div>
                </div>
              </div>
              </div>{/* close p-6 wrapper */}
            </div>

            {/* Apply section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('listings.detail.applyNow')}
              </h2>

              {/* Not logged in */}
              {!user && (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-4">{t('listings.detail.loginToApply')}</p>
                  <Link
                    to="/login"
                    className="inline-block bg-blue-600 text-white font-medium py-2 px-6 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {t('nav.login')}
                  </Link>
                </div>
              )}

              {/* Already applied */}
              {user && hasApplied && listing.myApplication && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    {t('listings.detail.alreadyApplied')}
                  </p>
                  <p className="text-sm text-gray-700 mb-1">
                    <span className="font-medium">Status:</span>{' '}
                    {t(`listings.myApplications.status.${listing.myApplication.status}`)}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Your pitch:</span> {listing.myApplication.pitch}
                  </p>
                </div>
              )}

              {/* Listing closed */}
              {user && !hasApplied && isClosed && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    {t('listings.detail.listingClosed')}
                  </p>
                </div>
              )}

              {/* Apply form */}
              {canApply && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('listings.detail.yourPitch')}
                  </label>
                  <textarea
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    placeholder={t('listings.detail.pitchPlaceholder')}
                    rows={4}
                    maxLength={500}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      {pitch.length}/500 characters
                    </span>
                    <button
                      onClick={handleApply}
                      disabled={submitting || !pitch.trim()}
                      className="bg-blue-600 text-white font-medium py-2 px-6 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? t('listings.detail.submitting') : t('listings.detail.submitApplication')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column - Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Agent card */}
            {listing.agent && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  {t('listings.detail.postedBy')}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{listing.agent.name}</p>
                    {listing.agent.domainVerified && (
                      <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    )}
                  </div>
                  {listing.agent.description && (
                    <p className="text-sm text-gray-600">{listing.agent.description}</p>
                  )}
                  {listing.isPro && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                      PRO Agent - High reputation
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Agent reputation */}
            {listing.agentReputation && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  {t('listings.detail.agentReputation')}
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {listing.agentReputation.completedJobs}
                    </p>
                    <p className="text-xs text-gray-500">{t('listings.detail.jobsCompleted')}</p>
                  </div>
                  {listing.agentReputation.avgRating > 0 && (
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">
                          {'★'.repeat(Math.round(listing.agentReputation.avgRating))}
                        </span>
                        <span className="text-sm text-gray-600">
                          {listing.agentReputation.avgRating.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{t('listings.detail.avgRating')}</p>
                    </div>
                  )}
                  {listing.agentReputation.avgPaymentSpeedHours !== null && (
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {listing.agentReputation.avgPaymentSpeedHours}h
                      </p>
                      <p className="text-xs text-gray-500">{t('listings.detail.avgPaymentSpeed')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Report link (logged-in only) */}
            {user && listing.agent && (
              <button
                onClick={() => setShowReportModal(true)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                {t('reportAgent.reportThis', 'Report this listing')}
              </button>
            )}
          </div>
        </div>
      </main>

      <Footer className="mt-12" />

      {listing.agent && (
        <ReportAgentModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          agentId={listing.agent.id}
          agentName={listing.agent.name}
        />
      )}
    </div>
  );
}
