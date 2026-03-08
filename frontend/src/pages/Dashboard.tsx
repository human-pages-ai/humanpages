import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { posthog } from '../lib/posthog';
import { analytics } from '../lib/analytics';
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

// Lazy-load wallet stack (Privy) — only fetched when payments tab opens
const WalletProvider = lazy(() => import('../components/dashboard/WalletProvider'));
const WalletsSection = lazy(() => import('../components/dashboard/WalletsSection'));
const FiatPaymentMethodsSection = lazy(() => import('../components/dashboard/FiatPaymentMethodsSection'));
import ServicesSection from '../components/dashboard/ServicesSection';
import AccountSection from '../components/dashboard/AccountSection';
import HumanitySection from '../components/dashboard/HumanitySection';
import VouchSection from '../components/dashboard/VouchSection';
import VerificationSection from '../components/dashboard/VerificationSection';
import PaymentPreferencesSection from '../components/dashboard/PaymentPreferencesSection';
import ContactPrivacySection from '../components/dashboard/ContactPrivacySection';
import FeaturedInviteModal from '../components/dashboard/FeaturedInviteModal';
import ListingsSection from '../components/dashboard/ListingsSection';
import SEO from '../components/SEO';
import Footer from '../components/Footer';

const VALID_TABS: DashboardTab[] = ['jobs', 'listings', 'profile', 'payments', 'settings', 'privacy'];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    featuredConsent: false,
    username: '',
    linkedinUrl: '',
    twitterUrl: '',
    githubUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    websiteUrl: '',
    workMode: null as 'REMOTE' | 'ONSITE' | 'HYBRID' | null,
  });

  const profileFormRef = useRef(profileForm);
  profileFormRef.current = profileForm;
  const initialProfileFormRef = useRef(profileForm);

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

  // Featured invite modal — shown when ?featured=1 is in the URL
  const [showFeaturedModal, setShowFeaturedModal] = useState(false);
  const [featuredModalValue, setFeaturedModalValue] = useState(false);
  const [featuredModalSaving, setFeaturedModalSaving] = useState(false);

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
  }, []);

  // Show featured invite modal when ?featured=1 is in the URL
  useEffect(() => {
    if (!profile) return;
    if (searchParams.get('featured') === '1' && !profile.featuredConsent) {
      setFeaturedModalValue(profile.featuredConsent || false);
      setShowFeaturedModal(true);
      searchParams.delete('featured');
      setSearchParams(searchParams, { replace: true });
    }
  }, [profile]);

  const saveFeaturedConsent = async () => {
    setFeaturedModalSaving(true);
    try {
      const updated = await api.updateProfile({ featuredConsent: featuredModalValue });
      setProfile(updated);
      setProfileForm(prev => ({ ...prev, featuredConsent: featuredModalValue }));
      initialProfileFormRef.current = { ...initialProfileFormRef.current, featuredConsent: featuredModalValue };
      setShowFeaturedModal(false);
      if (featuredModalValue) {
        toast.success(t('toast.featuredEnabled', { defaultValue: 'You\'re now featured on the homepage!' }));
      } else {
        toast.success(t('toast.profileSaved'));
      }
      posthog.capture('featured_consent_updated', { enabled: featuredModalValue });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.genericError'));
    } finally {
      setFeaturedModalSaving(false);
    }
  };

  // Poll for email verification when unverified (user may verify on another device)
  useEffect(() => {
    if (!profile || profile.emailVerified !== false) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.getProfile();
        if (data.emailVerified) {
          setProfile(prev => prev ? { ...prev, emailVerified: true } : prev);
          toast.success(t('toast.emailVerified'));
          clearInterval(interval);
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [profile?.emailVerified]);

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
        workMode: data.workMode || null,
      });
      setFiltersForm({
        minOfferPrice: data.minOfferPrice?.toString() || '',
        maxOfferDistance: data.maxOfferDistance?.toString() || '',
        minRateUsdc: data.minRateUsdc?.toString() || '',
        rateCurrency: data.rateCurrency || 'USD',
      });
      setServiceForm((prev) => ({ ...prev, priceCurrency: data.rateCurrency || 'USD' }));
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

  const handleUploadPhoto = async (file: File) => {
    await api.uploadProfilePhoto(file);
    await loadProfile();
  };

  const handleDeletePhoto = async () => {
    await api.deleteProfilePhoto();
    await loadProfile();
  };

  const buildProfilePayload = (form: typeof profileForm) => ({
    name: form.name,
    bio: form.bio || null,
    location: form.location || null,
    neighborhood: form.neighborhood || null,
    locationGranularity: form.locationGranularity,
    locationLat: form.locationLat ?? null,
    locationLng: form.locationLng ?? null,
    skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
    equipment: form.equipment.length > 0 ? form.equipment : null,
    languages: form.languages.length > 0 ? form.languages : null,
    contactEmail: form.contactEmail || null,
    telegram: form.telegram || null,
    whatsapp: form.whatsapp || null,
    paymentMethods: form.paymentMethods || null,
    hideContact: form.hideContact,
    featuredConsent: form.featuredConsent,
    username: form.username || null,
    linkedinUrl: form.linkedinUrl || null,
    twitterUrl: form.twitterUrl || null,
    githubUrl: form.githubUrl || null,
    facebookUrl: form.facebookUrl || null,
    instagramUrl: form.instagramUrl || null,
    youtubeUrl: form.youtubeUrl || null,
    websiteUrl: form.websiteUrl || null,
    workMode: form.workMode || null,
  });

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile(buildProfilePayload(profileForm));
      posthog.capture('profile_updated');
      setProfile(updated);
      setEditingProfile(false);
      initialProfileFormRef.current = profileForm;
      toast.success(t('toast.profileSaved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.genericError'));
    } finally {
      setSaving(false);
    }
  };

  // Auto-save profile on form changes (debounced 1.5s)
  const autoSaveProfile = useCallback(async () => {
    const form = profileFormRef.current;
    setAutoSaving(true);
    try {
      const updated = await api.updateProfile(buildProfilePayload(form));
      posthog.capture('profile_updated');
      setProfile(updated);
      initialProfileFormRef.current = form;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.genericError'));
    } finally {
      setAutoSaving(false);
    }
  }, []);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSaveProfile();
    }, 1500);
  }, [autoSaveProfile]);

  // Trigger auto-save when profileForm changes while editing
  useEffect(() => {
    if (!editingProfile) return;
    // Skip the initial render when editing starts (form just loaded from profile)
    if (JSON.stringify(profileFormRef.current) === JSON.stringify(initialProfileFormRef.current)) return;
    scheduleAutoSave();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [profileForm, editingProfile, scheduleAutoSave]);

  // When entering edit mode, snapshot the form state
  useEffect(() => {
    if (editingProfile) {
      initialProfileFormRef.current = profileForm;
    }
  }, [editingProfile]);

  const checkUsernameAvailability = useCallback(async (username: string): Promise<boolean> => {
    try {
      const { available } = await api.checkUsername(username);
      return available;
    } catch {
      return true; // Don't block on network errors
    }
  }, []);

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

  const addWalletManual = async (address: string, source?: 'privy' | 'manual_paste') => {
    setSaving(true);
    try {
      await api.addWalletManual({ address, source });
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
      message: 'This payment method will be removed from your profile.',
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }));
        try {
          await api.deleteFiatPaymentMethod(id);
          toast.success('Payment method deleted');
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
      const prevWalletCount = profile?.wallets?.length ?? 0;
      await loadProfile();
      setServiceForm({ title: '', description: '', category: '', priceMin: '', priceUnit: '', priceCurrency: profile?.rateCurrency || 'USD' });
      setShowServiceForm(false);
      toast.success(t('toast.serviceAdded'));
      if (prevWalletCount === 0) {
        setTimeout(() => {
          toast(
            (toastObj) => (
              <div>
                <p className="font-medium text-sm">{t('toast.walletNudgeTitle')}</p>
                <p className="text-xs text-gray-500 mt-1">{t('toast.walletNudgeDescription')}</p>
                <button
                  className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-500"
                  onClick={() => {
                    toast.dismiss(toastObj.id);
                    setActiveTab('payments');
                  }}
                >
                  {t('toast.walletNudgeAction')}
                </button>
              </div>
            ),
            { duration: 8000 }
          );
        }, 500);
      }
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
          onCompleteProfile={(fieldId) => {
            setActiveTab('profile');
            setEditingProfile(true);
            if (fieldId) {
              setTimeout(() => {
                document.getElementById(fieldId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                document.getElementById(fieldId)?.focus();
              }, 100);
            }
          }}
          onAddService={() => {
            setActiveTab('profile');
            setShowServiceForm(true);
            setTimeout(() => {
              document.getElementById('services-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }}
          onScrollToWallets={() => setActiveTab('payments')}
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

          {/* ───── LISTINGS TAB ───── */}
          {activeTab === 'listings' && (
            <ListingsSection skills={profile.skills || []} />
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
                    autoSaving={autoSaving}
                    onSaveProfile={saveProfile}
                    onCheckUsername={checkUsernameAvailability}
                    onUploadPhoto={handleUploadPhoto}
                    onDeletePhoto={handleDeletePhoto}
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
                    emailNotifications={profile.emailNotifications !== false}
                    telegramNotifications={profile.telegramNotifications !== false}
                    whatsappNotifications={profile.whatsappNotifications !== false}
                    emailDigestMode={profile.emailDigestMode || 'REALTIME'}
                    saving={saving}
                    onToggleAvailability={toggleAvailability}
                    onToggleNotification={toggleNotification}
                    onEmailDigestModeChange={changeEmailDigestMode}
                  />
                </div>
              </div>

              {/* Sharing & Referral — full width below the grid */}
              <ShareReferralSection
                profile={profile}
                copiedProfile={copiedProfile}
                setCopiedProfile={setCopiedProfile}
              />
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
              <Suspense fallback={<div className="bg-white rounded-lg shadow p-6 text-center text-gray-400 animate-pulse">Loading…</div>}>
                <FiatPaymentMethodsSection
                  methods={profile.fiatPaymentMethods || []}
                  saving={saving}
                  onAdd={addFiatPaymentMethod}
                  onUpdate={updateFiatPaymentMethod}
                  onDelete={deleteFiatPaymentMethod}
                  onSetPrimary={setFiatPaymentMethodPrimary}
                />
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
            </div>
          )}

          {/* ───── BOOST YOUR PROFILE TAB ───── */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Verification + Humanity side-by-side on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <VerificationSection profile={profile} onProfileUpdate={loadProfile} />
                <HumanitySection profile={profile} onVerified={loadProfile} />
              </div>

              {/* Integrations */}
              <TelegramSection
                telegramStatus={telegramStatus}
                telegramLinkUrl={telegramLinkUrl}
                telegramLoading={telegramLoading}
                onConnect={connectTelegram}
                onDisconnect={disconnectTelegram}
              />

              <VouchSection />
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

      <FeaturedInviteModal
        open={showFeaturedModal}
        enabled={featuredModalValue}
        saving={featuredModalSaving}
        onToggle={setFeaturedModalValue}
        onSave={saveFeaturedConsent}
        onClose={() => setShowFeaturedModal(false)}
      />

      <Footer className="mt-12" />
    </div>
  );
}
