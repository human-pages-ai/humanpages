import { useState, useRef, useEffect, useCallback } from 'react';

interface LocationResult {
  display: string;
  lat: number;
  lng: number;
}

interface LocationAutocompleteProps {
  id: string;
  value: string;
  onChange: (location: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  className?: string;
}

export default function LocationAutocomplete({
  id,
  value,
  onChange,
  placeholder,
  className,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync from external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        'accept-language': 'en',
        featuretype: 'city',
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { headers: { 'User-Agent': 'HumanPages/1.0' } }
      );

      if (!res.ok) return;
      const data = await res.json();

      const locations: LocationResult[] = data
        .filter((r: any) => r.type === 'city' || r.type === 'town' || r.type === 'village' ||
          r.type === 'administrative' || r.type === 'municipality' || r.class === 'place' || r.class === 'boundary')
        .map((r: any) => {
          const addr = r.address || {};
          const city = addr.city || addr.town || addr.village || addr.municipality || '';
          const state = addr.state || '';
          const country = addr.country || '';
          const parts = [city, state, country].filter(Boolean);
          return {
            display: parts.length > 0 ? parts.join(', ') : r.display_name.split(',').slice(0, 3).join(',').trim(),
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          };
        });

      // Deduplicate by display name
      const unique = locations.filter(
        (loc, i, arr) => arr.findIndex((l) => l.display === loc.display) === i
      );

      setResults(unique);
      setOpen(unique.length > 0);
    } catch {
      // Silently fail — user can still type manually
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    onChange(val); // Update parent with typed value (no lat/lng yet)

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (result: LocationResult) => {
    setQuery(result.display);
    setOpen(false);
    setResults([]);
    onChange(result.display, result.lat, result.lng);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-700"
              >
                {r.display}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
