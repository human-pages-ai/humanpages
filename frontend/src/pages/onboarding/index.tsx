import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { analytics } from '../../lib/analytics';
import { posthog } from '../../lib/posthog';
import { safeLocalStorage } from '../../lib/safeStorage';
import toast from 'react-hot-toast';
import SEO from '../../components/SEO';
import { getApplyIntent, clearApplyIntent, getListingApplyIntent, clearListingApplyIntent } from '../../lib/applyIntent';
import { isInAppBrowser, scrollToError, serializeLanguageEntry } from './utils';
// POPULAR_SERVICE_CATEGORIES removed — services are saved regardless of category
import { useProfileForm } from './hooks/useProfileForm';
import { useCvProcessing } from './hooks/useCvProcessing';
import { useDraftPersistence, loadDraft, clearDraft } from './hooks/useDraftPersistence';
import { getFlow, getStepLabels, stepAt, totalSteps } from './useStepFlow';
import type { StepId } from './useStepFlow';
import type { LanguageEntry } from './types';

// Step components — each is a self-contained module
import { StepConnect } from './steps/StepConnect';
import { StepCvUpload } from './steps/StepCvUpload';
import { StepSkills } from './steps/StepSkills';
import { StepServices } from './steps/StepServices';
import { StepVouch } from './steps/StepVouch';
import { StepLocation } from './steps/StepLocation';
import { StepEducation } from './steps/StepEducation';
import { StepPayment } from './steps/StepPayment';
import { StepAboutYou } from './steps/StepAboutYou';
import { StepAvailability } from './steps/StepAvailability';
import { StepFinish } from './steps/StepFinish';
import { StepErrorBoundary } from './components/StepErrorBoundary';

