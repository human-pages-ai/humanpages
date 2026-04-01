import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';

// Country codes sorted by dial code length DESC for parsePhone matching,
// then alphabetically by name for display.
export const COUNTRY_CODES = [
  { code: '+93', flag: '\u{1F1E6}\u{1F1EB}', name: 'Afghanistan' },
  { code: '+355', flag: '\u{1F1E6}\u{1F1F1}', name: 'Albania' },
  { code: '+213', flag: '\u{1F1E9}\u{1F1FF}', name: 'Algeria' },
  { code: '+376', flag: '\u{1F1E6}\u{1F1E9}', name: 'Andorra' },
  { code: '+244', flag: '\u{1F1E6}\u{1F1F4}', name: 'Angola' },
  { code: '+54', flag: '\u{1F1E6}\u{1F1F7}', name: 'Argentina' },
  { code: '+374', flag: '\u{1F1E6}\u{1F1F2}', name: 'Armenia' },
  { code: '+61', flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia' },
  { code: '+43', flag: '\u{1F1E6}\u{1F1F9}', name: 'Austria' },
  { code: '+994', flag: '\u{1F1E6}\u{1F1FF}', name: 'Azerbaijan' },
  { code: '+973', flag: '\u{1F1E7}\u{1F1ED}', name: 'Bahrain' },
  { code: '+880', flag: '\u{1F1E7}\u{1F1E9}', name: 'Bangladesh' },
  { code: '+375', flag: '\u{1F1E7}\u{1F1FE}', name: 'Belarus' },
  { code: '+32', flag: '\u{1F1E7}\u{1F1EA}', name: 'Belgium' },
  { code: '+501', flag: '\u{1F1E7}\u{1F1FF}', name: 'Belize' },
  { code: '+229', flag: '\u{1F1E7}\u{1F1EF}', name: 'Benin' },
  { code: '+975', flag: '\u{1F1E7}\u{1F1F9}', name: 'Bhutan' },
  { code: '+591', flag: '\u{1F1E7}\u{1F1F4}', name: 'Bolivia' },
  { code: '+387', flag: '\u{1F1E7}\u{1F1E6}', name: 'Bosnia' },
  { code: '+267', flag: '\u{1F1E7}\u{1F1FC}', name: 'Botswana' },
  { code: '+55', flag: '\u{1F1E7}\u{1F1F7}', name: 'Brazil' },
  { code: '+673', flag: '\u{1F1E7}\u{1F1F3}', name: 'Brunei' },
  { code: '+359', flag: '\u{1F1E7}\u{1F1EC}', name: 'Bulgaria' },
  { code: '+226', flag: '\u{1F1E7}\u{1F1EB}', name: 'Burkina Faso' },
  { code: '+257', flag: '\u{1F1E7}\u{1F1EE}', name: 'Burundi' },
  { code: '+855', flag: '\u{1F1F0}\u{1F1ED}', name: 'Cambodia' },
  { code: '+237', flag: '\u{1F1E8}\u{1F1F2}', name: 'Cameroon' },
  { code: '+1', flag: '\u{1F1E8}\u{1F1E6}', name: 'Canada/US' },
  { code: '+236', flag: '\u{1F1E8}\u{1F1EB}', name: 'Central African Republic' },
  { code: '+235', flag: '\u{1F1F9}\u{1F1E9}', name: 'Chad' },
  { code: '+56', flag: '\u{1F1E8}\u{1F1F1}', name: 'Chile' },
  { code: '+86', flag: '\u{1F1E8}\u{1F1F3}', name: 'China' },
  { code: '+57', flag: '\u{1F1E8}\u{1F1F4}', name: 'Colombia' },
  { code: '+269', flag: '\u{1F1F0}\u{1F1F2}', name: 'Comoros' },
  { code: '+243', flag: '\u{1F1E8}\u{1F1E9}', name: 'Congo (DRC)' },
  { code: '+242', flag: '\u{1F1E8}\u{1F1EC}', name: 'Congo (Republic)' },
  { code: '+506', flag: '\u{1F1E8}\u{1F1F7}', name: 'Costa Rica' },
  { code: '+385', flag: '\u{1F1ED}\u{1F1F7}', name: 'Croatia' },
  { code: '+53', flag: '\u{1F1E8}\u{1F1FA}', name: 'Cuba' },
  { code: '+357', flag: '\u{1F1E8}\u{1F1FE}', name: 'Cyprus' },
  { code: '+420', flag: '\u{1F1E8}\u{1F1FF}', name: 'Czech Republic' },
  { code: '+45', flag: '\u{1F1E9}\u{1F1F0}', name: 'Denmark' },
  { code: '+253', flag: '\u{1F1E9}\u{1F1EF}', name: 'Djibouti' },
  { code: '+593', flag: '\u{1F1EA}\u{1F1E8}', name: 'Ecuador' },
  { code: '+20', flag: '\u{1F1EA}\u{1F1EC}', name: 'Egypt' },
  { code: '+503', flag: '\u{1F1F8}\u{1F1FB}', name: 'El Salvador' },
  { code: '+240', flag: '\u{1F1EC}\u{1F1F6}', name: 'Equatorial Guinea' },
  { code: '+291', flag: '\u{1F1EA}\u{1F1F7}', name: 'Eritrea' },
  { code: '+372', flag: '\u{1F1EA}\u{1F1EA}', name: 'Estonia' },
  { code: '+268', flag: '\u{1F1F8}\u{1F1FF}', name: 'Eswatini' },
  { code: '+251', flag: '\u{1F1EA}\u{1F1F9}', name: 'Ethiopia' },
  { code: '+679', flag: '\u{1F1EB}\u{1F1EF}', name: 'Fiji' },
  { code: '+358', flag: '\u{1F1EB}\u{1F1EE}', name: 'Finland' },
  { code: '+33', flag: '\u{1F1EB}\u{1F1F7}', name: 'France' },
  { code: '+241', flag: '\u{1F1EC}\u{1F1E6}', name: 'Gabon' },
  { code: '+220', flag: '\u{1F1EC}\u{1F1F2}', name: 'Gambia' },
  { code: '+995', flag: '\u{1F1EC}\u{1F1EA}', name: 'Georgia' },
  { code: '+49', flag: '\u{1F1E9}\u{1F1EA}', name: 'Germany' },
  { code: '+233', flag: '\u{1F1EC}\u{1F1ED}', name: 'Ghana' },
  { code: '+30', flag: '\u{1F1EC}\u{1F1F7}', name: 'Greece' },
  { code: '+502', flag: '\u{1F1EC}\u{1F1F9}', name: 'Guatemala' },
  { code: '+224', flag: '\u{1F1EC}\u{1F1F3}', name: 'Guinea' },
  { code: '+592', flag: '\u{1F1EC}\u{1F1FE}', name: 'Guyana' },
  { code: '+509', flag: '\u{1F1ED}\u{1F1F9}', name: 'Haiti' },
  { code: '+504', flag: '\u{1F1ED}\u{1F1F3}', name: 'Honduras' },
  { code: '+852', flag: '\u{1F1ED}\u{1F1F0}', name: 'Hong Kong' },
  { code: '+36', flag: '\u{1F1ED}\u{1F1FA}', name: 'Hungary' },
  { code: '+354', flag: '\u{1F1EE}\u{1F1F8}', name: 'Iceland' },
  { code: '+91', flag: '\u{1F1EE}\u{1F1F3}', name: 'India' },
  { code: '+62', flag: '\u{1F1EE}\u{1F1E9}', name: 'Indonesia' },
  { code: '+98', flag: '\u{1F1EE}\u{1F1F7}', name: 'Iran' },
  { code: '+964', flag: '\u{1F1EE}\u{1F1F6}', name: 'Iraq' },
  { code: '+353', flag: '\u{1F1EE}\u{1F1EA}', name: 'Ireland' },
  { code: '+972', flag: '\u{1F1EE}\u{1F1F1}', name: 'Israel' },
  { code: '+39', flag: '\u{1F1EE}\u{1F1F9}', name: 'Italy' },
  { code: '+225', flag: '\u{1F1E8}\u{1F1EE}', name: 'Ivory Coast' },
  { code: '+1876', flag: '\u{1F1EF}\u{1F1F2}', name: 'Jamaica' },
  { code: '+81', flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan' },
  { code: '+962', flag: '\u{1F1EF}\u{1F1F4}', name: 'Jordan' },
  { code: '+7', flag: '\u{1F1F0}\u{1F1FF}', name: 'Kazakhstan' },
  { code: '+254', flag: '\u{1F1F0}\u{1F1EA}', name: 'Kenya' },
  { code: '+965', flag: '\u{1F1F0}\u{1F1FC}', name: 'Kuwait' },
  { code: '+996', flag: '\u{1F1F0}\u{1F1EC}', name: 'Kyrgyzstan' },
  { code: '+856', flag: '\u{1F1F1}\u{1F1E6}', name: 'Laos' },
  { code: '+371', flag: '\u{1F1F1}\u{1F1FB}', name: 'Latvia' },
  { code: '+961', flag: '\u{1F1F1}\u{1F1E7}', name: 'Lebanon' },
  { code: '+266', flag: '\u{1F1F1}\u{1F1F8}', name: 'Lesotho' },
  { code: '+231', flag: '\u{1F1F1}\u{1F1F7}', name: 'Liberia' },
  { code: '+218', flag: '\u{1F1F1}\u{1F1FE}', name: 'Libya' },
  { code: '+423', flag: '\u{1F1F1}\u{1F1EE}', name: 'Liechtenstein' },
  { code: '+370', flag: '\u{1F1F1}\u{1F1F9}', name: 'Lithuania' },
  { code: '+352', flag: '\u{1F1F1}\u{1F1FA}', name: 'Luxembourg' },
  { code: '+853', flag: '\u{1F1F2}\u{1F1F4}', name: 'Macau' },
  { code: '+261', flag: '\u{1F1F2}\u{1F1EC}', name: 'Madagascar' },
  { code: '+265', flag: '\u{1F1F2}\u{1F1FC}', name: 'Malawi' },
  { code: '+60', flag: '\u{1F1F2}\u{1F1FE}', name: 'Malaysia' },
  { code: '+960', flag: '\u{1F1F2}\u{1F1FB}', name: 'Maldives' },
  { code: '+223', flag: '\u{1F1F2}\u{1F1F1}', name: 'Mali' },
  { code: '+356', flag: '\u{1F1F2}\u{1F1F9}', name: 'Malta' },
  { code: '+222', flag: '\u{1F1F2}\u{1F1F7}', name: 'Mauritania' },
  { code: '+230', flag: '\u{1F1F2}\u{1F1FA}', name: 'Mauritius' },
  { code: '+52', flag: '\u{1F1F2}\u{1F1FD}', name: 'Mexico' },
  { code: '+373', flag: '\u{1F1F2}\u{1F1E9}', name: 'Moldova' },
  { code: '+377', flag: '\u{1F1F2}\u{1F1E8}', name: 'Monaco' },
  { code: '+976', flag: '\u{1F1F2}\u{1F1F3}', name: 'Mongolia' },
  { code: '+382', flag: '\u{1F1F2}\u{1F1EA}', name: 'Montenegro' },
  { code: '+212', flag: '\u{1F1F2}\u{1F1E6}', name: 'Morocco' },
  { code: '+258', flag: '\u{1F1F2}\u{1F1FF}', name: 'Mozambique' },
  { code: '+95', flag: '\u{1F1F2}\u{1F1F2}', name: 'Myanmar' },
  { code: '+264', flag: '\u{1F1F3}\u{1F1E6}', name: 'Namibia' },
  { code: '+977', flag: '\u{1F1F3}\u{1F1F5}', name: 'Nepal' },
  { code: '+31', flag: '\u{1F1F3}\u{1F1F1}', name: 'Netherlands' },
  { code: '+64', flag: '\u{1F1F3}\u{1F1FF}', name: 'New Zealand' },
  { code: '+505', flag: '\u{1F1F3}\u{1F1EE}', name: 'Nicaragua' },
  { code: '+227', flag: '\u{1F1F3}\u{1F1EA}', name: 'Niger' },
  { code: '+234', flag: '\u{1F1F3}\u{1F1EC}', name: 'Nigeria' },
  { code: '+389', flag: '\u{1F1F2}\u{1F1F0}', name: 'North Macedonia' },
  { code: '+47', flag: '\u{1F1F3}\u{1F1F4}', name: 'Norway' },
  { code: '+968', flag: '\u{1F1F4}\u{1F1F2}', name: 'Oman' },
  { code: '+92', flag: '\u{1F1F5}\u{1F1F0}', name: 'Pakistan' },
  { code: '+970', flag: '\u{1F1F5}\u{1F1F8}', name: 'Palestine' },
  { code: '+507', flag: '\u{1F1F5}\u{1F1E6}', name: 'Panama' },
  { code: '+675', flag: '\u{1F1F5}\u{1F1EC}', name: 'Papua New Guinea' },
  { code: '+595', flag: '\u{1F1F5}\u{1F1FE}', name: 'Paraguay' },
  { code: '+51', flag: '\u{1F1F5}\u{1F1EA}', name: 'Peru' },
  { code: '+63', flag: '\u{1F1F5}\u{1F1ED}', name: 'Philippines' },
  { code: '+48', flag: '\u{1F1F5}\u{1F1F1}', name: 'Poland' },
  { code: '+351', flag: '\u{1F1F5}\u{1F1F9}', name: 'Portugal' },
  { code: '+1787', flag: '\u{1F1F5}\u{1F1F7}', name: 'Puerto Rico' },
  { code: '+974', flag: '\u{1F1F6}\u{1F1E6}', name: 'Qatar' },
  { code: '+40', flag: '\u{1F1F7}\u{1F1F4}', name: 'Romania' },
  { code: '+7', flag: '\u{1F1F7}\u{1F1FA}', name: 'Russia' },
  { code: '+250', flag: '\u{1F1F7}\u{1F1FC}', name: 'Rwanda' },
  { code: '+966', flag: '\u{1F1F8}\u{1F1E6}', name: 'Saudi Arabia' },
  { code: '+221', flag: '\u{1F1F8}\u{1F1F3}', name: 'Senegal' },
  { code: '+381', flag: '\u{1F1F7}\u{1F1F8}', name: 'Serbia' },
  { code: '+232', flag: '\u{1F1F8}\u{1F1F1}', name: 'Sierra Leone' },
  { code: '+65', flag: '\u{1F1F8}\u{1F1EC}', name: 'Singapore' },
  { code: '+421', flag: '\u{1F1F8}\u{1F1F0}', name: 'Slovakia' },
  { code: '+386', flag: '\u{1F1F8}\u{1F1EE}', name: 'Slovenia' },
  { code: '+252', flag: '\u{1F1F8}\u{1F1F4}', name: 'Somalia' },
  { code: '+27', flag: '\u{1F1FF}\u{1F1E6}', name: 'South Africa' },
  { code: '+82', flag: '\u{1F1F0}\u{1F1F7}', name: 'South Korea' },
  { code: '+211', flag: '\u{1F1F8}\u{1F1F8}', name: 'South Sudan' },
  { code: '+34', flag: '\u{1F1EA}\u{1F1F8}', name: 'Spain' },
  { code: '+94', flag: '\u{1F1F1}\u{1F1F0}', name: 'Sri Lanka' },
  { code: '+249', flag: '\u{1F1F8}\u{1F1E9}', name: 'Sudan' },
  { code: '+597', flag: '\u{1F1F8}\u{1F1F7}', name: 'Suriname' },
  { code: '+46', flag: '\u{1F1F8}\u{1F1EA}', name: 'Sweden' },
  { code: '+41', flag: '\u{1F1E8}\u{1F1ED}', name: 'Switzerland' },
  { code: '+963', flag: '\u{1F1F8}\u{1F1FE}', name: 'Syria' },
  { code: '+886', flag: '\u{1F1F9}\u{1F1FC}', name: 'Taiwan' },
  { code: '+992', flag: '\u{1F1F9}\u{1F1EF}', name: 'Tajikistan' },
  { code: '+255', flag: '\u{1F1F9}\u{1F1FF}', name: 'Tanzania' },
  { code: '+66', flag: '\u{1F1F9}\u{1F1ED}', name: 'Thailand' },
  { code: '+228', flag: '\u{1F1F9}\u{1F1EC}', name: 'Togo' },
  { code: '+676', flag: '\u{1F1F9}\u{1F1F4}', name: 'Tonga' },
  { code: '+1868', flag: '\u{1F1F9}\u{1F1F9}', name: 'Trinidad & Tobago' },
  { code: '+216', flag: '\u{1F1F9}\u{1F1F3}', name: 'Tunisia' },
  { code: '+90', flag: '\u{1F1F9}\u{1F1F7}', name: 'Turkey' },
  { code: '+993', flag: '\u{1F1F9}\u{1F1F2}', name: 'Turkmenistan' },
  { code: '+256', flag: '\u{1F1FA}\u{1F1EC}', name: 'Uganda' },
  { code: '+380', flag: '\u{1F1FA}\u{1F1E6}', name: 'Ukraine' },
  { code: '+971', flag: '\u{1F1E6}\u{1F1EA}', name: 'UAE' },
  { code: '+44', flag: '\u{1F1EC}\u{1F1E7}', name: 'United Kingdom' },
  { code: '+598', flag: '\u{1F1FA}\u{1F1FE}', name: 'Uruguay' },
  { code: '+998', flag: '\u{1F1FA}\u{1F1FF}', name: 'Uzbekistan' },
  { code: '+58', flag: '\u{1F1FB}\u{1F1EA}', name: 'Venezuela' },
  { code: '+84', flag: '\u{1F1FB}\u{1F1F3}', name: 'Vietnam' },
  { code: '+967', flag: '\u{1F1FE}\u{1F1EA}', name: 'Yemen' },
  { code: '+260', flag: '\u{1F1FF}\u{1F1F2}', name: 'Zambia' },
  { code: '+263', flag: '\u{1F1FF}\u{1F1FC}', name: 'Zimbabwe' },
];

// Pre-sorted by code length DESC — computed once at module level, not per render
const CODES_BY_LENGTH_DESC = [...COUNTRY_CODES].sort(
  (a, b) => b.code.length - a.code.length
);

/**
 * Parse an E.164 phone number into country code + local number.
 * Uses pre-sorted array (longest codes first) so +1876 matches before +1.
 */
function parsePhone(value: string): { dialCode: string; localNumber: string } {
  if (!value || !value.startsWith('+')) {
    return { dialCode: '+1', localNumber: value || '' };
  }

  for (const cc of CODES_BY_LENGTH_DESC) {
    if (value.startsWith(cc.code)) {
      return { dialCode: cc.code, localNumber: value.slice(cc.code.length) };
    }
  }

  return { dialCode: '+1', localNumber: value.replace(/^\+/, '') };
}

interface PhoneInputProps {
  id: string;
  value: string;
  onChange: (fullNumber: string) => void;
  placeholder?: string;
  className?: string;
}

/** Single row in the country dropdown — memoized to avoid re-rendering all 170 rows on typing */
const CountryRow = memo(function CountryRow({
  cc,
  isSelected,
  onSelect,
}: {
  cc: (typeof COUNTRY_CODES)[number];
  isSelected: boolean;
  onSelect: (code: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(cc.code)}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 ${
        isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
      }`}
    >
      <span>{cc.flag}</span>
      <span className="flex-1 text-left truncate">{cc.name}</span>
      <span className="text-gray-500 shrink-0">{cc.code}</span>
    </button>
  );
});

export default function PhoneInput({ id, value, onChange, placeholder, className }: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync from external value changes (e.g., profile load)
  useEffect(() => {
    const p = parsePhone(value);
    setDialCode(p.dialCode);
    setLocalNumber(p.localNumber);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [dropdownOpen]);

  const selectedCountry = useMemo(
    () => COUNTRY_CODES.find(c => c.code === dialCode) || COUNTRY_CODES[0],
    [dialCode]
  );

  const filtered = useMemo(() => {
    if (!search) return COUNTRY_CODES;
    const q = search.toLowerCase();
    return COUNTRY_CODES.filter(
      (cc) => cc.name.toLowerCase().includes(q) || cc.code.includes(search)
    );
  }, [search]);

  const handleDialCodeChange = useCallback((code: string) => {
    setDialCode(code);
    setDropdownOpen(false);
    setSearch('');
    setLocalNumber((prev) => {
      if (prev) onChange(code + prev);
      return prev;
    });
  }, [onChange]);

  const handleNumberChange = useCallback((num: string) => {
    const cleaned = num.replace(/\D/g, '');
    setLocalNumber(cleaned);
    if (cleaned) {
      setDialCode((dc) => {
        onChange(dc + cleaned);
        return dc;
      });
    } else {
      onChange('');
    }
  }, [onChange]);

  return (
    <div className={`flex ${className || ''}`}>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100 text-sm h-full min-w-[90px]"
        >
          <span>{selectedCountry.flag}</span>
          <span className="text-gray-700">{dialCode}</span>
          <svg className="w-3 h-3 text-gray-400 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg">
            <div className="p-2 border-b border-gray-100">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No results</div>
              ) : (
                filtered.map((cc) => (
                  <CountryRow
                    key={`${cc.code}-${cc.name}`}
                    cc={cc}
                    isSelected={cc.code === dialCode && cc.name === selectedCountry.name}
                    onSelect={handleDialCodeChange}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <input
        id={id}
        type="tel"
        value={localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={placeholder || '555 123 4567'}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
