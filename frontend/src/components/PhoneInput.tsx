import { useState, useRef, useEffect } from 'react';

// Common country codes sorted by likely usage for a global gig platform
const COUNTRY_CODES = [
  { code: '+1', flag: '\u{1F1FA}\u{1F1F8}', name: 'US/CA' },
  { code: '+44', flag: '\u{1F1EC}\u{1F1E7}', name: 'UK' },
  { code: '+91', flag: '\u{1F1EE}\u{1F1F3}', name: 'India' },
  { code: '+63', flag: '\u{1F1F5}\u{1F1ED}', name: 'Philippines' },
  { code: '+84', flag: '\u{1F1FB}\u{1F1F3}', name: 'Vietnam' },
  { code: '+90', flag: '\u{1F1F9}\u{1F1F7}', name: 'Turkey' },
  { code: '+66', flag: '\u{1F1F9}\u{1F1ED}', name: 'Thailand' },
  { code: '+86', flag: '\u{1F1E8}\u{1F1F3}', name: 'China' },
  { code: '+52', flag: '\u{1F1F2}\u{1F1FD}', name: 'Mexico' },
  { code: '+55', flag: '\u{1F1E7}\u{1F1F7}', name: 'Brazil' },
  { code: '+49', flag: '\u{1F1E9}\u{1F1EA}', name: 'Germany' },
  { code: '+33', flag: '\u{1F1EB}\u{1F1F7}', name: 'France' },
  { code: '+34', flag: '\u{1F1EA}\u{1F1F8}', name: 'Spain' },
  { code: '+39', flag: '\u{1F1EE}\u{1F1F9}', name: 'Italy' },
  { code: '+81', flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan' },
  { code: '+82', flag: '\u{1F1F0}\u{1F1F7}', name: 'Korea' },
  { code: '+61', flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia' },
  { code: '+7', flag: '\u{1F1F7}\u{1F1FA}', name: 'Russia' },
  { code: '+62', flag: '\u{1F1EE}\u{1F1E9}', name: 'Indonesia' },
  { code: '+234', flag: '\u{1F1F3}\u{1F1EC}', name: 'Nigeria' },
  { code: '+27', flag: '\u{1F1FF}\u{1F1E6}', name: 'South Africa' },
  { code: '+20', flag: '\u{1F1EA}\u{1F1EC}', name: 'Egypt' },
  { code: '+971', flag: '\u{1F1E6}\u{1F1EA}', name: 'UAE' },
  { code: '+966', flag: '\u{1F1F8}\u{1F1E6}', name: 'Saudi Arabia' },
  { code: '+48', flag: '\u{1F1F5}\u{1F1F1}', name: 'Poland' },
  { code: '+31', flag: '\u{1F1F3}\u{1F1F1}', name: 'Netherlands' },
  { code: '+46', flag: '\u{1F1F8}\u{1F1EA}', name: 'Sweden' },
  { code: '+41', flag: '\u{1F1E8}\u{1F1ED}', name: 'Switzerland' },
  { code: '+351', flag: '\u{1F1F5}\u{1F1F9}', name: 'Portugal' },
  { code: '+57', flag: '\u{1F1E8}\u{1F1F4}', name: 'Colombia' },
  { code: '+56', flag: '\u{1F1E8}\u{1F1F1}', name: 'Chile' },
  { code: '+54', flag: '\u{1F1E6}\u{1F1F7}', name: 'Argentina' },
  { code: '+60', flag: '\u{1F1F2}\u{1F1FE}', name: 'Malaysia' },
  { code: '+65', flag: '\u{1F1F8}\u{1F1EC}', name: 'Singapore' },
  { code: '+972', flag: '\u{1F1EE}\u{1F1F1}', name: 'Israel' },
  { code: '+380', flag: '\u{1F1FA}\u{1F1E6}', name: 'Ukraine' },
  { code: '+40', flag: '\u{1F1F7}\u{1F1F4}', name: 'Romania' },
  { code: '+30', flag: '\u{1F1EC}\u{1F1F7}', name: 'Greece' },
  { code: '+64', flag: '\u{1F1F3}\u{1F1FF}', name: 'New Zealand' },
  { code: '+353', flag: '\u{1F1EE}\u{1F1EA}', name: 'Ireland' },
];

/**
 * Parse an E.164 phone number into country code + local number.
 * Returns the best match from COUNTRY_CODES.
 */
function parsePhone(value: string): { dialCode: string; localNumber: string } {
  if (!value || !value.startsWith('+')) {
    return { dialCode: '+1', localNumber: value || '' };
  }

  // Try longest country codes first (e.g., +971 before +9)
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const cc of sorted) {
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

export default function PhoneInput({ id, value, onChange, placeholder, className }: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCountry = COUNTRY_CODES.find(c => c.code === dialCode) || COUNTRY_CODES[0];

  const handleDialCodeChange = (code: string) => {
    setDialCode(code);
    setDropdownOpen(false);
    if (localNumber) {
      onChange(code + localNumber);
    }
  };

  const handleNumberChange = (num: string) => {
    // Strip non-digit characters
    const cleaned = num.replace(/\D/g, '');
    setLocalNumber(cleaned);
    if (cleaned) {
      onChange(dialCode + cleaned);
    } else {
      onChange('');
    }
  };

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
          <div className="absolute z-50 mt-1 w-56 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
            {COUNTRY_CODES.map((cc) => (
              <button
                key={cc.code}
                type="button"
                onClick={() => handleDialCodeChange(cc.code)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 ${
                  cc.code === dialCode ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <span>{cc.flag}</span>
                <span className="flex-1 text-left">{cc.name}</span>
                <span className="text-gray-500">{cc.code}</span>
              </button>
            ))}
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
