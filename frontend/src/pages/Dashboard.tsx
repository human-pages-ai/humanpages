import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { posthog } from '../lib/posthog';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import ConfirmDialog from '../components/ConfirmDialog';
import { Profile, Job, ReviewStats, Service } from '../components/dashboard/types';
import StatusHeader from '../components/dashboard/StatusHeader';
import DashboardTabs, { DashboardTab } from '../components/dashboard/DashboardTabs';
import ShareReferralSection from '../components/dashboard/ShareReferralSection';
import TelegramSection from '../components/dashboard/TelegramSection';
import WorkStatusSection from '../components/dashboard/WorkStatusSection';
import OfferFiltersSection from '../components/dashboard/OfferFiltersSection';
import JobsSection from '../components/dashboard/JobsSection';
import ProfileSection from '../components/dashboard/ProfileSection';
import WalletsSection from '../components/dashboard/WalletsSection';
import ServicesSection from '../components/dashboard/ServicesSection';
import AccountSection from '../components/dashboard/AccountSection';
import HumanitySection from '../components/dashboard/HumanitySection';
import VouchSection from '../components/dashboard/VouchSection';
import VerificationSection from '../components/dashboard/VerificationSection';
// TODO: Unhide once LinkedIn redirect URIs are configured
// import LinkedInSection from '../components/dashboard/LinkedInSection';
import SEO from '../components/SEO';

