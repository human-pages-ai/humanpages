import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import SEO from '../components/SEO';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { getApplyIntent, clearApplyIntent, getListingApplyIntent, clearListingApplyIntent } from '../lib/applyIntent';
import toast from 'react-hot-toast';
import { safeLocalStorage } from '../lib/safeStorage';

// ─── Categorised skill suggestions ──────────────────────────────────────────
// Covers digital/remote work, creative, professional, and local/physical tasks.
// Names are kept short and agent-searchable.
const SKILL_CATEGORIES: Record<string, string[]> = {
  'Marketing & Sales': [
    'Social Media Management', 'SEO & SEM', 'Email Marketing',
    'Sales & Lead Generation', 'Cold Outreach', 'Market Research',
    'Influencer Marketing', 'Affiliate Marketing', 'Brand Strategy',
    'Public Relations', 'Growth Hacking',
  ],
  'Content & Writing': [
    'Content Writing', 'Copywriting', 'Proofreading & Editing',
    'Technical Writing', 'Blog Writing', 'Ghostwriting',
    'Grant Writing', 'Resume & Cover Letters', 'Script Writing',
  ],
  'Design & Creative': [
    'Graphic Design', 'UI/UX Design', 'Photo & Image Editing',
    'Video Production', 'Video Editing', 'Prototyping & Wireframing',
    'Logo Design', 'Illustration', 'Animation & Motion Graphics',
    'Brand Identity', '3D Modeling',
  ],
  'Development & Tech': [
    'Software Development', 'Web Development', 'Mobile App Development',
    'QA & Bug Testing', 'Code Review', 'DevOps & Cloud',
    'Database Management', 'API Development', 'WordPress & CMS',
    'AI & Machine Learning',
  ],
  'Admin & Support': [
    'Virtual Assistant', 'Customer Support', 'Chat & Email Support',
    'Data Entry', 'Email & Calendar Management', 'Scheduling',
    'Document Management', 'Bookkeeping', 'Project Management',
    'CRM Management',
  ],
  'Education & Tutoring': [
    'English Teaching', 'Language Tutoring', 'Math Tutoring',
    'Science Tutoring', 'Music Lessons', 'Test Prep & SAT',
    'Academic Writing Help', 'Online Course Creation', 'Mentoring',
  ],
  'Translation & Language': [
    'Translation', 'Interpretation', 'Localization',
    'Subtitling & Captions', 'Transcription', 'Voiceover',
  ],
  'Travel & Hospitality': [
    'Travel Planning', 'Tour Guide', 'Local Guide',
    'Event Coordination', 'Concierge Services', 'Hotel & Airbnb Management',
  ],
  'Transportation & Delivery': [
    'Personal Driver', 'Package Delivery', 'Courier Services',
    'Airport Transfers', 'Moving & Relocation', 'Errand Running',
  ],
  'Home & Personal Services': [
    'Pet Care', 'Dog Walking', 'House Sitting', 'Babysitting',
    'Elder Care', 'Personal Shopping', 'Cooking & Meal Prep',
    'Cleaning', 'Furniture Assembly', 'Handyman',
    'Gardening & Landscaping',
  ],
  'Community & Social': [
    'Community Management', 'Social Media Moderation',
    'Discord & Telegram Management', 'Forum Moderation',
    'Event Planning', 'Fundraising',
  ],
  'Professional Services': [
    'Legal Research', 'Tax Preparation', 'Financial Consulting',
    'Business Consulting', 'Real Estate', 'Insurance',
    'Document Notarization', 'HR & Recruiting',
  ],
  'Local & In-Person': [
    'Local Photography', 'In-Person Verification', 'Mystery Shopping',
    'Survey & Feedback', 'In-Home Tech Support', 'Fitness Training',
    'Tailoring & Alterations', 'Auto Repair',
  ],
};

// Popular skills shown at the top for quick selection
const POPULAR_SKILLS = [
  'Virtual Assistant', 'Content Writing', 'Graphic Design',
  'Social Media Management', 'English Teaching', 'Translation',
  'Video Editing', 'Web Development', 'Data Entry',
  'Customer Support', 'Tour Guide', 'Personal Driver',
];

// Exported for use in profile editing and backend validation
export const SKILL_SUGGESTIONS = Object.values(SKILL_CATEGORIES).flat();

