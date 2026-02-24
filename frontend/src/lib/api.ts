import type { Profile, Wallet, Service, Job, JobMessage, ReviewStats, Vouch, Listing, ListingApplication } from '../components/dashboard/types';
import type { AdminStats, AdminUser, AdminAgent, AdminJob, AdminActivity, AdminFeedback, AdminUserDetail, AdminAgentDetail, AdminJobDetail, AdminMeResponse, PostingGroup, AdCopy, Pagination, StaffStats, StaffMember, GenerateApiKeyResponse, ClockStatus, TimeEntry, HoursSummary, StaffClockOverview, StaffPayment, HoursAdjustment, StaffBalance, ContentItem, ContentStats, StaffCapability, TaskSummary, VideoConcept, VideoJob, VideoScriptData, PhotoConcept, CareerApplication, CareerApplicationStats, VideoItem, VideoDetail, ScheduleEntry, ScheduleStats, ProductivityDashboardData, IdleAlertEntry, StaffActivityEvent } from '../types/admin';

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
    // On 401, token is invalid/expired — clear it and redirect to login
    if (res.status === 401 && token) {
      localStorage.removeItem('token');
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

  deleteWallet: (id: string) =>
    request<void>(`/wallets/${id}`, { method: 'DELETE' }),

  updateWalletLabel: (address: string, label?: string) =>
    request<{ message: string; count: number }>(`/wallets/${address}/label`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    }),

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

  getAdminUser: (id: string) =>
    request<AdminUserDetail>(`/admin/users/${id}`),

  getAdminAgent: (id: string) =>
    request<AdminAgentDetail>(`/admin/agents/${id}`),

  updateAdminAgent: (id: string, data: { status?: string; activationTier?: string; activationExpiresAt?: string | null }) =>
    request<AdminAgentDetail>(`/admin/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getAdminJob: (id: string) =>
    request<AdminJobDetail>(`/admin/jobs/${id}`),

  getAdminActivity: (limit?: number) =>
    request<{ activity: AdminActivity[] }>(`/admin/activity${limit ? `?limit=${limit}` : ''}`),

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

  applyToListing: (id: string, pitch: string) =>
    request<ListingApplication>(`/listings/${id}/apply`, {
      method: 'POST',
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

  deleteContent: (id: string) =>
    request<{ message: string }>(`/admin/content/${id}`, { method: 'DELETE' }),

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
  getVideos: (params?: { page?: number; limit?: number; status?: string; tier?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.status) sp.set('status', params.status);
    if (params?.tier) sp.set('tier', params.tier);
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
