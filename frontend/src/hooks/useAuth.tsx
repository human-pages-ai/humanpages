import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';
import { posthog } from '../lib/posthog';
import { analytics } from '../lib/analytics';
import { safeLocalStorage, safeSessionStorage } from '../lib/safeStorage';

interface User {
  id: string;
  email: string;
  name: string;
  analyticsOptOut?: boolean;
  hasWallet?: boolean;
}

interface WhatsAppLoginResult {
  isNew: boolean;
  needsSignup?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, captchaToken: string) => Promise<void>;
  signup: (email: string, password: string, name: string, termsAccepted: boolean, captchaToken: string) => Promise<void>;
  loginWithWhatsApp: (phone: string, code: string, signupData?: { name: string; termsAccepted: boolean }) => Promise<WhatsAppLoginResult>;
  logout: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithLinkedIn: () => Promise<void>;
  updateUser: (fields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = safeLocalStorage.getItem('token');
    if (token) {
      api.getProfile()
        .then((profile) => {
          setUser({ id: profile.id, email: profile.email, name: profile.name, analyticsOptOut: profile.analyticsOptOut });
          analytics.setOptOut(!!profile.analyticsOptOut);
          if (!profile.analyticsOptOut) {
            posthog.identify(profile.id);
          }
        })
        .catch(() => safeLocalStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string, captchaToken: string) => {
    const { human, token } = await api.login({ email, password, captchaToken });
    safeLocalStorage.setItem('token', token);
    setUser(human);
    analytics.setOptOut(!!human.analyticsOptOut);
    if (!human.analyticsOptOut) {
      posthog.identify(human.id);
    }
  };

  const signup = async (email: string, password: string, name: string, termsAccepted: boolean = true, captchaToken: string) => {
    const referrerId = safeLocalStorage.getItem('referrer_id') || undefined;
    // Pass UTM attribution from sessionStorage (captured by useUTMParams hook on landing)
    const utmSource = safeSessionStorage.getItem('utm_source') || undefined;
    const utmMedium = safeSessionStorage.getItem('utm_medium') || undefined;
    const utmCampaign = safeSessionStorage.getItem('utm_campaign') || undefined;
    const { human, token } = await api.signup({ email, password, name, referrerId, termsAccepted, captchaToken, utmSource, utmMedium, utmCampaign });
    safeLocalStorage.removeItem('referrer_id'); // Clean up after use
    safeLocalStorage.setItem('token', token);
    setUser(human);
    // New signups default to analytics enabled
    posthog.identify(human.id);
  };

  const loginWithWhatsApp = async (phone: string, code: string, signupData?: { name: string; termsAccepted: boolean }): Promise<WhatsAppLoginResult> => {
    const referrerId = localStorage.getItem('referrer_id') || undefined;
    const utmSource = sessionStorage.getItem('utm_source') || undefined;
    const utmMedium = sessionStorage.getItem('utm_medium') || undefined;
    const utmCampaign = sessionStorage.getItem('utm_campaign') || undefined;
    const result = await api.whatsappVerifyOtp({
      phone,
      code,
      name: signupData?.name,
      termsAccepted: signupData?.termsAccepted,
      referrerId,
      utmSource,
      utmMedium,
      utmCampaign,
    });
    // Backend returns { needsSignup: true } when phone is verified but no account exists yet
    if (result.needsSignup) {
      return { isNew: true, needsSignup: true };
    }
    localStorage.removeItem('referrer_id');
    localStorage.setItem('token', result.token);
    setUser(result.human);
    if (!result.human.analyticsOptOut) {
      posthog.identify(result.human.id);
    }
    return { isNew: !!result.isNew, needsSignup: false };
  };

  const logout = () => {
    safeLocalStorage.removeItem('token');
    setUser(null);
    posthog.reset();
  };

  const loginWithGoogle = async () => {
    const { url, state } = await api.getOAuthUrl('google');
    safeLocalStorage.setItem('oauth_state', state);
    window.location.href = url;
  };

  const loginWithLinkedIn = async () => {
    const { url, state } = await api.getOAuthUrl('linkedin');
    safeLocalStorage.setItem('oauth_state', state);
    window.location.href = url;
  };

  const updateUser = (fields: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...fields } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithWhatsApp, logout, loginWithGoogle, loginWithLinkedIn, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
