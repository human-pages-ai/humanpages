export interface Wallet {
  id: string;
  network: string;
  address: string;
  label?: string;
}

export interface FiatPaymentMethod {
  id: string;
  platform: 'WISE' | 'VENMO' | 'PAYPAL' | 'CASHAPP' | 'REVOLUT' | 'ZELLE' | 'MONZO' | 'N26' | 'MERCADOPAGO';
  handle: string;
  label?: string;
  isPrimary: boolean;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  priceRange?: string;
  priceMin?: string | null;
  priceCurrency?: string;
  priceUnit?: 'HOURLY' | 'FLAT_TASK' | 'NEGOTIABLE' | null;
  isActive: boolean;
}

export interface Profile {
  id: string;
  referralCode: string;
  name: string;
  email: string;
  username?: string;
  bio?: string;
  location?: string;
  neighborhood?: string;
  locationGranularity?: 'city' | 'neighborhood';
  locationLat?: number;
  locationLng?: number;
  skills: string[];
  equipment?: string[];
  languages?: string[];
  yearsOfExperience?: number;
  contactEmail?: string;
  telegram?: string;
  whatsapp?: string;
  paymentMethods?: string;
  hideContact?: boolean;
  isAvailable: boolean;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  tiktokUrl?: string;
  twitterFollowers?: number;
  instagramFollowers?: number;
  youtubeFollowers?: number;
  tiktokFollowers?: number;
  linkedinFollowers?: number;
  facebookFollowers?: number;
  wallets: Wallet[];
  fiatPaymentMethods?: FiatPaymentMethod[];
  services: Service[];
  referralCount?: number;
  referralProgram?: {
    status: 'APPROVED' | 'SUSPENDED';
    creditsPerReferral: number;
    totalSignups: number;
    qualifiedSignups: number;
    totalCredits: number;
    creditsRedeemed: number;
    availableCredits: number;
    suspendedReason?: string;
    milestones: Array<{
      threshold: number;
      bonus: number;
      label: string;
      reached: boolean;
      progress: number;
    }>;
    referrals: Array<{
      id: string;
      name: string;
      qualified: boolean;
      qualifiedAt?: string;
      creditsAwarded: number;
      createdAt: string;
    }>;
    creditLedger: Array<{
      id: string;
      credits: number;
      type: string;
      description?: string;
      createdAt: string;
    }>;
  };
  minOfferPrice?: number;
  maxOfferDistance?: number;
  minRateUsdc?: number;
  rateCurrency?: string;
  minRateUsdEstimate?: number;
  rateType?: 'HOURLY' | 'FLAT_TASK' | 'NEGOTIABLE';
  paymentPreferences?: ('UPFRONT' | 'ESCROW' | 'UPON_COMPLETION' | 'STREAM')[];
  workMode?: 'REMOTE' | 'ONSITE' | 'HYBRID' | null;
  preferredLanguage?: string;
  linkedinVerified?: boolean;
  githubVerified?: boolean;
  githubUsername?: string;
  humanityVerified?: boolean;
  humanityScore?: number;
  humanityProvider?: string;
  humanityVerifiedAt?: string;
  profilePhotoUrl?: string;
  profilePhotoStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  trustScore?: TrustScoreData;
  hasPassword?: boolean;
  emailVerified?: boolean;
  emailNotifications?: boolean;
  telegramNotifications?: boolean;
  whatsappNotifications?: boolean;
  analyticsOptOut?: boolean;
  emailDigestMode?: 'REALTIME' | 'HOURLY' | 'DAILY';
  featuredConsent?: boolean;
}

export interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  domainVerified: boolean;
}

export interface JobMessage {
  id: string;
  jobId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export interface Job {
  id: string;
  agentId: string;
  agentName?: string;
  registeredAgent?: AgentProfile;
  human?: {
    id: string;
    name: string;
    paymentPreferences?: ('UPFRONT' | 'ESCROW' | 'UPON_COMPLETION' | 'STREAM')[];
  };
  title: string;
  description: string;
  category?: string;
  priceUsdc: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PAYMENT_CLAIMED' | 'PAID' | 'SUBMITTED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  updateCount?: number;
  lastUpdatedByAgent?: string;
  createdAt: string;
  acceptedAt?: string;
  paymentTxHash?: string;
  paymentNetwork?: string;
  paidAt?: string;
  completedAt?: string;
  paymentClaimMethod?: string;
  paymentClaimNote?: string;
  paymentClaimedAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  disputedBy?: string;
  disputeReason?: string;
  disputeType?: 'PRE_PAYMENT' | 'POST_PAYMENT';
  paymentTiming?: string;
  submittedAt?: string;
  review?: {
    id: string;
    rating: number;
    comment?: string;
  };
  _count?: { messages: number };
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  completedJobs: number;
}

export interface TrustScoreData {
  score: number;
  level: 'new' | 'basic' | 'verified' | 'trusted';
  signals?: {
    identity: {
      emailVerified: boolean;
      hasGoogle: boolean;
      hasLinkedin: boolean;
      linkedinVerified: boolean;
      humanityVerified: boolean;
      humanityScore: number | null;
      hasGithub: boolean;
    };
    reputation: {
      jobsCompleted: number;
      completionRate: number;
      avgRating: number;
      reviewCount: number;
      disputeCount: number;
    };
    social: {
      vouchCount: number;
      socialProfilesLinked: number;
    };
    activity: {
      accountAgeDays: number;
      daysSinceLastActive: number;
      profileCompleteness: number;
    };
  };
  breakdown?: {
    identity: number;
    reputation: number;
    social: number;
    activity: number;
  };
}

export interface Vouch {
  id: string;
  comment?: string;
  createdAt: string;
  voucher: { id: string; name: string; username?: string };
  vouchee: { id: string; name: string; username?: string };
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  category?: string;
  budgetUsdc: string;
  budgetFlexible?: boolean;
  requiredSkills: string[];
  requiredEquipment: string[];
  location?: string;
  locationLat?: number;
  locationLng?: number;
  radiusKm?: number;
  workMode?: 'REMOTE' | 'ONSITE' | 'HYBRID';
  status: 'OPEN' | 'CLOSED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  maxApplicants?: number;
  isPro: boolean;
  imageUrl?: string;
  createdAt: string;
  agent?: {
    id: string;
    name: string;
    description?: string;
    domainVerified: boolean;
    activationTier: string;
  };
  agentReputation?: {
    completedJobs: number;
    avgRating: number;
    avgPaymentSpeedHours: number | null;
  };
  _count?: { applications: number };
  hasApplied?: boolean;
  myApplication?: {
    id: string;
    status: string;
    pitch: string;
  };
}

export interface ListingApplication {
  id: string;
  listingId: string;
  pitch: string;
  status: 'PENDING' | 'PENDING_RECONFIRM' | 'OFFERED' | 'REJECTED' | 'WITHDRAWN';
  jobId?: string;
  createdAt: string;
  listing?: {
    id: string;
    title: string;
    budgetUsdc: string;
    status: string;
    isPro: boolean;
    agent?: { id: string; name: string };
  };
  human?: {
    id: string;
    name: string;
    skills: string[];
    location?: string;
    bio?: string;
  };
}
