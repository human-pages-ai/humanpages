import { useState, useEffect } from 'react';
import LocationAutocomplete from '../../../components/LocationAutocomplete';

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
  onNext,
  onSkip,
  error,
}: StepLocationProps) {
  const [isRemote, setIsRemote] = useState(location === 'Remote');
  const [defaultLocationDetected, setDefaultLocationDetected] = useState(false);

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
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Where Are You?</h2>
      <p className="text-slate-600 mb-6">Tell us your location and timezone</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      {/* Location Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <label htmlFor="location-input" className="block text-sm font-medium text-slate-700">Location</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRemote}
              onChange={(e) => setIsRemote(e.target.checked)}
              className="w-4 h-4 border border-slate-300 rounded focus:ring-2 focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-slate-700">Remote</span>
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
              placeholder="City or address"
              className="w-full px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            {!location && (
              <p className="text-xs text-slate-500 mt-2">Location helps agents find you for local tasks</p>
            )}
          </>
        ) : (
          <div className="px-4 py-2.5 sm:py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium text-slate-700">Remote</div>
        )}
      </div>

      {/* Timezone Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <label className="block text-sm font-medium text-slate-700">Timezone</label>
          <button
            type="button"
            onClick={handleRefreshTimezone}
            className="text-xs font-medium text-orange-600 hover:text-orange-700 py-1"
          >
            Refresh
          </button>
        </div>
        <div className="px-4 py-2.5 sm:py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium text-slate-700">
          {timezone || 'Not detected'}
        </div>
        <p className="text-xs text-slate-500 mt-2">Auto-detected from your device</p>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={onNext} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">Next →</button>
        <button type="button" onClick={onSkip} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 active:bg-slate-300">Skip →</button>
      </div>
    </>
  );
}
