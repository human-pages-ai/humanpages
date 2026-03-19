import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CompactCvProcessingBar } from '../components/CvProcessingBar';
import { SuggestionInput } from '../components/SuggestionInput';
import { POPULAR_SERVICE_CATEGORIES, SERVICE_CATEGORY_HIERARCHY } from '../constants';
import type { Service } from '../types';

const formatUnitLabel = (unit: string): string => {
  const labels: Record<string, string> = {
    'per hour': 'Hourly',
    'per task': 'Fixed Price',
    'per word': 'Per Word',
    'per page': 'Per Page',
    'negotiable': 'Let\'s Discuss',
  };
  return labels[unit] || unit;
};

// Timezone to currency mapping
const TIMEZONE_CURRENCY_MAP: Record<string, string> = {
  'Asia/Saigon': 'VND',
  'Asia/Ho_Chi_Minh': 'VND',
  'Asia/Kolkata': 'INR',
  'Asia/Calcutta': 'INR',
  'Europe/London': 'GBP',
  'Europe/Paris': 'EUR',
  'Europe/Berlin': 'EUR',
  'Asia/Tokyo': 'JPY',
  'Asia/Seoul': 'KRW',
  'America/Sao_Paulo': 'BRL',
  'Africa/Lagos': 'NGN',
  'Asia/Manila': 'PHP',
  'Asia/Jakarta': 'IDR',
  'Asia/Bangkok': 'THB',
  'America/Mexico_City': 'MXN',
  'America/Bogota': 'COP',
  'America/Lima': 'PEN',
  'America/Argentina/Buenos_Aires': 'ARS',
  'Asia/Jerusalem': 'ILS',
  'Asia/Tel_Aviv': 'ILS',
  'Asia/Karachi': 'PKR',
  'Asia/Dhaka': 'BDT',
  'Africa/Nairobi': 'KES',
  'Africa/Accra': 'GHS',
  'Asia/Kuala_Lumpur': 'MYR',
  'Asia/Singapore': 'SGD',
  'Asia/Taipei': 'TWD',
  'Europe/Istanbul': 'TRY',
  'Europe/Moscow': 'RUB',
  'Europe/Kiev': 'UAH',
  'Europe/Warsaw': 'PLN',
  'Europe/Prague': 'CZK',
  'Europe/Budapest': 'HUF',
  'Europe/Bucharest': 'RON',
  'Europe/Stockholm': 'SEK',
  'Europe/Oslo': 'NOK',
  'Europe/Copenhagen': 'DKK',
  'Pacific/Auckland': 'NZD',
  'Australia/Sydney': 'AUD',
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'Asia/Dubai': 'AED',
  'Asia/Riyadh': 'SAR',
  'Africa/Cairo': 'EGP',
  'Asia/Colombo': 'LKR',
  'Asia/Kathmandu': 'NPR',
};

