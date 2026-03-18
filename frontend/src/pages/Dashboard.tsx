import { useState, useEffect, useRef, lazy, Suspense } from 'react';
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
import { VouchCard } from '../components/shared/VouchCard';
import { Profile, Job, ReviewStats } from '../components/dashboard/types';
// StatusHeader removed — wizard module tiles replace the profile completion banner
import DashboardTabs, { DashboardTab } from '../components/dashboard/DashboardTabs';
import TelegramSection from '../components/dashboard/TelegramSection';
import WhatsAppSection from '../components/dashboard/WhatsAppSection';
import OfferFiltersSection from '../components/dashboard/OfferFiltersSection';
import JobsSection from '../components/dashboard/JobsSection';
// import CvUpload from '../components/dashboard/CvUpload'; // Hidden: CV upload disabled
import WizardModuleTile from '../components/dashboard/WizardModuleTile';

// Lazy-load wallet stack (Privy) — only fetched when payments tab opens
const WalletProvider = lazy(() => import('../components/dashboard/WalletProvider'));
const WalletsSection = lazy(() => import('../components/dashboard/WalletsSection'));
import AccountSection from '../components/dashboard/AccountSection';
import HumanitySection from '../components/dashboard/HumanitySection';
import VouchSection from '../components/dashboard/VouchSection';
import VerificationSection from '../components/dashboard/VerificationSection';
import PaymentPreferencesSection from '../components/dashboard/PaymentPreferencesSection';
import ContactPrivacySection from '../components/dashboard/ContactPrivacySection';
import ListingsSection from '../components/dashboard/ListingsSection';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import { safeLocalStorage } from '../lib/safeStorage';

const VALID_TABS: DashboardTab[] = ['jobs', 'listings', 'profile', 'payments', 'settings', 'privacy'];

