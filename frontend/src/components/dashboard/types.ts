export interface Wallet {
  id: string;
  network: string;
  address: string;
  label?: string;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  priceRange?: string;
  isActive: boolean;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  username?: string;
  bio?: string;
  location?: string;
  locationLat?: number;
  locationLng?: number;
  skills: string[];
  equipment?: string[];
  languages?: string[];
  contactEmail?: string;
  telegram?: string;
  isAvailable: boolean;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  wallets: Wallet[];
  services: Service[];
  referralCount?: number;
  minOfferPrice?: number;
  maxOfferDistance?: number;
  minRateUsdc?: number;
  rateType?: 'HOURLY' | 'FLAT_TASK' | 'NEGOTIABLE';
  paymentPreference?: 'ESCROW' | 'UPFRONT' | 'BOTH';
  preferredLanguage?: string;
  hasPassword?: boolean;
  emailVerified?: boolean;
  emailNotifications?: boolean;
}

export interface Job {
  id: string;
  agentId: string;
  agentName?: string;
  title: string;
  description: string;
  category?: string;
  priceUsdc: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PAID' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  createdAt: string;
  acceptedAt?: string;
  paidAt?: string;
  completedAt?: string;
  review?: {
    id: string;
    rating: number;
    comment?: string;
  };
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  completedJobs: number;
}
