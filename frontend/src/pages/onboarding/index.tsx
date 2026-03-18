import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { analytics } from '../../lib/analytics';
import { posthog } from '../../lib/posthog';
import { safeLocalStorage } from '../../lib/safeStorage';
import toast from 'react-hot-toast';
import SEO from '../../components/SEO';
import { getApplyIntent, clearApplyIntent, getListingApplyIntent, clearListingApplyIntent } from '../../lib/applyIntent';
import { isInAppBrowser, scrollToError, serializeLanguageEntry } from './utils';
import { STEP_LABELS, POPULAR_SERVICE_CATEGORIES } from './constants';
import { useProfileForm } from './hooks/useProfileForm';
import { useCvProcessing } from './hooks/useCvProcessing';
import { useDraftPersistence, loadDraft, clearDraft } from './hooks/useDraftPersistence';
import type { LanguageEntry } from './types';

// Step components
import { StepNotifications } from './steps/StepNotifications';
import { StepCvUpload } from './steps/StepCvUpload';
import { StepConnect } from './steps/StepConnect';
import { StepAvailability } from './steps/StepAvailability';
import { StepServices } from './steps/StepServices';
import { StepAboutYou } from './steps/StepAboutYou';
import { StepSkills } from './steps/StepSkills';
import { StepFinish } from './steps/StepFinish';
import { StepErrorBoundary } from './components/StepErrorBoundary';

