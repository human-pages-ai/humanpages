// ─── Onboarding Wizard Types ───

export interface Service {
  title: string;
  category: string;
  subcategory?: string;
  description: string;
  price: string;
  currency: string;
  unit: string;
}

export interface PlatformEntry {
  platform: string;
  url: string;
  details: string;
}

export interface LanguageEntry {
  language: string;
  proficiency: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  country: string;
  startYear?: number;
  endYear?: number;
}

export interface OnboardingDraft {
  step: number;
  id: string;
  name: string;
  bio: string;
  location: string;
  neighborhood: string;
  locationLat?: number;
  locationLng?: number;
  skills: string[];
  educationEntries: EducationEntry[];
  languageEntries: LanguageEntry[];
  services: Service[];
  linkedinUrl: string;
  githubUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  externalProfiles: string[];
  walletAddress: string;
  whatsappNumber: string;
  cvUploaded: boolean;
  cvData: any;
  timezone: string;
  weeklyCapacityHours: number | null;
  workType: string;
  // Agent-facing structured fields
  yearsOfExperience: number | null;
  freelancerJobsRange: string;
  industries: string[];
  equipment: string[];
  platformPresence: PlatformEntry[];
  username: string;
}

/** All form state managed by useProfileForm */
export interface ProfileFormState {
  name: string;
  bio: string;
  location: string;
  neighborhood: string;
  locationLat?: number;
  locationLng?: number;
  skills: string[];
  educationEntries: EducationEntry[];
  languageEntries: LanguageEntry[];
  services: Service[];
  linkedinUrl: string;
  githubUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  externalProfiles: string[];
  walletAddress: string;
  whatsappNumber: string;
  timezone: string;
  weeklyCapacityHours: number | null;
  workType: string;
}

/** CV processing state managed by useCvProcessing */
export interface CvProcessingState {
  cvUploaded: boolean;
  cvData: any;
  cvProcessing: boolean;
}

/** Telegram connection state */
export interface TelegramState {
  telegramStatus: { connected: boolean; botAvailable: boolean; botUsername?: string } | null;
  telegramLinkUrl: string | null;
  telegramLoading: boolean;
}
