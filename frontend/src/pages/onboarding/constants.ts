// ─── Onboarding Wizard Constants ───

export const STORAGE_KEY = 'hp_onboarding_draft';

export const STEP_LABELS = ['CV Upload', 'Connect', 'Availability', 'Services', 'About You', 'Skills', 'Finish'] as const;

export const PROFICIENCY_LEVELS = [
  'Native',
  'Full Professional Proficiency',
  'Professional Working Proficiency',
  'Limited Working Proficiency',
  'Elementary',
];

export const COMMON_LANGUAGES = [
  'English', 'Spanish', 'Mandarin', 'French', 'German', 'Portuguese', 'Japanese',
  'Hindi', 'Arabic', 'Russian', 'Korean', 'Italian', 'Dutch', 'Turkish', 'Polish',
  'Swedish', 'Hebrew', 'Thai', 'Vietnamese', 'Indonesian', 'Czech', 'Greek',
  'Romanian', 'Hungarian', 'Danish', 'Finnish', 'Norwegian', 'Ukrainian', 'Bengali',
  'Urdu', 'Malay', 'Tagalog', 'Swahili', 'Persian', 'Tamil', 'Telugu',
];

export const SKILL_CATEGORIES: Record<string, string[]> = {
  'Marketing & Sales': ['Social Media Management', 'SEO & SEM', 'Email Marketing', 'Sales & Lead Generation', 'Cold Outreach', 'Market Research', 'Influencer Marketing', 'Affiliate Marketing', 'Brand Strategy', 'Public Relations', 'Growth Hacking'],
  'Content & Writing': ['Content Writing', 'Copywriting', 'Proofreading & Editing', 'Technical Writing', 'Blog Writing', 'Ghostwriting', 'Grant Writing', 'Resume & Cover Letters', 'Script Writing'],
  'Design & Creative': ['Graphic Design', 'UI/UX Design', 'Photo & Image Editing', 'Video Production', 'Video Editing', 'Prototyping & Wireframing', 'Logo Design', 'Illustration', 'Animation & Motion Graphics', 'Brand Identity', '3D Modeling'],
  'Development & Tech': ['Software Development', 'Web Development', 'Mobile App Development', 'QA & Bug Testing', 'Code Review', 'DevOps & Cloud', 'Database Management', 'API Development', 'WordPress & CMS', 'AI & Machine Learning'],
  'Admin & Support': ['Virtual Assistant', 'Customer Support', 'Chat & Email Support', 'Data Entry', 'Email & Calendar Management', 'Scheduling', 'Document Management', 'Bookkeeping', 'Project Management', 'CRM Management'],
  'Education & Tutoring': ['English Teaching', 'Language Tutoring', 'Math Tutoring', 'Science Tutoring', 'Music Lessons', 'Test Prep & SAT', 'Academic Writing Help', 'Online Course Creation', 'Mentoring'],
  'Translation & Language': ['Translation', 'Interpretation', 'Localization', 'Subtitling & Captions', 'Transcription', 'Voiceover'],
  'Travel & Hospitality': ['Travel Planning', 'Tour Guide', 'Local Guide', 'Event Coordination', 'Concierge Services', 'Hotel & Airbnb Management'],
  'Transportation & Delivery': ['Personal Driver', 'Package Delivery', 'Courier Services', 'Airport Transfers', 'Moving & Relocation', 'Errand Running'],
  'Home & Personal Services': ['Pet Care', 'Dog Walking', 'House Sitting', 'Babysitting', 'Elder Care', 'Personal Shopping', 'Cooking & Meal Prep', 'Cleaning', 'Furniture Assembly', 'Handyman', 'Gardening & Landscaping'],
  'Community & Social': ['Community Management', 'Social Media Moderation', 'Discord & Telegram Management', 'Forum Moderation', 'Event Planning', 'Fundraising'],
  'Professional Services': ['Legal Research', 'Tax Preparation', 'Financial Consulting', 'Business Consulting', 'Real Estate', 'Insurance', 'Document Notarization', 'HR & Recruiting'],
  'Local & In-Person': ['Local Photography', 'In-Person Verification', 'Mystery Shopping', 'Survey & Feedback', 'In-Home Tech Support', 'Fitness Training', 'Tailoring & Alterations', 'Auto Repair'],
};

export const POPULAR_SKILLS = ['Virtual Assistant', 'Content Writing', 'Graphic Design', 'Social Media Management', 'English Teaching', 'Translation', 'Video Editing', 'Web Development', 'Data Entry', 'Customer Support', 'Tour Guide', 'Personal Driver'];
export const SKILL_SUGGESTIONS = Object.values(SKILL_CATEGORIES).flat();
export const POPULAR_SERVICE_CATEGORIES = ['Photography', 'Delivery', 'Translation', 'Writing', 'Web Development', 'Data Entry', 'Graphic Design', 'Virtual Assistant', 'Tutoring', 'Other'];

