// ── Human Pages API response types ──

export interface Human {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  location: string | null;
  languages: string[];
  skills: string[];
  isAvailable: boolean;
  minRateUsdc: number | null;
  rateCurrency: string | null;
  minRateUsdEstimate: number | null;
  rateType: string | null;
  contactEmail: string | null;
  telegram: string | null;
  whatsapp: string | null;
  signal: string | null;
  wallets: {
    address: string;
    network: string;
  }[];
  reputation: {
    jobsCompleted: number;
    avgRating: number | null;
    reviewCount: number;
  };
}

export interface RegisterResponse {
  agent: {
    id: string;
    name: string;
    description: string | null;
  };
  apiKey: string;
  verificationToken: string;
  message: string;
}

export interface CreateJobResponse {
  id: string;
  status: string;
  message: string;
}

export interface PaidJobResponse {
  id: string;
  status: string;
  message: string;
}

export interface ReviewResponse {
  id: string;
  rating: number;
  message: string;
}

export interface Job {
  id: string;
  status: string;
  title: string;
  description: string;
  priceUsdc: string;
  humanId: string;
  human?: { id: string; name: string };
}

// ── Message types ──

export interface Message {
  id: string;
  jobId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

// ── Webhook payload types ──

export type WebhookEvent =
  | 'job.accepted'
  | 'job.rejected'
  | 'job.paid'
  | 'job.completed'
  | 'job.message';

export interface WebhookPayload {
  event: WebhookEvent;
  jobId: string;
  status: string;
  timestamp: string;
  data: {
    title: string;
    description: string;
    priceUsdc: string;
    humanId: string;
    humanName?: string;
    contact?: {
      email?: string;
      telegram?: string;
      whatsapp?: string;
      signal?: string;
    };
    message?: {
      id: string;
      senderType: string;
      senderName: string;
      content: string;
      createdAt: string;
    };
  };
}
