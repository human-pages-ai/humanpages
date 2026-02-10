import type { Profile, Wallet, Service, Job, JobMessage, ReviewStats, Vouch } from '../components/dashboard/types';
import type { AdminStats, AdminUser, AdminAgent, AdminJob, AdminActivity, Pagination } from '../types/admin';

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `Request failed (${res.status})`);
  }

  return res.json();
}

export interface AuthResponse {
  human: Profile;
  token: string;
  isNew?: boolean;
  requiresTerms?: boolean;
  provider?: string;
}

export interface PublicHuman {
  id: string;
  name: string;
  bio?: string;
  location?: string;
  skills: string[];
  contactEmail?: string;
  telegram?: string;
  isAvailable: boolean;
  linkedinUrl?: string;
  linkedinVerified?: boolean;
  twitterUrl?: string;
  githubUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  wallets: Array<{ network: string; address: string; label?: string }>;
  services: Array<{ title: string; description: string; category: string; priceRange?: string }>;
  vouches?: Array<{
    id: string;
    comment?: string;
    createdAt: string;
    voucher: { id: string; name: string; username?: string };
  }>;
}

export interface ReviewsResponse {
  stats: ReviewStats;
  reviews: Array<{
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
    jobId: string;
    agentName?: string;
  }>;
}

