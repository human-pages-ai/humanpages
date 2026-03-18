import { useState, useEffect, useRef } from 'react';
import { COUNTRY_CODES } from '../constants';

interface WhatsAppSectionProps {
  whatsappNumber: string;
  setWhatsappNumber: (v: string) => void;
  smsNumber?: string;
  setSmsNumber?: (v: string) => void;
}

export function WhatsAppSection({ whatsappNumber, setWhatsappNumber, smsNumber = '', setSmsNumber }: WhatsAppSectionProps) {
  const [countryCode, setCountryCode] = useState(() => {
    if (whatsappNumber) {
      const match = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find(c => whatsappNumber.startsWith(c.code));
      if (match) return match.code;
    }
    return '+1';
  });
  const [localPhone, setLocalPhone] = useState(() => {
    if (whatsappNumber) {
      const match = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find(c => whatsappNumber.startsWith(c.code));
      if (match) return whatsappNumber.slice(match.code.length).trim();
    }
    return whatsappNumber.replace(/^\+\d+\s*/, '');
  });
  const [codeSearch, setCodeSearch] = useState('');
  const [codeDropdownOpen, setCodeDropdownOpen] = useState(false);
  const codeDropdownRef = useRef<HTMLDivElement>(null);
  const [isDifferentSmsNumber, setIsDifferentSmsNumber] = useState(!!smsNumber);
  const [smsCountryCode, setSmsCountryCode] = useState(() => {
    if (smsNumber) {
      const match = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find(c => smsNumber.startsWith(c.code));
      if (match) return match.code;
    }
    return '+1';
  });
  const [smsLocalPhone, setSmsLocalPhone] = useState(() => {
    if (smsNumber) {
      const match = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find(c => smsNumber.startsWith(c.code));
      if (match) return smsNumber.slice(match.code.length).trim();
    }
    return '';
  });
  const [smsCpdeSearch, setSmsCpdeSearch] = useState('');
  const [smsCpdeDropdownOpen, setSmsCpdeDropdownOpen] = useState(false);
  const smsCodeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const full = localPhone ? `${countryCode}${localPhone.replace(/\D/g, '')}` : '';
    setWhatsappNumber(full);
  }, [countryCode, localPhone, setWhatsappNumber]);

  useEffect(() => {
    const full = localPhone ? `${countryCode}${localPhone.replace(/\D/g, '')}` : '';
    setWhatsappNumber(full);
  }, [countryCode, localPhone, setWhatsappNumber]);

  useEffect(() => {
    if (setSmsNumber) {
      const full = isDifferentSmsNumber && smsLocalPhone ? `${smsCountryCode}${smsLocalPhone.replace(/\D/g, '')}` : '';
      setSmsNumber(full);
    }
  }, [isDifferentSmsNumber, smsCountryCode, smsLocalPhone, setSmsNumber]);

  useEffect(() => {
    if (!codeDropdownOpen) return;
    const handleOutside = (e: Event) => {
      if (codeDropdownRef.current && !codeDropdownRef.current.contains(e.target as Node)) {
        setCodeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [codeDropdownOpen]);

  useEffect(() => {
    if (!smsCpdeDropdownOpen) return;
    const handleOutside = (e: Event) => {
      if (smsCodeDropdownRef.current && !smsCodeDropdownRef.current.contains(e.target as Node)) {
        setSmsCpdeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [smsCpdeDropdownOpen]);

  return (
    <div className="mb-6 p-4 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">WhatsApp</h3>
          <p className="text-xs text-slate-500">Get notified on WhatsApp when new jobs match your skills</p>
        </div>
      </div>
      <div>
        <label htmlFor="whatsapp-local" className="block text-sm font-medium text-slate-700 mb-1">Your WhatsApp number</label>
        <div className="flex gap-2">
          <div className="relative" ref={codeDropdownRef}>
            <button
              type="button"
              onClick={() => { setCodeDropdownOpen(!codeDropdownOpen); setCodeSearch(''); }}
              className="flex items-center gap-1 px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-lg text-sm bg-white hover:bg-slate-50 active:bg-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 whitespace-nowrap"
              aria-haspopup="listbox"
              aria-expanded={codeDropdownOpen}
            >
              <span className="text-base">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag || '🌍'}</span>
              <span className="font-medium">{countryCode}</span>
              <svg className={`w-3 h-3 text-slate-400 transition-transform ${codeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {codeDropdownOpen && (
              <div className="absolute z-[70] mt-1 w-64 max-h-60 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden" role="listbox">
                <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
                  <input
                    type="text"
                    value={codeSearch}
                    onChange={(e) => setCodeSearch(e.target.value)}
                    placeholder="Search country..."
                    className="w-full px-3 py-2 min-h-[44px] border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <div className="overflow-y-auto max-h-48">
                  {COUNTRY_CODES.filter(c =>
                    !codeSearch || c.label.toLowerCase().includes(codeSearch.toLowerCase()) || c.code.includes(codeSearch)
                  ).map(c => (
                    <button
                      key={c.country}
                      type="button"
                      role="option"
                      aria-selected={c.code === countryCode}
                      onClick={() => { setCountryCode(c.code); setCodeDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 min-h-[44px] text-sm flex items-center gap-2 active:bg-orange-50 ${c.code === countryCode ? 'bg-orange-50 font-medium text-orange-700' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <span className="text-base">{c.flag}</span>
                      <span className="flex-1">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <input
            id="whatsapp-local"
            type="tel"
            inputMode="tel"
            value={localPhone}
            onChange={(e) => setLocalPhone(e.target.value)}
            placeholder="555 123 4567"
            autoComplete="tel-national"
            className="flex-1 min-w-0 px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">We'll only contact you about job opportunities.</p>
      </div>

      {/* SMS Number Checkbox & Input */}
      <div className="mt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isDifferentSmsNumber}
            onChange={(e) => {
              setIsDifferentSmsNumber(e.target.checked);
              if (!e.target.checked && setSmsNumber) {
                setSmsNumber('');
                setSmsLocalPhone('');
              }
            }}
            className="w-4 h-4 border-slate-300 rounded text-orange-500 focus:ring-2 focus:ring-orange-500 cursor-pointer"
          />
          <span className="text-sm font-medium text-slate-700">My SMS number is different from WhatsApp</span>
        </label>
      </div>

      {isDifferentSmsNumber && (
        <div className="mt-4">
          <label htmlFor="sms-local" className="block text-sm font-medium text-slate-700 mb-1">Your SMS number</label>
          <div className="flex gap-2">
            <div className="relative" ref={smsCodeDropdownRef}>
              <button
                type="button"
                onClick={() => { setSmsCpdeDropdownOpen(!smsCpdeDropdownOpen); setSmsCpdeSearch(''); }}
                className="flex items-center gap-1 px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-lg text-sm bg-white hover:bg-slate-50 active:bg-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 whitespace-nowrap"
                aria-haspopup="listbox"
                aria-expanded={smsCpdeDropdownOpen}
              >
                <span className="text-base">{COUNTRY_CODES.find(c => c.code === smsCountryCode)?.flag || '🌍'}</span>
                <span className="font-medium">{smsCountryCode}</span>
                <svg className={`w-3 h-3 text-slate-400 transition-transform ${smsCpdeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {smsCpdeDropdownOpen && (
                <div className="absolute z-[70] mt-1 w-64 max-h-60 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden" role="listbox">
                  <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={smsCpdeSearch}
                      onChange={(e) => setSmsCpdeSearch(e.target.value)}
                      placeholder="Search country..."
                      className="w-full px-3 py-2 min-h-[44px] border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                  <div className="overflow-y-auto max-h-48">
                    {COUNTRY_CODES.filter(c =>
                      !smsCpdeSearch || c.label.toLowerCase().includes(smsCpdeSearch.toLowerCase()) || c.code.includes(smsCpdeSearch)
                    ).map(c => (
                      <button
                        key={c.country}
                        type="button"
                        role="option"
                        aria-selected={c.code === smsCountryCode}
                        onClick={() => { setSmsCountryCode(c.code); setSmsCpdeDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2.5 min-h-[44px] text-sm flex items-center gap-2 active:bg-orange-50 ${c.code === smsCountryCode ? 'bg-orange-50 font-medium text-orange-700' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        <span className="text-base">{c.flag}</span>
                        <span className="flex-1">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input
              id="sms-local"
              type="tel"
              inputMode="tel"
              value={smsLocalPhone}
              onChange={(e) => setSmsLocalPhone(e.target.value)}
              placeholder="555 123 4567"
              autoComplete="tel-national"
              className="flex-1 min-w-0 px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">We'll only contact you about job opportunities.</p>
        </div>
      )}
    </div>
  );
}