export default function Onboarding() {
  const navigate = useNavigate();
  const draft = useMemo(() => loadDraft(), []);

  // ─── Step navigation ───
  const [step, setStep] = useState(() => {
    const s = draft?.step || 1;
    if (s < 1 || s > 8) return 1;
    if (draft) {
      if (s >= 5 && !draft.name?.trim()) return 5;
      if (s >= 4 && (!draft.skills || draft.skills.length === 0)) return 4;
    }
    return s;
  });
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const prevStepRef = useRef(step);

  // ─── Hooks ───
  const form = useProfileForm(draft);
  const cv = useCvProcessing({
    setName: form.setName,
    setBio: form.setBio,
    setLocation: form.setLocation,
    setSkills: form.setSkills,
    setLanguageEntries: form.setLanguageEntries,
    setEducationEntries: form.setEducationEntries,
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
  });

  // Restore CV state from draft
  useEffect(() => {
    if (draft?.cvUploaded && draft?.cvData) {
      cv.setCvUploaded(true);
      cv.setCvData(draft.cvData);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — runs only on mount, draft is memoized

  // ─── Completed onboarding guard ───
  // If the user has already completed onboarding, redirect to dashboard
  useEffect(() => {
    if (!form.profileLoading && form.profileCompleted) {
      navigate('/dashboard', { replace: true });
    }
  }, [form.profileLoading, form.profileCompleted, navigate]);

  // Telegram state (lifted here so it persists across step navigation)
  // TODO: Consolidate these three useState calls into a single state object
  // This would require updating StepConnect's interface props
  const [telegramStatus, setTelegramStatus] = useState<{ connected: boolean; botAvailable: boolean; botUsername?: string } | null>(null);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);

  // ─── Draft persistence ───
  const saveStatus = useDraftPersistence({
    step,
    name: form.name, bio: form.bio, location: form.location,
    neighborhood: form.neighborhood, locationLat: form.locationLat, locationLng: form.locationLng,
    skills: form.skills, educationEntries: form.educationEntries, languageEntries: form.languageEntries,
    services: form.services,
    linkedinUrl: form.linkedinUrl, githubUrl: form.githubUrl, twitterUrl: form.twitterUrl,
    websiteUrl: form.websiteUrl, instagramUrl: form.instagramUrl, youtubeUrl: form.youtubeUrl,
    facebookUrl: form.facebookUrl, tiktokUrl: form.tiktokUrl,
    externalProfiles: form.externalProfiles, walletAddress: form.walletAddress,
    whatsappNumber: form.whatsappNumber,
    timezone: form.timezone, weeklyCapacityHours: form.weeklyCapacityHours,
    responseTimeCommitment: form.responseTimeCommitment, workType: form.workType,
    yearsOfExperience: form.yearsOfExperience, industries: form.industries,
    equipment: form.equipment,
    cvUploaded: cv.cvUploaded && cv.cvData != null,
    cvData: cv.cvData,
  });

  // Auto-advance from CV upload step when processing begins
  useEffect(() => {
    if (cv.cvProcessing && step === 3 && !loading) {
      goToStep(4);
    }
  }, [cv.cvProcessing, step, loading]); // eslint-disable-line react-hooks/exhaustive-deps — goToStep recreated each render

  // ─── Navigation ───
  const submittingRef = useRef(false);

  const goToStep = (nextStep: number) => {
    if (submittingRef.current || nextStep === step) return;

    // Step transition animation
    setTransitioning(true);
    prevStepRef.current = step;

    // Short delay for exit animation, then switch
    requestAnimationFrame(() => {
      setStep(nextStep);
      form.setError('');
      window.scrollTo({ top: 0, behavior: window.innerWidth < 640 ? 'auto' : 'smooth' });
      requestAnimationFrame(() => {
        setTransitioning(false);
        const heading = document.querySelector('[data-step-heading]') as HTMLElement;
        heading?.focus();
      });
    });
  };

  // Step handlers
  const handleStep1Next = () => goToStep(2);
  const handleStep2Next = () => goToStep(3);
  const handleStep3Next = () => goToStep(4);
  const handleStep4Next = () => goToStep(5);

  const handleStep5Next = () => {
    if (!form.name.trim()) { form.setError('Name is required'); scrollToError(); return; }
    goToStep(6);
  };

  const handleStep6Next = () => goToStep(7);

  const handleStep7Next = () => goToStep(8);

  // ─── Final submit ───
  const handleFinalSubmit = async () => {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;

    if (!form.name.trim()) {
      submittingRef.current = false;
      form.setError('Name is required. Go back to Step 5 (Profile).');
      scrollToError();
      return;
    }
    if (form.skills.length === 0) {
      submittingRef.current = false;
      form.setError('At least one skill is required. Go back to Step 6 (Skills).');
      scrollToError();
      return;
    }

    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      submittingRef.current = false;
      form.setError('You appear to be offline. Please check your connection and try again.');
      scrollToError();
      return;
    }

    setLoading(true);
    form.setError('');

    try {
      // Safety net dedup: while skills are already deduped by useCvProcessing and toggleSkill,
      // this final pass ensures no duplicates slip through before sending to backend.
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
          linkedinUrl: form.linkedinUrl.trim() || null,
          githubUrl: form.githubUrl.trim() || null,
          twitterUrl: form.twitterUrl.trim() || null,
          websiteUrl: form.websiteUrl.trim() || null,
          instagramUrl: form.instagramUrl.trim() || null,
          youtubeUrl: form.youtubeUrl.trim() || null,
          facebookUrl: form.facebookUrl.trim() || null,
          tiktokUrl: form.tiktokUrl.trim() || null,
          externalProfiles: form.externalProfiles.filter(u => u.trim()).length > 0 ? form.externalProfiles.filter(u => u.trim()) : [],
          walletAddress: form.walletAddress.trim() || null,
          whatsapp: form.whatsappNumber.trim() || null,
          timezone: form.timezone.trim() || null,
          weeklyCapacityHours: form.weeklyCapacityHours,
          responseTimeCommitment: form.responseTimeCommitment.trim() || null,
          workType: form.workType.trim() || null,
          yearsOfExperience: form.yearsOfExperience,
          equipment: form.equipment.length > 0 ? form.equipment : [],
          industries: form.industries.length > 0 ? form.industries : [],
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 15000)),
      ]);

      // Non-blocking parallel saves
      const nonBlocking: Promise<void>[] = [];

      if (form.photoFile) {
        nonBlocking.push(api.uploadProfilePhoto(form.photoFile).then(() => {}).catch(err => console.error('Photo upload failed (non-blocking):', err)));
      } else if (form.oauthPhotoUrl) {
        nonBlocking.push(api.importOAuthPhoto('google').then(() => {}).catch(err => console.error('OAuth photo import failed (non-blocking):', err)));
      }

      for (const edu of form.educationEntries) {
        if (edu.institution.trim() || edu.degree.trim() || edu.field.trim()) {
          nonBlocking.push(
            api.addEducation({ institution: edu.institution.trim(), degree: edu.degree.trim() || undefined, field: edu.field.trim() || undefined, country: edu.country.trim() || undefined, year: edu.endYear || edu.startYear || undefined })
              .then(() => {}).catch(err => console.error('Education creation failed (non-blocking):', err))
          );
        }
      }

      for (const svc of form.services) {
        if (svc.title.trim() && svc.category.trim() && POPULAR_SERVICE_CATEGORIES.includes(svc.category.trim())) {
          const price = svc.price?.trim() ? parseFloat(svc.price.trim()) : null;
          const validPrice = price !== null && !isNaN(price) && price > 0 ? price : null;
          nonBlocking.push(
            api.createService({ title: svc.title.trim(), description: svc.description.trim(), category: svc.category.trim(), priceMin: validPrice, priceCurrency: svc.currency, priceUnit: svc.unit || null })
              .then(() => { posthog.capture('service_added'); })
              .catch(err => console.error('Service creation failed (non-blocking):', err))
          );
        }
      }

      await Promise.all(nonBlocking);

      // Post-submit
      analytics.track('onboarding_complete', { skillCount: cleanSkills.length });
      posthog.capture('onboarding_completed', { skillCount: cleanSkills.length });
      safeLocalStorage.removeItem('hp_onboarding_pending');
      clearDraft();

      // Handle pending intents
      const careerIntent = getApplyIntent();
      if (careerIntent) {
        try {
          await api.submitCareerApplication({ positionId: careerIntent.positionId, positionTitle: careerIntent.positionTitle || careerIntent.positionId, about: `Excited to contribute as a ${careerIntent.positionTitle || careerIntent.positionId}.`, availability: 'flexible' });
          clearApplyIntent();
        } catch { clearApplyIntent(); }
      }
      const onboardingListingIntent = getListingApplyIntent();
      if (onboardingListingIntent?.listingId && /^[a-zA-Z0-9_-]+$/.test(onboardingListingIntent.listingId)) {
        clearListingApplyIntent();
        navigate(`/listings/${onboardingListingIntent.listingId}`);
        return;
      } else if (onboardingListingIntent) {
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

  const getLinkedInVerifyUrl = () => openExternalUrl(() => api.getLinkedInVerifyUrl(), 'LinkedIn');
  const getGitHubVerifyUrl = () => openExternalUrl(() => api.getGitHubVerifyUrl(), 'GitHub');

  // ─── Render ───
  const stepContent = (
    <>
      {step === 1 && (
        <StepNotifications
          onNext={handleStep1Next}
          onSkip={handleStep1Next}
          error={form.error}
        />
      )}

      {step === 2 && (
        <StepConnect
          whatsappNumber={form.whatsappNumber}
          setWhatsappNumber={form.setWhatsappNumber}
          telegramStatus={telegramStatus}
          setTelegramStatus={setTelegramStatus}
          telegramLinkUrl={telegramLinkUrl}
          setTelegramLinkUrl={setTelegramLinkUrl}
          telegramLoading={telegramLoading}
          setTelegramLoading={setTelegramLoading}
          onNext={handleStep2Next}
          onSkip={handleStep2Next}
          error={form.error}
        />
      )}

      {(!form.profileLoading || draft || step > 2) && step === 3 && (
        <StepCvUpload
          cvInputRef={cv.cvInputRef}
          onCVChange={cv.handleCVChange}
          onProcessFile={cv.processFile}
          cvProcessing={cv.cvProcessing}
          cvUploaded={cv.cvUploaded}
          cvData={cv.cvData}
          onReupload={() => cv.cvInputRef.current?.click()}
          onNext={handleStep3Next}
          onSkip={handleStep3Next}
          error={form.error}
        />
      )}

      {step === 4 && (
        <StepSkills
          skills={form.skills} toggleSkill={form.toggleSkill}
          customSkill={form.customSkill} setCustomSkill={form.setCustomSkill}
          addCustomSkill={form.addCustomSkill}
          skillSearch={form.skillSearch} setSkillSearch={form.setSkillSearch}
          expandedCategories={form.expandedCategories} toggleCategory={form.toggleCategory}
          educationEntries={form.educationEntries} setEducationEntries={form.setEducationEntries}
          languageEntries={form.languageEntries}
          addLanguageEntry={form.addLanguageEntry}
          removeLanguageEntry={form.removeLanguageEntry}
          updateLanguageEntry={form.updateLanguageEntry}
          yearsOfExperience={form.yearsOfExperience}
          setYearsOfExperience={form.setYearsOfExperience}
          onNext={handleStep4Next}
          error={form.error}
        />
      )}

      {step === 5 && (
        <StepAboutYou
          name={form.name} setName={form.setName}
          bio={form.bio} setBio={form.setBio}
          location={form.location} setLocation={form.setLocation}
          setLocationLat={form.setLocationLat} setLocationLng={form.setLocationLng}
          setNeighborhood={form.setNeighborhood}
          photoPreview={form.photoPreview} photoInputRef={form.photoInputRef}
          onPhotoChange={form.handlePhotoChange} onPhotoRemove={form.handlePhotoRemove}
          oauthPhotoUrl={form.oauthPhotoUrl}
          cvUploaded={cv.cvUploaded} cvData={cv.cvData}
          onNext={handleStep5Next}
          error={form.error} setError={form.setError}
        />
      )}

      {step === 6 && (
        <StepAvailability
          timezone={form.timezone}
          setTimezone={form.setTimezone}
          weeklyCapacityHours={form.weeklyCapacityHours}
          setWeeklyCapacityHours={form.setWeeklyCapacityHours}
          responseTimeCommitment={form.responseTimeCommitment}
          setResponseTimeCommitment={form.setResponseTimeCommitment}
          workType={form.workType}
          setWorkType={form.setWorkType}
          cvProcessing={cv.cvProcessing}
          onNext={handleStep6Next}
          onSkip={handleStep6Next}
          error={form.error}
        />
      )}

      {step === 7 && (
        <StepServices
          cvProcessing={cv.cvProcessing}
          cvData={cv.cvData}
          services={form.services}
          setServices={form.setServices}
          equipment={form.equipment}
          setEquipment={form.setEquipment}
          onNext={handleStep7Next}
          onSkip={handleStep7Next}
          error={form.error}
        />
      )}

      {step === 8 && (
        <StepFinish
          emailVerified={form.emailVerified}
          linkedinUrl={form.linkedinUrl} setLinkedinUrl={form.setLinkedinUrl}
          githubUrl={form.githubUrl} setGithubUrl={form.setGithubUrl}
          twitterUrl={form.twitterUrl} setTwitterUrl={form.setTwitterUrl}
          websiteUrl={form.websiteUrl} setWebsiteUrl={form.setWebsiteUrl}
          instagramUrl={form.instagramUrl} setInstagramUrl={form.setInstagramUrl}
          youtubeUrl={form.youtubeUrl} setYoutubeUrl={form.setYoutubeUrl}
          facebookUrl={form.facebookUrl} setFacebookUrl={form.setFacebookUrl}
          tiktokUrl={form.tiktokUrl} setTiktokUrl={form.setTiktokUrl}
          onLinkedInConnect={getLinkedInVerifyUrl}
          onGitHubConnect={getGitHubVerifyUrl}
          onNext={handleFinalSubmit}
          onSkip={handleFinalSubmit}
          isLoading={loading}
          error={form.error} setError={form.setError}
          profileData={{
            name: form.name, bio: form.bio, location: form.location,
            skills: form.skills, languageEntries: form.languageEntries,
            photoPreview: form.photoPreview, oauthPhotoUrl: form.oauthPhotoUrl,
            services: form.services, educationEntries: form.educationEntries,
          }}
        />
      )}
    </>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <SEO title="Complete Your Profile" noindex />

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <p className="text-sm font-medium text-slate-600">Complete Your Profile &bull; Step {step} of 8</p>
          {/* Auto-save indicator */}
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
        <div className="max-w-2xl mx-auto">
          <nav aria-label="Onboarding progress" className="flex items-start justify-between">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
              const label = STEP_LABELS[s - 1];
              return (
                <div key={s} className="flex flex-col items-center flex-1">
                  <div className="flex items-center w-full justify-center relative">
                    <button
                      type="button"
                      onClick={() => s < step && !loading && goToStep(s)}
                      disabled={s >= step || loading}
                      aria-label={`Step ${s}: ${label}`}
                      aria-current={s === step ? 'step' : undefined}
                      tabIndex={s < step && !loading ? 0 : -1}
                      className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-semibold text-[10px] sm:text-xs transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 ${
                        s < step && !loading ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600 active:bg-green-700'
                          : s === step ? 'bg-orange-500 text-white ring-2 ring-orange-300 cursor-default'
                          : 'bg-slate-200 text-slate-600 cursor-default'
                      }`}
                    >
                      {s < step ? '✓' : s}
                    </button>
                    {s < 8 && <div className={`absolute top-1/2 -translate-y-1/2 h-0.5 transition-all ${s < step ? 'bg-green-500' : 'bg-slate-200'}`} style={{ left: 'calc(50% + 16px)', right: '-50%' }} aria-hidden="true" />}
                  </div>
                  <span className={`mt-1.5 text-[9px] sm:text-[11px] text-center leading-tight w-full px-0.5 ${s === step ? 'text-orange-600 font-semibold' : s < step ? 'text-green-600' : 'text-slate-400'}`}>{label}</span>
                </div>
              );
            })}
          </nav>

          {/* CV processing indicator — aria-live for screen readers */}
          <div aria-live="polite" aria-atomic="true">
            {cv.cvProcessing && (
              <div className="mx-4 mt-2 mb-0 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-xs text-orange-700">
                <div className="w-3 h-3 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin flex-shrink-0" />
                <span>Analyzing your CV...</span>
              </div>
            )}
            {cv.cvUploaded && !cv.cvProcessing && (
              <div className="mx-4 mt-2 mb-0 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between text-xs text-green-700">
                <span className="flex items-center gap-1.5"><span>✓</span> CV analyzed successfully</span>
                <button type="button" onClick={() => cv.cvInputRef.current?.click()} className="text-orange-600 hover:text-orange-700 font-medium">Re-upload</button>
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
            {/* Loading state for first step */}
            {form.profileLoading && step === 1 && !draft ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3" aria-live="polite">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading your profile...</p>
              </div>
            ) : null}

            {(!form.profileLoading || draft || step > 1) && (
              <StepErrorBoundary
                key={step}
                stepName={STEP_LABELS[step - 1]}
                onReset={() => step > 1 && goToStep(step - 1)}
              >
                {stepContent}
              </StepErrorBoundary>
            )}
          </div>

          {step > 1 && (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={loading}
              aria-label={`Go back to step ${step - 1}`}
              className="w-full mt-4 mb-4 pb-[env(safe-area-inset-bottom)] sm:mb-0 sm:pb-0 py-2.5 sm:py-2 text-sm text-slate-600 hover:text-slate-900 font-medium border border-slate-200 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500"
            >
              &larr; Back to previous step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export for backward compatibility
export { SKILL_SUGGESTIONS } from './constants';
