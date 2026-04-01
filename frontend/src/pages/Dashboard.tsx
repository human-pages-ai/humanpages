import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import ConfirmDialog from '../components/ConfirmDialog';
import { Profile, Job, ReviewStats } from '../components/dashboard/types';
// StatusHeader removed — wizard module tiles replace the profile completion banner
import DashboardTabs, { DashboardTab } from '../components/dashboard/DashboardTabs';
import OfferFiltersSection from '../components/dashboard/OfferFiltersSection';
import JobsSection from '../components/dashboard/JobsSection';
// import CvUpload from '../components/dashboard/CvUpload'; // Hidden: CV upload disabled
import { ProfileCard } from '../components/dashboard/ProfileCard';
import { ProfileTilesGrid } from '../components/dashboard/ProfileTilesGrid';


// Lazy-load wallet stack (Privy) — only fetched when payments tab opens
const WalletProvider = lazy(() => import('../components/dashboard/WalletProvider'));
const WalletsSection = lazy(() => import('../components/dashboard/WalletsSection'));
import AccountSection from '../components/dashboard/AccountSection';
import HumanitySection from '../components/dashboard/HumanitySection';
import VouchSection from '../components/dashboard/VouchSection';
import ShareReferralSection from '../components/dashboard/ShareReferralSection';
import VerificationSection from '../components/dashboard/VerificationSection';
import PaymentPreferencesSection from '../components/dashboard/PaymentPreferencesSection';
import FiatPaymentMethodsSection from '../components/dashboard/FiatPaymentMethodsSection';
import ContactPrivacySection from '../components/dashboard/ContactPrivacySection';
import ListingsSection from '../components/dashboard/ListingsSection';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import { safeLocalStorage } from '../lib/safeStorage';

const VALID_TABS: DashboardTab[] = ['jobs', 'listings', 'profile', 'payments', 'settings', 'privacy'];


