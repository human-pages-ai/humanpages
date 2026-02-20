import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import { posthog } from '../lib/posthog';
import SEO from '../components/SEO';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { getApplyIntent, clearApplyIntent } from '../lib/applyIntent';
import toast from 'react-hot-toast';

// ─── Categorised skill suggestions ──────────────────────────────────────────
// Covers both digital/remote work and local/physical tasks.
// Names are kept short and agent-searchable.
const SKILL_CATEGORIES: Record<string, string[]> = {
  'Content & Writing': [
    'Content Writing', 'Copywriting', 'Proofreading & Editing',
    'Translation', 'Technical Writing',
  ],
  'Marketing & Sales': [
    'Social Media Management', 'SEO & SEM', 'Email Marketing',
    'Sales & Lead Generation', 'Cold Outreach', 'Market Research',
  ],
  'Design & Media': [
    'Graphic Design', 'UI/UX Design', 'Photo & Image Editing',
    'Video Production', 'Prototyping & Wireframing',
  ],
  'Development & QA': [
    'Software Development', 'QA & Bug Testing', 'Code Review',
  ],
  'Admin & Support': [
    'Customer Support', 'Chat & Email Support', 'Data Entry',
    'Email & Calendar Management', 'Scheduling', 'Document Management',
    'Community Management', 'Event Coordination',
  ],
  'Local Services': [
    'Local Photography', 'Package Delivery', 'Shopping & Errands',
    'In-Person Verification', 'Document Notarization', 'Pet Care',
    'Furniture Assembly', 'In-Home Tech Support', 'Interpretation',
  ],
};

// Exported for use in profile editing and backend validation
export const SKILL_SUGGESTIONS = Object.values(SKILL_CATEGORIES).flat();

// ─── LinkedIn headline → skill matching ─────────────────────────────────────
// Maps keywords found in LinkedIn headlines to relevant platform skills.
const HEADLINE_SKILL_MAP: [RegExp, string[]][] = [
  [/marketing/i, ['Social Media Management', 'SEO & SEM', 'Email Marketing', 'Content Writing']],
  [/software|developer|engineer|programming|coding/i, ['Software Development', 'Code Review', 'QA & Bug Testing']],
  [/design|ux|ui|product design/i, ['UI/UX Design', 'Graphic Design', 'Prototyping & Wireframing']],
  [/content|writer|copywriter|editor|journalist/i, ['Content Writing', 'Copywriting', 'Proofreading & Editing']],
  [/sales|business development|account executive/i, ['Sales & Lead Generation', 'Cold Outreach', 'Market Research']],
  [/support|customer|service|success/i, ['Customer Support', 'Chat & Email Support']],
  [/community|social media/i, ['Community Management', 'Social Media Management']],
  [/virtual assistant|admin|executive assistant|operations/i, ['Email & Calendar Management', 'Scheduling', 'Data Entry']],
  [/video|photo|media|film/i, ['Video Production', 'Photo & Image Editing']],
  [/qa|testing|quality/i, ['QA & Bug Testing', 'Software Development']],
  [/translation|translator|interpreter|localization/i, ['Translation', 'Interpretation']],
  [/data|analytics|research/i, ['Data Entry', 'Market Research']],
  [/graphic/i, ['Graphic Design', 'Photo & Image Editing']],
  [/seo/i, ['SEO & SEM', 'Content Writing']],
];

function matchHeadlineToSkills(headline: string): string[] {
  const matched = new Set<string>();
  for (const [pattern, skills] of HEADLINE_SKILL_MAP) {
    if (pattern.test(headline)) {
      skills.forEach((s) => matched.add(s));
    }
  }
  return Array.from(matched);
}

