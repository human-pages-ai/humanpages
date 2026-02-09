import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import { posthog } from '../lib/posthog';
import SEO from '../components/SEO';
import PhoneInput from '../components/PhoneInput';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { SUPPORTED_CURRENCIES, getCurrencySymbol } from '../lib/currencies';

const SKILL_SUGGESTIONS = [
  'Local Photography', 'Phone Calls', 'In-Person Verification',
  'Package Pickup & Delivery', 'Document Notarization', 'Store Price Check',
  'Restaurant Reservation', 'Apartment Viewing', 'Queue Waiting',
  'Government Office Visit', 'Interpretation', 'Pet Care',
  'Furniture Assembly', 'Tech Support Home Visit',
  'Grocery Shopping', 'Event Attendance', 'Product Returns',
];

const EQUIPMENT_SUGGESTIONS = [
  'car', 'bike', 'drone', 'camera', 'smartphone', 'laptop',
  'tools', 'van', 'motorcycle',
];

const LANGUAGE_SUGGESTIONS = [
  'English', 'Spanish', 'Chinese', 'Hindi', 'Filipino',
  'Vietnamese', 'Turkish', 'Thai', 'French', 'Arabic',
  'Portuguese', 'German', 'Japanese', 'Korean', 'Russian',
];

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [contactMethod, setContactMethod] = useState<'email' | 'whatsapp' | 'telegram'>('email');
  const [contactValue, setContactValue] = useState('');
  const [location, setLocation] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [locationLat, setLocationLat] = useState<number | undefined>();
  const [locationLng, setLocationLng] = useState<number | undefined>();
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [minRate, setMinRate] = useState('');
  const [rateCurrency, setRateCurrency] = useState('USD');
  const [rateType, setRateType] = useState<'HOURLY' | 'FLAT_TASK' | 'NEGOTIABLE'>('NEGOTIABLE');
  const [workMode, setWorkMode] = useState<'REMOTE' | 'ONSITE' | 'HYBRID' | null>(null);
  const [step1Error, setStep1Error] = useState('');
  const [step2Error, setStep2Error] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      analytics.identify(data.id);

      // Pre-fill if already set
      if (data.contactEmail) {
        setContactMethod('email');
        setContactValue(data.contactEmail);
      } else if (data.whatsapp) {
        setContactMethod('whatsapp');
        setContactValue(data.whatsapp);
      } else if (data.telegram) {
        setContactMethod('telegram');
        setContactValue(data.telegram);
      }
      if (data.location) setLocation(data.location);
      if (data.neighborhood) setNeighborhood(data.neighborhood);
      if (data.skills?.length) setSkills(data.skills);
      if (data.equipment?.length) setEquipment(data.equipment);
      if (data.languages?.length) setLanguages(data.languages);
      if (data.minRateUsdc) setMinRate(data.minRateUsdc.toString());
      if (data.rateCurrency) setRateCurrency(data.rateCurrency);
      if (data.rateType) setRateType(data.rateType);
      if (data.workMode) setWorkMode(data.workMode);
    } catch (error) {
      console.error('Failed to load profile:', error);
      navigate('/login');
    }
  };

  const isValidWhatsApp = (value: string) => {
    // Must start with + followed by country code and number, 7-15 digits total
    return /^\+[1-9]\d{6,14}$/.test(value.replace(/[\s\-()]/g, ''));
  };

  const handleStep1 = async () => {
    if (!contactValue.trim()) {
      setStep1Error(t('onboarding.step1.errorRequired'));
      return;
    }

    if (contactMethod === 'whatsapp' && !isValidWhatsApp(contactValue)) {
      setStep1Error(t('onboarding.step1.errorWhatsapp'));
      return;
    }

    setStep1Error('');
    setLoading(true);
    try {
      const updates: any = contactMethod === 'email'
        ? { contactEmail: contactValue }
        : contactMethod === 'whatsapp'
        ? { whatsapp: contactValue.replace(/[\s\-()]/g, '') }
        : { telegram: contactValue };
      if (workMode) updates.workMode = workMode;

      await api.updateProfile(updates);
      analytics.track('onboarding_step_1', { contactMethod });
      posthog.capture('onboarding_step_completed', { step: 1, contactMethod });
      setStep(2);
    } catch (error) {
      console.error('Failed to save contact:', error);
      setStep1Error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!location.trim() && skills.length === 0) {
      setStep2Error(t('onboarding.step2.errorBoth'));
      return;
    }
    if (!location.trim()) {
      setStep2Error(t('onboarding.step2.errorLocation'));
      return;
    }
    if (skills.length === 0) {
      setStep2Error(t('onboarding.step2.errorSkills'));
      return;
    }
    setStep2Error('');

    setLoading(true);
    try {
      await api.updateProfile({
        location,
        ...(neighborhood ? { neighborhood } : {}),
        ...(locationLat != null && locationLng != null ? { locationLat, locationLng } : {}),
        skills,
      });
      analytics.track('onboarding_step_2', { skillCount: skills.length });
      posthog.capture('onboarding_step_completed', { step: 2, skillCount: skills.length });
      setStep(3);
    } catch (error) {
      console.error('Failed to save skills/location:', error);
      setStep2Error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setLoading(true);
    try {
      const updates: any = { equipment, languages, rateCurrency };
      if (minRate) updates.minRateUsdc = parseFloat(minRate);
      updates.rateType = rateType;

      await api.updateProfile(updates);
      analytics.track('onboarding_step_3');
      posthog.capture('onboarding_step_completed', { step: 3 });
      completeOnboarding();
    } catch (error) {
      console.error('Failed to save rate:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = () => {
    analytics.track('onboarding_complete');
    posthog.capture('onboarding_completed');
    navigate('/welcome');
  };

  const skipToEnd = () => {
    analytics.track('onboarding_skip', { fromStep: step });
    navigate('/dashboard');
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

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SEO title="Complete Your Profile" noindex />
      {/* Progress bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">{t('onboarding.title')}</span>
            <span className="text-sm text-slate-500">{t('onboarding.stepOf', { step, total: 3 })}</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Step 1: Contact Method */}
          {step === 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {t('onboarding.step1.title')}
              </h2>
              <p className="text-slate-600 mb-6">
                {t('onboarding.step1.subtitle')}
              </p>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setContactMethod('email'); setStep1Error(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                    contactMethod === 'email'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t('onboarding.step1.email')}
                </button>
                <button
                  onClick={() => { setContactMethod('whatsapp'); setStep1Error(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                    contactMethod === 'whatsapp'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t('onboarding.step1.whatsapp')}
                </button>
                <button
                  onClick={() => { setContactMethod('telegram'); setStep1Error(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                    contactMethod === 'telegram'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t('onboarding.step1.telegram')}
                </button>
              </div>

              <label htmlFor="contact-value" className="sr-only">
                {contactMethod === 'email' ? t('onboarding.step1.email') : contactMethod === 'whatsapp' ? t('onboarding.step1.whatsapp') : t('onboarding.step1.telegram')}
              </label>
              {contactMethod === 'whatsapp' ? (
                <PhoneInput
                  id="contact-value"
                  value={contactValue}
                  onChange={(val) => setContactValue(val)}
                  className="w-full"
                />
              ) : (
                <input
                  id="contact-value"
                  type={contactMethod === 'email' ? 'email' : 'text'}
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder={contactMethod === 'email' ? t('onboarding.step1.emailPlaceholder') : t('onboarding.step1.telegramPlaceholder')}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}

              {/* Work Mode */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('dashboard.workMode.title')}
                </label>
                <div className="flex gap-2">
                  {(['REMOTE', 'ONSITE', 'HYBRID'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setWorkMode(workMode === mode ? null : mode)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                        workMode === mode
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {t(`dashboard.workMode.${mode.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              </div>

              {step1Error && (
                <p className="mt-3 text-sm text-red-600">{step1Error}</p>
              )}

              <button
                onClick={handleStep1}
                disabled={loading || !contactValue.trim()}
                className="w-full mt-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('onboarding.saving') : t('onboarding.continue')}
              </button>
            </div>
          )}

          {/* Step 2: Skills & Location */}
          {step === 2 && (
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
                    if (nbhd) setNeighborhood(nbhd);
                    if (lat != null && lng != null) {
                      setLocationLat(lat);
                      setLocationLng(lng);
                    }
                  }}
                  placeholder={t('onboarding.step2.locationPlaceholder')}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
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

              {step2Error && (
                <p className="mt-4 text-sm text-red-600">{step2Error}</p>
              )}

              <button
                onClick={handleStep2}
                disabled={loading}
                className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('onboarding.saving') : t('onboarding.continue')}
              </button>
            </div>
          )}

          {/* Step 3: Rate & Equipment (Optional) */}
          {step === 3 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {t('onboarding.step3.title')}
              </h2>
              <p className="text-slate-600 mb-6">
                {t('onboarding.step3.subtitle')}
              </p>

              {/* Currency */}
              <div className="mb-4">
                <label htmlFor="rate-currency" className="block text-sm font-medium text-slate-700 mb-2">
                  {t('currency.label')}
                </label>
                <select
                  id="rate-currency"
                  value={rateCurrency}
                  onChange={(e) => setRateCurrency(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rate */}
              <div className="mb-6">
                <label htmlFor="min-rate" className="block text-sm font-medium text-slate-700 mb-2">
                  {t('onboarding.step3.minRate')}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{getCurrencySymbol(rateCurrency)}</span>
                    <input
                      id="min-rate"
                      type="number"
                      value={minRate}
                      onChange={(e) => setMinRate(e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <label htmlFor="rate-type" className="sr-only">
                    {t('onboarding.step3.perHour')} / {t('onboarding.step3.perTask')} / {t('onboarding.step3.negotiable')}
                  </label>
                  <select
                    id="rate-type"
                    value={rateType}
                    onChange={(e) => setRateType(e.target.value as any)}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="HOURLY">{t('onboarding.step3.perHour')}</option>
                    <option value="FLAT_TASK">{t('onboarding.step3.perTask')}</option>
                    <option value="NEGOTIABLE">{t('onboarding.step3.negotiable')}</option>
                  </select>
                </div>
              </div>

              {/* Equipment */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('onboarding.step3.equipment')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      onClick={() => toggleEquipment(item)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        equipment.includes(item)
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('onboarding.step3.languages')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_SUGGESTIONS.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => toggleLanguage(lang)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        languages.includes(lang)
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStep3}
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? t('onboarding.saving') : t('onboarding.completeProfile')}
              </button>

              <button
                onClick={completeOnboarding}
                className="w-full mt-3 py-3 text-slate-600 font-medium hover:text-slate-800"
              >
                {t('onboarding.skipForNow')}
              </button>
            </div>
          )}

          {/* Skip link */}
          {step < 3 && (
            <button
              onClick={skipToEnd}
              className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700"
            >
              {t('onboarding.skipToDashboard')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