export default function Dashboard() {
  const { t } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProfile] = useState(false);
  const [copiedProfile, setCopiedProfile] = useState(false);

  // Tab state — driven by URL search param
  const tabParam = searchParams.get('tab') as DashboardTab | null;
  const activeTab: DashboardTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'profile';

  const setActiveTab = (tab: DashboardTab) => {
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'profile') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams, { replace: true });
  };

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
    featuredConsent: false,
    username: '',
    linkedinUrl: '',
    twitterUrl: '',
    githubUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    websiteUrl: '',
    tiktokUrl: '',
    twitterFollowers: '',
    instagramFollowers: '',
    youtubeFollowers: '',
    tiktokFollowers: '',
    linkedinFollowers: '',
    facebookFollowers: '',
    yearsOfExperience: '' as string,
    workMode: null as 'REMOTE' | 'ONSITE' | 'HYBRID' | null,
  });

  const profileFormRef = useRef(profileForm);
  profileFormRef.current = profileForm;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);

  const [telegramStatus, setTelegramStatus] = useState<{
    connected: boolean;
    botAvailable: boolean;
    botUsername?: string;
  } | null>(null);


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
    if (searchParams.get('emailVerifyError') === 'true') {
      toast.error(t('toast.emailVerifyError', 'Email verification failed. The link may have expired or already been used. Please request a new one from your dashboard.'));
      searchParams.delete('emailVerifyError');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  // Poll for identity verification when unverified (user may verify on another device)
  useEffect(() => {
    if (!profile || profile.emailVerified || profile.whatsappVerified) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.getProfile();
        if (data.emailVerified || data.whatsappVerified) {
          setProfile(prev => prev ? { ...prev, emailVerified: data.emailVerified, whatsappVerified: data.whatsappVerified } : prev);
          toast.success(t('toast.emailVerified'));
          clearInterval(interval);
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [profile?.emailVerified, profile?.whatsappVerified]);

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
        featuredConsent: data.featuredConsent || false,
        username: data.username || '',
        linkedinUrl: data.linkedinUrl || '',
        twitterUrl: data.twitterUrl || '',
        githubUrl: data.githubUrl || '',
        facebookUrl: data.facebookUrl || '',
        instagramUrl: data.instagramUrl || '',
        youtubeUrl: data.youtubeUrl || '',
        websiteUrl: data.websiteUrl || '',
        tiktokUrl: data.tiktokUrl || '',
        twitterFollowers: data.twitterFollowers?.toString() || '',
        instagramFollowers: data.instagramFollowers?.toString() || '',
        youtubeFollowers: data.youtubeFollowers?.toString() || '',
        tiktokFollowers: data.tiktokFollowers?.toString() || '',
        linkedinFollowers: data.linkedinFollowers?.toString() || '',
        facebookFollowers: data.facebookFollowers?.toString() || '',
        yearsOfExperience: data.yearsOfExperience?.toString() || '',
        workMode: data.workMode || null,
      });
      setFiltersForm({
        minOfferPrice: data.minOfferPrice?.toString() || '',
        maxOfferDistance: data.maxOfferDistance?.toString() || '',
        minRateUsdc: data.minRateUsdc?.toString() || '',
        rateCurrency: data.rateCurrency || 'USD',
      });
      updateUser({ hasWallet: (data.wallets?.length ?? 0) > 0 });
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


  // toggleAvailability removed — availability is managed via wizard tiles

  const togglePaymentPreference = async (pref: 'UPFRONT' | 'ESCROW' | 'UPON_COMPLETION' | 'STREAM') => {
    if (!profile) return;
    const current = profile.paymentPreferences || ['UPFRONT', 'ESCROW', 'UPON_COMPLETION'];
    const next = current.includes(pref)
      ? current.filter(p => p !== pref)
      : [...current, pref];
    if (next.length === 0) return; // must keep at least one
    setSaving(true);
    try {
      const updated = await api.updateProfile({ paymentPreferences: next });
      setProfile(updated);
    } catch (error) {
      console.error('Failed to update payment preferences:', error);
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

  const addWallet = async (data: { address: string; signature: string; nonce: string }) => {
    setSaving(true);
    try {
      await api.addWallet(data);
      analytics.track('wallet_added', { address: data.address });
      await loadProfile();
      toast.success(t('toast.walletAdded'));
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const addWalletManual = async (address: string) => {
    setSaving(true);
    try {
      await api.addWalletManual({ address });
      analytics.track('wallet_added_manual', { address });
      await loadProfile();
      toast.success(t('toast.walletAdded'));
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const updateWalletLabel = async (address: string, label?: string) => {
    setSaving(true);
    try {
      await api.updateWalletLabel(address, label);
      await loadProfile();
      toast.success(t('toast.walletLabelUpdated'));
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
          analytics.track('wallet_deleted');
          toast.success(t('toast.walletDeleted'));
          await loadProfile();
        } catch (error: any) {
          toast.error(error.message || t('toast.genericError'));
        }
      },
    });
  };



  const addFiatPaymentMethod = async (data: { platform: string; handle: string; label?: string }) => {
    setSaving(true);
    try {
      await api.addFiatPaymentMethod(data);
      analytics.track('fiat_payment_method_added', { platform: data.platform });
      await loadProfile();
      toast.success('Payment method added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add payment method');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const updateFiatPaymentMethod = async (id: string, data: { handle?: string; label?: string }) => {
    setSaving(true);
    try {
      await api.updateFiatPaymentMethod(id, data);
      await loadProfile();
      toast.success('Payment method updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update payment method');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const deleteFiatPaymentMethod = async (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete payment method?',
      message: 'Are you sure you want to remove this payment method?',
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }));
        try {
          await api.deleteFiatPaymentMethod(id);
          analytics.track('fiat_payment_method_deleted');
          toast.success('Payment method removed');
          await loadProfile();
        } catch (error: any) {
          toast.error(error.message || 'Failed to delete payment method');
        }
      },
    });
  };

  const setFiatPaymentMethodPrimary = async (id: string) => {
    setSaving(true);
    try {
      await api.setFiatPaymentMethodPrimary(id);
      await loadProfile();
      toast.success('Primary payment method updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to set primary');
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
      analytics.track('dashboard_resend_verification');
      await api.resendVerification();
      toast.success(t('toast.verificationSent'));
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
    }
  };

  const handleLogout = async () => {
    analytics.track('dashboard_logout');
    await logout();
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
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <LanguageSwitcher />
            <span className="text-gray-600 truncate max-w-[120px] sm:max-w-[200px]">{user?.name ? (() => { const parts = user.name.trim().split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]; })() : ''}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 whitespace-nowrap flex-shrink-0">
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Identity verification banner */}
        {!profile.emailVerified && !profile.whatsappVerified && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-semibold text-yellow-800">{t('dashboard.emailVerification.banner')}</p>
                <p className="text-xs text-yellow-700 mt-1">{t('dashboard.emailVerification.restricted')}</p>
              </div>
              <button
                onClick={resendVerification}
                className="w-full sm:w-auto sm:ml-4 text-xs sm:text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 px-3 py-2 sm:py-1.5 rounded whitespace-nowrap"
              >
                {t('dashboard.emailVerification.resend')}
              </button>
            </div>
          </div>
        )}

        {/* Onboarding pending banner — shown for fast-tracked listing signups */}
        {safeLocalStorage.getItem('hp_onboarding_pending') === '1' && profile && !profile.location && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-800">Complete your profile to get matched with more gigs</p>
                <p className="text-xs text-blue-600 mt-0.5">Add your location and skills to appear in more search results</p>
              </div>
              <Link
                to="/onboarding"
                className="ml-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded whitespace-nowrap"
              >
                Complete Profile
              </Link>
            </div>
          </div>
        )}

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

          {/* ───── LISTINGS TAB ───── */}
          {activeTab === 'listings' && (
            <ListingsSection skills={profile.skills || []} />
          )}

          {/* ───── PROFILE TAB ───── */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <ProfileCard profile={profile} />
              <ShareReferralSection profile={profile} copiedProfile={copiedProfile} setCopiedProfile={setCopiedProfile} />
              <ProfileTilesGrid profile={profile} telegramStatus={telegramStatus} />
            </div>
          )}

          {/* ───── PAYMENTS TAB ───── */}
          {activeTab === 'payments' && (
            <div className="space-y-4" id="payment-setup-section">
              <Suspense fallback={<div className="bg-white rounded-lg shadow p-6 text-center text-gray-400 animate-pulse">Loading wallet tools…</div>}>
                <WalletProvider>
                  <WalletsSection
                    wallets={profile.wallets}
                    saving={saving}
                    onAddWallet={addWallet}
                    onAddWalletManual={addWalletManual}
                    onDeleteWallet={deleteWallet}
                    onUpdateWalletLabel={updateWalletLabel}
                  />
                </WalletProvider>
              </Suspense>
              <PaymentPreferencesSection
                paymentPreferences={profile.paymentPreferences || ['UPFRONT', 'ESCROW', 'UPON_COMPLETION']}
                saving={saving}
                isAvailable={profile.isAvailable}
                onPaymentPreferenceToggle={togglePaymentPreference}
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
              <FiatPaymentMethodsSection
                methods={profile.fiatPaymentMethods || []}
                saving={saving}
                onAdd={addFiatPaymentMethod}
                onUpdate={updateFiatPaymentMethod}
                onDelete={deleteFiatPaymentMethod}
                onSetPrimary={setFiatPaymentMethodPrimary}
              />
            </div>
          )}

          {/* ───── BOOST YOUR PROFILE TAB ───── */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Vouching — share profile and get vouched */}
              <VouchSection />

              {/* Verification + Humanity side-by-side on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <VerificationSection profile={profile} onProfileUpdate={loadProfile} />
                <HumanitySection profile={profile} onVerified={loadProfile} />
              </div>
            </div>
          )}

          {/* ───── PRIVACY TAB ───── */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <ContactPrivacySection
                profile={profile}
                editingProfile={editingProfile}
                profileForm={profileForm}
                setProfileForm={setProfileForm}
              />
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

      <Footer className="mt-12" />
    </div>
  );
}
