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
  rateType: string | null;
  contactEmail: string | null;
  telegram: string | null;
  whatsapp: string | null;
  signal: string | null;
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

// ── Webhook payload types ──

export type WebhookEvent =
  | 'job.accepted'
  | 'job.rejected'
  | 'job.paid'
  | 'job.completed';

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
  };
}
