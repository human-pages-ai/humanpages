import { useState, useEffect, useRef, lazy, Suspense, FormEvent } from 'react';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

// Lazy-load Turnstile — only downloaded when user actually sees the form
const LazyTurnstile = lazy(() => import('react-turnstile').then(m => ({ default: m.Turnstile })));

// ─── SVG icons (static, no re-renders) ──────────────────────────────────────

const GoogleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GoogleIconWhite = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fillOpacity=".7" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" fillOpacity=".5" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fillOpacity=".8" />
  </svg>
);

const LinkedInIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="#0A66C2" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

// ─── Types ──────────────────────────────────────────────────────────────────

export type SignupMode = 'email-primary' | 'oauth-primary';

interface InlineSignupFormProps {
  /** 'email-primary': email form on top, OAuth below (FB webview).
   *  'oauth-primary': OAuth buttons only (normal browsers). */
  mode: SignupMode;

  /** Called after successful email signup. Receives the form data. */
  onEmailSignup: (data: { name: string; email: string; password: string; captchaToken: string }) => Promise<void>;

  /** Called when user clicks Google sign-in. */
  onGoogleSignup: () => void;

  /** Called when user clicks LinkedIn sign-in. Only shown in oauth-primary mode. */
  onLinkedInSignup?: () => void;

  /** Whether to auto-focus the first input (useful for mobile slide-up). */
  autoFocus?: boolean;

  /** Compact spacing for mobile bottom sheets. */
  compact?: boolean;

  /** Whether we're in an embedded browser (FB/TG WebView). Enables Turnstile timeout fallback. */
  embeddedBrowser?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function InlineSignupForm({
  mode,
  onEmailSignup,
  onGoogleSignup,
  onLinkedInSignup,
  autoFocus = false,
  compact = false,
  embeddedBrowser = false,
}: InlineSignupFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaBypassed, setCaptchaBypassed] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const captchaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // In embedded browsers (FB/TG WebView), Turnstile often fails to load.
  // Start an 8-second timer — if captcha hasn't verified by then, allow bypass.
  useEffect(() => {
    if (embeddedBrowser && !captchaToken && !captchaBypassed) {
      captchaTimerRef.current = setTimeout(() => {
        setCaptchaBypassed(true);
        setCaptchaToken('__webview_bypass__');
      }, 8000);
    }
    return () => {
      if (captchaTimerRef.current) clearTimeout(captchaTimerRef.current);
    };
  }, [embeddedBrowser, captchaToken, captchaBypassed]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!captchaToken) {
      setError('Please complete the security check');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onEmailSignup({ name: name.trim(), email: email.trim(), password, captchaToken });
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const spacing = compact ? 'space-y-2' : 'space-y-2.5';

  // ── OAuth-primary mode: OAuth buttons + expandable email form (normal browser) ──

  if (mode === 'oauth-primary') {
    if (showEmailForm) {
      // User clicked "sign up with email" — show the email form with OAuth below
      return (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
          <form onSubmit={handleSubmit} className={spacing}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required autoFocus autoComplete="name" className={inputClass} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required autoComplete="email" inputMode="email" className={inputClass} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create password (8+ chars)" required minLength={8} autoComplete="new-password" className={inputClass} />
            <Suspense fallback={<div className="h-[65px] bg-gray-50 rounded border border-gray-200 flex items-center justify-center"><span className="text-xs text-gray-400">Loading security check...</span></div>}>
              <LazyTurnstile sitekey={TURNSTILE_SITE_KEY} onVerify={(token: string) => setCaptchaToken(token)} onExpire={() => setCaptchaToken('')} size="normal" />
            </Suspense>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={loading || !captchaToken || !name.trim() || !email.trim() || !password} className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50">
              {loading ? 'Creating account...' : 'Sign Up Free to Apply'}
            </button>
          </form>
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <button onClick={onGoogleSignup} className="w-full py-2.5 px-4 rounded-lg text-slate-600 font-medium bg-white border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm">
            <GoogleIcon />
            Sign in with Google
          </button>
          {onLinkedInSignup && (
            <button onClick={onLinkedInSignup} className="w-full py-2.5 px-4 rounded-lg text-slate-600 font-medium bg-white border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm">
              <LinkedInIcon />
              or continue with LinkedIn
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <button
          onClick={onGoogleSignup}
          className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2"
        >
          <GoogleIconWhite />
          Sign Up Free to Apply
        </button>
        {onLinkedInSignup && (
          <button
            onClick={onLinkedInSignup}
            className="w-full py-2.5 px-4 rounded-lg text-slate-600 font-medium bg-white border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <LinkedInIcon />
            or continue with LinkedIn
          </button>
        )}
        <button
          onClick={() => setShowEmailForm(true)}
          className="w-full py-2.5 px-4 rounded-lg text-slate-500 font-medium bg-transparent hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 text-sm"
        >
          or sign up with email
        </button>
        <p className="text-center text-xs text-gray-400 mt-1">
          Free forever · No credit card · Takes 10 seconds
        </p>
      </div>
    );
  }

  // ── Email-primary mode: email form + Google option below (FB webview) ──

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <form onSubmit={handleSubmit} className={spacing}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
          autoFocus={autoFocus}
          autoComplete="name"
          className={inputClass}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          required
          autoComplete="email"
          inputMode="email"
          className={inputClass}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create password (8+ chars)"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
        {captchaBypassed ? (
          <div className="h-[65px] bg-green-50 rounded border border-green-200 flex items-center justify-center">
            <span className="text-xs text-green-600">✓ Verification skipped — you're good to go</span>
          </div>
        ) : (
          <Suspense fallback={
            <div className="h-[65px] bg-gray-50 rounded border border-gray-200 flex items-center justify-center">
              <span className="text-xs text-gray-400">Loading security check...</span>
            </div>
          }>
            <LazyTurnstile
              sitekey={TURNSTILE_SITE_KEY}
              onVerify={(token: string) => {
                setCaptchaToken(token);
                if (captchaTimerRef.current) clearTimeout(captchaTimerRef.current);
              }}
              onExpire={() => setCaptchaToken('')}
              onError={() => {
                if (embeddedBrowser) {
                  setCaptchaBypassed(true);
                  setCaptchaToken('__webview_bypass__');
                }
              }}
              size="normal"
            />
          </Suspense>
        )}
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !captchaToken || !name.trim() || !email.trim() || !password}
          className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign Up Free to Apply'}
        </button>
      </form>
      <p className={`text-center text-xs text-gray-400 ${compact ? 'mt-1' : ''}`}>
        Free forever · No credit card · No fees
      </p>

      {/* Separator + Google OAuth as secondary option */}
      <div className={`flex items-center gap-3 ${compact ? 'my-1.5' : 'my-1'}`}>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <button
        onClick={onGoogleSignup}
        className="w-full py-2.5 px-4 rounded-lg text-slate-600 font-medium bg-white border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm"
      >
        <GoogleIcon />
        Sign in with Google
      </button>
    </div>
  );
}
