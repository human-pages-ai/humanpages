import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import ProfileCompleteness from '../components/ProfileCompleteness';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface Wallet {
  id: string;
  network: string;
  address: string;
  label?: string;
}

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  priceRange?: string;
  isActive: boolean;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  bio?: string;
  location?: string;
  locationLat?: number;
  locationLng?: number;
  skills: string[];
  contactEmail?: string;
  telegram?: string;
  isAvailable: boolean;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  wallets: Wallet[];
  services: Service[];
  referralCount?: number;
  minOfferPrice?: number;
  maxOfferDistance?: number;
  minRateUsdc?: number;
}

interface Job {
  id: string;
  agentId: string;
  agentName?: string;
  title: string;
  description: string;
  category?: string;
  priceUsdc: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PAID' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  createdAt: string;
  acceptedAt?: string;
  paidAt?: string;
  completedAt?: string;
  review?: {
    id: string;
    rating: number;
    comment?: string;
  };
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  completedJobs: number;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    bio: '',
    location: '',
    skills: '',
    contactEmail: '',
    telegram: '',
    linkedinUrl: '',
    twitterUrl: '',
    githubUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    websiteUrl: '',
  });

  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletForm, setWalletForm] = useState({ network: 'ethereum', address: '', label: '' });

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ title: '', description: '', category: '', priceRange: '' });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);

  const [copiedProfile, setCopiedProfile] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  const [telegramStatus, setTelegramStatus] = useState<{
    connected: boolean;
    botAvailable: boolean;
    botUsername?: string;
  } | null>(null);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);

  const [editingFilters, setEditingFilters] = useState(false);
  const [filtersForm, setFiltersForm] = useState({
    minOfferPrice: '',
    maxOfferDistance: '',
    minRateUsdc: '',
  });

  useEffect(() => {
    loadProfile();
    loadJobs();
    loadTelegramStatus();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
      setProfileForm({
        name: data.name || '',
        bio: data.bio || '',
        location: data.location || '',
        skills: data.skills?.join(', ') || '',
        contactEmail: data.contactEmail || '',
        telegram: data.telegram || '',
        linkedinUrl: data.linkedinUrl || '',
        twitterUrl: data.twitterUrl || '',
        githubUrl: data.githubUrl || '',
        instagramUrl: data.instagramUrl || '',
        youtubeUrl: data.youtubeUrl || '',
        websiteUrl: data.websiteUrl || '',
      });
      setFiltersForm({
        minOfferPrice: data.minOfferPrice?.toString() || '',
        maxOfferDistance: data.maxOfferDistance?.toString() || '',
        minRateUsdc: data.minRateUsdc?.toString() || '',
      });
      if (data.id) {
        try {
          const reviewData = await api.getMyReviews(data.id);
          setReviewStats(reviewData.stats);
        } catch (e) {
          console.error('Failed to load reviews:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    try {
      const data = await api.getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setJobsLoading(false);
    }
  };

  const loadTelegramStatus = async () => {
    try {
      const status = await api.getTelegramStatus();
      setTelegramStatus(status);
    } catch (error) {
      console.error('Failed to load Telegram status:', error);
    }
  };

  const connectTelegram = async () => {
    setTelegramLoading(true);
    try {
      const { linkUrl } = await api.linkTelegram();
      setTelegramLinkUrl(linkUrl);
      window.open(linkUrl, '_blank');
      const pollInterval = setInterval(async () => {
        const status = await api.getTelegramStatus();
        if (status.connected) {
          clearInterval(pollInterval);
          setTelegramStatus(status);
          setTelegramLinkUrl(null);
        }
      }, 3000);
      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
    } catch (error: any) {
      alert(error.message || 'Failed to generate Telegram link');
    } finally {
      setTelegramLoading(false);
    }
  };

  const disconnectTelegram = async () => {
    if (!confirm(t('dashboard.telegram.disconnect'))) return;
    try {
      await api.unlinkTelegram();
      setTelegramStatus({ connected: false, botAvailable: telegramStatus?.botAvailable || false });
    } catch (error: any) {
      alert(error.message || 'Failed to disconnect Telegram');
    }
  };

  const acceptJob = async (jobId: string) => {
    try {
      await api.acceptJob(jobId);
      await loadJobs();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const rejectJob = async (jobId: string) => {
    if (!confirm(t('dashboard.jobs.confirmReject'))) return;
    try {
      await api.rejectJob(jobId);
      await loadJobs();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const completeJob = async (jobId: string) => {
    try {
      await api.completeJob(jobId);
      await loadJobs();
      await loadProfile();
    } catch (error: any) {
      alert(error.message);
    }
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

  const toggleAvailability = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile({ isAvailable: !profile.isAvailable });
      setProfile(updated);
    } catch (error) {
      console.error('Failed to update availability:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        name: profileForm.name,
        bio: profileForm.bio || null,
        location: profileForm.location || null,
        skills: profileForm.skills.split(',').map(s => s.trim()).filter(Boolean),
        contactEmail: profileForm.contactEmail || null,
        telegram: profileForm.telegram || null,
        linkedinUrl: profileForm.linkedinUrl || null,
        twitterUrl: profileForm.twitterUrl || null,
        githubUrl: profileForm.githubUrl || null,
        instagramUrl: profileForm.instagramUrl || null,
        youtubeUrl: profileForm.youtubeUrl || null,
        websiteUrl: profileForm.websiteUrl || null,
      });
      setProfile(updated);
      setEditingProfile(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveFilters = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        minOfferPrice: filtersForm.minOfferPrice ? parseFloat(filtersForm.minOfferPrice) : null,
        maxOfferDistance: filtersForm.maxOfferDistance ? parseInt(filtersForm.maxOfferDistance) : null,
        minRateUsdc: filtersForm.minRateUsdc ? parseFloat(filtersForm.minRateUsdc) : null,
      });
      setProfile(updated);
      setEditingFilters(false);
    } catch (error) {
      console.error('Failed to save filters:', error);
    } finally {
      setSaving(false);
    }
  };

  const addWallet = async () => {
    setSaving(true);
    try {
      await api.addWallet(walletForm);
      await loadProfile();
      setWalletForm({ network: 'ethereum', address: '', label: '' });
      setShowWalletForm(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteWallet = async (id: string) => {
    if (!confirm(t('dashboard.wallets.confirmDelete'))) return;
    try {
      await api.deleteWallet(id);
      await loadProfile();
    } catch (error) {
      console.error('Failed to delete wallet:', error);
    }
  };

  const addService = async () => {
    setSaving(true);
    try {
      await api.createService(serviceForm);
      await loadProfile();
      setServiceForm({ title: '', description: '', category: '', priceRange: '' });
      setShowServiceForm(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleServiceActive = async (service: Service) => {
    try {
      await api.updateService(service.id, { isActive: !service.isActive });
      await loadProfile();
    } catch (error) {
      console.error('Failed to update service:', error);
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm(t('dashboard.services.confirmDelete'))) return;
    try {
      await api.deleteService(id);
      await loadProfile();
    } catch (error) {
      console.error('Failed to delete service:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center">{t('common.error')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Human Pages</h1>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <span className="text-gray-600">{user?.name}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700">
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <ProfileCompleteness profile={profile} onEditProfile={() => setEditingProfile(true)} />

        {/* Share & Referral Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{t('dashboard.shareProfile')}</h2>
              <p className="text-blue-100 text-sm">
                {t('dashboard.shareDesc')}
                {profile.referralCount !== undefined && profile.referralCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                    {t('dashboard.referrals', { count: profile.referralCount })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/humans/${profile.id}`;
                  navigator.clipboard.writeText(url);
                  setCopiedProfile(true);
                  analytics.track('profile_share_copy');
                  setTimeout(() => setCopiedProfile(false), 2000);
                }}
                className="px-4 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                {copiedProfile ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('common.copied')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    {t('dashboard.copyProfileLink')}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/signup?ref=${profile.id}`;
                  navigator.clipboard.writeText(url);
                  setCopiedReferral(true);
                  analytics.track('referral_link_copy');
                  setTimeout(() => setCopiedReferral(false), 2000);
                }}
                className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-400 transition-colors flex items-center justify-center gap-2"
              >
                {copiedReferral ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('common.copied')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    {t('dashboard.inviteFriends')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Telegram Notifications */}
        {telegramStatus?.botAvailable && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.234.169.337.015.102.034.331.019.51z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t('dashboard.telegram.title')}</h2>
                  <p className="text-gray-600 text-sm">
                    {telegramStatus?.connected
                      ? t('dashboard.telegram.connected')
                      : t('dashboard.telegram.notConnected')}
                  </p>
                </div>
              </div>
              {telegramStatus?.connected ? (
                <button
                  onClick={disconnectTelegram}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200"
                >
                  {t('dashboard.availability.available')}
                </button>
              ) : (
                <button
                  onClick={connectTelegram}
                  disabled={telegramLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {telegramLoading ? t('dashboard.telegram.connecting') : t('dashboard.telegram.connect')}
                </button>
              )}
            </div>
            {telegramLinkUrl && !telegramStatus?.connected && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                {t('dashboard.telegram.openTelegram')}{' '}
                <a href={telegramLinkUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {t('dashboard.telegram.clickHere')}
                </a>
                . {t('dashboard.telegram.waiting')}
              </div>
            )}
          </div>
        )}

        {/* Availability Toggle */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t('dashboard.availability.title')}</h2>
              <p className="text-gray-600 text-sm">
                {profile.isAvailable ? t('dashboard.availability.visible') : t('dashboard.availability.hidden')}
              </p>
            </div>
            <button
              onClick={toggleAvailability}
              disabled={saving}
              className={`px-4 py-2 rounded-lg font-medium ${
                profile.isAvailable
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {profile.isAvailable ? t('dashboard.availability.available') : t('dashboard.availability.unavailable')}
            </button>
          </div>
        </div>

        {/* Offer Filters Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">{t('dashboard.filters.title')}</h2>
              <p className="text-gray-600 text-sm">{t('dashboard.filters.subtitle')}</p>
            </div>
            <button
              onClick={() => setEditingFilters(!editingFilters)}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {editingFilters ? t('common.cancel') : t('dashboard.filters.configure')}
            </button>
          </div>

          {editingFilters ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.filters.minPrice')}</label>
                <p className="text-xs text-gray-500 mb-1">{t('dashboard.filters.minPriceDesc')}</p>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={filtersForm.minOfferPrice}
                  onChange={(e) => setFiltersForm({ ...filtersForm, minOfferPrice: e.target.value })}
                  placeholder="e.g., 50"
                  className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.filters.minRate')}</label>
                <p className="text-xs text-gray-500 mb-1">{t('dashboard.filters.minRateDesc')}</p>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={filtersForm.minRateUsdc}
                  onChange={(e) => setFiltersForm({ ...filtersForm, minRateUsdc: e.target.value })}
                  placeholder="e.g., 25"
                  className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.filters.maxDistance')}</label>
                <p className="text-xs text-gray-500 mb-1">{t('dashboard.filters.maxDistanceDesc')}</p>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={filtersForm.maxOfferDistance}
                  onChange={(e) => setFiltersForm({ ...filtersForm, maxOfferDistance: e.target.value })}
                  placeholder="e.g., 100"
                  className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md"
                />
                {!profile?.locationLat && filtersForm.maxOfferDistance && (
                  <p className="text-xs text-amber-600 mt-1">{t('dashboard.filters.distanceWarning')}</p>
                )}
              </div>

              <button
                onClick={saveFilters}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? t('dashboard.profile.saving') : t('dashboard.filters.saveFilters')}
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {!profile?.minOfferPrice && !profile?.maxOfferDistance && !profile?.minRateUsdc ? (
                <p className="text-gray-500">{t('dashboard.filters.noFilters')}</p>
              ) : (
                <>
                  {profile?.minOfferPrice && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>Minimum offer: <strong>${profile.minOfferPrice} USDC</strong></span>
                    </div>
                  )}
                  {profile?.minRateUsdc && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>Minimum rate: <strong>${profile.minRateUsdc}/hr</strong></span>
                    </div>
                  )}
                  {profile?.maxOfferDistance && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>Max distance: <strong>{profile.maxOfferDistance} km</strong></span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Jobs Section */}
        <div className="bg-white rounded-lg shadow p-6">
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
            <div className="flex gap-1">
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
            <p className="text-gray-500 text-sm">{t('common.loading')}</p>
          ) : getFilteredJobs().length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {jobFilter === 'all'
                  ? t('dashboard.jobs.noJobs')
                  : t('dashboard.jobs.noJobsFiltered', { filter: t(`dashboard.jobs.${jobFilter}`) })}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {getFilteredJobs().map((job) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{job.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(job.status)}`}>
                          {t(`dashboard.jobs.status.${job.status}`)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{job.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="font-medium text-green-600">${job.priceUsdc} USDC</span>
                        {job.agentName && <span>{t('dashboard.jobs.from')}: {job.agentName}</span>}
                        {job.category && <span className="bg-gray-100 px-2 py-0.5 rounded">{job.category}</span>}
                        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>

                      {job.review && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-500">{'★'.repeat(job.review.rating)}{'☆'.repeat(5 - job.review.rating)}</span>
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
                            onClick={() => acceptJob(job.id)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                          >
                            {t('dashboard.jobs.accept')}
                          </button>
                          <button
                            onClick={() => rejectJob(job.id)}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                          >
                            {t('dashboard.jobs.reject')}
                          </button>
                        </>
                      )}
                      {job.status === 'PAID' && (
                        <button
                          onClick={() => completeJob(job.id)}
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
          )}
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('dashboard.profile.title')}</h2>
            <button
              onClick={() => setEditingProfile(!editingProfile)}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {editingProfile ? t('common.cancel') : t('common.edit')}
            </button>
          </div>

          {editingProfile ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.bio')}</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.location')}</label>
                <input
                  type="text"
                  value={profileForm.location}
                  onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('dashboard.profile.skills')} ({t('dashboard.profile.skillsSeparator')})
                </label>
                <input
                  type="text"
                  value={profileForm.skills}
                  onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                  placeholder={t('dashboard.profile.skillsPlaceholder')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.contactEmail')}</label>
                <input
                  type="email"
                  value={profileForm.contactEmail}
                  onChange={(e) => setProfileForm({ ...profileForm, contactEmail: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.telegramHandle')}</label>
                <input
                  type="text"
                  value={profileForm.telegram}
                  onChange={(e) => setProfileForm({ ...profileForm, telegram: e.target.value })}
                  placeholder={t('dashboard.profile.telegramPlaceholder')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  {t('dashboard.profile.socialProfiles')} ({t('dashboard.profile.socialForTrust')})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.linkedin')}</label>
                    <input
                      type="url"
                      value={profileForm.linkedinUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/in/username"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.twitter')}</label>
                    <input
                      type="url"
                      value={profileForm.twitterUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, twitterUrl: e.target.value })}
                      placeholder="https://twitter.com/username"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.github')}</label>
                    <input
                      type="url"
                      value={profileForm.githubUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, githubUrl: e.target.value })}
                      placeholder="https://github.com/username"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.instagram')}</label>
                    <input
                      type="url"
                      value={profileForm.instagramUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, instagramUrl: e.target.value })}
                      placeholder="https://instagram.com/username"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.youtube')}</label>
                    <input
                      type="url"
                      value={profileForm.youtubeUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, youtubeUrl: e.target.value })}
                      placeholder="https://youtube.com/@channel"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('dashboard.profile.website')}</label>
                    <input
                      type="url"
                      value={profileForm.websiteUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, websiteUrl: e.target.value })}
                      placeholder="https://yourwebsite.com"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? t('dashboard.profile.saving') : t('dashboard.profile.saveProfile')}
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">{t('common.name')}:</span> {profile.name}</p>
              <p><span className="font-medium">{t('dashboard.profile.bio')}:</span> {profile.bio || t('common.notSet')}</p>
              <p><span className="font-medium">{t('dashboard.profile.location')}:</span> {profile.location || t('common.notSet')}</p>
              <p><span className="font-medium">{t('dashboard.profile.skills')}:</span> {profile.skills?.join(', ') || t('common.none')}</p>
              <p><span className="font-medium">{t('dashboard.profile.contactEmail')}:</span> {profile.contactEmail || t('common.notSet')}</p>
              <p><span className="font-medium">{t('dashboard.profile.telegramHandle')}:</span> {profile.telegram || t('common.notSet')}</p>

              {(profile.linkedinUrl || profile.twitterUrl || profile.githubUrl ||
                profile.instagramUrl || profile.youtubeUrl || profile.websiteUrl) && (
                <div className="pt-3 mt-3 border-t border-gray-200">
                  <p className="font-medium mb-2">{t('dashboard.profile.socialProfiles')}:</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.linkedinUrl && (
                      <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                        {t('dashboard.profile.linkedin')}
                      </a>
                    )}
                    {profile.twitterUrl && (
                      <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs hover:bg-sky-200">
                        {t('dashboard.profile.twitter')}
                      </a>
                    )}
                    {profile.githubUrl && (
                      <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">
                        {t('dashboard.profile.github')}
                      </a>
                    )}
                    {profile.instagramUrl && (
                      <a href={profile.instagramUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs hover:bg-pink-200">
                        {t('dashboard.profile.instagram')}
                      </a>
                    )}
                    {profile.youtubeUrl && (
                      <a href={profile.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                        {t('dashboard.profile.youtube')}
                      </a>
                    )}
                    {profile.websiteUrl && (
                      <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">
                        {t('dashboard.profile.website')}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wallets Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('dashboard.wallets.title')}</h2>
            <button
              onClick={() => setShowWalletForm(!showWalletForm)}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {showWalletForm ? t('common.cancel') : t('dashboard.wallets.addWallet')}
            </button>
          </div>

          {showWalletForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.wallets.network')}</label>
                <select
                  value={walletForm.network}
                  onChange={(e) => setWalletForm({ ...walletForm, network: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="ethereum">{t('dashboard.wallets.networks.ethereum')}</option>
                  <option value="solana">{t('dashboard.wallets.networks.solana')}</option>
                  <option value="bitcoin">{t('dashboard.wallets.networks.bitcoin')}</option>
                  <option value="polygon">{t('dashboard.wallets.networks.polygon')}</option>
                  <option value="arbitrum">{t('dashboard.wallets.networks.arbitrum')}</option>
                  <option value="base">{t('dashboard.wallets.networks.base')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.wallets.address')}</label>
                <input
                  type="text"
                  value={walletForm.address}
                  onChange={(e) => setWalletForm({ ...walletForm, address: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('dashboard.wallets.label')} ({t('common.optional')})
                </label>
                <input
                  type="text"
                  value={walletForm.label}
                  onChange={(e) => setWalletForm({ ...walletForm, label: e.target.value })}
                  placeholder={t('dashboard.wallets.labelPlaceholder')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <button
                onClick={addWallet}
                disabled={saving || !walletForm.address}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('dashboard.wallets.addWallet')}
              </button>
            </div>
          )}

          {profile.wallets.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('dashboard.wallets.noWallets')}</p>
          ) : (
            <div className="space-y-2">
              {profile.wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{wallet.network}</span>
                    {wallet.label && <span className="text-gray-500 text-sm ml-2">({wallet.label})</span>}
                    <p className="text-xs text-gray-600 font-mono truncate max-w-md">{wallet.address}</p>
                  </div>
                  <button
                    onClick={() => deleteWallet(wallet.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Services Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('dashboard.services.title')}</h2>
            <button
              onClick={() => setShowServiceForm(!showServiceForm)}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {showServiceForm ? t('common.cancel') : t('dashboard.services.addService')}
            </button>
          </div>

          {showServiceForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.services.serviceTitle')}</label>
                <input
                  type="text"
                  value={serviceForm.title}
                  onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                  placeholder={t('dashboard.services.serviceTitlePlaceholder')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.services.description')}</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  rows={3}
                  placeholder={t('dashboard.services.descriptionPlaceholder')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('dashboard.services.category')}</label>
                <input
                  type="text"
                  value={serviceForm.category}
                  onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                  placeholder={t('dashboard.services.categoryPlaceholder')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('dashboard.services.priceRange')} ({t('common.optional')})
                </label>
                <input
                  type="text"
                  value={serviceForm.priceRange}
                  onChange={(e) => setServiceForm({ ...serviceForm, priceRange: e.target.value })}
                  placeholder={t('dashboard.services.priceRangePlaceholder')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <button
                onClick={addService}
                disabled={saving || !serviceForm.title || !serviceForm.description || !serviceForm.category}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('dashboard.services.addService')}
              </button>
            </div>
          )}

          {profile.services.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('dashboard.services.noServices')}</p>
          ) : (
            <div className="space-y-3">
              {profile.services.map((service) => (
                <div key={service.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{service.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded">{service.category}</span>
                        {service.priceRange && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {service.priceRange}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleServiceActive(service)}
                        className={`text-xs px-2 py-1 rounded ${
                          service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {service.isActive ? t('dashboard.services.statusActive') : t('dashboard.services.statusInactive')}
                      </button>
                      <button
                        onClick={() => deleteService(service.id)}
                        className="text-red-600 hover:text-red-700 text-xs"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