// All currencies with flags
const ALL_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'BRL', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'TRY', name: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'GHS', name: 'Ghanaian Cedi', flag: '🇬🇭' },
  { code: 'PHP', name: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'IDR', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'THB', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'VND', name: 'Vietnamese Dong', flag: '🇻🇳' },
  { code: 'PKR', name: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'BDT', name: 'Bangladeshi Taka', flag: '🇧🇩' },
  { code: 'EGP', name: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'COP', name: 'Colombian Peso', flag: '🇨🇴' },
  { code: 'PEN', name: 'Peruvian Sol', flag: '🇵🇪' },
  { code: 'ARS', name: 'Argentine Peso', flag: '🇦🇷' },
  { code: 'CLP', name: 'Chilean Peso', flag: '🇨🇱' },
  { code: 'NZD', name: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'SEK', name: 'Swedish Krona', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', flag: '🇩🇰' },
  { code: 'PLN', name: 'Polish Zloty', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna', flag: '🇨🇿' },
  { code: 'HUF', name: 'Hungarian Forint', flag: '🇭🇺' },
  { code: 'RON', name: 'Romanian Leu', flag: '🇷🇴' },
  { code: 'BGN', name: 'Bulgarian Lev', flag: '🇧🇬' },
  { code: 'RUB', name: 'Russian Ruble', flag: '🇷🇺' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', flag: '🇺🇦' },
  { code: 'GEL', name: 'Georgian Lari', flag: '🇬🇪' },
  { code: 'AMD', name: 'Armenian Dram', flag: '🇦🇲' },
  { code: 'AZN', name: 'Azerbaijani Manat', flag: '🇦🇿' },
  { code: 'KZT', name: 'Kazakhstani Tenge', flag: '🇰🇿' },
  { code: 'UZS', name: 'Uzbekistani Som', flag: '🇺🇿' },
  { code: 'ILS', name: 'Israeli Shekel', flag: '🇮🇱' },
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'QAR', name: 'Qatari Riyal', flag: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar', flag: '🇰🇼' },
  { code: 'BHD', name: 'Bahraini Dinar', flag: '🇧🇭' },
  { code: 'OMR', name: 'Omani Rial', flag: '🇴🇲' },
  { code: 'JOD', name: 'Jordanian Dinar', flag: '🇯🇴' },
  { code: 'MAD', name: 'Moroccan Dirham', flag: '🇲🇦' },
  { code: 'TND', name: 'Tunisian Dinar', flag: '🇹🇳' },
  { code: 'TWD', name: 'Taiwan Dollar', flag: '🇹🇼' },
  { code: 'MYR', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'LKR', name: 'Sri Lankan Rupee', flag: '🇱🇰' },
  { code: 'NPR', name: 'Nepalese Rupee', flag: '🇳🇵' },
  { code: 'MMK', name: 'Myanmar Kyat', flag: '🇲🇲' },
  { code: 'UGX', name: 'Ugandan Shilling', flag: '🇺🇬' },
  { code: 'TZS', name: 'Tanzanian Shilling', flag: '🇹🇿' },
  { code: 'ETB', name: 'Ethiopian Birr', flag: '🇪🇹' },
  { code: 'XOF', name: 'West African CFA Franc', flag: '🌍' },
  { code: 'JMD', name: 'Jamaican Dollar', flag: '🇯🇲' },
  { code: 'TTD', name: 'Trinidad Dollar', flag: '🇹🇹' },
];

const detectUserCurrency = (): string => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_CURRENCY_MAP[timezone] || 'USD';
  } catch {
    return 'USD';
  }
};

/**
 * Generate service suggestions from CV data OR from the user's skills array.
 * When returning from dashboard, cvData is null but skills are loaded from profile API.
 */
const generateServiceSuggestions = (cvData: any, profileSkills?: string[]): any[] => {
  const suggestions: any[] = [];
  const allSkills = cvData
    ? [...(cvData.skills?.explicit || []), ...(cvData.skills?.inferred || [])]
    : (profileSkills || []);
  if (allSkills.length === 0) return [];
  const experienceHighlights = cvData?.experienceHighlights || [];

  // Skill to service mapping
  const skillToService: Record<string, { title: string; category: string; description: string }> = {
    'react': { title: 'React Development', category: 'Software Development', description: 'Custom React applications' },
    'javascript': { title: 'JavaScript Development', category: 'Software Development', description: 'Full-stack JavaScript projects' },
    'python': { title: 'Python Development', category: 'Software Development', description: 'Python scripting and automation' },
    'design': { title: 'UI/UX Design', category: 'Design & Creative', description: 'Website and app design' },
    'graphic design': { title: 'Graphic Design', category: 'Design & Creative', description: 'Logos, banners, and marketing materials' },
    'writing': { title: 'Content Writing', category: 'Writing & Content', description: 'Articles, blogs, and website copy' },
    'video': { title: 'Video Editing', category: 'Video & Media', description: 'Professional video production' },
    'photography': { title: 'Photography', category: 'Photography', description: 'Professional photo services' },
    'marketing': { title: 'Digital Marketing', category: 'Marketing & SEO', description: 'SEO, social media, and campaigns' },
  };

  // Check skills for matches
  for (const skill of allSkills) {
    const skillLower = skill.toLowerCase();
    for (const [key, service] of Object.entries(skillToService)) {
      if (skillLower.includes(key) && !suggestions.some(s => s.title === service.title)) {
        suggestions.push(service);
        if (suggestions.length >= 3) break; // Cap at 3 suggestions
      }
    }
    if (suggestions.length >= 3) break;
  }

  // If not enough suggestions from skills, use highlights
  if (suggestions.length < 3 && experienceHighlights.length > 0) {
    const highlightLower = experienceHighlights.join(' ').toLowerCase();
    const remainingMappings = Object.entries(skillToService).filter(
      ([_, s]) => !suggestions.some(sg => sg.title === s.title)
    );
    for (const [key, service] of remainingMappings) {
      if (highlightLower.includes(key) && !suggestions.some(s => s.title === service.title)) {
        suggestions.push(service);
        if (suggestions.length >= 3) break;
      }
    }
  }

  return suggestions;
};

