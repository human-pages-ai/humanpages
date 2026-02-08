import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';
import { posthog } from '../lib/posthog';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, termsAccepted: boolean) => Promise<void>;
  logout: () => void;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getProfile()
        .then((profile) => setUser({ id: profile.id, email: profile.email, name: profile.name }))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { human, token } = await api.login({ email, password });
    localStorage.setItem('token', token);
    setUser(human);
    posthog.identify(human.id);
  };

  const signup = async (email: string, password: string, name: string, termsAccepted: boolean = true) => {
    const referrerId = localStorage.getItem('referrer_id') || undefined;
    const { human, token } = await api.signup({ email, password, name, referrerId, termsAccepted });
    localStorage.removeItem('referrer_id'); // Clean up after use
    localStorage.setItem('token', token);
    setUser(human);
    posthog.identify(human.id);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    posthog.reset();
  };

  const loginWithGoogle = async () => {
    const { url, state } = await api.getOAuthUrl('google');
    sessionStorage.setItem('oauth_state', state);
    window.location.href = url;
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, loginWithGoogle }}>
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