// Determine which categories should be expanded based on selected skills
function getExpandedCategories(selectedSkills: string[]): Set<string> {
  if (selectedSkills.length === 0) {
    // Default: show first 2 categories
    const cats = Object.keys(SKILL_CATEGORIES);
    return new Set(cats.slice(0, 2));
  }
  const expanded = new Set<string>();
  for (const [category, categorySkills] of Object.entries(SKILL_CATEGORIES)) {
    if (categorySkills.some((s) => selectedSkills.includes(s))) {
      expanded.add(category);
    }
  }
  // Always show at least 1 category
  if (expanded.size === 0) {
    expanded.add(Object.keys(SKILL_CATEGORIES)[0]);
  }
  return expanded;
}

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Form state
  const [location, setLocation] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [locationLat, setLocationLat] = useState<number | undefined>();
  const [locationLng, setLocationLng] = useState<number | undefined>();
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [error, setError] = useState('');

  // Collapsible categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(SKILL_CATEGORIES).slice(0, 2))
  );

  // OAuth photo import
  const [oauthPhotoUrl, setOauthPhotoUrl] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const [photoImporting, setPhotoImporting] = useState(false);
  const [photoDismissed, setPhotoDismissed] = useState(false);

  useEffect(() => {
    // Check for OAuth photo URL stored during signup
    const storedPhotoUrl = localStorage.getItem('oauthPhotoUrl');
    const storedProvider = localStorage.getItem('oauthProvider');
    if (storedPhotoUrl) {
      setOauthPhotoUrl(storedPhotoUrl);
      setOauthProvider(storedProvider);
      localStorage.removeItem('oauthPhotoUrl');
      localStorage.removeItem('oauthProvider');
    }

    // Collect skills to pre-select from multiple sources
    const preSelectedSkills = new Set<string>();

    // Source 1: Apply intent (e.g. user clicked "Apply" on Content Creator)
    const intent = getApplyIntent();
    if (intent?.suggestedSkills?.length) {
      intent.suggestedSkills.forEach((s) => preSelectedSkills.add(s));
    }

    // Source 2: LinkedIn headline auto-matching
    const linkedinHeadline = localStorage.getItem('linkedinHeadline');
    if (linkedinHeadline) {
      localStorage.removeItem('linkedinHeadline');
      const headlineSkills = matchHeadlineToSkills(linkedinHeadline);
      headlineSkills.forEach((s) => preSelectedSkills.add(s));
    }

    if (preSelectedSkills.size > 0) {
      setSkills((prev) => {
        const merged = new Set([...prev, ...preSelectedSkills]);
        return Array.from(merged);
      });
      // Expand categories that contain pre-selected skills
      setExpandedCategories(getExpandedCategories(Array.from(preSelectedSkills)));
    }

    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      analytics.identify(data.id);

      // Pre-fill if already set
      if (data.location) setLocation(data.location);
      if (data.neighborhood) setNeighborhood(data.neighborhood);
      if (data.locationLat != null) setLocationLat(data.locationLat);
      if (data.locationLng != null) setLocationLng(data.locationLng);
      if (data.skills?.length) setSkills(data.skills);
    } catch (error) {
      console.error('Failed to load profile:', error);
      navigate('/login');
    }
  };

  const locationChosen = locationLat != null && locationLng != null;

  const handleSubmit = async () => {
    // Only skills are required now — location is optional
    if (skills.length === 0) {
      setError(t('onboarding.step2.errorSkills'));
      return;
    }
    setError('');

    setLoading(true);
    try {
      await api.updateProfile({
        ...(location.trim() ? { location } : {}),
        ...(neighborhood ? { neighborhood } : {}),
        ...(locationLat != null && locationLng != null ? { locationLat, locationLng } : {}),
        skills,
      });
      analytics.track('onboarding_complete', { skillCount: skills.length });
      posthog.capture('onboarding_completed', { skillCount: skills.length });

      // Auto-submit career application if there's a pending apply intent
      const intent = getApplyIntent();
      if (intent) {
        try {
          await api.submitCareerApplication({
            positionId: intent.positionId,
            positionTitle: intent.positionTitle || intent.positionId,
            about: `Excited to contribute as a ${intent.positionTitle || intent.positionId}.`,
            availability: 'flexible',
          });
          clearApplyIntent();
          toast.success(t('onboarding.applicationSubmitted', `Your application for ${intent.positionTitle || intent.positionId} has been submitted!`));
        } catch (err) {
          // Non-fatal: application submission failure shouldn't block onboarding
          console.error('Auto-submit application failed:', err);
          clearApplyIntent();
        }
      }

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      setError(error.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !skills.includes(customSkill.trim())) {
      setSkills([...skills, customSkill.trim()]);
      setCustomSkill('');
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSkip = () => {
    analytics.track('onboarding_skip');
    posthog.capture('onboarding_skipped');

    // Still auto-submit application on skip if intent exists
    const intent = getApplyIntent();
    if (intent) {
      api.submitCareerApplication({
        positionId: intent.positionId,
        positionTitle: intent.positionTitle || intent.positionId,
        about: `Excited to contribute as a ${intent.positionTitle || intent.positionId}.`,
        availability: 'flexible',
      }).catch(() => {}); // Fire and forget
      clearApplyIntent();
    }

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SEO title="Complete Your Profile" noindex />
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <span className="text-sm font-medium text-slate-700">{t('onboarding.title')}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {t('onboarding.step2.title')}
            </h2>
            <p className="text-slate-600 mb-6">
              {t('onboarding.step2.subtitle')}
            </p>

            {/* OAuth Photo Import Prompt */}
            {oauthPhotoUrl && !photoDismissed && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-3">
                  {t('onboarding.useProviderPhoto', 'Use your profile photo?')}
                </p>
                <div className="flex items-center gap-4">
                  <img
                    src={oauthPhotoUrl}
                    alt=""
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-200"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={async () => {
                        setPhotoImporting(true);
                        try {
                          await api.importOAuthPhoto((oauthProvider || 'google') as 'google' | 'linkedin');
                          setPhotoDismissed(true);
                        } catch (err: any) {
                          toast.error(err.message || t('onboarding.photoImportFailed', 'Failed to import photo'));
                        } finally {
                          setPhotoImporting(false);
                        }
                      }}
                      disabled={photoImporting}
                      className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded disabled:opacity-50"
                    >
                      {photoImporting
                        ? t('common.loading', 'Loading...')
                        : t('onboarding.useThisPhoto', 'Use this photo')}
                    </button>
                    <button
                      onClick={() => setPhotoDismissed(true)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {t('onboarding.skipPhoto', 'Skip for now')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Location (optional) */}
            <div className="mb-6">
              <label htmlFor="location-input" className="block text-sm font-medium text-slate-700 mb-1">
                {t('onboarding.step2.location')}
              </label>
              <p className="text-xs text-slate-400 mb-2">
                {t('onboarding.step2.locationOptional', 'Optional — helps match you with local tasks')}
              </p>
              <LocationAutocomplete
                id="location-input"
                value={location}
                onChange={(loc, lat, lng, nbhd) => {
                  setLocation(loc);
                  if (lat != null && lng != null) {
                    setLocationLat(lat);
                    setLocationLng(lng);
                    setNeighborhood(nbhd || '');
                  } else {
                    // User is typing freely — clear previous selection
                    setLocationLat(undefined);
                    setLocationLng(undefined);
                    setNeighborhood('');
                  }
                }}
                placeholder={t('onboarding.step2.locationPlaceholder')}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {location.trim() && !locationChosen && (
                <p className="mt-1 text-xs text-amber-500">
                  {t('onboarding.step2.locationHint', 'Select a suggestion from the dropdown for accurate matching')}
                </p>
              )}
            </div>

            {/* Skills */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('onboarding.step2.skills')}
              </label>
              <div className="space-y-2 mb-3">
                {Object.entries(SKILL_CATEGORIES).map(([category, categorySkills]) => {
                  const isExpanded = expandedCategories.has(category);
                  const selectedInCategory = categorySkills.filter((s) => skills.includes(s)).length;
                  return (
                    <div key={category}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="flex items-center gap-2 w-full text-left py-1 group"
                      >
                        <span className="text-xs text-slate-400 transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                          ▸
                        </span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide group-hover:text-slate-700">
                          {category}
                        </span>
                        <span className="text-xs text-slate-400">
                          {selectedInCategory > 0
                            ? `${selectedInCategory} selected`
                            : `${categorySkills.length} skills`}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="flex flex-wrap gap-2 mt-1 mb-2 pl-4">
                          {categorySkills.map((skill) => (
                            <button
                              key={skill}
                              onClick={() => toggleSkill(skill)}
                              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                skills.includes(skill)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Custom skill input */}
              <div className="flex gap-2">
                <label htmlFor="custom-skill" className="sr-only">
                  {t('onboarding.step2.addCustomSkill')}
                </label>
                <input
                  id="custom-skill"
                  type="text"
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomSkill()}
                  placeholder={t('onboarding.step2.addCustomSkill')}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={addCustomSkill}
                  disabled={!customSkill.trim()}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
                >
                  {t('onboarding.step2.add')}
                </button>
              </div>

              {/* Selected skills */}
              {skills.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-blue-700 font-medium">
                    {t('onboarding.step2.selected')}: {skills.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full mt-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('onboarding.saving') : t('onboarding.completeProfile')}
            </button>
          </div>

          {/* Skip link — no warning dialog, just navigate */}
          <button
            onClick={handleSkip}
            className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700"
          >
            {t('onboarding.skipToDashboard')}
          </button>
        </div>
      </div>
    </div>
  );
}