interface StepServicesProps {
  cvProcessing: boolean;
  cvData: any;
  /** User's skills from profile — used for suggestions when cvData is unavailable */
  skills?: string[];
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  equipment: string[];
  setEquipment: React.Dispatch<React.SetStateAction<string[]>>;
  /** When true, only render the equipment section (used as standalone Equipment step) */
  equipmentOnly?: boolean;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepServices({ cvProcessing, cvData, skills, services, setServices, equipment, setEquipment, equipmentOnly, onNext, onSkip: _onSkip, error }: StepServicesProps) {
  const { t } = useTranslation();
  const [addingService, setAddingService] = useState(false);
  const localeCurrency = detectUserCurrency();
  const [newService, setNewService] = useState<Service>({ title: '', category: '', subcategory: '', description: '', price: '', currency: localeCurrency, unit: 'per hour' });
  const [categoryError, setCategoryError] = useState(false);
  const [priceError, setPriceError] = useState('');
  // Equipment two-picker state (category + tool)
  const [eqCategory, setEqCategory] = useState('');
  const [eqTool, setEqTool] = useState('');
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);

  // Generate service suggestions from CV data or profile skills
  const cvSuggestedServices = generateServiceSuggestions(cvData, skills);

  const categoryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const priceTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Clear all pending error timeouts on unmount
  useEffect(() => {
    return () => {
      if (categoryTimeoutRef.current) clearTimeout(categoryTimeoutRef.current);
      if (priceTimeoutRef.current) clearTimeout(priceTimeoutRef.current);
    };
  }, []);

