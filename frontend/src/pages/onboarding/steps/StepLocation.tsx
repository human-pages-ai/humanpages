import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SearchableCombobox from '../../../components/common/SearchableCombobox';
import toast from 'react-hot-toast';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import { COMMON_LANGUAGES, PROFICIENCY_LEVELS } from '../constants';
import type { LanguageEntry } from '../types';

const TIMEZONE_CITY_MAP: Record<string, string> = {
  'Asia/Saigon': 'Ho Chi Minh City, Vietnam',
  'Asia/Ho_Chi_Minh': 'Ho Chi Minh City, Vietnam',
  'Asia/Calcutta': 'Kolkata, India',
  'Asia/Kolkata': 'Kolkata, India',
  'Asia/Bombay': 'Mumbai, India',
  'Europe/Kiev': 'Kyiv, Ukraine',
  'Asia/Rangoon': 'Yangon, Myanmar',
  'Asia/Katmandu': 'Kathmandu, Nepal',
  'Pacific/Ponape': 'Pohnpei, Micronesia',
  'Asia/Ujung_Pandang': 'Makassar, Indonesia',
  'America/Buenos_Aires': 'Buenos Aires, Argentina',
};

interface StepLocationProps {
  location: string;
  setLocation: (v: string) => void;
  setLocationLat: (v: number | undefined) => void;
  setLocationLng: (v: number | undefined) => void;
  setNeighborhood: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  languageEntries: LanguageEntry[];
  addLanguageEntry: (entry: LanguageEntry) => void;
  removeLanguageEntry: (index: number) => void;
  updateLanguageEntry: (index: number, updates: Partial<LanguageEntry>) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepLocation({
  location,
  setLocation,
  setLocationLat,
  setLocationLng,
  setNeighborhood,
  timezone,
  setTimezone,
  languageEntries,
  addLanguageEntry,
  removeLanguageEntry,
  updateLanguageEntry,
  onNext,
  onSkip: _onSkip,
  error,
}: StepLocationProps) {
  const { t } = useTranslation();
  const [isRemote, setIsRemote] = useState(location === 'Remote');
  const [defaultLocationDetected, setDefaultLocationDetected] = useState(false);
  const [newLang, setNewLang] = useState('');
  const [newProficiency, setNewProficiency] = useState('');
  const [addingLanguage, setAddingLanguage] = useState(false);

  const handleAddLanguage = () => {
    const trimmed = newLang.trim();
    if (!trimmed) return;
    if (!newProficiency.trim()) {
      toast.error('Please select a proficiency level');
      return;
    }
    if (languageEntries.some(entry => entry.language.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This language is already added');
      return;
    }
    addLanguageEntry({ language: trimmed, proficiency: newProficiency });
    setNewLang('');
    setNewProficiency('');
    setAddingLanguage(false);
  };

  function getCityFromTimezone(tz: string): string {
    // Check if we have a specific mapping
    if (TIMEZONE_CITY_MAP[tz]) {
      return TIMEZONE_CITY_MAP[tz];
    }

    // Extract city from timezone and append continent as hint
    const parts = tz.split('/');
    if (parts.length > 1) {
      const continent = parts[0];
      const cityName = parts[parts.length - 1].replace(/_/g, ' ');
      return `${cityName}, ${continent}`;
    }
    return '';
  }

  // Auto-detect location and timezone on mount
  useEffect(() => {
    if (!location && !isRemote && !defaultLocationDetected) {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(tz);
        if (tz) {
          const cityName = getCityFromTimezone(tz);
          if (cityName) {
            setLocation(cityName);
            setDefaultLocationDetected(true);
          }
        }
      } catch (e) {
        // Silently fail if timezone detection doesn't work
      }
    } else if (!timezone) {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(tz);
      } catch (e) {
        // Silently fail
      }
    }
  }, [location, isRemote, defaultLocationDetected, setLocation, setTimezone, timezone]);

  useEffect(() => {
    if (isRemote) {
      setLocation('Remote');
    }
  }, [isRemote, setLocation]);

