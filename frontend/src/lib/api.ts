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

export const api = {
  // Auth
  signup: (data: { email: string; password: string; name: string; referrerId?: string }) =>
    request<{ human: any; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ human: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // OAuth
  getOAuthUrl: (provider: 'google' | 'github') =>
    request<{ url: string; state: string }>(`/oauth/${provider}`),

  oauthCallback: (provider: 'google' | 'github', code: string, state: string, referrerId?: string) =>
    request<{ human: any; token: string; isNew?: boolean }>(`/oauth/${provider}/callback`, {
      method: 'POST',
      body: JSON.stringify({ code, state, referrerId }),
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
  getProfile: () => request<any>('/humans/me'),

  updateProfile: (data: any) =>
    request<any>('/humans/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Wallets
  getWallets: () => request<any[]>('/wallets'),

  addWallet: (data: { network: string; address: string; label?: string }) =>
    request<any>('/wallets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteWallet: (id: string) =>
    request<void>(`/wallets/${id}`, { method: 'DELETE' }),

  // Services
  getServices: () => request<any[]>('/services'),

  createService: (data: { title: string; description: string; category: string; priceRange?: string }) =>
    request<any>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateService: (id: string, data: any) =>
    request<any>(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteService: (id: string) =>
    request<void>(`/services/${id}`, { method: 'DELETE' }),

  // Referrals
  getReferrals: () =>
    request<{ count: number; referrals: Array<{ id: string; name: string; createdAt: string }> }>('/humans/me/referrals'),

  // Public profiles
  getHumanById: (id: string) => request<any>(`/humans/${id}`),

  // Jobs
  getJobs: (status?: string) =>
    request<any[]>(`/jobs${status ? `?status=${status}` : ''}`),

  acceptJob: (id: string) =>
    request<any>(`/jobs/${id}/accept`, { method: 'PATCH' }),

  rejectJob: (id: string) =>
    request<any>(`/jobs/${id}/reject`, { method: 'PATCH' }),

  completeJob: (id: string) =>
    request<any>(`/jobs/${id}/complete`, { method: 'PATCH' }),

  getMyReviews: (humanId: string) =>
    request<{ stats: any; reviews: any[] }>(`/jobs/human/${humanId}/reviews`),

  // Telegram
  getTelegramStatus: () =>
    request<{ connected: boolean; telegramUsername?: string; botAvailable: boolean; botUsername?: string }>('/telegram/status'),

  linkTelegram: () =>
    request<{ code: string; linkUrl: string; expiresIn: string }>('/telegram/link', { method: 'POST' }),

  unlinkTelegram: () =>
    request<{ message: string }>('/telegram/link', { method: 'DELETE' }),
};