// ─── LinkedIn headline → skill matching ─────────────────────────────────────
// Maps keywords found in LinkedIn headlines to relevant platform skills.
const HEADLINE_SKILL_MAP: [RegExp, string[]][] = [
  [/marketing/i, ['Social Media Management', 'SEO & SEM', 'Email Marketing', 'Content Writing']],
  [/software|developer|engineer|programming|coding|fullstack|full.stack|backend|frontend/i, ['Software Development', 'Web Development', 'Code Review', 'QA & Bug Testing']],
  [/design|ux|ui|product design/i, ['UI/UX Design', 'Graphic Design', 'Prototyping & Wireframing']],
  [/content|writer|copywriter|editor|journalist|blogger/i, ['Content Writing', 'Copywriting', 'Proofreading & Editing', 'Blog Writing']],
  [/sales|business development|account executive/i, ['Sales & Lead Generation', 'Cold Outreach', 'Market Research']],
  [/support|customer|service|success/i, ['Customer Support', 'Chat & Email Support']],
  [/community|social media/i, ['Community Management', 'Social Media Management']],
  [/virtual assistant|admin|executive assistant|operations/i, ['Virtual Assistant', 'Email & Calendar Management', 'Scheduling', 'Data Entry']],
  [/video|film|cinemat/i, ['Video Production', 'Video Editing']],
  [/photo/i, ['Photo & Image Editing', 'Local Photography']],
  [/qa|testing|quality/i, ['QA & Bug Testing', 'Software Development']],
  [/translat|interpret|locali[sz]/i, ['Translation', 'Interpretation', 'Localization']],
  [/data|analytics|research/i, ['Data Entry', 'Market Research']],
  [/graphic/i, ['Graphic Design', 'Photo & Image Editing', 'Logo Design']],
  [/seo/i, ['SEO & SEM', 'Content Writing']],
  [/teacher|tutor|instructor|professor|educator|teach/i, ['English Teaching', 'Language Tutoring', 'Online Course Creation', 'Mentoring']],
  [/travel|tour|hospitality|concierge/i, ['Travel Planning', 'Tour Guide', 'Local Guide', 'Concierge Services']],
  [/driver|transport|deliver|courier|logistic/i, ['Personal Driver', 'Package Delivery', 'Courier Services']],
  [/pet|veterinar|animal/i, ['Pet Care', 'Dog Walking']],
  [/consult|advisor|strateg/i, ['Business Consulting', 'Financial Consulting']],
  [/recruit|hr|human resource|talent/i, ['HR & Recruiting', 'Project Management']],
  [/legal|lawyer|attorney|paralegal/i, ['Legal Research', 'Document Notarization']],
  [/account|bookkeep|financ|tax/i, ['Bookkeeping', 'Tax Preparation', 'Financial Consulting']],
  [/mobile|ios|android|react native|flutter/i, ['Mobile App Development', 'Software Development']],
  [/wordpress|cms|webmaster|web dev/i, ['WordPress & CMS', 'Web Development']],
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
    return new Set<string>(); // Start collapsed — popular skills + search handle discovery
  }
  const expanded = new Set<string>();
  for (const [category, categorySkills] of Object.entries(SKILL_CATEGORIES)) {
    if (categorySkills.some((s) => selectedSkills.includes(s))) {
      expanded.add(category);
    }
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

  // Skill search
  const [skillSearch, setSkillSearch] = useState('');

  // Collapsible categories — start collapsed (search + popular handle discovery)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set<string>()
  );

  // OAuth photo import
  const [oauthPhotoUrl, setOauthPhotoUrl] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const [photoImporting, setPhotoImporting] = useState(false);
  const [photoDismissed, setPhotoDismissed] = useState(false);
  const [photoAccepted, setPhotoAccepted] = useState(false);

  // Featured consent — defaults to true when photo is accepted
  const [featuredConsent, setFeaturedConsent] = useState(true);
  const [showFeaturedTooltip, setShowFeaturedTooltip] = useState(false);

  useEffect(() => {
    // Check for OAuth photo URL stored during signup
    const storedPhotoUrl = safeLocalStorage.getItem('oauthPhotoUrl');
    const storedProvider = safeLocalStorage.getItem('oauthProvider');
    if (storedPhotoUrl) {
      setOauthPhotoUrl(storedPhotoUrl);
      setOauthProvider(storedProvider);
      safeLocalStorage.removeItem('oauthPhotoUrl');
      safeLocalStorage.removeItem('oauthProvider');
    }

    // Collect skills to pre-select from multiple sources
    const preSelectedSkills = new Set<string>();

    // Source 1a: Career apply intent (e.g. user clicked "Apply" on Content Creator)
    const careerIntent = getApplyIntent();
    if (careerIntent?.suggestedSkills?.length) {
      careerIntent.suggestedSkills.forEach((s) => preSelectedSkills.add(s));
    }

    // Source 1b: Listing apply intent (e.g. user clicked "Apply" on a listing)
    const listingIntent = getListingApplyIntent();
    if (listingIntent?.requiredSkills?.length) {
      listingIntent.requiredSkills.forEach((s) => preSelectedSkills.add(s));
    }

    // Source 2: LinkedIn headline auto-matching
    const linkedinHeadline = safeLocalStorage.getItem('linkedinHeadline');
    if (linkedinHeadline) {
      safeLocalStorage.removeItem('linkedinHeadline');
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
        featuredConsent,
      });
      analytics.track('onboarding_complete', { skillCount: skills.length });
      posthog.capture('onboarding_completed', { skillCount: skills.length });
      safeLocalStorage.removeItem('hp_onboarding_pending');

      // Auto-submit career application if there's a pending apply intent
      const careerIntent = getApplyIntent();
      if (careerIntent) {
        try {
          await api.submitCareerApplication({
            positionId: careerIntent.positionId,
            positionTitle: careerIntent.positionTitle || careerIntent.positionId,
            about: `Excited to contribute as a ${careerIntent.positionTitle || careerIntent.positionId}.`,
            availability: 'flexible',
          });
          clearApplyIntent();
          toast.success(t('onboarding.applicationSubmitted', `Your application for ${careerIntent.positionTitle || careerIntent.positionId} has been submitted!`));
        } catch (err) {
          // Non-fatal: application submission failure shouldn't block onboarding
          console.error('Auto-submit application failed:', err);
          clearApplyIntent();
        }
      }

      // If there's a pending listing intent, redirect to that listing
      const onboardingListingIntent = getListingApplyIntent();
      if (onboardingListingIntent) {
        clearListingApplyIntent();
        navigate(`/listings/${onboardingListingIntent.listingId}`);
        return;
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

    // Still auto-submit application on skip if intent exists
    const skipCareerIntent = getApplyIntent();
    if (skipCareerIntent) {
      api.submitCareerApplication({
        positionId: skipCareerIntent.positionId,
        positionTitle: skipCareerIntent.positionTitle || skipCareerIntent.positionId,
        about: `Excited to contribute as a ${skipCareerIntent.positionTitle || skipCareerIntent.positionId}.`,
        availability: 'flexible',
      }).catch(() => {}); // Fire and forget
      clearApplyIntent();
    }

    // Redirect to listing if there's a pending intent
    const skipListingIntent = getListingApplyIntent();
    if (skipListingIntent) {
      clearListingApplyIntent();
      navigate(`/listings/${skipListingIntent.listingId}`);
      return;
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
                          setPhotoAccepted(true);
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

            {/* Featured on homepage opt-in */}
            <label className="flex items-start gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={featuredConsent}
                onChange={(e) => setFeaturedConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">
                  {t('onboarding.featuredConsent', 'Feature me on the homepage')}
                </span>
                <span className="relative inline-block ml-1">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowFeaturedTooltip(!showFeaturedTooltip); }}
                    onMouseEnter={() => setShowFeaturedTooltip(true)}
                    onMouseLeave={() => setShowFeaturedTooltip(false)}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-300"
                    aria-label={t('onboarding.featuredConsentInfo', 'What does this mean?')}
                  >
                    ?
                  </button>
                  {showFeaturedTooltip && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10">
                      {t('onboarding.featuredConsentTooltip', 'Your photo, name, skills, and location may appear on our homepage to showcase the community. You can change this anytime in your dashboard privacy settings.')}
                    </span>
                  )}
                </span>
              </span>
            </label>

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

              {/* Selected skills — shown as removable chips at the top */}
              {skills.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {skills.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      {skill}
                      <span className="text-blue-200 text-xs ml-0.5">&times;</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Search bar */}
              <div className="relative mb-3">
                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder={t('onboarding.step2.searchSkills', 'Search skills...')}
                  className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Search results */}
              {skillSearch.trim() ? (
                <div className="mb-3">
                  {(() => {
                    const query = skillSearch.toLowerCase();
                    const matches = SKILL_SUGGESTIONS.filter(
                      (s) => s.toLowerCase().includes(query) && !skills.includes(s)
                    );
                    if (matches.length === 0) return (
                      <p className="text-xs text-slate-400 mb-2">{t('onboarding.step2.noResults', 'No matching skills — add a custom one below')}</p>
                    );
                    return (
                      <div className="flex flex-wrap gap-2">
                        {matches.slice(0, 12).map((skill) => (
                          <button
                            key={skill}
                            onClick={() => { toggleSkill(skill); setSkillSearch(''); }}
                            className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                          >
                            + {skill}
                          </button>
                        ))}
                        {matches.length > 12 && (
                          <span className="px-2 py-1.5 text-xs text-slate-400">+{matches.length - 12} more</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {/* Popular skills — shown when not searching */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      {t('onboarding.step2.popular', 'Popular')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_SKILLS.filter((s) => !skills.includes(s)).slice(0, 8).map((skill) => (
                        <button
                          key={skill}
                          onClick={() => toggleSkill(skill)}
                          className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category accordion */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      {t('onboarding.step2.browseCategories', 'Browse by category')}
                    </p>
                    {Object.entries(SKILL_CATEGORIES).map(([category, categorySkills]) => {
                      const isExpanded = expandedCategories.has(category);
                      const selectedInCategory = categorySkills.filter((s) => skills.includes(s)).length;
                      return (
                        <div key={category}>
                          <button
                            type="button"
                            onClick={() => toggleCategory(category)}
                            className="flex items-center gap-2 w-full text-left py-1.5 group"
                          >
                            <span className="text-xs text-slate-400 transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                              ▸
                            </span>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide group-hover:text-slate-700">
                              {category}
                            </span>
                            {selectedInCategory > 0 ? (
                              <span className="text-xs text-blue-600 font-medium">{selectedInCategory} selected</span>
                            ) : (
                              <span className="text-xs text-slate-400">{categorySkills.length}</span>
                            )}
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
                </>
              )}

              {/* Custom skill input */}
              <div className="flex gap-2 mt-3">
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