  const handleRefreshTimezone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(tz);
    } catch (e) {
      alert('Could not detect timezone');
    }
  };

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">{t('onboarding.location.heading')}</h2>
      <p className="text-slate-600 mb-6">{t('onboarding.location.subtitle')}</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      {/* Location Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <label htmlFor="location-input" className="block text-sm font-medium text-slate-700">{t('onboarding.location.label')}</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRemote}
              onChange={(e) => setIsRemote(e.target.checked)}
              className="w-4 h-4 border border-slate-300 rounded focus:ring-2 focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-slate-700">{t('onboarding.location.remote')}</span>
          </label>
        </div>
        {!isRemote ? (
          <>
            <LocationAutocomplete
              id="location-input"
              value={location}
              onChange={(loc: string, lat?: number, lng?: number, nbhd?: string) => {
                setLocation(loc);
                if (lat != null && lng != null) { setLocationLat(lat); setLocationLng(lng); setNeighborhood(nbhd || ''); } else { setLocationLat(undefined); setLocationLng(undefined); setNeighborhood(''); }
              }}
              placeholder={t('onboarding.location.placeholder')}
              className="w-full px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            {!location && (
              <p className="text-xs text-slate-500 mt-2">{t('onboarding.location.hint')}</p>
            )}
          </>
        ) : (
          <div className="px-4 py-2.5 sm:py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium text-slate-700">{t('onboarding.location.remote')}</div>
        )}
      </div>

      {/* Timezone Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <label htmlFor="timezone-input" className="block text-sm font-medium text-slate-700">{t('onboarding.location.timezoneLabel')}</label>
          <button
            type="button"
            onClick={handleRefreshTimezone}
            className="text-xs font-medium text-orange-600 hover:text-orange-700 py-1"
          >
            Refresh
          </button>
        </div>
        <input
          id="timezone-input"
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="e.g., America/New_York"
          className="w-full px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        <p className="text-xs text-slate-500 mt-2">{t('onboarding.location.timezoneHint')}</p>
      </div>

      {/* ─── Languages Section ─── */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('onboarding.location.languagesLabel')}{languageEntries.length > 0 && <span className="ml-2 text-xs font-normal text-orange-600">{languageEntries.length} added</span>}
        </label>
        {languageEntries.length > 0 && (
          <div className="space-y-3 mb-4">
            {languageEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-900 text-sm">{entry.language}</span>
                  {entry.proficiency && <span className="text-xs text-slate-500 ml-2">({entry.proficiency})</span>}
                </div>
                <select value={entry.proficiency} onChange={(e) => updateLanguageEntry(idx, { proficiency: e.target.value })} className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" aria-label={`Proficiency for ${entry.language}`}>
                  <option value="">No level set</option>
                  {PROFICIENCY_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
                <button type="button" onClick={() => removeLanguageEntry(idx)} className="text-slate-400 hover:text-red-500 font-bold flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={`Remove language: ${entry.language}`}>×</button>
              </div>
            ))}
          </div>
        )}
        {languageEntries.length < 10 && !addingLanguage && (
          <button type="button" onClick={() => setAddingLanguage(true)} className="w-full py-3 min-h-[44px] border-2 border-dashed border-orange-300 rounded-lg text-sm text-orange-600 hover:text-orange-700 hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100 font-medium mb-4 transition-colors">+ Add Language</button>
        )}
        {addingLanguage && (
          <div className="border border-slate-300 rounded-lg p-4 mb-4 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <SearchableCombobox id="onb-lang-name" label="Language" value={newLang} onChange={(v) => setNewLang(v)} options={COMMON_LANGUAGES.filter(lang => !languageEntries.some(entry => entry.language.toLowerCase() === lang.toLowerCase()))} placeholder="e.g., English" required allowFreeText />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proficiency</label>
                <select value={newProficiency} onChange={(e) => setNewProficiency(e.target.value)} className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white" aria-label="Proficiency level" aria-required="true">
                  <option value="">Select proficiency...</option>
                  {PROFICIENCY_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddLanguage} disabled={!newLang.trim()} className="px-4 py-2.5 sm:py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors min-h-[44px]">Add Language</button>
              <button type="button" onClick={() => { setAddingLanguage(false); setNewLang(''); setNewProficiency(''); }} className="px-4 py-2.5 sm:py-2 text-slate-600 bg-slate-100 rounded-lg font-medium text-sm hover:bg-slate-200 active:bg-slate-300 transition-colors min-h-[44px]">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onNext} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Next step">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}