const VALID_TABS: DashboardTab[] = ['jobs', 'profile', 'payments', 'settings'];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tab state — driven by URL search param
  const tabParam = searchParams.get('tab') as DashboardTab | null;
  const activeTab: DashboardTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'jobs';

  const setActiveTab = (tab: DashboardTab) => {
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'jobs') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams, { replace: true });
  };

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    bio: '',
    location: '',
    neighborhood: '',
    locationGranularity: 'city' as 'city' | 'neighborhood',
    locationLat: undefined as number | undefined,
    locationLng: undefined as number | undefined,
    skills: '',
    equipment: [] as string[],
    languages: [] as string[],
    contactEmail: '',
    telegram: '',
    whatsapp: '',
    paymentMethods: '',
    hideContact: false,
    username: '',
    linkedinUrl: '',
    twitterUrl: '',
    githubUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    websiteUrl: '',
    workMode: null as 'REMOTE' | 'ONSITE' | 'HYBRID' | null,
  });

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ title: '', description: '', category: '', priceMin: '', priceUnit: '', priceCurrency: 'USD' });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);

  const [copiedProfile, setCopiedProfile] = useState(false);

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
    rateCurrency: 'USD',
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    loadProfile();
    loadJobs();
    loadTelegramStatus();

    // Handle query param toasts
    if (searchParams.get('emailVerified') === 'true') {
      toast.success(t('toast.emailVerified'));
      searchParams.delete('emailVerified');
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get('unsubscribed') === 'true') {
      toast.success(t('toast.preferencesSaved'));
      searchParams.delete('unsubscribed');
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get('linkedinVerified') === 'true') {
      toast.success(t('toast.linkedinConnected'));
      searchParams.delete('linkedinVerified');
      setSearchParams(searchParams, { replace: true });
      loadProfile();
    }
    if (searchParams.get('githubVerified') === 'true') {
      toast.success('GitHub connected successfully!');
      searchParams.delete('githubVerified');
      setSearchParams(searchParams, { replace: true });
      loadProfile();
    }
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
      setProfileForm({
        name: data.name || '',
        bio: data.bio || '',
        location: data.location || '',
        neighborhood: data.neighborhood || '',
        locationGranularity: data.locationGranularity || 'city',
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        skills: data.skills?.join(', ') || '',
        equipment: data.equipment || [],
        languages: data.languages || [],
        contactEmail: data.contactEmail || '',
        telegram: data.telegram || '',
        whatsapp: data.whatsapp || '',
        paymentMethods: data.paymentMethods || '',
        hideContact: data.hideContact || false,
        username: data.username || '',
        linkedinUrl: data.linkedinUrl || '',
        twitterUrl: data.twitterUrl || '',
        githubUrl: data.githubUrl || '',
        instagramUrl: data.instagramUrl || '',
        youtubeUrl: data.youtubeUrl || '',
        websiteUrl: data.websiteUrl || '',
        workMode: data.workMode || null,
      });
      setFiltersForm({
        minOfferPrice: data.minOfferPrice?.toString() || '',
        maxOfferDistance: data.maxOfferDistance?.toString() || '',
        minRateUsdc: data.minRateUsdc?.toString() || '',
        rateCurrency: data.rateCurrency || 'USD',
      });
      setServiceForm((prev) => ({ ...prev, priceCurrency: data.rateCurrency || 'USD' }));
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
          posthog.capture('telegram_connected');
        }
      }, 3000);
      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
    } finally {
      setTelegramLoading(false);
    }
  };

  const disconnectTelegram = async () => {
    setConfirmDialog({
      open: true,
      title: t('dashboard.telegram.disconnect'),
      message: t('dashboard.telegram.disconnect'),
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }));
        try {
          await api.unlinkTelegram();
          setTelegramStatus({ connected: false, botAvailable: telegramStatus?.botAvailable || false });
          toast.success(t('toast.telegramDisconnected'));
        } catch (error: any) {
          toast.error(error.message || t('toast.genericError'));
        }
      },
    });
  };

  const toggleAvailability = async () => {
    if (!profile) return;
    if (profile.isAvailable && !window.confirm(t('dashboard.workStatus.confirmSuspend'))) {
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile({ isAvailable: !profile.isAvailable });
      posthog.capture('availability_toggled', { isAvailable: updated.isAvailable });
      setProfile(updated);
    } catch (error) {
      console.error('Failed to update availability:', error);
    } finally {
      setSaving(false);
    }
  };

  const changePaymentPreference = async (pref: 'ESCROW' | 'UPFRONT' | 'BOTH') => {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile({ paymentPreference: pref });
      setProfile(updated);
    } catch (error) {
      console.error('Failed to update payment preference:', error);
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
        neighborhood: profileForm.neighborhood || null,
        locationGranularity: profileForm.locationGranularity,
        locationLat: profileForm.locationLat ?? null,
        locationLng: profileForm.locationLng ?? null,
        skills: profileForm.skills.split(',').map(s => s.trim()).filter(Boolean),
        equipment: profileForm.equipment.length > 0 ? profileForm.equipment : null,
        languages: profileForm.languages.length > 0 ? profileForm.languages : null,
        contactEmail: profileForm.contactEmail || null,
        telegram: profileForm.telegram || null,
        whatsapp: profileForm.whatsapp || null,
        paymentMethods: profileForm.paymentMethods || null,
        hideContact: profileForm.hideContact,
        username: profileForm.username || null,
        linkedinUrl: profileForm.linkedinUrl || null,
        twitterUrl: profileForm.twitterUrl || null,
        githubUrl: profileForm.githubUrl || null,
        instagramUrl: profileForm.instagramUrl || null,
        youtubeUrl: profileForm.youtubeUrl || null,
        websiteUrl: profileForm.websiteUrl || null,
        workMode: profileForm.workMode || null,
      });
      posthog.capture('profile_updated');
      setProfile(updated);
      setEditingProfile(false);
      toast.success(t('toast.profileSaved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.genericError'));
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
        rateCurrency: filtersForm.rateCurrency,
      });
      setProfile(updated);
      setEditingFilters(false);
      toast.success(t('toast.filtersSaved'));
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const addWallet = async (data: { network: string; address: string; label?: string; signature: string; nonce: string }) => {
    setSaving(true);
    try {
      await api.addWallet(data);
      posthog.capture('wallet_added', { network: data.network });
      await loadProfile();
      toast.success(t('toast.walletAdded'));
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const deleteWallet = async (id: string) => {
    setConfirmDialog({
      open: true,
      title: t('dashboard.wallets.confirmDelete'),
      message: t('dashboard.wallets.confirmDelete'),
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }));
        try {
          await api.deleteWallet(id);
          toast.success(t('toast.walletDeleted'));
          await loadProfile();
        } catch (error: any) {
          toast.error(error.message || t('toast.genericError'));
        }
      },
    });
  };

  const addService = async () => {
    setSaving(true);
    try {
      await api.createService({
        title: serviceForm.title,
        description: serviceForm.description,
        category: serviceForm.category,
        priceMin: serviceForm.priceMin ? parseFloat(serviceForm.priceMin) : null,
        priceCurrency: serviceForm.priceCurrency,
        priceUnit: serviceForm.priceUnit || null,
      });
      posthog.capture('service_added');
      await loadProfile();
      setServiceForm({ title: '', description: '', category: '', priceMin: '', priceUnit: '', priceCurrency: profile?.rateCurrency || 'USD' });
      setShowServiceForm(false);
      toast.success(t('toast.serviceAdded'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleServiceActive = async (service: Service) => {
    try {
      await api.updateService(service.id, { isActive: !service.isActive });
      await loadProfile();
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
    }
  };

  const deleteService = async (id: string) => {
    setConfirmDialog({
      open: true,
      title: t('dashboard.services.confirmDelete'),
      message: t('dashboard.services.confirmDelete'),
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }));
        try {
          await api.deleteService(id);
          toast.success(t('toast.serviceDeleted'));
          await loadProfile();
        } catch (error: any) {
          toast.error(error.message || t('toast.genericError'));
        }
      },
    });
  };

  const changeEmailDigestMode = async (mode: 'REALTIME' | 'HOURLY' | 'DAILY') => {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile({ emailDigestMode: mode });
      setProfile(updated);
    } catch (error) {
      console.error('Failed to update email digest mode:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = async (channel: 'email' | 'telegram' | 'whatsapp') => {
    if (!profile) return;
    setSaving(true);
    try {
      const key = channel === 'email' ? 'emailNotifications'
        : channel === 'telegram' ? 'telegramNotifications'
        : 'whatsappNotifications';
      const updated = await api.updateProfile({ [key]: !(profile as any)[key] });
      setProfile(updated);
      toast.success(t('toast.preferencesSaved'));
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (password?: string) => {
    setSaving(true);
    try {
      await api.deleteAccount(password);
      toast.success(t('toast.accountDeleted'));
      logout();
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setSaving(true);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `human-pages-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('toast.dataExported'));
    } catch (error) {
      toast.error(t('toast.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const resendVerification = async () => {
    try {
      await api.resendVerification();
      toast.success(t('toast.verificationSent'));
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
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

  const pendingJobCount = jobs.filter(j => j.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title="Dashboard" noindex />
      <nav className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="whitespace-nowrap"><Link to="/"><Logo /></Link></h1>
          <div className="flex items-center gap-4 whitespace-nowrap">
            <LanguageSwitcher />
            <span className="text-gray-600">{user?.name}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700">
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Email verification banner */}
        {profile.emailVerified === false && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-yellow-800">{t('dashboard.emailVerification.banner')}</p>
                <p className="text-xs text-yellow-700 mt-1">{t('dashboard.emailVerification.restricted')}</p>
              </div>
              <button
                onClick={resendVerification}
                className="ml-4 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 px-3 py-1.5 rounded whitespace-nowrap"
              >
                {t('dashboard.emailVerification.resend')}
              </button>
            </div>
          </div>
        )}

        {/* Status header — always visible */}
        <StatusHeader
          profile={profile}
          jobs={jobs}
          reviewStats={reviewStats}
          saving={saving}
          onToggleAvailability={toggleAvailability}
        />

        {/* Tab navigation */}
        <DashboardTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingJobCount={pendingJobCount}
        />

        {/* Tab content */}
        <div className="mt-2">
          {/* ───── JOBS TAB ───── */}
          {activeTab === 'jobs' && (
            <div className="space-y-4">
              <JobsSection
                jobs={jobs}
                jobsLoading={jobsLoading}
                jobFilter={jobFilter}
                setJobFilter={setJobFilter}
                reviewStats={reviewStats}
                profileId={profile.id}
                profileUsername={profile.username}
              />
            </div>
          )}

          {/* ───── PROFILE TAB ───── */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Two-column layout on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Profile info */}
                <div>
                  <ProfileSection
                    profile={profile}
                    editingProfile={editingProfile}
                    setEditingProfile={setEditingProfile}
                    hasWallet={profile.wallets.length > 0}
                    onScrollToWallets={() => setActiveTab('payments')}
                    profileForm={profileForm}
                    setProfileForm={setProfileForm}
                    saving={saving}
                    onSaveProfile={saveProfile}
                  />
                </div>

                {/* Right: Services + Work status */}
                <div className="space-y-6" id="services-section">
                  <ServicesSection
                    services={profile.services}
                    showServiceForm={showServiceForm}
                    setShowServiceForm={setShowServiceForm}
                    serviceForm={serviceForm}
                    setServiceForm={setServiceForm}
                    saving={saving}
                    onAddService={addService}
                    onToggleServiceActive={toggleServiceActive}
                    onDeleteService={deleteService}
                  />
                  <WorkStatusSection
                    isAvailable={profile.isAvailable}
                    paymentPreference={profile.paymentPreference || 'BOTH'}
                    emailNotifications={profile.emailNotifications !== false}
                    telegramNotifications={profile.telegramNotifications !== false}
                    whatsappNotifications={profile.whatsappNotifications !== false}
                    emailDigestMode={profile.emailDigestMode || 'REALTIME'}
                    saving={saving}
                    onToggleAvailability={toggleAvailability}
                    onPaymentPreferenceChange={changePaymentPreference}
                    onToggleNotification={toggleNotification}
                    onEmailDigestModeChange={changeEmailDigestMode}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ───── PAYMENTS TAB ───── */}
          {activeTab === 'payments' && (
            <div className="space-y-4" id="payment-setup-section">
              <WalletsSection
                wallets={profile.wallets}
                saving={saving}
                onAddWallet={addWallet}
                onDeleteWallet={deleteWallet}
              />
              <OfferFiltersSection
                profile={profile}
                editingFilters={editingFilters}
                setEditingFilters={setEditingFilters}
                filtersForm={filtersForm}
                setFiltersForm={setFiltersForm}
                saving={saving}
                onSaveFilters={saveFilters}
              />
            </div>
          )}

          {/* ───── SETTINGS TAB ───── */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Two-column grid for settings cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trust & Verification */}
                <div className="space-y-4">
                  <VerificationSection profile={profile} onProfileUpdate={loadProfile} />
                  {/* TODO: Unhide once LinkedIn redirect URIs are configured */}
                  {/* <LinkedInSection profile={profile} onProfileUpdate={setProfile} /> */}
                  <HumanitySection profile={profile} onVerified={loadProfile} />
                </div>

                {/* Integrations */}
                <div className="space-y-4">
                  <TelegramSection
                    telegramStatus={telegramStatus}
                    telegramLinkUrl={telegramLinkUrl}
                    telegramLoading={telegramLoading}
                    onConnect={connectTelegram}
                    onDisconnect={disconnectTelegram}
                  />
                </div>
              </div>

              {/* Sharing & Growth — full width */}
              <ShareReferralSection
                profile={profile}
                copiedProfile={copiedProfile}
                setCopiedProfile={setCopiedProfile}
              />
              <VouchSection />

              {/* Account — full width at bottom */}
              <AccountSection
                profile={profile}
                onDeleteAccount={deleteAccount}
                onExportData={exportData}
                onProfileUpdate={setProfile}
                saving={saving}
              />
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