export const api = {
  // Auth
  signup: (data: { email: string; password: string; name: string; referrerId?: string; termsAccepted: boolean; captchaToken: string }) =>
    request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string; captchaToken: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // OAuth
  getOAuthUrl: (provider: 'google' | 'linkedin') =>
    request<{ url: string; state: string }>(`/oauth/${provider}`),

  oauthCallback: (provider: 'google' | 'linkedin', code: string, state: string, referrerId?: string, termsAccepted?: boolean) =>
    request<AuthResponse>(`/oauth/${provider}/callback`, {
      method: 'POST',
      body: JSON.stringify({ code, state, referrerId, termsAccepted }),
    }),

  // Password Reset
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  verifyResetToken: (token: string) =>
    request<{ valid: boolean }>(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`),

  // Profile
  getProfile: () => request<Profile>('/humans/me'),

  updateProfile: (data: Record<string, unknown>) =>
    request<Profile>('/humans/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Wallets
  getWallets: () => request<Wallet[]>('/wallets'),

  getWalletNonce: (address: string) =>
    request<{ nonce: string; message: string }>('/wallets/nonce', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  addWallet: (data: { network: string; address: string; label?: string; signature: string; nonce: string }) =>
    request<Wallet>('/wallets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteWallet: (id: string) =>
    request<void>(`/wallets/${id}`, { method: 'DELETE' }),

  // Services
  getServices: () => request<Service[]>('/services'),

  createService: (data: { title: string; description: string; category: string; priceRange?: string; priceMin?: number | null; priceCurrency?: string; priceUnit?: string | null }) =>
    request<Service>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateService: (id: string, data: Partial<Pick<Service, 'title' | 'description' | 'category' | 'priceRange' | 'priceMin' | 'priceUnit' | 'isActive'>>) =>
    request<Service>(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteService: (id: string) =>
    request<void>(`/services/${id}`, { method: 'DELETE' }),

  // Humanity verification
  verifyHumanity: (walletAddress: string) =>
    request<{
      humanityVerified: boolean;
      humanityScore: number;
      humanityProvider: string;
      humanityTier: string;
      humanityVerifiedAt: string;
    }>('/humans/me/verify-humanity', {
      method: 'POST',
      body: JSON.stringify({ walletAddress }),
    }),

  // LinkedIn verification
  getLinkedInVerifyUrl: () =>
    request<{ url: string; state: string }>('/oauth/linkedin/verify'),

  linkedinVerifyCallback: (code: string, state: string) =>
    request<{ linkedinVerified: boolean }>('/oauth/linkedin/verify/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    }),

  disconnectLinkedin: () =>
    request<{ message: string }>('/humans/me/disconnect-linkedin', { method: 'POST' }),

  // GitHub verification
  getGitHubVerifyUrl: () =>
    request<{ url: string; state: string }>('/oauth/github/verify'),

  githubVerifyCallback: (code: string, state: string) =>
    request<{ githubVerified: boolean; githubUsername: string }>('/oauth/github/verify/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    }),

  disconnectGithub: () =>
    request<{ message: string }>('/humans/me/disconnect-github', { method: 'POST' }),


  // Vouches
  getMyVouches: () =>
    request<{ given: Vouch[]; received: Vouch[] }>('/humans/me/vouches'),

  createVouch: (data: { username: string; comment?: string }) =>
    request<Vouch>('/humans/me/vouch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revokeVouch: (voucheeId: string) =>
    request<{ message: string }>(`/humans/me/vouch/${voucheeId}`, { method: 'DELETE' }),

  // Public profiles
  getHumanById: (id: string) => request<PublicHuman>(`/humans/${id}`),

  // Agents
  getAgent: (id: string) =>
    request<{
      id: string;
      name: string;
      description?: string;
      websiteUrl?: string;
      domainVerified: boolean;
      createdAt: string;
      reputation: {
        totalJobs: number;
        completedJobs: number;
        paidJobs: number;
        avgPaymentSpeedHours: number | null;
      };
    }>(`/agents/${id}`),

  // Jobs
  getJobs: (status?: string) =>
    request<Job[]>(`/jobs${status ? `?status=${status}` : ''}`),

  getJob: (id: string) =>
    request<Job>(`/jobs/${id}`),

  acceptJob: (id: string) =>
    request<Job>(`/jobs/${id}/accept`, { method: 'PATCH' }),

  rejectJob: (id: string) =>
    request<Job>(`/jobs/${id}/reject`, { method: 'PATCH' }),

  completeJob: (id: string) =>
    request<Job>(`/jobs/${id}/complete`, { method: 'PATCH' }),

  getJobMessages: (jobId: string) =>
    request<JobMessage[]>(`/jobs/${jobId}/messages`),

  sendJobMessage: (jobId: string, content: string) =>
    request<JobMessage>(`/jobs/${jobId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  getMyReviews: (humanId: string) =>
    request<ReviewsResponse>(`/jobs/human/${humanId}/reviews`),

  // Account management
  deleteAccount: (password?: string) =>
    request<{ message: string }>('/humans/me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  exportData: () =>
    request<Record<string, unknown>>('/humans/me/export'),

  resendVerification: () =>
    request<{ message: string }>('/auth/resend-verification', { method: 'POST' }),

  // Telegram
  getTelegramStatus: () =>
    request<{ connected: boolean; telegramUsername?: string; botAvailable: boolean; botUsername?: string }>('/telegram/status'),

  linkTelegram: () =>
    request<{ code: string; linkUrl: string; expiresIn: string }>('/telegram/link', { method: 'POST' }),

  unlinkTelegram: () =>
    request<{ message: string }>('/telegram/link', { method: 'DELETE' }),

  // Referral Program
  getAffiliateLeaderboard: () =>
    request<Array<{ rank: number; name: string; username?: string; avatarUrl?: string; referrals: number; totalCredits: number; joinedAt: string }>>('/affiliate/leaderboard'),

  // Admin
  checkAdmin: () =>
    request<{ isAdmin: boolean }>('/admin/me'),

  getAdminStats: () =>
    request<AdminStats>('/admin/stats'),

  getAdminUsers: (params: { page?: number; limit?: number; search?: string; verified?: string; sort?: string; order?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.verified) query.set('verified', params.verified);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);
    const qs = query.toString();
    return request<{ users: AdminUser[]; pagination: Pagination }>(`/admin/users${qs ? `?${qs}` : ''}`);
  },

  getAdminAgents: (params: { page?: number; limit?: number; search?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return request<{ agents: AdminAgent[]; pagination: Pagination }>(`/admin/agents${qs ? `?${qs}` : ''}`);
  },

  getAdminJobs: (params: { page?: number; limit?: number; search?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return request<{ jobs: AdminJob[]; pagination: Pagination }>(`/admin/jobs${qs ? `?${qs}` : ''}`);
  },

  getAdminActivity: (limit?: number) =>
    request<{ activity: AdminActivity[] }>(`/admin/activity${limit ? `?limit=${limit}` : ''}`),
};

// Referral Program types (included in profile response)
export interface ReferralProgramData {
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
}
