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
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  // Auth
  signup: (data: { email: string; password: string; name: string }) =>
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
    request<{ url: string }>(`/oauth/${provider}`),

  oauthCallback: (provider: 'google' | 'github', code: string) =>
    request<{ human: any; token: string }>(`/oauth/${provider}/callback`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

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

  // Public profiles
  getHumanById: (id: string) => request<any>(`/humans/${id}`),
};