export const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸', label: 'United States (+1)' },
  { code: '+44', country: 'GB', flag: '🇬🇧', label: 'United Kingdom (+44)' },
  { code: '+972', country: 'IL', flag: '🇮🇱', label: 'Israel (+972)' },
  { code: '+91', country: 'IN', flag: '🇮🇳', label: 'India (+91)' },
  { code: '+86', country: 'CN', flag: '🇨🇳', label: 'China (+86)' },
  { code: '+81', country: 'JP', flag: '🇯🇵', label: 'Japan (+81)' },
  { code: '+82', country: 'KR', flag: '🇰🇷', label: 'South Korea (+82)' },
  { code: '+49', country: 'DE', flag: '🇩🇪', label: 'Germany (+49)' },
  { code: '+33', country: 'FR', flag: '🇫🇷', label: 'France (+33)' },
  { code: '+34', country: 'ES', flag: '🇪🇸', label: 'Spain (+34)' },
  { code: '+39', country: 'IT', flag: '🇮🇹', label: 'Italy (+39)' },
  { code: '+55', country: 'BR', flag: '🇧🇷', label: 'Brazil (+55)' },
  { code: '+52', country: 'MX', flag: '🇲🇽', label: 'Mexico (+52)' },
  { code: '+54', country: 'AR', flag: '🇦🇷', label: 'Argentina (+54)' },
  { code: '+57', country: 'CO', flag: '🇨🇴', label: 'Colombia (+57)' },
  { code: '+56', country: 'CL', flag: '🇨🇱', label: 'Chile (+56)' },
  { code: '+51', country: 'PE', flag: '🇵🇪', label: 'Peru (+51)' },
  { code: '+58', country: 'VE', flag: '🇻🇪', label: 'Venezuela (+58)' },
  { code: '+7', country: 'RU', flag: '🇷🇺', label: 'Russia (+7)' },
  { code: '+380', country: 'UA', flag: '🇺🇦', label: 'Ukraine (+380)' },
  { code: '+48', country: 'PL', flag: '🇵🇱', label: 'Poland (+48)' },
  { code: '+40', country: 'RO', flag: '🇷🇴', label: 'Romania (+40)' },
  { code: '+31', country: 'NL', flag: '🇳🇱', label: 'Netherlands (+31)' },
  { code: '+32', country: 'BE', flag: '🇧🇪', label: 'Belgium (+32)' },
  { code: '+46', country: 'SE', flag: '🇸🇪', label: 'Sweden (+46)' },
  { code: '+47', country: 'NO', flag: '🇳🇴', label: 'Norway (+47)' },
  { code: '+45', country: 'DK', flag: '🇩🇰', label: 'Denmark (+45)' },
  { code: '+358', country: 'FI', flag: '🇫🇮', label: 'Finland (+358)' },
  { code: '+41', country: 'CH', flag: '🇨🇭', label: 'Switzerland (+41)' },
  { code: '+43', country: 'AT', flag: '🇦🇹', label: 'Austria (+43)' },
  { code: '+351', country: 'PT', flag: '🇵🇹', label: 'Portugal (+351)' },
  { code: '+30', country: 'GR', flag: '🇬🇷', label: 'Greece (+30)' },
  { code: '+90', country: 'TR', flag: '🇹🇷', label: 'Turkey (+90)' },
  { code: '+20', country: 'EG', flag: '🇪🇬', label: 'Egypt (+20)' },
  { code: '+27', country: 'ZA', flag: '🇿🇦', label: 'South Africa (+27)' },
  { code: '+234', country: 'NG', flag: '🇳🇬', label: 'Nigeria (+234)' },
  { code: '+254', country: 'KE', flag: '🇰🇪', label: 'Kenya (+254)' },
  { code: '+212', country: 'MA', flag: '🇲🇦', label: 'Morocco (+212)' },
  { code: '+966', country: 'SA', flag: '🇸🇦', label: 'Saudi Arabia (+966)' },
  { code: '+971', country: 'AE', flag: '🇦🇪', label: 'UAE (+971)' },
  { code: '+974', country: 'QA', flag: '🇶🇦', label: 'Qatar (+974)' },
  { code: '+60', country: 'MY', flag: '🇲🇾', label: 'Malaysia (+60)' },
  { code: '+65', country: 'SG', flag: '🇸🇬', label: 'Singapore (+65)' },
  { code: '+66', country: 'TH', flag: '🇹🇭', label: 'Thailand (+66)' },
  { code: '+84', country: 'VN', flag: '🇻🇳', label: 'Vietnam (+84)' },
  { code: '+62', country: 'ID', flag: '🇮🇩', label: 'Indonesia (+62)' },
  { code: '+63', country: 'PH', flag: '🇵🇭', label: 'Philippines (+63)' },
  { code: '+61', country: 'AU', flag: '🇦🇺', label: 'Australia (+61)' },
  { code: '+64', country: 'NZ', flag: '🇳🇿', label: 'New Zealand (+64)' },
  { code: '+353', country: 'IE', flag: '🇮🇪', label: 'Ireland (+353)' },
  { code: '+36', country: 'HU', flag: '🇭🇺', label: 'Hungary (+36)' },
  { code: '+420', country: 'CZ', flag: '🇨🇿', label: 'Czech Republic (+420)' },
  { code: '+421', country: 'SK', flag: '🇸🇰', label: 'Slovakia (+421)' },
  { code: '+385', country: 'HR', flag: '🇭🇷', label: 'Croatia (+385)' },
  { code: '+381', country: 'RS', flag: '🇷🇸', label: 'Serbia (+381)' },
  { code: '+359', country: 'BG', flag: '🇧🇬', label: 'Bulgaria (+359)' },
  { code: '+370', country: 'LT', flag: '🇱🇹', label: 'Lithuania (+370)' },
  { code: '+371', country: 'LV', flag: '🇱🇻', label: 'Latvia (+371)' },
  { code: '+372', country: 'EE', flag: '🇪🇪', label: 'Estonia (+372)' },
] as const;

