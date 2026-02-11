import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import { posthog } from '../lib/posthog';
import SEO from '../components/SEO';
import LocationAutocomplete from '../components/LocationAutocomplete';
import ConfirmDialog from '../components/ConfirmDialog';

const SKILL_SUGGESTIONS = [
  'Local Photography', 'Phone Calls', 'In-Person Verification',
  'Package Pickup & Delivery', 'Document Notarization', 'Store Price Check',
  'Restaurant Reservation', 'Apartment Viewing', 'Queue Waiting',
  'Government Office Visit', 'Interpretation', 'Pet Care',
  'Furniture Assembly', 'Tech Support Home Visit',
  'Grocery Shopping', 'Event Attendance', 'Product Returns',
];

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
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  useEffect(() => {
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
    if (!location.trim() && skills.length === 0) {
      setError(t('onboarding.step2.errorBoth'));
      return;
    }
    if (!location.trim()) {
      setError(t('onboarding.step2.errorLocation'));
      return;
    }
    if (location.trim() && !locationChosen) {
      setError(t('onboarding.step2.errorLocationSelect'));
      return;
    }
    if (skills.length === 0) {
      setError(t('onboarding.step2.errorSkills'));
      return;
    }
    setError('');

    setLoading(true);
    try {
      await api.updateProfile({
        location,
        ...(neighborhood ? { neighborhood } : {}),
        ...(locationLat != null && locationLng != null ? { locationLat, locationLng } : {}),
        skills,
      });
      analytics.track('onboarding_complete', { skillCount: skills.length });
      posthog.capture('onboarding_completed', { skillCount: skills.length });
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

            {/* Location */}
            <div className="mb-6">
              <label htmlFor="location-input" className="block text-sm font-medium text-slate-700 mb-2">
                {t('onboarding.step2.location')}
              </label>
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
                <p className="mt-1 text-sm text-amber-600">
                  {t('onboarding.step2.errorLocationSelect')}
                </p>
              )}
            </div>

            {/* Skills */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('onboarding.step2.skills')}
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {SKILL_SUGGESTIONS.map((skill) => (
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
              disabled={loading || (!!location.trim() && !locationChosen)}
              className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('onboarding.saving') : t('onboarding.completeProfile')}
            </button>
          </div>

          {/* Skip link */}
          <button
            onClick={() => setShowSkipWarning(true)}
            className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700"
          >
            {t('onboarding.skipToDashboard')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showSkipWarning}
        title={t('onboarding.skipWarning.title')}
        message={t('onboarding.skipWarning.message')}
        confirmLabel={t('onboarding.skipWarning.confirm')}
        cancelLabel={t('onboarding.skipWarning.cancel')}
        onConfirm={() => {
          setShowSkipWarning(false);
          analytics.track('onboarding_skip');
          posthog.capture('onboarding_skipped');
          navigate('/dashboard');
        }}
        onCancel={() => setShowSkipWarning(false)}
      />
    </div>
  );
}
