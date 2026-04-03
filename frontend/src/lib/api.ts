import type { Profile, Wallet, Service, Job, JobMessage, ReviewStats, Vouch, Listing, ListingApplication, FiatPaymentMethod } from '../components/dashboard/types';
import type { AdminStats, AdminUser, AdminAgent, AdminJob, AdminActivity, AdminFeedback, AdminUserDetail, AdminAgentDetail, AdminJobDetail, AdminMeResponse, PostingGroup, AdCopy, Pagination, StaffStats, StaffMember, GenerateApiKeyResponse, ClockStatus, TimeEntry, HoursSummary, StaffClockOverview, StaffPayment, HoursAdjustment, StaffBalance, ContentItem, ContentStats, ContentPlatform, StaffCapability, TaskSummary, VideoConcept, VideoJob, VideoScriptData, PhotoConcept, CareerApplication, CareerApplicationStats, VideoItem, VideoDetail, ScheduleEntry, ScheduleStats, ProductivityDashboardData, IdleAlertEntry, StaffActivityEvent, InfluencerLead, LeadStats, BatchSummary, BatchDetail, BatchConceptDetail, GalleryConcept, LogQueryResult, LogStats, MktOpsLog, MktOpsDecision, MktOpsConfig, AdminPerson, PeopleFilterOptions, SolverStats, SolverRequestsResponse, AdminFeaturesResponse, FeatureMetricsResponse, McpFunnelAnalyticsResponse } from '../types/admin';

import { safeLocalStorage, safeGetItem, safeSetItem, safeRemoveItem } from './safeStorage';
// Re-export for backward compatibility (OAuthCallback etc. import from here)
export { safeGetItem, safeSetItem, safeRemoveItem };

const API_BASE = '/api';

