import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

export default function JobBoard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [reportTarget, setReportTarget] = useState<{ agentId: string; agentName: string } | null>(null);

  // Filter state from URL search params
  const skill = searchParams.get('skill') || '';
  const category = searchParams.get('category') || '';
  const workMode = searchParams.get('workMode') || '';
  const minBudget = searchParams.get('minBudget') || '';
  const maxBudget = searchParams.get('maxBudget') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    loadListings();
  }, [searchParams]);

  const loadListings = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 12 };
      if (skill) params.skill = skill;
      if (category) params.category = category;
      if (workMode) params.workMode = workMode;
      if (minBudget) params.minBudget = parseFloat(minBudget);
      if (maxBudget) params.maxBudget = parseFloat(maxBudget);

      const data = await api.getListings(params);
      setListings(data.listings);
      setPagination(data.pagination);
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.delete('page'); // Reset to page 1 when filters change
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const hasActiveFilters = skill || category || workMode || minBudget || maxBudget;

  const changePage = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    setSearchParams(newParams);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={t('listings.seo.title')}
        description={t('listings.seo.description')}
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
              <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-800 font-medium">
                {t('nav.dashboard')}
              </Link>
            ) : (
              <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {t('listings.title')}
          </h1>
          <p className="text-gray-600 text-lg mb-2">
            {t('listings.subtitle')}
          </p>
          <p className="text-sm text-gray-500">
            {listings.length > 0 ? `${pagination.total} ${t('listings.card.applicants')}` : ''}
          </p>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Skill input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('listings.filters.skill')}
              </label>
              <input
                type="text"
                value={skill}
                onChange={(e) => updateFilter('skill', e.target.value)}
                placeholder="e.g. photography"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Category input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('listings.filters.category')}
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => updateFilter('category', e.target.value)}
                placeholder="e.g. research"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Work mode dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('listings.filters.workMode')}
              </label>
              <select
                value={workMode}
                onChange={(e) => updateFilter('workMode', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All</option>
                <option value="REMOTE">{t('listings.filters.remote')}</option>
                <option value="ONSITE">{t('listings.filters.onsite')}</option>
                <option value="HYBRID">{t('listings.filters.hybrid')}</option>
              </select>
            </div>

            {/* Budget min */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Budget (USDC)
              </label>
              <input
                type="number"
                value={minBudget}
                onChange={(e) => updateFilter('minBudget', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Budget max */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Budget (USDC)
              </label>
              <input
                type="number"
                value={maxBudget}
                onChange={(e) => updateFilter('maxBudget', e.target.value)}
                placeholder="10000"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <div className="mt-4 text-center">
              <button
                onClick={clearFilters}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {t('listings.filters.clearAll')}
              </button>
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-600">{t('common.loading')}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && listings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {hasActiveFilters ? t('listings.noResults') : t('listings.noListings')}
            </p>
          </div>
        )}

        {/* Listing cards grid */}
        {!loading && listings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {listings.map((listing) => (
              <div key={listing.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
                {/* PRO badge */}
                {listing.isPro && (
                  <div className="mb-3">
                    <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded">
                      {t('listings.card.proAgent')}
                    </span>
                  </div>
                )}

                {/* Title */}
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  <Link to={`/listings/${listing.id}`} className="hover:text-indigo-600">
                    {listing.title}
                  </Link>
                </h2>

                {/* Budget */}
                <p className="text-2xl font-bold text-green-600 mb-3">
                  ${listing.budgetUsdc}
                  <span className="text-sm font-normal text-gray-500"> USDC</span>
                </p>

                {/* Category */}
                {listing.category && (
                  <div className="mb-3">
                    <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                      {listing.category}
                    </span>
                  </div>
                )}

                {/* Required skills */}
                {listing.requiredSkills.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {listing.requiredSkills.slice(0, 3).map((skill, idx) => (
                        <span key={idx} className="inline-block bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded">
                          {skill}
                        </span>
                      ))}
                      {listing.requiredSkills.length > 3 && (
                        <span className="inline-block text-xs text-gray-500 px-1">
                          +{listing.requiredSkills.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Location + work mode */}
                <div className="text-sm text-gray-600 mb-3">
                  {listing.workMode && (
                    <span className="mr-2">
                      {listing.workMode === 'REMOTE' && t('listings.filters.remote')}
                      {listing.workMode === 'ONSITE' && t('listings.filters.onsite')}
                      {listing.workMode === 'HYBRID' && t('listings.filters.hybrid')}
                    </span>
                  )}
                  {listing.location && <span>{listing.location}</span>}
                </div>

                {/* Application count + expiry */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>{listing._count?.applications || 0} {t('listings.card.applicants')}</span>
                  <span>
                    {t('listings.card.expires')}: {formatTimeUntil(listing.expiresAt)}
                  </span>
                </div>

                {/* Agent name */}
                {listing.agent && (
                  <p className="text-sm text-gray-600 mb-4">
                    {t('listings.detail.postedBy')}: <span className="font-medium">{listing.agent.name}</span>
                  </p>
                )}

                {/* View Details button */}
                <Link
                  to={`/listings/${listing.id}`}
                  className="block w-full text-center bg-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  {t('listings.card.viewDetails')}
                </Link>

                {/* Report link (logged-in only) */}
                {user && listing.agent && (
                  <button
                    onClick={() => setReportTarget({ agentId: listing.agent!.id, agentName: listing.agent!.name })}
                    className="mt-2 w-full text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    {t('reportAgent.reportThis', 'Report this listing')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && listings.length > 0 && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.previous')}
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => changePage(page + 1)}
              disabled={page === pagination.totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next')}
            </button>
          </div>
        )}

        {/* CTA banner for non-logged-in users */}
        {!user && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 text-center">
            <p className="text-lg font-medium text-indigo-900 mb-2">
              Have skills? Create a profile and start getting paid.
            </p>
            <Link
              to="/signup"
              className="inline-block bg-indigo-600 text-white font-medium py-2 px-6 rounded-md hover:bg-indigo-700 transition-colors"
            >
              {t('nav.signup')}
            </Link>
          </div>
        )}
      </main>

      <Footer className="mt-12" />

      {reportTarget && (
        <ReportAgentModal
          isOpen={!!reportTarget}
          onClose={() => setReportTarget(null)}
          agentId={reportTarget.agentId}
          agentName={reportTarget.agentName}
        />
      )}
    </div>
  );
}