// Helper component for rendering chips in a consistent style
function ChipList({ items, color = 'blue' }: { items: string[]; color?: 'blue' | 'amber' | 'green' }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-800',
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProfile] = useState(false);

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
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);

  const [whatsappStatus, setWhatsappStatus] = useState<{
    connected: boolean;
    botAvailable: boolean;
    whatsappNumber?: string;
    botNumber?: string;
  } | null>(null);
  const [whatsappLinkCode, setWhatsappLinkCode] = useState<string | null>(null);
  const [whatsappWaLink, setWhatsappWaLink] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

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
    loadWhatsAppStatus();

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

  const loadWhatsAppStatus = async () => {
    try {
      const status = await api.getWhatsAppStatus();
      setWhatsappStatus(status);
    } catch (error) {
      console.error('Failed to load WhatsApp status:', error);
    }
  };

  const connectWhatsApp = async () => {
    setWhatsappLoading(true);
    try {
      const { code, waLink } = await api.linkWhatsApp();
      setWhatsappLinkCode(code);
      setWhatsappWaLink(waLink ?? null);
      // Poll for connection
      const pollInterval = setInterval(async () => {
        const status = await api.getWhatsAppStatus();
        if (status.connected) {
          clearInterval(pollInterval);
          setWhatsappStatus(status);
          setWhatsappLinkCode(null);
          setWhatsappWaLink(null);
          toast.success('WhatsApp connected!');
        }
      }, 3000);
      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
    } finally {
      setWhatsappLoading(false);
    }
  };

  const disconnectWhatsApp = async () => {
    setConfirmDialog({
      open: true,
      title: 'Disconnect WhatsApp',
      message: 'You will no longer receive notifications via WhatsApp. Continue?',
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }));
        try {
          await api.unlinkWhatsApp();
          setWhatsappStatus({ connected: false, botAvailable: whatsappStatus?.botAvailable || false });
          toast.success('WhatsApp disconnected');
        } catch (error: any) {
          toast.error(error.message || t('toast.genericError'));
        }
      },
    });
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
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <LanguageSwitcher />
            <span className="text-gray-600 truncate max-w-[120px] sm:max-w-[200px]">{user?.name}</span>
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
          {activeTab === 'profile' && (() => {
            // Profile completion scoring
            const checks = [
              { label: 'Name', done: !!profile.name?.trim(), stepId: 'profile' },
              { label: 'Photo', done: !!profile.profilePhotoUrl, stepId: 'profile' },
              { label: 'Skills', done: (profile.skills?.length || 0) > 0, stepId: 'skills' },
              { label: 'Location', done: !!profile.location?.trim(), stepId: 'location' },
              { label: 'Services', done: profile.services?.some(s => s.isActive) ?? false, stepId: 'services' },
              { label: 'Equipment', done: (profile.equipment?.length || 0) > 0, stepId: 'equipment' },
              { label: 'Payment', done: profile.wallets.length > 0, stepId: 'payment' },
              { label: 'Bio', done: !!profile.bio?.trim(), stepId: 'profile' },
            ];
            const doneCount = checks.filter(c => c.done).length;
            const pct = Math.round((doneCount / checks.length) * 100);
            const firstIncomplete = checks.find(c => !c.done);
            const level = pct >= 100 ? 'Pro' : pct >= 75 ? 'Rising' : pct >= 50 ? 'Starter' : 'New';
            const levelColor = pct >= 100 ? 'text-green-600' : pct >= 75 ? 'text-blue-600' : pct >= 50 ? 'text-orange-600' : 'text-slate-500';
            const ringColor = pct >= 100 ? '#22c55e' : pct >= 75 ? '#3b82f6' : pct >= 50 ? '#f97316' : '#94a3b8';
            const circumference = 2 * Math.PI * 40;
            const dashOffset = circumference - (pct / 100) * circumference;

            return (
            <div className="space-y-6">
              {/* Profile card with photo, name, progress ring, level */}
              <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                <div className="flex items-center gap-5">
                  {/* Progress ring with photo inside */}
                  <div className="relative w-24 h-24 shrink-0">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="40" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                      <circle cx="48" cy="48" r="40" fill="none" stroke={ringColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} className="transition-all duration-700" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {profile.profilePhotoUrl ? (
                        <img src={profile.profilePhotoUrl || ''} alt="" className="w-16 h-16 rounded-full object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-400">
                          {profile.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Name + level + progress */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{profile.name || 'Complete your profile'}</h2>
                    {profile.username && <p className="text-sm text-slate-500">@{profile.username}</p>}
                    <div className="mt-2 flex items-center gap-3">
                      <span className={`text-xs font-bold uppercase tracking-wide ${levelColor}`}>{level}</span>
                      <span className="text-xs text-slate-400">{pct}% complete</span>
                    </div>
                    {/* Checklist pills */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {checks.map(c => (
                        <span key={c.label} className={`text-[10px] px-2 py-0.5 rounded-full ${c.done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                          {c.done ? '✓' : '○'} {c.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  {firstIncomplete && (
                    <Link
                      to={`/onboarding?step=${firstIncomplete.stepId}`}
                      className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 shadow whitespace-nowrap"
                    >
                      + {firstIncomplete.label}
                    </Link>
                  )}
                </div>
              </div>

              {/* Wizard Module Tiles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Notifications & Connect */}
                <WizardModuleTile
                  title="Notifications & Connect"
                  stepId="connect"
                  icon="🔔"
                  color="blue"
                  isEmpty={!profile.pushNotifications && !telegramStatus?.connected && !profile.whatsapp}
                  emptyHint="Enable notifications to never miss a job offer"
                >
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs">Push Notifications:</span>{' '}
                      <span className={`text-sm font-medium ${profile.pushNotifications ? 'text-green-600' : 'text-gray-400'}`}>
                        {profile.pushNotifications ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Telegram:</span>{' '}
                      <span className={`text-sm font-medium ${telegramStatus?.connected ? 'text-green-600' : 'text-gray-400'}`}>
                        {telegramStatus?.connected ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">WhatsApp:</span>{' '}
                      <span className={`text-sm font-medium ${profile.whatsapp ? 'text-green-600' : 'text-gray-400'}`}>
                        {profile.whatsapp || '—'}
                      </span>
                    </div>
                  </div>
                </WizardModuleTile>

                {/* 2. Skills */}
                <WizardModuleTile
                  title="Skills"
                  stepId="skills"
                  icon="⚡"
                  color="purple"
                  isEmpty={!profile.skills || profile.skills.length === 0}
                  emptyHint="Add skills so agents can find you"
                >
                  {profile.skills && profile.skills.length > 0 ? (
                    <ChipList items={profile.skills} color="blue" />
                  ) : null}
                </WizardModuleTile>

                {/* 3. Equipment */}
                <WizardModuleTile
                  title="Equipment"
                  stepId="equipment"
                  icon="🔧"
                  color="amber"
                  isEmpty={!profile.equipment || profile.equipment.length === 0}
                  emptyHint="List your tools to match physical tasks"
                >
                  {profile.equipment && profile.equipment.length > 0 ? (
                    <ChipList items={profile.equipment} color="amber" />
                  ) : null}
                </WizardModuleTile>

                {/* 4. Location */}
                <WizardModuleTile
                  title="Location"
                  stepId="location"
                  icon="📍"
                  color="green"
                  isEmpty={!profile.location}
                  emptyHint="Set location so agents find you for nearby tasks"
                >
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs">Location:</span>{' '}
                      <span className={`text-sm font-medium ${profile.location ? 'text-gray-900' : 'text-gray-400'}`}>
                        {profile.location ? (
                          profile.locationGranularity === 'neighborhood' && profile.neighborhood
                            ? `${profile.neighborhood}, ${profile.location}`
                            : profile.location
                        ) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Timezone:</span>{' '}
                      <span className={`text-sm font-medium ${profile.timezone ? 'text-gray-900' : 'text-gray-400'}`}>
                        {profile.timezone || '—'}
                      </span>
                    </div>
                  </div>
                </WizardModuleTile>

                {/* 5. Education & Experience */}
                <WizardModuleTile
                  title="Education & Experience"
                  stepId="education"
                  icon="🎓"
                  color="indigo"
                  isEmpty={(!profile.education || profile.education.length === 0) && !profile.yearsOfExperience}
                  emptyHint="Add experience to stand out"
                >
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs">Years of Experience:</span>{' '}
                      <span className={`text-sm font-medium ${profile.yearsOfExperience ? 'text-gray-900' : 'text-gray-400'}`}>
                        {profile.yearsOfExperience != null && profile.yearsOfExperience > 0
                          ? `${profile.yearsOfExperience} ${profile.yearsOfExperience === 1 ? 'year' : 'years'}`
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Education:</span>
                      {profile.education && profile.education.length > 0 ? (
                        <div className="space-y-1 mt-1">
                          {profile.education.map((edu) => (
                            <div key={edu.id} className="text-xs">
                              <span className="font-medium text-gray-900">{edu.institution}</span>
                              {edu.degree && <span className="text-gray-600"> — {edu.degree}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">None added</span>
                      )}
                    </div>
                  </div>
                </WizardModuleTile>

                {/* 6. Services */}
                <WizardModuleTile
                  title="Services"
                  stepId="services"
                  icon="💼"
                  color="teal"
                  isEmpty={!profile.services || profile.services.length === 0}
                  emptyHint="Define services to get hired"
                >
                  {profile.services && profile.services.length > 0 ? (
                    <div className="space-y-2">
                      {profile.services.map((service) => (
                        <div key={service.id} className="text-xs">
                          <span className="font-medium text-gray-900">{service.title}</span>
                          {service.priceMin && (
                            <span className="text-gray-600 ml-2">
                              {service.priceCurrency || 'USD'} {service.priceMin} {service.priceUnit || 'flat'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </WizardModuleTile>

                {/* 7. Profile (Name, Bio, Photo) */}
                <WizardModuleTile
                  title="Profile"
                  stepId="profile"
                  icon="👤"
                  color="rose"
                  isEmpty={!profile.name}
                  emptyHint="Add a name and photo to build trust"
                >
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs">Name:</span>{' '}
                      <span className={`text-sm font-medium ${profile.name ? 'text-gray-900' : 'text-gray-400'}`}>
                        {profile.name || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Bio:</span>{' '}
                      {profile.bio ? (
                        <p className="text-sm text-gray-900 mt-1 line-clamp-2">{profile.bio}</p>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Photo:</span>{' '}
                      <span className={`text-sm font-medium ${profile.profilePhotoUrl ? 'text-green-600' : 'text-gray-400'}`}>
                        {profile.profilePhotoUrl ? 'Added' : '—'}
                      </span>
                    </div>
                  </div>
                </WizardModuleTile>

                {/* 8. Availability */}
                <WizardModuleTile
                  title="Availability"
                  stepId="availability"
                  icon="📅"
                  color="orange"
                  isEmpty={!profile.workType && !profile.weeklyCapacityHours}
                  emptyHint="Set availability so agents know when to hire you"
                >
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs">Work Type:</span>{' '}
                      <span className={`text-sm font-medium ${profile.workType ? 'text-gray-900' : 'text-gray-400'}`}>
                        {profile.workType || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Weekly Hours:</span>{' '}
                      <span className={`text-sm font-medium ${profile.weeklyCapacityHours ? 'text-gray-900' : 'text-gray-400'}`}>
                        {profile.weeklyCapacityHours ? `${profile.weeklyCapacityHours} hours/week` : '—'}
                      </span>
                    </div>
                  </div>
                </WizardModuleTile>

                {/* 9. Verification */}
                <WizardModuleTile
                  title="Verification"
                  stepId="verification"
                  icon="✅"
                  color="green"
                  isEmpty={!profile.linkedinVerified && !profile.githubVerified}
                  emptyHint="Verify accounts to boost trust score"
                >
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs">LinkedIn:</span>{' '}
                      <span className={`text-sm font-medium ${profile.linkedinVerified ? 'text-green-600' : 'text-gray-400'}`}>
                        {profile.linkedinVerified ? 'Verified' : 'Not verified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">GitHub:</span>{' '}
                      <span className={`text-sm font-medium ${profile.githubVerified ? 'text-green-600' : 'text-gray-400'}`}>
                        {profile.githubVerified ? 'Verified' : 'Not verified'}
                      </span>
                    </div>
                  </div>
                </WizardModuleTile>
              </div>

              {/* Share Profile Link — using VouchCard for consistency */}
              <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Share Your Profile</h2>
                <VouchCard
                  username={profile.username}
                  userId={profile.id}
                  vouchCount={0}
                  vouchTarget={10}
                />
              </div>
            </div>
            );
          })()}

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

              {/* Integrations */}
              <TelegramSection
                telegramStatus={telegramStatus}
                telegramLinkUrl={telegramLinkUrl}
                telegramLoading={telegramLoading}
                onConnect={connectTelegram}
                onDisconnect={disconnectTelegram}
              />

              <WhatsAppSection
                whatsappStatus={whatsappStatus}
                linkCode={whatsappLinkCode}
                waLink={whatsappWaLink}
                loading={whatsappLoading}
                onConnect={connectWhatsApp}
                onDisconnect={disconnectWhatsApp}
              />
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
