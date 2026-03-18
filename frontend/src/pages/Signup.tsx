import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Turnstile } from 'react-turnstile';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Link from '../components/LocalizedLink';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator';
import InAppBrowserBanner from '../components/InAppBrowserBanner';
import { safeLocalStorage, safeSessionStorage } from '../lib/safeStorage';
import PhoneInput from '../components/PhoneInput';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'; // test key fallback
const CAPTCHA_TIMEOUT_MS = 10_000;

type WhatsAppStep = 'phone' | 'otp' | 'name';

export default function Signup() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const captchaResolved = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const { signup, loginWithWhatsApp, loginWithGoogle, loginWithLinkedIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // WhatsApp OTP state
  const [waStep, setWaStep] = useState<WhatsAppStep | null>(null);
  const [waPhone, setWaPhone] = useState('');
  const [waOtp, setWaOtp] = useState('');
  const [waName, setWaName] = useState('');
  const [waTerms, setWaTerms] = useState(false);
  const [waSending, setWaSending] = useState(false);

  // Application-level timeout: if Turnstile hasn't verified within 10s, show fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!captchaResolved.current) {
        setCaptchaFailed(true);
      }
    }, CAPTCHA_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Store referral ID if present
    const ref = searchParams.get('ref');
    if (ref) {
      safeLocalStorage.setItem('referrer_id', ref);
    }

    const utmSource = searchParams.get('utm_source') || safeSessionStorage.getItem('utm_source') || undefined;
    const utmMedium = searchParams.get('utm_medium') || safeSessionStorage.getItem('utm_medium') || undefined;
    const utmCampaign = searchParams.get('utm_campaign') || safeSessionStorage.getItem('utm_campaign') || undefined;
    analytics.track('signup_start', { utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signup(email, password, name, termsAccepted, captchaToken);
      const utmSource = safeSessionStorage.getItem('utm_source') || undefined;
      const utmMedium = safeSessionStorage.getItem('utm_medium') || undefined;
      const utmCampaign = safeSessionStorage.getItem('utm_campaign') || undefined;
      analytics.track('signup_complete', { method: 'email', utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || t('auth.signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setOauthLoading('google');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || t('auth.signupFailed'));
      setOauthLoading(null);
    }
  };

  const handleLinkedInSignup = async () => {
    setError('');
    setOauthLoading('linkedin');
    try {
      await loginWithLinkedIn();
    } catch (err: any) {
      setError(err.message || t('auth.signupFailed'));
      setOauthLoading(null);
    }
  };

  // ── WhatsApp OTP flow ──
  const handleWhatsAppStart = () => {
    if (!captchaToken) {
      setError('Please complete the CAPTCHA first');
      return;
    }
    setError('');
    setWaStep('phone');
  };

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setWaSending(true);
    try {
      await api.whatsappSendOtp({ phone: waPhone, captchaToken });
      setWaStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setWaSending(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setWaSending(true);
    try {
      const result = await loginWithWhatsApp(waPhone, waOtp);
      if (result.needsSignup) {
        setWaStep('name');
      } else {
        analytics.track('signup_complete', { method: 'whatsapp', isNew: result.isNew });
        navigate(result.isNew ? '/onboarding' : '/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setWaSending(false);
    }
  };

  const handleWhatsAppSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!waTerms) {
      setError('You must accept the Terms of Use');
      return;
    }
    setWaSending(true);
    try {
      const result = await loginWithWhatsApp(waPhone, waOtp, { name: waName, termsAccepted: waTerms });
      analytics.track('signup_complete', { method: 'whatsapp', isNew: result.isNew });
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setWaSending(false);
    }
  };

  // WhatsApp icon SVG
  const WhatsAppIcon = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );

  // ── WhatsApp flow UI ──
  if (waStep) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <SEO title="Sign up with WhatsApp" noindex />
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="max-w-md w-full space-y-8">
          <div>
            <h1 className="text-center"><Link to="/"><Logo size="lg" /></Link></h1>
            <h2 className="mt-2 text-center text-xl text-gray-600">Sign up with WhatsApp</h2>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
              {error}
            </div>
          )}

          {waStep === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="wa-phone" className="block text-sm font-medium text-gray-700">
                  WhatsApp Number
                </label>
                <PhoneInput
                  id="wa-phone"
                  value={waPhone}
                  onChange={(val) => setWaPhone(val)}
                />
              </div>
              <button
                type="submit"
                disabled={waSending || !waPhone}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {waSending ? 'Sending...' : 'Send Verification Code'}
              </button>
              <button
                type="button"
                onClick={() => { setWaStep(null); setError(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Back to other options
              </button>
            </form>
          )}

          {waStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-gray-600">
                We sent a 6-digit code to <strong>{waPhone}</strong> on WhatsApp.
              </p>
              <div>
                <label htmlFor="wa-otp" className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <input
                  id="wa-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={waOtp}
                  onChange={(e) => setWaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-center text-2xl tracking-widest"
                />
              </div>
              <button
                type="submit"
                disabled={waSending || waOtp.length !== 6}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {waSending ? 'Verifying...' : 'Verify Code'}
              </button>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => { setWaStep('phone'); setWaOtp(''); setError(''); }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Change number
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setError('');
                    setWaSending(true);
                    try {
                      await api.whatsappSendOtp({ phone: waPhone, captchaToken });
                      setError('');
                    } catch (err: any) {
                      setError(err.message || 'Failed to resend');
                    } finally {
                      setWaSending(false);
                    }
                  }}
                  disabled={waSending}
                  className="text-sm text-green-600 hover:text-green-500"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {waStep === 'name' && (
            <form onSubmit={handleWhatsAppSignup} className="space-y-4">
              <p className="text-sm text-gray-600">
                Almost there! Tell us your name to create your account.
              </p>
              <div>
                <label htmlFor="wa-name" className="block text-sm font-medium text-gray-700">
                  {t('common.name')}
                </label>
                <input
                  id="wa-name"
                  type="text"
                  required
                  value={waName}
                  onChange={(e) => setWaName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div className="flex items-start">
                <input
                  id="wa-terms"
                  type="checkbox"
                  checked={waTerms}
                  onChange={(e) => setWaTerms(e.target.checked)}
                  className="h-4 w-4 mt-0.5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="wa-terms" className="ml-2 text-sm text-gray-600">
                  {t('auth.agreeToTerms')}{' '}
                  <Link to="/terms" target="_blank" className="text-blue-600 hover:text-blue-500">
                    {t('auth.termsOfUse')}
                  </Link>{' '}
                  {t('common.and')}{' '}
                  <Link to="/privacy" target="_blank" className="text-blue-600 hover:text-blue-500">
                    {t('auth.privacyPolicy')}
                  </Link>
                </label>
              </div>
              <button
                type="submit"
                disabled={waSending || !waName || !waTerms}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {waSending ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <SEO
        title="Create Profile"
        description="Create your Human Pages profile. Get discovered by AI agents for photography, deliveries, research, and more real-world tasks."
        path="/signup"
      />
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center"><Link to="/"><Logo size="lg" /></Link></h1>
          <h2 className="mt-2 text-center text-xl text-gray-600">{t('auth.createAccount')}</h2>
          <p className="mt-2 text-center text-sm text-gray-500">{t('auth.signupSubtitle')}</p>
        </div>

        {/* OAuth section first */}
        <div className="space-y-3">
          {/* WhatsApp signup hidden until ready for production */}
          <button
            type="button"
            onClick={handleWhatsAppStart}
            disabled={oauthLoading !== null || !captchaToken}
            className="!hidden"
          >
            <WhatsAppIcon />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={oauthLoading !== null}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {oauthLoading === 'google' ? t('auth.redirecting') : 'Continue with Google'}
          </button>
          <button
            type="button"
            onClick={handleLinkedInSignup}
            disabled={oauthLoading !== null}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            {oauthLoading === 'linkedin' ? t('auth.redirecting') : 'Continue with LinkedIn'}
          </button>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <button
              type="button"
              onClick={() => setShowEmailForm(!showEmailForm)}
              className="px-2 bg-gray-50 text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              or sign up with email
            </button>
          </div>
        </div>

        {/* Email/password form */}
        {showEmailForm && (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                {t('common.name')}
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('common.email')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('common.password')}
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              <PasswordStrengthIndicator password={password} />
            </div>
          </div>
          <div className="flex items-start">
            <input
              id="terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="h-4 w-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
              {t('auth.agreeToTerms')}{' '}
              <Link to="/terms" target="_blank" className="text-blue-600 hover:text-blue-500">
                {t('auth.termsOfUse')}
              </Link>{' '}
              {t('common.and')}{' '}
              <Link to="/privacy" target="_blank" className="text-blue-600 hover:text-blue-500">
                {t('auth.privacyPolicy')}
              </Link>
            </label>
          </div>
          <Turnstile
            sitekey={TURNSTILE_SITE_KEY}
            onVerify={(token) => { captchaResolved.current = true; setCaptchaFailed(false); setCaptchaToken(token); }}
            onExpire={() => setCaptchaToken('')}
            onError={() => setCaptchaFailed(true)}
            onTimeout={() => setCaptchaFailed(true)}
          />
          {captchaFailed && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded text-sm">
              {t('auth.captchaFailed')}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !termsAccepted || !captchaToken}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <span role="status" aria-label="Loading">{t('auth.creatingAccount')}</span>
            ) : (
              t('auth.signUp')
            )}
          </button>

          <InAppBrowserBanner />

          <p className="text-center text-sm text-gray-600">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-500">
              {t('auth.signIn')}
            </Link>
          </p>
        </form>
        )}
      </div>
    </main>
  );
}