function getToken(): string | null {
  return safeLocalStorage.getItem('token');
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
    // On 401, token is invalid/expired — clear it and redirect to login
    if (res.status === 401 && token) {
      safeLocalStorage.removeItem('token');
      // Only redirect if not already on a public/auth page
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/signup') && !path.startsWith('/forgot-password')) {
        window.location.href = '/login';
      }
    }
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
  oauthPhotoUrl?: string;
  linkedinHeadline?: string;
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
  profilePhotoUrl?: string;
  linkedinUrl?: string;
  linkedinVerified?: boolean;
  twitterUrl?: string;
  githubUrl?: string;
  facebookUrl?: string;
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
  signup: (data: { email: string; password: string; name: string; referrerId?: string; termsAccepted: boolean; captchaToken: string; utmSource?: string; utmMedium?: string; utmCampaign?: string }) =>
    request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string; captchaToken: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // WhatsApp OTP auth
  whatsappSendOtp: (data: { phone: string; captchaToken: string }) =>
    request<{ message: string }>('/auth/whatsapp/send-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  whatsappVerifyOtp: (data: { phone: string; code: string; name?: string; termsAccepted?: boolean; referrerId?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string }) =>
    request<AuthResponse & { isNew?: boolean; needsSignup?: boolean }>('/auth/whatsapp/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // OAuth
  getOAuthUrl: (provider: 'google' | 'linkedin') =>
    request<{ url: string; state: string }>(`/oauth/${provider}`),

  oauthCallback: (provider: 'google' | 'linkedin', code: string, state: string, referrerId?: string, termsAccepted?: boolean, utmSource?: string, utmMedium?: string, utmCampaign?: string) =>
    request<AuthResponse>(`/oauth/${provider}/callback`, {
      method: 'POST',
      body: JSON.stringify({ code, state, referrerId, termsAccepted, utmSource, utmMedium, utmCampaign }),
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
  getReferralCode: () => request<{ referralCode: string }>('/humans/me/referral-code'),

  updateProfile: (data: Record<string, unknown>) =>
    request<Profile>('/humans/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  checkUsername: (username: string) =>
    request<{ available: boolean }>(`/humans/me/check-username?username=${encodeURIComponent(username)}`),

  // Wallets
  getWallets: () => request<Wallet[]>('/wallets'),

  getWalletNonce: (address: string) =>
    request<{ nonce: string; message: string }>('/wallets/nonce', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  addWallet: (data: { network?: string; address: string; label?: string; signature: string; nonce: string }) =>
    request<Wallet[]>('/wallets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addWalletManual: (data: { address: string; label?: string; source?: 'privy' | 'manual_paste' }, privyIdToken?: string) =>
    request<Wallet[]>('/wallets/manual', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: privyIdToken ? { 'privy-id-token': privyIdToken } : undefined,
    }),

  deleteWallet: (id: string) =>
    request<void>(`/wallets/${id}`, { method: 'DELETE' }),

  updateWalletLabel: (address: string, label?: string) =>
    request<{ message: string; count: number }>(`/wallets/${address}/label`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    }),

  // Fiat Payment Methods
  addFiatPaymentMethod: (data: { platform: string; handle: string; label?: string }) =>
    request<FiatPaymentMethod>('/fiat-payment-methods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateFiatPaymentMethod: (id: string, data: { handle?: string; label?: string }) =>
    request<FiatPaymentMethod>(`/fiat-payment-methods/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteFiatPaymentMethod: (id: string) =>
    request<void>(`/fiat-payment-methods/${id}`, { method: 'DELETE' }),

  setFiatPaymentMethodPrimary: (id: string) =>
    request<FiatPaymentMethod>(`/fiat-payment-methods/${id}/primary`, { method: 'POST' }),

  // Services
  getServices: () => request<Service[]>('/services'),

  createService: (data: { title: string; description: string; category: string; subcategory?: string | null; priceRange?: string; priceMin?: number | null; priceCurrency?: string; priceUnit?: string | null }) =>
    request<Service>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateService: (id: string, data: Partial<Pick<Service, 'title' | 'description' | 'category' | 'subcategory' | 'priceRange' | 'priceMin' | 'priceUnit' | 'isActive'>>) =>
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
  getHumanByUsername: (username: string) => request<PublicHuman>(`/humans/u/${username}`),

  // Report a human user
  reportUser: (humanId: string, data: { reason: string; description?: string }) =>
    request<{ id: string; message: string }>(`/humans/${humanId}/report`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Report an agent
  reportAgent: (agentId: string, data: { reason: string; description?: string; jobId?: string }) =>
    request<{ id: string; message: string }>(`/agents/${agentId}/report`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Agents
  getAgent: (id: string) =>
    request<{
      id: string;
      name: string;
      description?: string;
      websiteUrl?: string;
      contactEmail?: string;
      domainVerified: boolean;
      lastActiveAt?: string;
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

  completeJob: (id: string, body?: { message: string }) =>
    request<Job>(`/jobs/${id}/complete`, { method: 'PATCH', ...(body && { body: JSON.stringify(body) }) }),

  confirmPayment: (id: string) =>
    request<Job>(`/jobs/${id}/confirm-payment`, { method: 'PATCH' }),

  cancelJob: (id: string, reason?: string) =>
    request<Job>(`/jobs/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  disputeJob: (id: string, reason: string) =>
    request<Job>(`/jobs/${id}/dispute`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

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

  devSimulateTelegramConnection: (code: string) =>
    request<{ success: boolean; message: string; chatId: string }>('/telegram/dev-simulate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // WhatsApp
  getWhatsAppStatus: () =>
    request<{ connected: boolean; whatsappNumber?: string; botAvailable: boolean; botNumber?: string }>('/whatsapp/status'),

  linkWhatsApp: () =>
    request<{ code: string; waLink?: string; expiresIn: string }>('/whatsapp/link', { method: 'POST' }),

  unlinkWhatsApp: () =>
    request<{ message: string }>('/whatsapp/link', { method: 'DELETE' }),

  // Admin Link Codes
  getAdminLinkCodes: () =>
    request<{ entries: Array<{ id: string; name: string; linkCode: string | null; expiresAt: string | null; status: 'pending' | 'linked' | 'expired'; whatsapp: string | null; createdAt: string }>; total: number }>('/admin/link-codes'),

  createAdminLinkCode: (data: { name: string }) =>
    request<{ id: string; name: string; linkCode: string; expiresAt: string; whatsAppEnabled: boolean; botNumber: string | null; message: string }>('/admin/link-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  regenerateAdminLinkCode: (id: string) =>
    request<{ id: string; linkCode: string; expiresAt: string }>(`/admin/link-codes/${id}/regenerate`, { method: 'POST' }),

  deleteAdminLinkCode: (id: string) =>
    request<{ message: string }>(`/admin/link-codes/${id}`, { method: 'DELETE' }),

  // Referral Program
  getAffiliateLeaderboard: () =>
    request<Array<{ rank: number; name: string; username?: string; referrals: number; totalCredits: number; joinedAt: string }>>('/affiliate/leaderboard'),

  // Feedback
  submitFeedback: (data: {
    type: 'BUG' | 'FEATURE' | 'FEEDBACK';
    category?: string;
    title?: string;
    description: string;
    sentiment?: number;
    stepsToReproduce?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    pageUrl?: string;
    browser?: string;
    os?: string;
    viewport?: string;
    userAgent?: string;
    appVersion?: string;
    screenshotData?: string;
    diagnostics?: Record<string, unknown>;
    contactName?: string;
    contactEmail?: string;
    captchaToken?: string;
  }) =>
    request<{ id: string; message: string }>('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Admin - Feedback
  getAdminFeedback: (params: { page?: number; limit?: number; status?: string; type?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.type) query.set('type', params.type);
    const qs = query.toString();
    return request<{ feedback: AdminFeedback[]; pagination: Pagination }>(`/feedback/admin${qs ? `?${qs}` : ''}`);
  },

  updateAdminFeedback: (id: string, data: { status?: string; adminNotes?: string }) =>
    request<AdminFeedback>(`/feedback/admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Admin
  checkAdmin: () =>
    request<AdminMeResponse>('/admin/me'),

  getAdminStats: () =>
    request<AdminStats>('/admin/stats'),

  getAdminFunnelStats: () =>
    request<import('../types/admin').FunnelStats>('/admin/stats/funnel'),

  getAdminMcpFunnel: (range?: number) => {
    const params = new URLSearchParams();
    if (range) params.append('range', String(range));
    return request<McpFunnelAnalyticsResponse>(`/admin/mcp/funnel?${params}`);
  },

  getSolverStats: () =>
    request<SolverStats>('/admin/solver/stats'),

  getAdminFeatures: (params?: { domain?: string; metrics?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.domain) query.set('domain', params.domain);
    if (params?.metrics) query.set('metrics', 'true');
    const qs = query.toString();
    return request<AdminFeaturesResponse>(`/admin/features${qs ? `?${qs}` : ''}`);
  },

  getAdminFeatureMetrics: (featureId: string, period?: string) => {
    const query = new URLSearchParams();
    if (period) query.set('period', period);
    const qs = query.toString();
    return request<FeatureMetricsResponse>(`/admin/features/${featureId}/metrics${qs ? `?${qs}` : ''}`);
  },

  getSolverRequests: (params: { filter?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.filter) query.set('filter', params.filter);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<SolverRequestsResponse>(`/admin/solver/requests${qs ? `?${qs}` : ''}`);
  },

  getAdminUsers: (params: { page?: number; limit?: number; search?: string; verified?: string; catchAll?: string; sort?: string; order?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.verified) query.set('verified', params.verified);
    if (params.catchAll) query.set('catchAll', params.catchAll);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);
    const qs = query.toString();
    return request<{ users: AdminUser[]; pagination: Pagination }>(`/admin/users${qs ? `?${qs}` : ''}`);
  },

  getAdminPeople: (params: {
    page?: number; limit?: number; search?: string; sort?: string; order?: string;
    country?: string; skills?: string; hasCareerApplication?: boolean; careerPositionId?: string;
    affiliatedBy?: string; hasReferrals?: boolean; availability?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);
    if (params.country) query.set('country', params.country);
    if (params.skills) query.set('skills', params.skills);
    if (params.hasCareerApplication) query.set('hasCareerApplication', 'true');
    if (params.careerPositionId) query.set('careerPositionId', params.careerPositionId);
    if (params.affiliatedBy) query.set('affiliatedBy', params.affiliatedBy);
    if (params.hasReferrals) query.set('hasReferrals', 'true');
    if (params.availability) query.set('availability', params.availability);
    const qs = query.toString();
    return request<{ people: AdminPerson[]; pagination: Pagination }>(`/admin/people${qs ? `?${qs}` : ''}`);
  },

  getAdminPeopleFilterOptions: () =>
    request<PeopleFilterOptions>('/admin/people/filter-options'),

  sendFeaturedInvite: (humanId: string) =>
    request<{ success: boolean; sentAt: string }>(`/admin/people/${humanId}/featured-invite`, { method: 'POST' }),

  exportAdminPeople: (params: {
    search?: string; country?: string; skills?: string; hasCareerApplication?: boolean;
    careerPositionId?: string; affiliatedBy?: string; hasReferrals?: boolean; availability?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.country) query.set('country', params.country);
    if (params.skills) query.set('skills', params.skills);
    if (params.hasCareerApplication) query.set('hasCareerApplication', 'true');
    if (params.careerPositionId) query.set('careerPositionId', params.careerPositionId);
    if (params.affiliatedBy) query.set('affiliatedBy', params.affiliatedBy);
    if (params.hasReferrals) query.set('hasReferrals', 'true');
    if (params.availability) query.set('availability', params.availability);
    const qs = query.toString();
    const token = getToken();
    return fetch(`${API_BASE}/admin/people/export${qs ? `?${qs}` : ''}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    }).then(res => {
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    });
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

  getAdminUser: (id: string) =>
    request<AdminUserDetail>(`/admin/users/${id}`),

  updateAdminUser: (id: string, data: { isCatchAll?: boolean }) =>
    request<AdminUserDetail>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getAdminAgent: (id: string) =>
    request<AdminAgentDetail>(`/admin/agents/${id}`),

  updateAdminAgent: (id: string, data: { status?: string; activationTier?: string; activationExpiresAt?: string | null }) =>
    request<AdminAgentDetail>(`/admin/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getAdminArbitrators: () =>
    request<any[]>(`/admin/arbitrators`),

  updateAdminArbitrator: (id: string, data: { approved?: boolean; healthy?: boolean }) =>
    request<any>(`/admin/arbitrators/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getAdminJob: (id: string) =>
    request<AdminJobDetail>(`/admin/jobs/${id}`),

  getAdminActivity: (limit?: number) =>
    request<{ activity: AdminActivity[] }>(`/admin/activity${limit ? `?limit=${limit}` : ''}`),

  getAdminModeration: (params: { page?: number; limit?: number; status?: string; contentType?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.limit) qs.append('limit', String(params.limit));
    if (params.status) qs.append('status', params.status);
    if (params.contentType) qs.append('contentType', params.contentType);
    return request<{ items: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/moderation${qs.toString() ? `?${qs}` : ''}`);
  },

  patchAdminModeration: (id: string, status: 'approved' | 'rejected') =>
    request<any>(`/admin/moderation/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getAdminEmails: (params: { page?: number; limit?: number; tab?: string; status?: string; recipient?: string; type?: string; jobId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.limit) qs.append('limit', String(params.limit));
    if (params.tab) qs.append('tab', params.tab);
    if (params.status) qs.append('status', params.status);
    if (params.recipient) qs.append('recipient', params.recipient);
    if (params.type) qs.append('type', params.type);
    if (params.jobId) qs.append('jobId', params.jobId);
    return request<{ entries: any[]; total: number; page: number; limit: number; statusCounts?: Record<string, number> }>(`/admin/emails${qs.toString() ? `?${qs}` : ''}`);
  },

  // Profile photos
  uploadProfilePhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    const token = getToken();
    return fetch(`${API_BASE}/photos/upload`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
      }
      return res.json() as Promise<{ profilePhotoUrl: string; profilePhotoStatus: string }>;
    });
  },

  importOAuthPhoto: (provider: 'google' | 'linkedin') =>
    request<{ profilePhotoUrl: string; profilePhotoStatus: string }>('/photos/import-oauth', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),

  deleteProfilePhoto: () =>
    request<{ message: string }>('/photos', { method: 'DELETE' }),

  // Listings (Job Board)
  getListings: (params: { page?: number; limit?: number; skill?: string; category?: string; workMode?: string; minBudget?: number; maxBudget?: number; lat?: number; lng?: number; radius?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.skill) query.set('skill', params.skill);
    if (params.category) query.set('category', params.category);
    if (params.workMode) query.set('workMode', params.workMode);
    if (params.minBudget) query.set('minBudget', String(params.minBudget));
    if (params.maxBudget) query.set('maxBudget', String(params.maxBudget));
    if (params.lat) query.set('lat', String(params.lat));
    if (params.lng) query.set('lng', String(params.lng));
    if (params.radius) query.set('radius', String(params.radius));
    const qs = query.toString();
    return request<{ listings: Listing[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/listings${qs ? `?${qs}` : ''}`);
  },

  getListing: (id: string) =>
    request<Listing>(`/listings/${id}`),

  resolveListingCode: (code: string) =>
    request<{ listingId: string; code: string }>(`/listings/by-code/${code}`),

  applyToListing: (id: string, pitch?: string) =>
    request<ListingApplication>(`/listings/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(pitch ? { pitch } : {}),
    }),

  updateListingApplication: (listingId: string, pitch: string) =>
    request<{ id: string; pitch: string; status: string }>(`/listings/${listingId}/application`, {
      method: 'PATCH',
      body: JSON.stringify({ pitch }),
    }),

  getMyApplications: () =>
    request<ListingApplication[]>('/listings/my-applications'),

  // Admin Listings
  getAdminListings: (params: { page?: number; limit?: number; search?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return request<{ listings: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/listings${qs ? `?${qs}` : ''}`);
  },

  getAdminListing: (id: string) =>
    request<any>(`/admin/listings/${id}`),

  // Posting Queue
  getPostingGroups: (params: { page?: number; limit?: number; status?: string; language?: string; country?: string; adId?: string; taskType?: string; campaign?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.language) query.set('language', params.language);
    if (params.country) query.set('country', params.country);
    if (params.adId) query.set('adId', params.adId);
    if (params.taskType) query.set('taskType', params.taskType);
    if (params.campaign) query.set('campaign', params.campaign);
    const qs = query.toString();
    return request<{ groups: PostingGroup[]; pagination: Pagination }>(`/admin/posting/groups${qs ? `?${qs}` : ''}`);
  },

  createPostingGroup: (data: { name: string; url: string; adId: string; language: string; country: string; taskType: string; campaign?: string }) =>
    request<{ created: number; skipped: number; groups: PostingGroup[] }>('/admin/posting/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePostingGroup: (id: string, data: { status?: string; notes?: string | null; datePosted?: string | null }) =>
    request<PostingGroup>(`/admin/posting/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAdCopies: () =>
    request<{ ads: AdCopy[] }>('/admin/posting/ads'),

  getAdCopy: (id: string) =>
    request<AdCopy>(`/admin/posting/ads/${id}`),

  createAdCopy: (data: { adNumber: number; language: string; title: string; body: string }) =>
    request<AdCopy>('/admin/posting/ads/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdCopy: (id: string, data: { adNumber?: number; language?: string; title?: string; body?: string }) =>
    request<AdCopy>(`/admin/posting/ads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAdCopy: (id: string) =>
    request<{ message: string }>(`/admin/posting/ads/${id}`, {
      method: 'DELETE',
    }),

  getStaffStats: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return request<StaffStats>(`/admin/posting/staff-stats${query}`);
  },

  // Staff Management
  getStaffMembers: () =>
    request<{ staff: StaffMember[] }>('/admin/staff'),

  generateStaffApiKey: (userId: string) =>
    request<GenerateApiKeyResponse>(`/admin/staff/${userId}/api-key`, { method: 'POST' }),

  revokeStaffApiKey: (userId: string) =>
    request<{ message: string }>(`/admin/staff/${userId}/api-key`, { method: 'DELETE' }),

  updateStaffRole: (userId: string, role: 'USER' | 'STAFF') =>
    request<{ message: string; id: string; role: string }>(`/admin/staff/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  sendStaffApiKey: (userId: string, apiKey: string) =>
    request<{ message: string }>(`/admin/staff/${userId}/send-key`, {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),

  // Staff Capabilities
  getStaffCapabilities: (userId: string) =>
    request<{ capabilities: StaffCapability[] }>(`/admin/staff/${userId}/capabilities`),

  updateStaffCapabilities: (userId: string, capabilities: StaffCapability[]) =>
    request<{ id: string; capabilities: StaffCapability[] }>(`/admin/staff/${userId}/capabilities`, {
      method: 'PATCH',
      body: JSON.stringify({ capabilities }),
    }),

  // Task Summary
  getTaskSummary: () =>
    request<TaskSummary>('/admin/tasks/summary'),

  // Career Applications
  submitCareerApplication: (data: {
    positionId: string;
    positionTitle: string;
    about: string;
    portfolioUrl?: string;
    availability: string;
    utmSource?: string;
  }) =>
    request<{ id: string; positionId: string; status: string; createdAt: string }>('/careers/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyCareerApplications: () =>
    request<Array<{
      id: string;
      positionId: string;
      positionTitle: string;
      status: string;
      availability: string;
      createdAt: string;
    }>>('/careers/my-applications'),

  // Time Tracking
  getClockStatus: () =>
    request<ClockStatus>('/admin/time-tracking/status'),

  clockIn: () =>
    request<ClockStatus>('/admin/time-tracking/clock-in', { method: 'POST' }),

  clockOut: (notes?: string) =>
    request<{ clockedIn: boolean; entry: TimeEntry }>('/admin/time-tracking/clock-out', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  getTimeEntries: (params: { page?: number; limit?: number; from?: string; to?: string; humanId?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.humanId) query.set('humanId', params.humanId);
    const qs = query.toString();
    return request<{ entries: TimeEntry[]; pagination: Pagination }>(`/admin/time-tracking/entries${qs ? `?${qs}` : ''}`);
  },

  getHoursSummary: (humanId?: string) => {
    const qs = humanId ? `?humanId=${humanId}` : '';
    return request<HoursSummary>(`/admin/time-tracking/summary${qs}`);
  },

  getAllStaffClock: () =>
    request<{ staff: StaffClockOverview[] }>('/admin/time-tracking/all-staff'),

  // Staff Rate Config
  setStaffRate: (data: { humanId: string; staffDailyRate?: number; staffDailyHours?: number }) =>
    request<{ id: string; name: string; staffDailyRate: number | null; staffDailyHours: number | null }>('/admin/time-tracking/rate', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Staff Payments
  createPayment: (data: { humanId: string; amountUsd: number; paymentDate: string; notes?: string }) =>
    request<StaffPayment>('/admin/time-tracking/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPayments: (params: { page?: number; limit?: number; humanId?: string; from?: string; to?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.humanId) query.set('humanId', params.humanId);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    const qs = query.toString();
    return request<{ payments: StaffPayment[]; pagination: Pagination }>(`/admin/time-tracking/payments${qs ? `?${qs}` : ''}`);
  },

  updatePayment: (id: string, data: { amountUsd?: number; paymentDate?: string; notes?: string }) =>
    request<StaffPayment>(`/admin/time-tracking/payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deletePayment: (id: string) =>
    request<{ deleted: boolean }>(`/admin/time-tracking/payments/${id}`, { method: 'DELETE' }),

  // Hours Adjustments
  createAdjustment: (data: { date: string; minutes: number; reason: string }) =>
    request<HoursAdjustment>('/admin/time-tracking/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAdjustments: (params: { page?: number; limit?: number; humanId?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.humanId) query.set('humanId', params.humanId);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return request<{ adjustments: HoursAdjustment[]; pagination: Pagination }>(`/admin/time-tracking/adjustments${qs ? `?${qs}` : ''}`);
  },

  reviewAdjustment: (id: string, status: 'APPROVED' | 'REJECTED') =>
    request<HoursAdjustment>(`/admin/time-tracking/adjustments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Balance
  getBalance: (params: { humanId?: string; from?: string; to?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.humanId) query.set('humanId', params.humanId);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    const qs = query.toString();
    return request<StaffBalance>(`/admin/time-tracking/balance${qs ? `?${qs}` : ''}`);
  },

  getAllStaffBalances: (params: { from?: string; to?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    const qs = query.toString();
    return request<{ balances: StaffBalance[] }>(`/admin/time-tracking/balance/all-staff${qs ? `?${qs}` : ''}`);
  },

  // Content Pipeline
  getContentItems: (params: { page?: number; limit?: number; status?: string; platform?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.platform) query.set('platform', params.platform);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    return request<{ items: ContentItem[]; pagination: Pagination }>(`/admin/content${qs ? `?${qs}` : ''}`);
  },

  getContentStats: () =>
    request<ContentStats>('/admin/content/stats'),

  getContentItem: (id: string) =>
    request<ContentItem>(`/admin/content/${id}`),

  updateContentItem: (id: string, data: Partial<ContentItem>) =>
    request<ContentItem>(`/admin/content/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  approveContent: (id: string) =>
    request<ContentItem>(`/admin/content/${id}/approve`, { method: 'PATCH' }),

  rejectContent: (id: string, reason: string) =>
    request<ContentItem>(`/admin/content/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  publishContent: (id: string) =>
    request<ContentItem>(`/admin/content/${id}/publish`, { method: 'POST' }),

  crosspostContent: (id: string, platforms: string[], tags?: string[], force?: boolean) =>
    request<ContentItem & { crosspostResults?: Record<string, any> }>(`/admin/content/${id}/crosspost`, {
      method: 'POST',
      body: JSON.stringify({ platforms, tags, force }),
    }),

  deleteContent: (id: string) =>
    request<{ message: string }>(`/admin/content/${id}`, { method: 'DELETE' }),

  createContent: (data: { sourceTitle: string; sourceUrl?: string; source?: string; platform: ContentPlatform; tweetDraft?: string; linkedinSnippet?: string; blogTitle?: string; blogSlug?: string; blogBody?: string; blogExcerpt?: string; blogReadingTime?: string; imageR2Key?: string }) =>
    request<ContentItem>('/admin/content', { method: 'POST', body: JSON.stringify(data) }),

  getContentUploadUrl: (id: string, contentType: string) =>
    request<{ uploadUrl: string; key: string }>(`/admin/content/${id}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ contentType }),
    }),

  generateContentImage: (id: string) =>
    request<ContentItem>(`/admin/content/${id}/generate-image`, { method: 'POST' }),

  // Public Blog API
  getBlogPosts: (params: { page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<{ posts: Array<{ id: string; blogTitle: string; blogSlug: string; blogExcerpt: string; blogReadingTime: string; isFeatured: boolean; publishedAt: string; createdAt: string }>; pagination: Pagination }>(`/blog/posts${qs ? `?${qs}` : ''}`);
  },

  getBlogPost: (slug: string) =>
    request<{ id: string; blogTitle: string; blogSlug: string; blogBody: string; blogExcerpt: string; blogReadingTime: string; metaDescription: string; sourceTitle: string; sourceUrl: string; publishedAt: string; createdAt: string }>(`/blog/posts/${slug}`),

  // Video Concepts
  getVideoJobs: () =>
    request<{ jobs: VideoJob[] }>('/admin/video-concepts/jobs'),

  getVideoConcepts: () =>
    request<{ concepts: VideoConcept[] }>('/admin/video-concepts'),

  getVideoConcept: (slug: string) =>
    request<VideoConcept>(`/admin/video-concepts/${slug}`),

  createVideoConcept: (data: { title: string; slug?: string; duration?: string; style?: string; body: string }) =>
    request<VideoConcept>('/admin/video-concepts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateVideoConcept: (slug: string, data: { title?: string; duration?: string; style?: string; body?: string }) =>
    request<VideoConcept>(`/admin/video-concepts/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteVideoConcept: (slug: string) =>
    request<{ message: string }>(`/admin/video-concepts/${slug}`, { method: 'DELETE' }),

  previewVideoConcept: (slug: string) =>
    request<{ message: string; jobId: string }>(`/admin/video-concepts/${slug}/preview`, { method: 'POST' }),

  approveVideoConcept: (slug: string, tier: string = 'draft') =>
    request<{ slug: string; status: string; approvedTier: string }>(`/admin/video-concepts/${slug}/approve`, {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }),

  produceVideoConcept: (slug: string) =>
    request<{ message: string; jobId: string }>(`/admin/video-concepts/${slug}/produce`, { method: 'POST' }),

  getVideoConceptOutputs: (slug: string) =>
    request<{ slug: string; outputs: { tier: string; files: string[] }[] }>(`/admin/video-concepts/${slug}/outputs`),

  getVideoConceptScript: (slug: string, tier: string) =>
    request<VideoScriptData>(`/admin/video-concepts/${slug}/script/${tier}`),

  getVideoConceptImageUrl: (slug: string, tier: string, filename: string) =>
    `/api/admin/video-concepts/${slug}/image/${tier}/${filename}`,

  rejectVideoConcept: (slug: string) =>
    request<{ slug: string; status: string }>(`/admin/video-concepts/${slug}/reject`, { method: 'POST' }),

  getVideoConceptJobs: (slug: string) =>
    request<{ jobs: VideoJob[] }>(`/admin/video-concepts/${slug}/jobs`),

  getVideoJob: (jobId: string) =>
    request<VideoJob>(`/admin/video-concepts/job/${jobId}`),

  cancelVideoJob: (jobId: string) =>
    request<VideoJob>(`/admin/video-concepts/job/${jobId}/cancel`, { method: 'POST' }),

  continueVideoConcept: (slug: string) =>
    request<{ message: string; jobId: string }>(`/admin/video-concepts/${slug}/continue`, { method: 'POST' }),

  regenerateSceneImage: (slug: string, tier: string, sceneNum: number) =>
    request<{ success: boolean; scene: number }>(
      `/admin/video-concepts/${slug}/regenerate-image/${tier}/${sceneNum}`,
      { method: 'POST' }
    ),

  getVideoConceptCostEstimate: (slug: string, tier: string) =>
    request<{ tier: string; numScenes: number; totalDuration: number; total: number; totalWithRetries: number;
      breakdown: { images: number; video: number; voiceover: number } }>(
      `/admin/video-concepts/${slug}/cost-estimate/${tier}`
    ),

  updateVideoConceptScript: (slug: string, tier: string, script: VideoScriptData) =>
    request<{ success: boolean }>(`/admin/video-concepts/${slug}/script/${tier}`, {
      method: 'PUT',
      body: JSON.stringify(script),
    }),

  // Video Batches
  getVideoBatches: () =>
    request<{ batches: BatchSummary[] }>('/admin/video-batches'),

  getVideoBatch: (date: string) =>
    request<BatchDetail>(`/admin/video-batches/${date}`),

  getVideoBatchConcept: (date: string, num: number) =>
    request<BatchConceptDetail>(`/admin/video-batches/${date}/concept/${num}`),

  approveVideoBatchConcepts: (date: string, concepts: number[], tier: string = 'draft') =>
    request<{ approved: number; tier: string; date: string }>(`/admin/video-batches/${date}/approve`, {
      method: 'POST',
      body: JSON.stringify({ concepts, tier }),
    }),

  rejectVideoBatchConcepts: (date: string, concepts: number[]) =>
    request<{ rejected: number; date: string }>(`/admin/video-batches/${date}/reject`, {
      method: 'POST',
      body: JSON.stringify({ concepts }),
    }),

  getVideoBatchImageUrl: (date: string, conceptNum: number, filename: string) =>
    `/api/admin/video-batches/${date}/concept/${conceptNum}/image/${filename}`,

  updateVideoBatchScript: (date: string, conceptNum: number, script: VideoScriptData) =>
    request<{ success: boolean }>(`/admin/video-batches/${date}/concept/${conceptNum}/script`, {
      method: 'PUT',
      body: JSON.stringify(script),
    }),

  getVideoBatchGallery: () =>
    request<{ concepts: GalleryConcept[] }>('/admin/video-batches/gallery'),

  getVideoBatchR2ImageUrl: (date: string, conceptNum: number, filename: string) =>
    request<{ url: string; source: string }>(`/admin/video-batches/${date}/concept/${conceptNum}/r2-image/${filename}`),

  promoteToDraft: (date: string, conceptNum: number) =>
    request<{ success: boolean }>(`/admin/video-batches/${date}/concept/${conceptNum}/promote-draft`, {
      method: 'POST',
    }),

  // Photo Concepts
  getPhotoConcepts: () =>
    request<{ concepts: PhotoConcept[] }>('/admin/photo-concepts'),

  getPhotoConcept: (slug: string) =>
    request<PhotoConcept>(`/admin/photo-concepts/${slug}`),

  createPhotoConcept: (data: Record<string, unknown>) =>
    request<PhotoConcept>('/admin/photo-concepts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePhotoConcept: (slug: string, data: Record<string, unknown>) =>
    request<PhotoConcept>(`/admin/photo-concepts/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deletePhotoConcept: (slug: string) =>
    request<{ message: string }>(`/admin/photo-concepts/${slug}`, { method: 'DELETE' }),

  approvePhotoConcept: (slug: string) =>
    request<{ slug: string; status: string }>(`/admin/photo-concepts/${slug}/approve`, { method: 'POST' }),

  renderPhotoConcept: (slug: string, tier: string = 'final') =>
    request<{ message: string; pid: number; slug: string }>(`/admin/photo-concepts/${slug}/render`, {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }),

  rejectPhotoConcept: (slug: string) =>
    request<{ slug: string; status: string }>(`/admin/photo-concepts/${slug}/reject`, { method: 'POST' }),

  assessPhotoConcept: (slug: string) =>
    request<{ slug: string; score: number; verdict: string }>(`/admin/photo-concepts/${slug}/assess`, { method: 'POST' }),

  assessAllPhotoConcepts: () =>
    request<{ message: string; total: number }>('/admin/photo-concepts/assess-all', { method: 'POST' }),

  generatePhotoBatch: (count: number = 10) =>
    request<{ message: string; pid: number }>('/admin/photo-concepts/generate-batch', {
      method: 'POST',
      body: JSON.stringify({ count }),
    }),

  getPhotoConceptOutputs: (slug: string) =>
    request<{ slug: string; outputs: { platform: string; files: string[] }[] }>(`/admin/photo-concepts/${slug}/outputs`),

  // Career Applications (Admin)
  getCareerApplications: (params?: { page?: number; limit?: number; status?: string; positionId?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.status) sp.set('status', params.status);
    if (params?.positionId) sp.set('positionId', params.positionId);
    if (params?.search) sp.set('search', params.search);
    return request<{ applications: CareerApplication[]; pagination: Pagination; stats: CareerApplicationStats }>(`/admin/career-applications?${sp}`);
  },

  getCareerApplication: (id: string) =>
    request<CareerApplication>(`/admin/career-applications/${id}`),

  updateCareerApplication: (id: string, data: { status?: string; adminNotes?: string }) =>
    request<CareerApplication>(`/admin/career-applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  bulkUpdateCareerApplications: (ids: string[], status: string) =>
    request<{ updated: number }>('/admin/career-applications/bulk-status', {
      method: 'PATCH',
      body: JSON.stringify({ ids, status }),
    }),

  // Videos (R2-backed)
  getVideos: (params?: { page?: number; limit?: number; status?: string; tier?: string; conceptSlug?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.status) sp.set('status', params.status);
    if (params?.tier) sp.set('tier', params.tier);
    if (params?.conceptSlug) sp.set('conceptSlug', params.conceptSlug);
    return request<{ videos: VideoItem[]; pagination: Pagination }>(`/admin/videos?${sp}`);
  },

  getVideo: (id: string) =>
    request<VideoDetail>(`/admin/videos/${id}`),

  updateVideo: (id: string, data: Record<string, unknown>) =>
    request<VideoItem>(`/admin/videos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteVideo: (id: string) =>
    request<{ message: string }>(`/admin/videos/${id}`, { method: 'DELETE' }),

  // Publication Schedule
  getSchedule: (params?: { page?: number; limit?: number; platform?: string; status?: string; contentType?: string; from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.platform) sp.set('platform', params.platform);
    if (params?.status) sp.set('status', params.status);
    if (params?.contentType) sp.set('contentType', params.contentType);
    if (params?.from) sp.set('from', params.from);
    if (params?.to) sp.set('to', params.to);
    return request<{ entries: ScheduleEntry[]; pagination: Pagination }>(`/admin/schedule?${sp}`);
  },

  getScheduleStats: () =>
    request<ScheduleStats>('/admin/schedule/stats'),

  createScheduleEntry: (data: Record<string, unknown>) =>
    request<ScheduleEntry>('/admin/schedule', { method: 'POST', body: JSON.stringify(data) }),

  updateScheduleEntry: (id: string, data: Record<string, unknown>) =>
    request<ScheduleEntry>(`/admin/schedule/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteScheduleEntry: (id: string) =>
    request<{ message: string }>(`/admin/schedule/${id}`, { method: 'DELETE' }),

  markPublished: (id: string, data: { publishedUrl?: string; platformMeta?: Record<string, unknown> }) =>
    request<ScheduleEntry>(`/admin/schedule/${id}/mark-published`, { method: 'POST', body: JSON.stringify(data) }),

  // Staff Productivity
  getProductivityDashboard: () =>
    request<ProductivityDashboardData>('/admin/productivity/dashboard'),

  getProductivityAlerts: (params: { page?: number; limit?: number; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return request<{ alerts: IdleAlertEntry[]; pagination: Pagination }>(`/admin/productivity/alerts${qs ? `?${qs}` : ''}`);
  },

  dismissIdleAlert: (id: string) =>
    request<IdleAlertEntry>(`/admin/productivity/alerts/${id}/dismiss`, { method: 'PATCH' }),

  getProductivityActivity: (params: { page?: number; limit?: number; humanId?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.humanId) query.set('humanId', params.humanId);
    const qs = query.toString();
    return request<{ activities: StaffActivityEvent[]; pagination: Pagination }>(`/admin/productivity/activity${qs ? `?${qs}` : ''}`);
  },

  // ─── Lead Generation ───
  getLeadStats: () => request<LeadStats>('/admin/leads/stats'),

  getLeads: (params: { page?: number; limit?: number; search?: string; status?: string; list?: string; source?: string; assignedTo?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.list) query.set('list', params.list);
    if (params.source) query.set('source', params.source);
    if (params.assignedTo) query.set('assignedTo', params.assignedTo);
    const qs = query.toString();
    return request<{ leads: InfluencerLead[]; pagination: Pagination }>(`/admin/leads${qs ? `?${qs}` : ''}`);
  },

  getLead: (id: string) => request<InfluencerLead>(`/admin/leads/${id}`),

  createLead: (data: Record<string, unknown>) => request<InfluencerLead>('/admin/leads', { method: 'POST', body: JSON.stringify(data) }),

  updateLead: (id: string, data: Record<string, unknown>) => request<InfluencerLead>(`/admin/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  updateLeadStatus: (id: string, status: string) => request<InfluencerLead>(`/admin/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  assignLead: (id: string, assignedToId: string | null) => request<InfluencerLead>(`/admin/leads/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ assignedToId }) }),

  deleteLead: (id: string) => request<{ deleted: boolean }>(`/admin/leads/${id}`, { method: 'DELETE' }),

  exportLeads: (params: { list?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.list) query.set('list', params.list);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    const token = getToken();
    return fetch(`${API_BASE}/admin/leads/export${qs ? `?${qs}` : ''}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    }).then(res => {
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    });
  },


  // ─── Logs (Axiom) ───
  getLogs: (params: { level?: string; search?: string; timeRange?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.level) query.set('level', params.level);
    if (params.search) query.set('search', params.search);
    if (params.timeRange) query.set('timeRange', params.timeRange);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return request<LogQueryResult>(`/admin/logs?${query}`);
  },

  getLogStats: (timeRange = '24h') =>
    request<LogStats>(`/admin/logs/stats?timeRange=${timeRange}`),

  getLogHealth: () =>
    request<any>('/admin/logs/health'),

  // ─── Watch Dog ───
  getWatchDogErrors: (params: { status?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return request<{ errors: any[]; total: number }>(`/admin/watchdog?${query}`);
  },
  getWatchDogStats: () =>
    request<{ total: number; new: number; alerted: number; acknowledged: number }>('/admin/watchdog/stats'),
  updateWatchDogError: (id: string, status: string) =>
    request<any>(`/admin/watchdog/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  triggerWatchDogScan: () =>
    request<{ success: boolean; message: string }>('/admin/watchdog/scan', { method: 'POST' }),
  getWatchDogHealth: () =>
    request<any>('/admin/watchdog/health'),
  reanalyzeWatchDogError: (id: string) =>
    request<any>(`/admin/watchdog/reanalyze/${id}`, { method: 'POST' }),
  getWatchDogTrends: () =>
    request<any[]>('/admin/watchdog/trends'),
  triggerAutoFix: (id: string) =>
    request<any>(`/admin/watchdog/${id}/auto-fix`, { method: 'POST' }),
  approveAutoFix: (id: string) =>
    request<any>(`/admin/watchdog/${id}/approve-fix`, { method: 'POST' }),
  rejectAutoFix: (id: string) =>
    request<any>(`/admin/watchdog/${id}/reject-fix`, { method: 'POST' }),
  triggerTestAlert: (data: { errorType?: string; message: string; level?: number; category?: string }) =>
    request<any>('/admin/watchdog/test-alert', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Marketing Ops ───
  getMktOpsLogs: (params: { page?: number; limit?: number; event?: string; staff?: string; from?: string; to?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.event) query.set('event', params.event);
    if (params.staff) query.set('staff', params.staff);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    const qs = query.toString();
    return request<{ logs: MktOpsLog[]; pagination: Pagination }>(`/admin/mktops/logs${qs ? `?${qs}` : ''}`);
  },
  getMktOpsDecisions: (params: { page?: number; limit?: number; status?: string; staff?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.staff) query.set('staff', params.staff);
    const qs = query.toString();
    return request<{ decisions: MktOpsDecision[]; pagination: Pagination }>(`/admin/mktops/decisions${qs ? `?${qs}` : ''}`);
  },
  getMktOpsConfig: (key: string) =>
    request<MktOpsConfig>(`/admin/mktops/config/${key}`),
  updateMktOpsConfig: (key: string, value: unknown) =>
    request<MktOpsConfig>(`/admin/mktops/config/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  // ─── CV ───
  /** @deprecated Use uploadCvFile + pollCvParse for the 3-stage flow */
  uploadCV: (file: File) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('cv', file);
    return fetch(`${API_BASE}/cv/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
      }
      return res.json();
    });
  },

  /** Stage 2: Upload the CV file to the server. Returns a fileId for polling. */
  uploadCvFile: (file: File): Promise<{ fileId: string }> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('cv', file);
    return fetch(`${API_BASE}/cv/upload-file`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
      }
      return res.json();
    });
  },

  /** Stage 3: Poll for CV parse result. Returns status + parsed data when ready. */
  pollCvParse: (fileId: string): Promise<{ status: 'pending' | 'complete' | 'failed'; data?: any; error?: string }> =>
    request(`/cv/parse-status/${fileId}`),

  addEducation: (data: { institution: string; degree?: string; field?: string; country?: string; startYear?: number; endYear?: number }) =>
    request('/cv/education', { method: 'POST', body: JSON.stringify(data) }),

  deleteEducation: (id: string) =>
    request(`/cv/education/${id}`, { method: 'DELETE' }),

  addCertificate: (data: { name: string; issuer?: string; issueDate?: string; expiryDate?: string }) =>
    request('/cv/certificate', { method: 'POST', body: JSON.stringify(data) }),

  deleteCertificate: (id: string) =>
    request(`/cv/certificate/${id}`, { method: 'DELETE' }),

  // Push Notifications
  getVapidPublicKey: () =>
    request<{ vapidPublicKey: string }>('/push/vapid-key'),

  subscribeToPushNotifications: (data: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }) =>
    request<{ success: boolean }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  unsubscribeFromPushNotifications: (endpoint: string) =>
    request<{ success: boolean }>('/push/unsubscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    }),
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