  const handleCancelService = () => {
    setAddingService(false);
    setNewService({ title: '', category: '', subcategory: '', description: '', price: '', currency: localeCurrency, unit: 'per hour' });
    setCategoryError(false);
    setPriceError('');
    setShowTitleSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && addingService) {
      e.preventDefault();
      handleCancelService();
    }
  };

  const addSuggestedService = (svc: any) => {
    setServices(prev => [...prev, {
      title: svc.title || '',
      category: svc.category || '',
      subcategory: svc.subcategory || '',
      description: svc.description || '',
      price: '',
      currency: localeCurrency,
      unit: 'per hour',
    }]);
  };

  const applySuggestedTitle = (suggestion: string) => {
    setNewService({ ...newService, title: suggestion });
    setShowTitleSuggestions(false);
  };

  const getCategoryHierarchy = () => {
    if (!newService.category) return { subcategories: [], suggestions: [] };
    return SERVICE_CATEGORY_HIERARCHY[newService.category] || { subcategories: [], suggestions: [] };
  };

  const getDescriptionPlaceholder = () => {
    if (!newService.title) {
      return 'Describe what clients get...';
    }
    return 'I will [deliverable] for [audience]. Includes [specifics]. Delivered in [timeframe]. E.g., "I will design a professional logo for small businesses. Includes 3 concepts, unlimited revisions. Delivered in 2-3 days."';
  };

  const handleAddService = () => {
    if (!newService.title.trim() || !newService.category.trim()) {
      if (!newService.category.trim()) {
        setCategoryError(true);
        if (categoryTimeoutRef.current) clearTimeout(categoryTimeoutRef.current);
        categoryTimeoutRef.current = setTimeout(() => setCategoryError(false), 1500);
      }
      return;
    }
    // Validate price minimum if provided
    if (newService.price.trim()) {
      const parsed = parseFloat(newService.price.trim());
      if (isNaN(parsed) || parsed <= 0) {
        setPriceError('Price must be greater than 0');
        if (priceTimeoutRef.current) clearTimeout(priceTimeoutRef.current);
        priceTimeoutRef.current = setTimeout(() => setPriceError(''), 3000);
        return;
      }
      if (!/^\d+(\.\d{1,2})?$/.test(newService.price.trim())) {
        setPriceError('Use a valid number (max 2 decimal places)');
        if (priceTimeoutRef.current) clearTimeout(priceTimeoutRef.current);
        priceTimeoutRef.current = setTimeout(() => setPriceError(''), 3000);
        return;
      }
      if (parsed > 100000) {
        setPriceError('Price seems too high — double check');
        if (priceTimeoutRef.current) clearTimeout(priceTimeoutRef.current);
        priceTimeoutRef.current = setTimeout(() => setPriceError(''), 3000);
        return;
      }
    }
    setServices(prev => [...prev, { ...newService, title: newService.title.trim(), category: newService.category.trim() }]);
    setNewService({ title: '', category: '', subcategory: '', description: '', price: '', currency: localeCurrency, unit: 'per hour' });
    setAddingService(false);
    setCategoryError(false);
    setPriceError('');
    setShowTitleSuggestions(false);
  };

  const handleRemoveService = (index: number) => {
    setServices(prev => prev.filter((_, i) => i !== index));
  };

  // Equipment-only mode: two-picker (category → tool)
  if (equipmentOnly) {
    const EQUIPMENT_CATEGORIES: { value: string; label: string }[] = [
      { value: 'Phone', label: '📱 Phone' },
      { value: 'Camera', label: '📷 Camera' },
      { value: 'Vehicle', label: '🚗 Vehicle' },
      { value: 'Computer', label: '💻 Computer' },
      { value: 'Audio', label: '🎤 Audio' },
      { value: 'Drone', label: '🚁 Drone' },
      { value: 'Tools', label: '🔨 Tools' },
      { value: 'Software', label: '🖥️ Software' },
      { value: 'Other', label: '🧰 Other' },
    ];

    const TOOLS_BY_CATEGORY: Record<string, { value: string; label: string }[]> = {
      Phone: [
        { value: 'iPhone', label: 'iPhone' },
        { value: 'Samsung Galaxy', label: 'Samsung Galaxy' },
        { value: 'Google Pixel', label: 'Google Pixel' },
        { value: 'Xiaomi', label: 'Xiaomi' },
        { value: 'OnePlus', label: 'OnePlus' },
      ],
      Camera: [
        { value: 'DSLR Camera', label: 'DSLR Camera' },
        { value: 'Mirrorless Camera', label: 'Mirrorless Camera' },
        { value: 'GoPro / Action Camera', label: 'GoPro / Action Camera' },
        { value: 'Webcam', label: 'Webcam' },
        { value: 'Ring Light', label: 'Ring Light' },
        { value: 'Stabilizer / Gimbal', label: 'Stabilizer / Gimbal' },
        { value: 'Green Screen', label: 'Green Screen' },
      ],
      Vehicle: [
        { value: 'Car', label: 'Car' },
        { value: 'Motorcycle', label: 'Motorcycle' },
        { value: 'Bicycle', label: 'Bicycle' },
        { value: 'Van / Truck', label: 'Van / Truck' },
        { value: 'Scooter', label: 'Scooter' },
      ],
      Computer: [
        { value: 'Laptop', label: 'Laptop' },
        { value: 'Desktop', label: 'Desktop' },
        { value: 'iPad / Tablet', label: 'iPad / Tablet' },
        { value: 'External Monitor', label: 'External Monitor' },
      ],
      Audio: [
        { value: 'Microphone', label: 'Microphone' },
        { value: 'Studio Headphones', label: 'Studio Headphones' },
        { value: 'Audio Interface', label: 'Audio Interface' },
        { value: 'Speaker', label: 'Speaker' },
      ],
      Drone: [
        { value: 'DJI Drone', label: 'DJI Drone' },
        { value: 'FPV Drone', label: 'FPV Drone' },
      ],
      Tools: [
        { value: 'Power Drill', label: 'Power Drill' },
        { value: '3D Printer', label: '3D Printer' },
        { value: 'Soldering Station', label: 'Soldering Station' },
        { value: 'Measuring Tools', label: 'Measuring Tools' },
      ],
      Software: [
        { value: 'Adobe Creative Suite', label: 'Adobe Creative Suite' },
        { value: 'Final Cut Pro', label: 'Final Cut Pro' },
        { value: 'AutoCAD', label: 'AutoCAD' },
        { value: 'Figma', label: 'Figma' },
      ],
      Other: [
        { value: 'Sewing Machine', label: 'Sewing Machine' },
        { value: 'Pressure Washer', label: 'Pressure Washer' },
        { value: 'Portable Generator', label: 'Portable Generator' },
        { value: 'Projector', label: 'Projector' },
        { value: 'Printer / Scanner', label: 'Printer / Scanner' },
      ],
    };

    const toolSuggestions = eqCategory ? (TOOLS_BY_CATEGORY[eqCategory] || []) : [];

    // Auto-add: when tool is selected, add "Category - Tool" and reset
    const autoAddEquipment = (category: string, tool: string) => {
      const value = tool.trim() ? `${category} - ${tool.trim()}` : category.trim();
      if (value && !equipment.some(eq => eq.toLowerCase() === value.toLowerCase())) {
        setEquipment(prev => [...prev, value]);
      }
      setEqCategory('');
      setEqTool('');
    };

    // When a tool is picked from suggestions, auto-add immediately
    const handleToolChange = (v: string) => {
      setEqTool(v);
      // Auto-add if user selected a suggestion (not empty, not just typing)
      const isSuggestion = toolSuggestions.some(s => s.value === v || s.label === v);
      if (isSuggestion && eqCategory.trim()) {
        setTimeout(() => autoAddEquipment(eqCategory, v), 50);
      }
    };

    // When category is picked and there are no tool suggestions, auto-add just the category
    const handleCategoryChange = (v: string) => {
      setEqCategory(v);
      setEqTool('');
      const isSuggestion = EQUIPMENT_CATEGORIES.some(s => s.value === v || s.label === v);
      if (isSuggestion && !(TOOLS_BY_CATEGORY[v]?.length)) {
        setTimeout(() => autoAddEquipment(v, ''), 50);
      }
    };

    // Add custom equipment from free-text input (category or category + tool)
    const handleAddCustomEquipment = () => {
      if (eqCategory.trim()) {
        autoAddEquipment(eqCategory, eqTool);
      }
    };

    // Whether the "Add" button should be visible: user typed custom text that isn't a
    // predefined category with tools (those auto-add on selection), OR has custom tool text
    const showAddButton = eqCategory.trim() && (
      !TOOLS_BY_CATEGORY[eqCategory]?.length || eqTool.trim()
    );

    return (
      <>
        <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">{t('onboarding.equipment.heading')}</h2>
        <p className="text-slate-600 mb-6">{t('onboarding.equipment.subtitle')}</p>
        {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}
        {equipment.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {equipment.map((item, idx) => (
              <button key={idx} type="button" onClick={() => setEquipment(prev => prev.filter((_, i) => i !== idx))} aria-label={`Remove: ${item}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 min-h-[44px]">
                {item}<span aria-hidden="true" className="text-orange-200 ml-0.5 text-base leading-none">&times;</span>
              </button>
            ))}
          </div>
        )}
        {equipment.length < 20 && (
          <>
            <div className="space-y-3 mb-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <SuggestionInput
                  value={eqCategory}
                  onChange={handleCategoryChange}
                  suggestions={EQUIPMENT_CATEGORIES}
                  placeholder="Phone, Camera, Vehicle..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && eqCategory.trim() && !TOOLS_BY_CATEGORY[eqCategory]?.length) {
                      e.preventDefault();
                      handleAddCustomEquipment();
                    }
                  }}
                />
              </div>
              {eqCategory && TOOLS_BY_CATEGORY[eqCategory]?.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tool / Model</label>
                  <SuggestionInput
                    value={eqTool}
                    onChange={handleToolChange}
                    suggestions={toolSuggestions}
                    placeholder={`Pick a ${eqCategory.toLowerCase()}...`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && eqTool.trim()) {
                        e.preventDefault();
                        autoAddEquipment(eqCategory, eqTool);
                      }
                    }}
                  />
                </div>
              )}
            </div>
            {showAddButton && (
              <button
                type="button"
                onClick={handleAddCustomEquipment}
                className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 active:bg-orange-700 transition-colors min-h-[44px]"
              >
                Add {eqTool.trim() ? `${eqCategory} - ${eqTool.trim()}` : eqCategory.trim()}
              </button>
            )}
            <p className="text-xs text-slate-400 mt-1">{t('onboarding.equipment.hint')}</p>
          </>
        )}
        <div className="flex justify-end mt-6">
          <button type="button" onClick={onNext} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Next step">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">{t('onboarding.services.heading')}</h2>
      <p className="text-slate-600 mb-6">{t('onboarding.services.subtitle')}</p>

      {cvProcessing && <CompactCvProcessingBar />}
      {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}

      {/* CV-suggested services */}
      {cvSuggestedServices.length > 0 && services.length === 0 && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm font-medium text-orange-900 mb-2">{t('onboarding.services.cvSuggestion')}</p>
          <div className="space-y-2">
            {cvSuggestedServices.map((svc: any, idx: number) => (
              <button key={idx} type="button" onClick={() => addSuggestedService(svc)} className="w-full text-left p-3 bg-white border border-orange-200 rounded-lg hover:border-orange-400 transition-colors">
                <p className="font-medium text-slate-900 text-sm">{svc.title}</p>
                <p className="text-xs text-slate-500">{svc.category} — {svc.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Services</h3>

        {services.length > 0 && (
          <div className="space-y-3 mb-4">
            {services.map((svc, idx) => (
              <div key={idx}>
                {editingServiceIndex === idx ? (
                  // Edit mode for pricing
                  <div className="p-3 border border-orange-300 rounded-lg bg-orange-50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{svc.title}</p>
                        <p className="text-xs text-slate-500">{svc.category}{svc.subcategory ? ` • ${svc.subcategory}` : ''}</p>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-slate-700 mb-2">Set price and currency:</p>
                    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Price</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={svc.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              const updated = [...services];
                              updated[idx] = { ...svc, price: val };
                              setServices(updated);
                            }
                          }}
                          placeholder="Price"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Currency</label>
                        <SuggestionInput
                          value={svc.currency}
                          onChange={(v) => {
                            const updated = [...services];
                            updated[idx] = { ...svc, currency: v.toUpperCase().slice(0, 3) };
                            setServices(updated);
                          }}
                          suggestions={(() => {
                            const suggestedCurrency = detectUserCurrency();
                            const suggested = [
                              suggestedCurrency !== 'USD' ? ALL_CURRENCIES.find(c => c.code === suggestedCurrency) : null,
                              ALL_CURRENCIES.find(c => c.code === 'USD'),
                            ].filter(Boolean) as typeof ALL_CURRENCIES;
                            const rest = ALL_CURRENCIES.filter(c => !suggested.some(s => s?.code === c.code));
                            return [
                              ...suggested.map(c => ({ value: c.code, label: `${c.flag} ${c.code} - ${c.name}` })),
                              ...rest.map(c => ({ value: c.code, label: `${c.flag} ${c.code} - ${c.name}` })),
                            ];
                          })()}
                          placeholder="USD"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Rate Type</label>
                        <select value={svc.unit} onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...svc, unit: e.target.value };
                          setServices(updated);
                        }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                          <option value="per hour">{t('onboarding.services.rateType.hourly')}</option>
                          <option value="per task">{t('onboarding.services.rateType.fixedPrice')}</option>
                          <option value="per word">{t('onboarding.services.rateType.perWord')}</option>
                          <option value="per page">{t('onboarding.services.rateType.perPage')}</option>
                          <option value="negotiable">{t('onboarding.services.rateType.negotiate')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingServiceIndex(null)}
                        className="px-3 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors min-h-[44px]"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingServiceIndex(null); handleRemoveService(idx); }}
                        className="px-3 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[44px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="p-3 border border-slate-200 rounded-lg bg-white hover:border-orange-300 transition-colors cursor-pointer" onClick={() => setEditingServiceIndex(idx)}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{svc.title}</p>
                        <p className="text-xs text-slate-500">{svc.category}{svc.subcategory ? ` • ${svc.subcategory}` : ''}</p>
                      </div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveService(idx); }} className="text-slate-400 hover:text-red-500 font-bold flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={`Remove service: ${svc.title}`}>×</button>
                    </div>
                    {svc.description && <p className="text-xs text-slate-600 mb-2 line-clamp-2">{svc.description}</p>}
                    <div className="flex items-center justify-between">
                      {svc.price ? <p className="text-xs text-slate-700 font-medium">{svc.currency} {svc.price}/{formatUnitLabel(svc.unit)}</p> : <p className="text-xs text-slate-400">{t('onboarding.services.noPriceSet')}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!addingService && (
          <button type="button" onClick={() => setAddingService(true)} disabled={services.length >= 5} aria-disabled={services.length >= 5} className={`w-full py-3 min-h-[44px] border-2 border-dashed rounded-lg text-sm font-medium mb-4 transition-colors ${services.length >= 5 ? 'border-slate-300 text-slate-400 bg-slate-50 cursor-not-allowed opacity-50' : 'border-orange-300 text-orange-600 hover:text-orange-700 hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100'}`}>{t('onboarding.services.addButton')}</button>
        )}

        {addingService && (
          <div className="border border-slate-300 rounded-lg p-4 mb-4 bg-white" onKeyDown={handleKeyDown}>
            {/* Service Title with Suggestions */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Service Title</label>
              <input
                type="text"
                value={newService.title}
                onChange={(e) => setNewService({ ...newService, title: e.target.value.slice(0, 100) })}
                onFocus={() => setShowTitleSuggestions(true)}
                maxLength={100}
                placeholder="e.g., Wedding Photography, Blog Writing..."
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              {showTitleSuggestions && newService.category && getCategoryHierarchy().suggestions.length > 0 && (
                <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs font-medium text-orange-900 mb-2">Suggested titles for {newService.category}:</p>
                  <div className="space-y-1">
                    {getCategoryHierarchy().suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applySuggestedTitle(suggestion)}
                        className="w-full text-left px-2 py-1.5 text-sm text-slate-700 hover:bg-orange-100 rounded transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category with Subcategories */}
            <div className="mb-3">
              <label htmlFor="service-category" className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input
                id="service-category"
                list="service-categories-list"
                type="text"
                autoComplete="off"
                value={newService.category}
                onChange={(e) => { setNewService({ ...newService, category: e.target.value, subcategory: '' }); setCategoryError(false); setShowTitleSuggestions(false); }}
                placeholder="Start typing to find..."
                className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${categoryError ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
              />
              <datalist id="service-categories-list">
                {POPULAR_SERVICE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              {categoryError && <p className="text-xs text-red-500 mt-1">Please select a category</p>}
            </div>

            {/* Subcategory - only show if category has subcategories */}
            {newService.category && getCategoryHierarchy().subcategories.length > 0 && (
              <div className="mb-3">
                <label htmlFor="service-subcategory" className="block text-sm font-medium text-slate-700 mb-1">Subcategory (Optional)</label>
                <select
                  id="service-subcategory"
                  value={newService.subcategory || ''}
                  onChange={(e) => setNewService({ ...newService, subcategory: e.target.value })}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Choose a subcategory...</option>
                  {getCategoryHierarchy().subcategories.map(subcat => (
                    <option key={subcat} value={subcat}>{subcat}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Description with Guidance */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <p className="text-xs text-slate-400 mb-2">A strong description helps agents understand what you offer</p>
              <textarea
                value={newService.description}
                onChange={(e) => setNewService({ ...newService, description: e.target.value.slice(0, 500) })}
                maxLength={500}
                placeholder={getDescriptionPlaceholder()}
                rows={3}
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              {newService.description.length > 0 && (
                <p className={`text-xs mt-1 ${newService.description.length >= 480 ? 'text-red-500 font-medium' : newService.description.length >= 400 ? 'text-orange-600' : 'text-slate-400'}`}>{newService.description.length}/500</p>
              )}
            </div>
            {/* Pricing Section */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-medium text-blue-900 mb-3">Pricing (Optional — you can update this later)</p>
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newService.price}
                    onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setNewService({ ...newService, price: val }); setPriceError(''); } }}
                    placeholder="Price"
                    className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${priceError ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                  />
                  {priceError && <p className="text-xs text-red-500 mt-1">{priceError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <SuggestionInput
                    value={newService.currency}
                    onChange={(v) => setNewService({ ...newService, currency: v.toUpperCase().slice(0, 3) })}
                    suggestions={(() => {
                      const suggestedCurrency = detectUserCurrency();
                      const suggested = [
                        ALL_CURRENCIES.find(c => c.code === 'USD'),
                        suggestedCurrency !== 'USD' ? ALL_CURRENCIES.find(c => c.code === suggestedCurrency) : null,
                      ].filter(Boolean) as typeof ALL_CURRENCIES;
                      const rest = ALL_CURRENCIES.filter(c => !suggested.some(s => s?.code === c.code));

                      return [
                        ...suggested.map(c => ({ value: c.code, label: `${c.flag} ${c.code} - ${c.name}` })),
                        ...rest.map(c => ({ value: c.code, label: `${c.flag} ${c.code} - ${c.name}` })),
                      ];
                    })()}
                    placeholder="USD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rate Type</label>
                  <select value={newService.unit} onChange={(e) => setNewService({ ...newService, unit: e.target.value })} className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                    <option value="per hour">Hourly</option>
                    <option value="per task">Fixed Price</option>
                    <option value="per word">Per Word</option>
                    <option value="per page">Per Page</option>
                    <option value="negotiable">Let's Discuss</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Service Preview */}
            {newService.title && (
              <div className="mb-4 p-3 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xs font-medium text-slate-600 mb-2">How your service will appear:</p>
                <div className="p-3 bg-white rounded border border-slate-200">
                  <p className="font-medium text-slate-900 text-sm">{newService.title}</p>
                  <p className="text-xs text-slate-500 mb-1">{newService.category}{newService.subcategory ? ` • ${newService.subcategory}` : ''}</p>
                  {newService.description && <p className="text-xs text-slate-600 mb-2 line-clamp-2">{newService.description}</p>}
                  <p className="text-xs text-slate-700 font-medium">
                    {newService.price ? `${newService.currency} ${newService.price}/${formatUnitLabel(newService.unit)}` : '(price not set)'}
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={handleAddService} disabled={!newService.title.trim() || !newService.category.trim()} className="px-4 py-2.5 sm:py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors min-h-[44px]">Add Service</button>
              <button type="button" onClick={handleCancelService} className="px-4 py-2.5 sm:py-2 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[44px]">Cancel</button>
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