// ─── Availability step options ───

export const WEEKLY_CAPACITY_OPTIONS = [
  { value: 5, label: '~5 hours/week', description: 'Side hustle' },
  { value: 10, label: '~10 hours/week', description: 'Part-time light' },
  { value: 20, label: '~20 hours/week', description: 'Part-time' },
  { value: 30, label: '~30 hours/week', description: 'Near full-time' },
  { value: 40, label: '40+ hours/week', description: 'Full-time' },
];

export const RESPONSE_TIME_OPTIONS = [
  { value: 'within_1h', label: 'Within 1 hour', description: 'Best for urgent tasks' },
  { value: 'within_4h', label: 'Within 4 hours', description: 'Same-day response' },
  { value: 'within_24h', label: 'Within 24 hours', description: 'Next-day response' },
  { value: 'flexible', label: 'Flexible', description: 'Response time varies' },
];

export const WORK_TYPE_OPTIONS = [
  { value: 'digital', label: 'Digital / Remote', description: 'Online work only' },
  { value: 'physical', label: 'Physical / In-Person', description: 'On-site work' },
  { value: 'both', label: 'Both', description: 'Open to either' },
];

// Reserved for future dashboard use (previously used in removed UI)
// export const SCHEDULE_PATTERN_OPTIONS = [
//   { value: 'morning', label: 'Mornings', description: '6am – 12pm local' },
//   { value: 'afternoon', label: 'Afternoons', description: '12pm – 6pm local' },
//   { value: 'evening', label: 'Evenings', description: '6pm – 12am local' },
//   { value: 'flexible', label: 'Flexible', description: 'Any time of day' },
// ];

// Reserved for future dashboard use (previously used in removed UI)
// export const TASK_DURATION_OPTIONS = [
//   { value: 'micro', label: 'Quick tasks', description: '1-2 hours' },
//   { value: 'half_day', label: 'Half-day', description: '3-5 hours' },
//   { value: 'full_project', label: 'Full projects', description: '10+ hours' },
//   { value: 'any', label: 'Any length', description: 'Open to all' },
// ];

// Reserved for future dashboard use (previously used in removed UI)
// export const EARLIEST_START_OPTIONS = [
//   { value: 'today', label: 'Today', description: 'Available immediately' },
//   { value: 'tomorrow', label: 'Tomorrow', description: 'Can start next day' },
//   { value: 'this_week', label: 'This week', description: 'Within a few days' },
//   { value: 'next_week', label: 'Next week', description: 'Need some lead time' },
// ];

// Reserved for future dashboard use (previously used in removed UI)
// export const INDUSTRIES = [
//   'Healthcare', 'Finance & Banking', 'E-commerce & Retail', 'Education',
//   'Legal', 'Real Estate', 'Travel & Hospitality', 'Food & Restaurant',
//   'Manufacturing', 'Logistics & Supply Chain', 'Media & Entertainment',
//   'SaaS & Technology', 'Gaming', 'Non-profit', 'Government',
//   'Agriculture', 'Energy & Utilities', 'Construction', 'Automotive',
//   'Telecommunications',
// ];

// Reserved for future dashboard use (replaced by free-text input in StepServices)
// export const EQUIPMENT_OPTIONS = [
//   'Laptop/Computer', 'Smartphone', 'DSLR Camera', 'Video Camera',
//   'Microphone', 'Ring Light', 'Drone', 'Car/Vehicle',
//   'Printer/Scanner', 'Drawing Tablet', 'VR Headset', '3D Printer',
// ];

// Reserved for future dashboard use (previously used in removed UI)
// export const PAYMENT_METHOD_OPTIONS = [
//   { value: 'paypal', label: 'PayPal', icon: '💳' },
//   { value: 'wise', label: 'Wise', icon: '💸' },
//   { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
//   { value: 'crypto', label: 'Crypto (USDC/ETH)', icon: '₿' },
//   { value: 'mobile_money', label: 'Mobile Money (M-Pesa)', icon: '📱' },
//   { value: 'venmo', label: 'Venmo', icon: '💰' },
//   { value: 'cash_app', label: 'Cash App', icon: '💵' },
// ];