// Step completion emojis — universal
const STEP_COMPLETION_EMOJIS: Record<StepId, string> = {
  'connect':      '🔔',
  'cv-upload':    '📄',
  'skills':       '⚡',
  'equipment':    '🔧',
  'vouch':        '🤝',
  'location':     '📍',
  'education':    '🎓',
  'payment':      '💰',
  'services':     '💼',
  'profile':      '👤',
  'availability': '📅',
  'verification': '✅',
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const draft = useMemo(() => loadDraft(), []);

  // ─── Hooks ───
  const form = useProfileForm(draft);

  // Optimistic CV flow state — true from the moment user selects a file,
  // reverted to false if upload or parsing fails.
  const [cvActive, setCvActive] = useState(() => !!(draft?.cvUploaded && draft?.cvData));

  // Track which step to return to after a successful re-upload.
  // When CV fails and user is sent back to cv-upload, this stores where they were.
  const returnToStepRef = useRef<string | null>(null);

  const cv = useCvProcessing({
    setName: form.setName,
    setBio: form.setBio,
    setLocation: form.setLocation,
    setSkills: form.setSkills,
    setLanguageEntries: form.setLanguageEntries,
    setEducationEntries: form.setEducationEntries,
    setYearsOfExperience: form.setYearsOfExperience,
    setLinkedinUrl: form.setLinkedinUrl,
    setGithubUrl: form.setGithubUrl,
    setTwitterUrl: form.setTwitterUrl,
    setWebsiteUrl: form.setWebsiteUrl,
    getCurrentSocialUrls: () => ({
      linkedinUrl: form.linkedinUrl,
      githubUrl: form.githubUrl,
      twitterUrl: form.twitterUrl,
      websiteUrl: form.websiteUrl,
    }),
    setExternalProfiles: form.setExternalProfiles,
    mountedRef: form.mountedRef,

    // Stage 1: File selected — advance to equipment immediately
    onFileSelected: () => {
      setCvActive(true);
      // If we have a saved return step (re-upload), go there; otherwise equipment
      const target = returnToStepRef.current || 'equipment';
      returnToStepRef.current = null;
      setSearchParams({ step: target }, { replace: true });
      window.scrollTo({ top: 0 });
    },

    // Stage 2/3 failure: revert to NO_CV flow, send user back to cv-upload
    onCvFailed: (_reason: string) => {
      // Save where the user currently is so we can return them on re-upload
      const currentStep = searchParams.get('step');
      if (currentStep && currentStep !== 'cv-upload') {
        returnToStepRef.current = currentStep;
      }
      setCvActive(false);
      setSearchParams({ step: 'cv-upload' }, { replace: true });
      window.scrollTo({ top: 0 });
    },

    // Stage 3 success: CV data applied — confirm the flow (already on CV flow)
    onParseComplete: () => {
      // cvActive is already true from onFileSelected, and cvUploaded is now true
      // from applyParsedCvData. Nothing to do here — the user keeps working.
    },
  });

  // Restore CV state from draft
  useEffect(() => {
    if (draft?.cvUploaded && draft?.cvData) {
      cv.setCvUploaded(true);
      cv.setCvData(draft.cvData);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — only on mount, draft is memoized

  // ─── Flow engine ───
  // Use optimistic cvActive for flow ordering (not cvUploaded, which only becomes
  // true after parsing completes). This lets us switch to CV flow on file selection.
  const flow = useMemo(() => getFlow(cvActive), [cvActive]);
  const labels = useMemo(() => getStepLabels(flow), [flow]);
  const total = totalSteps(flow);

  // Derive position from URL param, falling back to draft
  const urlStepId = searchParams.get('step') as StepId | null;
  const position = useMemo(() => {
    if (urlStepId) {
      const idx = flow.findIndex(s => s.id === urlStepId);
      if (idx !== -1) return idx + 1;
    }
    return Math.max(1, Math.min(draft?.step || 1, total));
  }, [urlStepId, flow, draft, total]);

  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const prevPositionRef = useRef(position);

  // Current step ID derived from position
  const currentStepId = stepAt(flow, position);

  // ─── Completed onboarding guard ───
  // Only redirect if user landed on /onboarding without a ?step= param.
  // If ?step= is present, the user explicitly wants to edit that step (e.g., from dashboard "Edit" button).
  useEffect(() => {
    if (!form.profileLoading && form.profileCompleted && !urlStepId) {
      navigate('/dashboard', { replace: true });
    }
  }, [form.profileLoading, form.profileCompleted, navigate]);

  // Telegram state (persists across step navigation)
  const [telegramStatus, setTelegramStatus] = useState<{ connected: boolean; botAvailable: boolean; botUsername?: string } | null>(null);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);

  // ─── Draft persistence ───
  const saveStatus = useDraftPersistence({
    step: position,
    id: form.id,
    name: form.name, bio: form.bio, location: form.location,
    neighborhood: form.neighborhood, locationLat: form.locationLat, locationLng: form.locationLng,
    skills: form.skills, educationEntries: form.educationEntries, languageEntries: form.languageEntries,
    services: form.services,
    linkedinUrl: form.linkedinUrl, githubUrl: form.githubUrl, twitterUrl: form.twitterUrl,
    websiteUrl: form.websiteUrl, instagramUrl: form.instagramUrl, youtubeUrl: form.youtubeUrl,
    facebookUrl: form.facebookUrl, tiktokUrl: form.tiktokUrl,
    walletAddress: form.walletAddress,
    whatsappNumber: form.whatsappNumber,
    smsNumber: form.smsNumber,
    timezone: form.timezone, weeklyCapacityHours: form.weeklyCapacityHours,
    workType: form.workType,
    yearsOfExperience: form.yearsOfExperience,
    freelancerJobsRange: form.freelancerJobsRange,
    industries: form.industries,
    equipment: form.equipment,
    platformPresence: form.platformPresence,
    cvUploaded: cv.cvUploaded && cv.cvData != null,
    cvData: cv.cvData,
  });

  // CV auto-advance is handled by the onFileSelected callback in useCvProcessing.
  // No effect needed — the callback fires directly on file selection.

  // ─── Save step data (for edit mode) ───
  const saveCurrentStepData = useCallback(async (stepId: StepId) => {
    try {
      // Always save profile fields
      await api.updateProfile({
        name: form.name.trim() || undefined,
        bio: form.bio.trim() || null,
        location: form.location.trim() || null,
        skills: form.skills,
        equipment: form.equipment.length > 0 ? form.equipment : [],
        timezone: form.timezone.trim() || null,
        weeklyCapacityHours: form.weeklyCapacityHours,
        workType: form.workType.trim() || null,
        username: form.username?.trim() || undefined,
        yearsOfExperience: form.yearsOfExperience,
        freelancerJobsRange: form.freelancerJobsRange || null,
        platformPresence: form.platformPresence.length > 0 ? form.platformPresence : null,
        externalProfiles: form.externalProfiles.length > 0 ? form.externalProfiles : undefined,
        languages: form.languageEntries.length > 0
          ? [...new Map(form.languageEntries.map(e => [e.language.trim().toLowerCase(), serializeLanguageEntry(e)])).values()]
          : null,
      });

      // Save services if on services step
      if (stepId === 'services') {
        for (const svc of form.services) {
          if (svc.title.trim()) {
            const price = svc.price?.trim() ? parseFloat(svc.price.trim()) : null;
            const validPrice = price !== null && !isNaN(price) && price > 0 ? price : null;
            await api.createService({
              title: svc.title.trim(),
              description: svc.description.trim(),
              category: svc.category.trim(),
              subcategory: svc.subcategory?.trim() || null,
              priceMin: validPrice,
              priceCurrency: svc.currency,
              priceUnit: svc.unit || null,
            }).catch(err => console.error('Service save failed:', err));
          }
        }
      }
    } catch (err) {
      console.error('Auto-save step data failed:', err);
    }
  }, [form]);

  // ─── Navigation ───
  const submittingRef = useRef(false);

  const goToPosition = useCallback((nextPos: number) => {
    const clamped = Math.max(1, Math.min(nextPos, total));
    if (submittingRef.current || clamped === position) return;

    // Save draft immediately before transitioning (for slow internet)
    const saveNow = (window as any).__draftSaveNow;
    if (saveNow) saveNow();

    // In edit mode: save current step data when advancing or going back
    if (urlStepId && form.profileCompleted && currentStepId) {
      saveCurrentStepData(currentStepId);
    }

    // Show step completion toast when advancing forward
    if (clamped > position && position > 0) {
      const completedStep = flow[position - 1];
      const stepId = completedStep.id;
      const emoji = STEP_COMPLETION_EMOJIS[stepId];
      const messageKey = stepId === 'cv-upload' ? 'cvUpload' : stepId;
      const message = t(`onboarding.completion.${messageKey}`);
      if (message) {
        toast(message, { icon: emoji, duration: 2000 });
      }
    }

    setTransitioning(true);
    prevPositionRef.current = position;

    requestAnimationFrame(() => {
      setSearchParams({ step: flow[clamped - 1].id }, { replace: true });
      form.setError('');
      window.scrollTo({ top: 0, behavior: window.innerWidth < 640 ? 'auto' : 'smooth' });
      requestAnimationFrame(() => {
        setTransitioning(false);
        const heading = document.querySelector('[data-step-heading]') as HTMLElement;
        heading?.focus();
      });
    });
  }, [position, total, flow, setSearchParams, form, urlStepId, currentStepId, saveCurrentStepData]);

  // Universal next/skip/back — every step uses these
  const handleNext = useCallback(() => {
    goToPosition(position + 1);
  }, [goToPosition, position]);

  const handleSkip = useCallback(() => {
    goToPosition(position + 1);
  }, [goToPosition, position]);

  const handleBack = useCallback(() => {
    goToPosition(position - 1);
  }, [goToPosition, position]);

  // ─── Final submit ───
  const handleFinalSubmit = async () => {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;

    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      submittingRef.current = false;
      form.setError('You appear to be offline. Please check your connection and try again.');
      scrollToError();
      return;
    }

    setLoading(true);
    form.setError('');

    try {
      // Dedup skills
      const seen = new Set<string>();
      const cleanSkills = (form.skills || []).reduce<string[]>((acc, s) => {
        const key = s.trim().toLowerCase();
        if (!seen.has(key)) { seen.add(key); acc.push(s.trim()); }
        return acc;
      }, []);
      const cleanLanguages = form.languageEntries.length > 0
        ? [...new Map(form.languageEntries.map((e: LanguageEntry) => [e.language.trim().toLowerCase(), serializeLanguageEntry(e)])).values()]
        : null;

      await Promise.race([
        api.updateProfile({
          name: form.name.trim(),
          bio: form.bio.trim() || null,
          location: form.location.trim() || null,
          neighborhood: form.neighborhood?.trim() || null,
          locationLat: form.locationLat ?? null,
          locationLng: form.locationLng ?? null,
          skills: cleanSkills,
          languages: cleanLanguages,
          featuredConsent: true,
          username: form.username?.trim() || undefined,
          walletAddress: form.walletAddress.trim() || null,
          whatsapp: form.whatsappNumber.trim() || null,
          sms: form.smsNumber?.trim() || null,
          timezone: form.timezone.trim() || null,
          weeklyCapacityHours: form.weeklyCapacityHours,
          workType: form.workType.trim() || null,
          yearsOfExperience: form.yearsOfExperience,
          equipment: form.equipment.length > 0 ? form.equipment : [],
          industries: form.industries.length > 0 ? form.industries : [],
          freelancerJobsRange: form.freelancerJobsRange || null,
          platformPresence: form.platformPresence.length > 0 ? form.platformPresence : null,
          externalProfiles: form.externalProfiles.length > 0 ? form.externalProfiles : undefined,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 15000)),
      ]);

      // Non-blocking parallel saves
      const nonBlocking: Promise<void>[] = [];

      if (form.photoFile) {
        nonBlocking.push(api.uploadProfilePhoto(form.photoFile).then(() => {}).catch(err => console.error('Photo upload failed:', err)));
      } else if (form.oauthPhotoUrl) {
        nonBlocking.push(api.importOAuthPhoto('google').then(() => {}).catch(err => console.error('OAuth photo import failed:', err)));
      }

      for (const edu of form.educationEntries) {
        if (edu.institution.trim() || edu.degree.trim() || edu.field.trim()) {
          nonBlocking.push(
            api.addEducation({ institution: edu.institution.trim(), degree: edu.degree.trim() || undefined, field: edu.field.trim() || undefined, country: edu.country.trim() || undefined, startYear: edu.startYear || undefined, endYear: edu.endYear || undefined })
              .then(() => {}).catch(err => console.error('Education save failed:', err))
          );
        }
      }

      for (const svc of form.services) {
        if (svc.title.trim()) {
          const price = svc.price?.trim() ? parseFloat(svc.price.trim()) : null;
          const validPrice = price !== null && !isNaN(price) && price > 0 ? price : null;
          nonBlocking.push(
            api.createService({ title: svc.title.trim(), description: svc.description.trim(), category: svc.category.trim(), subcategory: svc.subcategory?.trim() || null, priceMin: validPrice, priceCurrency: svc.currency, priceUnit: svc.unit || null })
              .then(() => { posthog.capture('service_added'); })
              .catch(err => console.error('Service save failed:', err))
          );
        }
      }

      await Promise.all(nonBlocking);

      // Post-submit
      analytics.track('onboarding_complete', { skillCount: cleanSkills.length });
      posthog.capture('onboarding_completed', { skillCount: cleanSkills.length });
      safeLocalStorage.removeItem('hp_onboarding_pending');
      clearDraft();

      // Celebration toast
      toast('🎉 Profile Complete! Welcome to HumanPages', {
        duration: 3000,
        style: { background: '#22c55e', color: 'white', fontWeight: 'bold' },
      });

      // Handle pending intents
      const careerIntent = getApplyIntent();
      if (careerIntent) {
        try {
          await api.submitCareerApplication({ positionId: careerIntent.positionId, positionTitle: careerIntent.positionTitle || careerIntent.positionId, about: `Excited to contribute as a ${careerIntent.positionTitle || careerIntent.positionId}.`, availability: 'flexible' });
          clearApplyIntent();
        } catch { clearApplyIntent(); }
      }
      const listingIntent = getListingApplyIntent();
      if (listingIntent?.listingId && /^[a-zA-Z0-9_-]+$/.test(listingIntent.listingId)) {
        clearListingApplyIntent();
        navigate(`/listings/${listingIntent.listingId}`);
        return;
      } else if (listingIntent) {
        clearListingApplyIntent();
      }
      navigate('/dashboard');
    } catch (err: any) {
      if (form.mountedRef.current) {
        if (err?.status === 401 || err?.status === 403) {
          form.setError('Your session has expired. Please log in again — your progress has been saved.');
        } else {
          form.setError(err.message || 'Failed to complete onboarding. Please try again.');
        }
        scrollToError();
      }
    } finally {
      submittingRef.current = false;
      if (form.mountedRef.current) setLoading(false);
    }
  };

  // ─── External link helpers ───
  const openExternalUrl = async (fetchUrl: () => Promise<{ url: string }>, label: string) => {
    const inApp = isInAppBrowser();
    const win = inApp ? null : window.open('about:blank', '_blank', 'noopener,noreferrer');
    try {
      const { url } = await fetchUrl();
      if (win) { win.location.href = url; } else { window.location.href = url; }
    } catch (error: any) {
      if (win) win.close();
      toast.error(error.message || `Failed to get ${label} URL`);
    }
  };

  // ─── Step renderer ───
  // Maps step IDs to their component. Each step is a self-contained module.
  const stepProps = { error: form.error };

  function renderStep(id: StepId) {
    switch (id) {
      case 'connect':
        return (
          <StepConnect
            whatsappNumber={form.whatsappNumber} setWhatsappNumber={form.setWhatsappNumber}
            smsNumber={form.smsNumber} setSmsNumber={form.setSmsNumber}
            telegramStatus={telegramStatus} setTelegramStatus={setTelegramStatus}
            telegramLinkUrl={telegramLinkUrl} setTelegramLinkUrl={setTelegramLinkUrl}
            telegramLoading={telegramLoading} setTelegramLoading={setTelegramLoading}
            onNext={handleNext} onSkip={handleSkip} {...stepProps}
          />
        );

      case 'cv-upload':
        return (
          <StepCvUpload
            cvInputRef={cv.cvInputRef} onCVChange={cv.handleCVChange} onProcessFile={cv.processFile}
            cvProcessing={cv.cvProcessing} cvUploaded={cv.cvUploaded} cvData={cv.cvData}
            onReupload={() => {
              // Clear value so re-selecting the same file triggers onChange
              if (cv.cvInputRef.current) cv.cvInputRef.current.value = '';
              cv.cvInputRef.current?.click();
            }}
            onNext={handleNext} onSkip={handleSkip} {...stepProps}
          />
        );

      case 'skills':
        return (
          <StepSkills
            skills={form.skills} toggleSkill={form.toggleSkill}
            customSkill={form.customSkill} setCustomSkill={form.setCustomSkill}
            addCustomSkill={form.addCustomSkill}
            skillSearch={form.skillSearch} setSkillSearch={form.setSkillSearch}
            expandedCategories={form.expandedCategories} toggleCategory={form.toggleCategory}
            onNext={handleNext} {...stepProps}
          />
        );

      case 'equipment':
        return (
          <StepServices
            cvProcessing={cv.cvProcessing} cvData={cv.cvData}
            services={[]} setServices={() => {}}
            equipment={form.equipment} setEquipment={form.setEquipment}
            equipmentOnly
            onNext={handleNext} onSkip={handleSkip} {...stepProps}
          />
        );

      case 'vouch':
        return (
          <StepVouch
            userId={form.id}
            username={form.username} setUsername={form.setUsername}
            onNext={handleNext} onSkip={handleSkip} {...stepProps}
          />
        );

      case 'location':
        return (
          <StepLocation
            location={form.location} setLocation={form.setLocation}
            setLocationLat={form.setLocationLat} setLocationLng={form.setLocationLng}
            setNeighborhood={form.setNeighborhood}
            timezone={form.timezone} setTimezone={form.setTimezone}
            languageEntries={form.languageEntries}
            addLanguageEntry={form.addLanguageEntry}
            removeLanguageEntry={form.removeLanguageEntry}
            updateLanguageEntry={form.updateLanguageEntry}
            onNext={handleNext} onSkip={handleSkip} {...stepProps}
          />
        );

      case 'education':
        return (
          <StepEducation
            educationEntries={form.educationEntries} setEducationEntries={form.setEducationEntries}
            yearsOfExperience={form.yearsOfExperience} setYearsOfExperience={form.setYearsOfExperience}
            freelancerJobsRange={form.freelancerJobsRange} setFreelancerJobsRange={form.setFreelancerJobsRange}
            onNext={handleNext} onSkip={handleSkip} {...stepProps}
          />
        );

      case 'payment':
        return (
          <StepPayment
            walletAddress={form.walletAddress} setWalletAddress={form.setWalletAddress}
            onNext={handleNext} onSkip={handleSkip} {...stepProps}
          />
        );

      case 'services':
        return (
          <StepServices
            cvProcessing={cv.cvProcessing} cvData={cv.cvData}
            skills={form.skills}
            services={form.services} setServices={form.setServices}
            equipment={form.equipment} setEquipment={form.setEquipment}
            onNext={handleNext} onSkip={handleSkip} {...stepProps}
          />
        );

      case 'profile':
        return (
          <StepAboutYou
            name={form.name} setName={form.setName}
            bio={form.bio} setBio={form.setBio}
            photoPreview={form.photoPreview} photoInputRef={form.photoInputRef}
            onPhotoChange={form.handlePhotoChange} onPhotoRemove={form.handlePhotoRemove}
            oauthPhotoUrl={form.oauthPhotoUrl}
            cvUploaded={cv.cvUploaded} cvData={cv.cvData}
            onNext={handleNext} {...stepProps} setError={form.setError}
          />
        );

      case 'availability':
        return (
          <StepAvailability
            weeklyCapacityHours={form.weeklyCapacityHours} setWeeklyCapacityHours={form.setWeeklyCapacityHours}
            workType={form.workType} setWorkType={form.setWorkType}
            cvProcessing={cv.cvProcessing}
            onNext={handleNext} onSkip={handleSkip} {...stepProps}
          />
        );

      case 'verification':
        return (
          <StepFinish
            emailVerified={form.emailVerified}
            platformPresence={form.platformPresence} setPlatformPresence={form.setPlatformPresence}
            onLinkedInConnect={() => openExternalUrl(() => api.getLinkedInVerifyUrl(), 'LinkedIn')}
            onGitHubConnect={() => openExternalUrl(() => api.getGitHubVerifyUrl(), 'GitHub')}
            onNext={handleFinalSubmit} onSkip={handleFinalSubmit}
            isLoading={loading} {...stepProps} setError={form.setError}
            profileData={{
              name: form.name, bio: form.bio, location: form.location,
              skills: form.skills, languageEntries: form.languageEntries,
              photoPreview: form.photoPreview, oauthPhotoUrl: form.oauthPhotoUrl,
              services: form.services, educationEntries: form.educationEntries,
            }}
          />
        );
    }
  }

  // ─── Render ───
  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <SEO title="Complete Your Profile" noindex />

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {urlStepId && form.profileCompleted && (
              <button
                type="button"
                onClick={async () => {
                  await saveCurrentStepData(currentStepId);
                  navigate('/dashboard');
                }}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Dashboard
              </button>
            )}
            <p className="text-sm font-medium text-slate-600 truncate">
              {labels[position - 1]}
            </p>
          </div>
          <div aria-live="polite" aria-atomic="true" className="flex items-center gap-1.5">
            {saveStatus === 'saving' && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" aria-hidden="true" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-[10px] text-green-500 flex items-center gap-1 animate-fade-in">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white px-4 py-4 border-b border-slate-200">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Progress bar with milestone dots */}
          <div>
            <div className="relative h-1.5 bg-slate-200 rounded-full overflow-visible">
              <div
                className="h-full bg-orange-500 transition-all duration-300 ease-out"
                style={{ width: `${(position / total) * 100}%` }}
                role="progressbar"
                aria-valuenow={position}
                aria-valuemin={1}
                aria-valuemax={total}
                aria-label="Onboarding progress"
              />
              {/* Milestone dots at 25%, 50%, 75% */}
              {[25, 50, 75].map(m => {
                const pct = Math.round((position / total) * 100);
                return (
                  <div
                    key={m}
                    className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors duration-300 ${
                      pct >= m ? 'bg-orange-500' : 'bg-slate-300'
                    }`}
                    style={{ left: `${m}%` }}
                    aria-hidden="true"
                  />
                );
              })}
            </div>
          </div>

          {/* CV processing indicator — shows stage-specific status */}
          <div aria-live="polite" aria-atomic="true">
            {cv.cvStage === 'uploading' && (
              <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-xs text-orange-700">
                <div className="w-3 h-3 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin flex-shrink-0" />
                <span>Uploading your CV...</span>
              </div>
            )}
            {cv.cvStage === 'parsing' && (
              <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-xs text-orange-700">
                <div className="w-3 h-3 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin flex-shrink-0" />
                <span>Analyzing your CV...</span>
              </div>
            )}
            {cv.cvStage === 'done' && cv.cvUploaded && (
              <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between text-xs text-green-700">
                <span className="flex items-center gap-1.5"><span>✓</span> CV analyzed — fields pre-filled</span>
                <button type="button" onClick={() => {
                  setSearchParams({ step: 'cv-upload' }, { replace: true });
                  window.scrollTo({ top: 0 });
                }} className="text-orange-600 hover:text-orange-700 font-medium">Re-upload</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start sm:items-center justify-center px-3 sm:px-4 py-4 sm:py-8 overflow-y-auto">
        <div className="w-full max-w-2xl">
          <div
            className={`bg-white rounded-xl shadow-lg border border-slate-200 p-4 min-[400px]:p-6 sm:p-8 transition-opacity duration-150 ease-in-out ${
              transitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
            }`}
            style={{ transition: 'opacity 150ms ease-in-out, transform 150ms ease-in-out' }}
          >
            {form.profileLoading && position === 1 && !draft ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3" aria-live="polite">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading your profile...</p>
              </div>
            ) : (
              <StepErrorBoundary
                key={currentStepId}
                stepName={labels[position - 1]}
                onReset={() => position > 1 && goToPosition(position - 1)}
              >
                {renderStep(currentStepId)}
              </StepErrorBoundary>
            )}
          </div>

          <div className="mt-4 mb-4 pb-[env(safe-area-inset-bottom)] sm:mb-0 sm:pb-0 flex flex-col gap-2">
            {position > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                aria-label={`Go back to step ${position - 1}`}
                className="w-full py-2.5 sm:py-2 text-sm text-slate-600 hover:text-slate-900 font-medium border border-slate-200 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500"
              >
                &larr; Back to previous step
              </button>
            )}
            {urlStepId && form.profileCompleted && (
              <button
                type="button"
                onClick={async () => {
                  await saveCurrentStepData(currentStepId);
                  navigate('/dashboard');
                }}
                className="w-full py-2.5 sm:py-2 text-sm text-slate-500 hover:text-slate-700 font-medium border border-slate-200 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                &larr; Save &amp; back to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export for backward compatibility
export { SKILL_SUGGESTIONS } from './constants';
