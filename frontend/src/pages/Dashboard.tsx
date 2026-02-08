import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { posthog } from '../lib/posthog';
import ProfileCompleteness from '../components/ProfileCompleteness';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import ConfirmDialog from '../components/ConfirmDialog';
import { Profile, Job, ReviewStats, Service } from '../components/dashboard/types';
import ShareReferralSection from '../components/dashboard/ShareReferralSection';
import TelegramSection from '../components/dashboard/TelegramSection';
import NotificationPreferencesSection from '../components/dashboard/NotificationPreferencesSection';
import AvailabilitySection from '../components/dashboard/AvailabilitySection';
import OfferFiltersSection from '../components/dashboard/OfferFiltersSection';
import JobsSection from '../components/dashboard/JobsSection';
import ProfileSection from '../components/dashboard/ProfileSection';
import WalletsSection from '../components/dashboard/WalletsSection';
import ServicesSection from '../components/dashboard/ServicesSection';
import AccountSection from '../components/dashboard/AccountSection';
import SEO from '../components/SEO';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    bio: '',
    location: '',
    skills: '',
    equipment: [] as string[],
    languages: [] as string[],
    contactEmail: '',
    telegram: '',
    whatsapp: '',
    paymentMethods: '',
    username: '',
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
        equipment: data.equipment || [],
        languages: data.languages || [],
        contactEmail: data.contactEmail || '',
        telegram: data.telegram || '',
        whatsapp: data.whatsapp || '',
        paymentMethods: data.paymentMethods || '',
        username: data.username || '',
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

  const acceptJob = async (jobId: string) => {
    try {
      await api.acceptJob(jobId);
      posthog.capture('job_accepted', { jobId });
      toast.success(t('toast.jobAccepted'));
      await loadJobs();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const rejectJob = async (jobId: string) => {
    setConfirmDialog({
      open: true,
      title: t('dashboard.jobs.confirmReject'),
      message: t('dashboard.jobs.confirmReject'),
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }));
        try {
          await api.rejectJob(jobId);
          posthog.capture('job_rejected', { jobId });
          toast.success(t('toast.jobRejected'));
          await loadJobs();
        } catch (error: any) {
          toast.error(error.message);
        }
      },
    });
  };

  const completeJob = async (jobId: string) => {
    try {
      await api.completeJob(jobId);
      posthog.capture('job_completed', { jobId });
      toast.success(t('toast.jobCompleted'));
      await loadJobs();
      await loadProfile();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleAvailability = async () => {
    if (!profile) return;
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
        skills: profileForm.skills.split(',').map(s => s.trim()).filter(Boolean),
        equipment: profileForm.equipment.length > 0 ? profileForm.equipment : null,
        languages: profileForm.languages.length > 0 ? profileForm.languages : null,
        contactEmail: profileForm.contactEmail || null,
        telegram: profileForm.telegram || null,
        whatsapp: profileForm.whatsapp || null,
        paymentMethods: profileForm.paymentMethods || null,
        username: profileForm.username || null,
        linkedinUrl: profileForm.linkedinUrl || null,
        twitterUrl: profileForm.twitterUrl || null,
        githubUrl: profileForm.githubUrl || null,
        instagramUrl: profileForm.instagramUrl || null,
        youtubeUrl: profileForm.youtubeUrl || null,
        websiteUrl: profileForm.websiteUrl || null,
      });
      posthog.capture('profile_updated');
      setProfile(updated);
      setEditingProfile(false);
      toast.success(t('toast.profileSaved'));
    } catch (error) {
      toast.error(t('toast.genericError'));
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
      toast.success(t('toast.filtersSaved'));
    } catch (error) {
      toast.error(t('toast.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const addWallet = async () => {
    setSaving(true);
    try {
      await api.addWallet(walletForm);
      posthog.capture('wallet_added', { network: walletForm.network });
      await loadProfile();
      setWalletForm({ network: 'ethereum', address: '', label: '' });
      setShowWalletForm(false);
      toast.success(t('toast.walletAdded'));
    } catch (error: any) {
      toast.error(error.message);
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
        } catch (error) {
          toast.error(t('toast.genericError'));
        }
      },
    });
  };

  const addService = async () => {
    setSaving(true);
    try {
      await api.createService(serviceForm);
      posthog.capture('service_added');
      await loadProfile();
      setServiceForm({ title: '', description: '', category: '', priceRange: '' });
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
    } catch (error) {
      toast.error(t('toast.genericError'));
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
        } catch (error) {
          toast.error(t('toast.genericError'));
        }
      },
    });
  };

  const toggleEmailNotifications = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile({ emailNotifications: !profile.emailNotifications });
      setProfile(updated);
      toast.success(t('toast.preferencesSaved'));
    } catch (error) {
      toast.error(t('toast.genericError'));
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

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Email verification banner */}
        {profile.emailVerified === false && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-sm text-yellow-800">{t('dashboard.emailVerification.banner')}</p>
            <button
              onClick={resendVerification}
              className="ml-4 text-sm font-medium text-yellow-800 hover:text-yellow-900 underline whitespace-nowrap"
            >
              {t('dashboard.emailVerification.resend')}
            </button>
          </div>
        )}

        <ProfileCompleteness profile={profile} onEditProfile={() => setEditingProfile(true)} />

        <ShareReferralSection
          profile={profile}
          copiedProfile={copiedProfile}
          setCopiedProfile={setCopiedProfile}
          copiedReferral={copiedReferral}
          setCopiedReferral={setCopiedReferral}
        />

        <TelegramSection
          telegramStatus={telegramStatus}
          telegramLinkUrl={telegramLinkUrl}
          telegramLoading={telegramLoading}
          onConnect={connectTelegram}
          onDisconnect={disconnectTelegram}
        />

        <NotificationPreferencesSection
          emailNotifications={profile.emailNotifications !== false}
          saving={saving}
          onToggle={toggleEmailNotifications}
        />

        <AvailabilitySection
          isAvailable={profile.isAvailable}
          paymentPreference={profile.paymentPreference || 'BOTH'}
          saving={saving}
          onToggle={toggleAvailability}
          onPaymentPreferenceChange={changePaymentPreference}
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

        <JobsSection
          jobs={jobs}
          jobsLoading={jobsLoading}
          jobFilter={jobFilter}
          setJobFilter={setJobFilter}
          reviewStats={reviewStats}
          onAcceptJob={acceptJob}
          onRejectJob={rejectJob}
          onCompleteJob={completeJob}
          profileId={profile.id}
          profileUsername={profile.username}
        />

        <ProfileSection
          profile={profile}
          editingProfile={editingProfile}
          setEditingProfile={setEditingProfile}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          saving={saving}
          onSaveProfile={saveProfile}
        />

        <WalletsSection
          wallets={profile.wallets}
          showWalletForm={showWalletForm}
          setShowWalletForm={setShowWalletForm}
          walletForm={walletForm}
          setWalletForm={setWalletForm}
          saving={saving}
          onAddWallet={addWallet}
          onDeleteWallet={deleteWallet}
        />

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

        <AccountSection
          profile={profile}
          onDeleteAccount={deleteAccount}
          onExportData={exportData}
          saving={saving}
        />
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
