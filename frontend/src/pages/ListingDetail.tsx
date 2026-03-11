import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { setListingApplyIntent } from '../lib/applyIntent';
import { analytics } from '../lib/analytics';
import { posthog } from '../lib/posthog';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

// Lazy-load Turnstile — only downloaded when an embedded browser user opens the signup form
const LazyTurnstile = lazy(() => import('react-turnstile').then(m => ({ default: m.Turnstile })));

// Lazy-load ReportAgentModal — only downloaded when a logged-in user clicks "Report"
const ReportAgentModal = lazy(() => import('../components/ReportAgentModal'));
import SEO from '../components/SEO';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Listing } from '../components/dashboard/types';
import Footer from '../components/Footer';

function formatTimeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

/**
 * Detect embedded in-app browsers where Google/LinkedIn OAuth is blocked or unreliable.
 * Covers: Facebook, Facebook Lite, Instagram, Telegram, Opera Mini, Line, WeChat, Snapchat.
 * These all use restricted WebViews that break standard OAuth popup/redirect flows.
 */
function isEmbeddedBrowser(): boolean {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FBLC|FB_IAB|Instagram|Telegram|OPiOS|OPR\/.*Mini|Line\/|KAKAOTALK|Snapchat|MicroMessenger/i.test(ua);
}

export default function ListingDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signup, loginWithGoogle, loginWithLinkedIn } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [pitch, setPitch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMobileApplySheet, setShowMobileApplySheet] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const applyFormRef = useRef<HTMLDivElement>(null);
  const hasShownWelcomeToast = useRef(false);

  // Inline email signup for FB in-app browser (where OAuth is blocked)
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [showInlineSignup, setShowInlineSignup] = useState(false);

  const handleInlineSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword) return;
    if (signupPassword.length < 8) {
      setSignupError('Password must be at least 8 characters');
      return;
    }
    if (!captchaToken) {
      setSignupError('Please complete the security check');
      return;
    }
    setSignupError('');
    setSignupLoading(true);
    try {
      // Save listing intent before signup so it persists
      if (listing) setListingApplyIntent(id!, listing.title, listing.requiredSkills);
      await signup(signupEmail.trim(), signupPassword, signupName.trim(), true, captchaToken);
      analytics.track('listing_signup_clicked', { listingId: id, method: 'email', title: listing?.title, budget: listing?.budgetUsdc });
      posthog.capture('listing_signup_clicked', { listingId: id, method: 'email', title: listing?.title, budget: listing?.budgetUsdc });
      // Save skills from listing to profile (non-blocking)
      if (listing?.requiredSkills?.length) {
        api.updateProfile({ skills: listing.requiredSkills }).catch(() => {});
      }
      localStorage.setItem('hp_onboarding_pending', '1');
      // Reload the page so the user state refreshes
      window.location.href = `/listings/${id}?signedup=1`;
    } catch (err: any) {
      setSignupError(err.message || 'Signup failed. Please try again.');
    } finally {
      setSignupLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadListing();
    }
  }, [id]);

  // Show welcome toast when redirected after fast-track signup (once only)
  useEffect(() => {
    if (searchParams.get('signedup') === '1' && !hasShownWelcomeToast.current) {
      hasShownWelcomeToast.current = true;
      toast.success(
        'Welcome! You can now apply to this gig or browse more listings.',
        { duration: 6000 }
      );
      searchParams.delete('signedup');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadListing = async () => {
    setLoading(true);
    try {
      const data = await api.getListing(id!);
      setListing(data);
      // Funnel step 1: listing page viewed
      const utmSource = new URLSearchParams(window.location.search).get('utm_source') || undefined;
      analytics.track('listing_viewed', { listingId: id, title: data.title, budget: data.budgetUsdc, utm_source: utmSource });
      posthog.capture('listing_viewed', { listingId: id, title: data.title, budget: data.budgetUsdc, utm_source: utmSource });
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!pitch.trim()) {
      toast.error('Please enter a pitch');
      return;
    }
    if (pitch.length > 500) {
      toast.error('Pitch must be 500 characters or less');
      return;
    }

    setSubmitting(true);
    try {
      await api.applyToListing(id!, pitch.trim());
      analytics.track('listing_applied', { listingId: id, hasPitch: true });
      posthog.capture('listing_applied', { listingId: id, hasPitch: true });
      toast.success(t('listings.detail.applicationSubmitted'));
      setPitch('');
      setShowMobileApplySheet(false);
      await loadListing();
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplySignup = (method: 'linkedin' | 'google') => {
    if (!listing) return;
    // Funnel step 2: signup button clicked
    analytics.track('listing_signup_clicked', { listingId: id, method, title: listing.title, budget: listing.budgetUsdc });
    posthog.capture('listing_signup_clicked', { listingId: id, method, title: listing.title, budget: listing.budgetUsdc });
    setListingApplyIntent(id!, listing.title, listing.requiredSkills);
    if (method === 'linkedin') {
      loginWithLinkedIn();
    } else {
      loginWithGoogle();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {t('common.loading')}
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Listing not found</p>
        <Link to="/listings" className="text-blue-600 hover:text-blue-800">
          {t('common.back')} to listings
        </Link>
      </div>
    );
  }

  const isExpired = new Date(listing.expiresAt) <= new Date();
  const isClosed = listing.status !== 'OPEN' || isExpired;
  const hasApplied = listing.hasApplied || !!listing.myApplication;
  const canApply = user && !hasApplied && !isClosed;
  const showMobileBottomBar = !hasApplied && !isClosed;
  const inEmbeddedBrowser = isEmbeddedBrowser();

  // ─── Desktop Sidebar Apply Card ────────────────────────────────────────────

  const renderDesktopApplyCard = () => (
    <div className="sticky top-6 bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {t('listings.detail.applyNow')}
      </h2>

      {/* Budget */}
      <div className="mb-4">
        <p className="text-2xl font-bold text-green-600">
          ${listing.budgetUsdc}{listing.budgetFlexible && '+'}
        </p>
        {listing.budgetFlexible && (
          <p className="text-xs text-gray-500 mt-0.5">Budget is negotiable</p>
        )}
      </div>

      {/* Skills hint */}
      {!user && listing.requiredSkills?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Skills needed</p>
          <div className="flex flex-wrap gap-1.5">
            {listing.requiredSkills.map((skill: string, idx: number) => (
              <span key={idx} className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Not logged in — signup options */}
      {!user && !isClosed && (
        inEmbeddedBrowser ? (
          /* ── FB in-app browser: inline email signup (OAuth is blocked in webviews) ── */
          <div className="space-y-3">
            <form onSubmit={handleInlineSignup} className="space-y-2.5">
              <input
                type="text"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="Email address"
                required
                autoComplete="email"
                inputMode="email"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Create password (8+ chars)"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Suspense fallback={<div className="h-[65px] bg-gray-50 rounded border border-gray-200 flex items-center justify-center"><span className="text-xs text-gray-400">Loading security check...</span></div>}>
                <LazyTurnstile
                  sitekey={TURNSTILE_SITE_KEY}
                  onVerify={(token: string) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken('')}
                  size="normal"
                />
              </Suspense>
              {signupError && (
                <p className="text-xs text-red-600">{signupError}</p>
              )}
              <button
                type="submit"
                disabled={signupLoading || !captchaToken || !signupName.trim() || !signupEmail.trim() || !signupPassword}
                className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
              >
                {signupLoading ? 'Creating account...' : 'Sign Up Free to Apply'}
              </button>
            </form>
            <p className="text-center text-xs text-gray-400">
              Free forever · No credit card · No fees
            </p>
            <p className="text-center">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); window.open(window.location.href, '_blank'); }}
                className="text-xs text-blue-600 hover:text-blue-500"
              >
                Open in browser &rarr;
              </a>
            </p>
          </div>
        ) : (
          /* ── Normal browser: OAuth buttons ── */
          <div className="space-y-3">
            <button
              onClick={() => handleApplySignup('google')}
              className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fillOpacity=".7"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" fillOpacity=".5"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fillOpacity=".8"/></svg>
              Sign Up Free to Apply
            </button>
            <button
              onClick={() => handleApplySignup('linkedin')}
              className="w-full py-2.5 px-4 rounded-lg text-slate-600 font-medium bg-white border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="#0A66C2" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              or continue with LinkedIn
            </button>
            <p className="text-center text-xs text-gray-400 mt-1">
              Free forever · No credit card · Takes 10 seconds
            </p>
          </div>
        )
      )}

      {/* Already applied */}
      {user && hasApplied && listing.myApplication && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-800 mb-2">
            {t('listings.detail.alreadyApplied')}
          </p>
          <p className="text-sm text-gray-700 mb-1">
            <span className="font-medium">Status:</span>{' '}
            {t(`listings.myApplications.status.${listing.myApplication.status}`)}
          </p>
          {listing.myApplication.pitch && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Your pitch:</span> {listing.myApplication.pitch}
            </p>
          )}
          {!listing.myApplication.pitch && (
            <Link
              to="/dashboard"
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              Add a cover letter &rarr;
            </Link>
          )}
        </div>
      )}

      {/* Listing closed */}
      {isClosed && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            {t('listings.detail.listingClosed')}
          </p>
        </div>
      )}

      {/* Logged in — can apply (desktop has inline form) */}
      {canApply && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('listings.detail.yourPitch')}
          </label>
          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder={t('listings.detail.pitchPlaceholder')}
            rows={4}
            maxLength={500}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {pitch.length}/500 characters
            </span>
            <button
              onClick={handleApply}
              disabled={submitting || !pitch.trim()}
              className="bg-blue-600 text-white font-medium py-2 px-6 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('listings.detail.submitting') : t('listings.detail.submitApplication')}
            </button>
          </div>
        </div>
      )}

    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={listing.title}
        description={listing.description?.substring(0, 160)}
        path={`/listings/${listing.id}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": listing.title,
          "description": listing.description,
          "datePosted": listing.createdAt,
          "validThrough": listing.expiresAt,
          ...(listing.location && {
            "jobLocation": {
              "@type": "Place",
              "address": listing.location
            }
          }),
          ...(listing.workMode && {
            "jobLocationType": listing.workMode === 'REMOTE' ? "TELECOMMUTE" : undefined
          }),
          ...(listing.budgetUsdc && {
            "baseSalary": {
              "@type": "MonetaryAmount",
              "currency": "USD",
              "value": listing.budgetUsdc
            }
          }),
          "hiringOrganization": {
            "@type": "Organization",
            "name": listing.agent?.name || "AI Agent",
            ...(listing.agent?.domainVerified && { "url": `https://humanpages.ai/agents/${listing.agent.id}` })
          },
          "employmentType": "TEMPORARY",
          ...(listing.requiredSkills?.length > 0 && {
            "skills": listing.requiredSkills.join(", ")
          })
        }}
      />

      {/* Nav bar */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="whitespace-nowrap">
            <Link to="/"><Logo /></Link>
          </h1>
          <div className="flex items-center gap-2 sm:gap-4 whitespace-nowrap">
            <LanguageSwitcher />
            {user ? (
              <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                {t('nav.dashboard')}
              </Link>
            ) : (
              <button
                onClick={() => !inEmbeddedBrowser ? handleApplySignup('google') : setShowInlineSignup(true)}
                className="bg-blue-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign Up
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Platform explainer for cold traffic */}
      {!user && (
        <div className="bg-slate-900 border-b border-slate-800">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
            <span className="text-white font-medium">Real tasks. Real pay. No middleman.</span>
            <span className="text-slate-400 hidden sm:inline">·</span>
            <span className="text-slate-300 hidden sm:inline">Keep 100% of your earnings</span>
            <span className="text-slate-400 hidden sm:inline">·</span>
            <span className="text-emerald-400 hidden sm:inline font-medium">Always free</span>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 pb-32 lg:pb-8">
        {/* Back link */}
        <Link
          to="/listings"
          className="text-sm text-blue-600 hover:text-blue-800 mb-6 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('common.back')} to listings
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Left column - Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main card */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Cover image */}
              {listing.imageUrl && (
                <img
                  src={listing.imageUrl}
                  alt={listing.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-56 object-cover"
                />
              )}

              <div className="p-6">
              {/* PRO badge */}
              {listing.isPro && (
                <div className="mb-3">
                  <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded">
                    {t('listings.card.proAgent')}
                  </span>
                </div>
              )}

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                {listing.title}
              </h1>

              {/* Budget on mobile */}
              <div className="mb-4 lg:hidden">
                <p className="text-3xl font-bold text-green-600">
                  ${listing.budgetUsdc}{listing.budgetFlexible && '+'}
                </p>
                {listing.budgetFlexible && (
                  <p className="text-sm text-gray-500 mt-1">Budget is negotiable</p>
                )}
              </div>

              {/* Trust strip on mobile — visible instantly, builds credibility */}
              <div className="mb-6 lg:hidden flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
                {listing.agent && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-gray-700">{listing.agent.name}</span>
                    {listing.agent.domainVerified && (
                      <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    )}
                  </span>
                )}
                {listing.agentReputation && listing.agentReputation.completedJobs > 0 && (
                  <span>{listing.agentReputation.completedJobs} jobs completed</span>
                )}
                {listing.agentReputation && listing.agentReputation.avgRating > 0 && (
                  <span className="flex items-center gap-0.5">
                    <span className="text-yellow-500">★</span>
                    {listing.agentReputation.avgRating.toFixed(1)}
                  </span>
                )}
                {listing.agentReputation && listing.agentReputation.avgPaymentSpeedHours !== null && (
                  <span>Pays in ~{listing.agentReputation.avgPaymentSpeedHours}h</span>
                )}
                {(listing._count?.applications ?? 0) > 0 && (
                  <span>{listing._count!.applications} applied</span>
                )}
              </div>

              {/* Description — truncated on mobile for cold traffic */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Description
                </h2>
                {listing.description && listing.description.length > 200 && !descExpanded ? (
                  <div>
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {listing.description.substring(0, 200).trimEnd()}...
                    </p>
                    <button
                      onClick={() => setDescExpanded(true)}
                      className="text-sm text-blue-600 hover:text-blue-500 font-medium mt-1"
                    >
                      Read more
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {listing.description}
                  </p>
                )}
              </div>

              {/* Requirements section */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {t('listings.detail.requirements')}
                </h2>

                {listing.requiredSkills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      {t('listings.detail.skills')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {listing.requiredSkills.map((skill: string, idx: number) => (
                        <span key={idx} className="inline-block bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {listing.requiredEquipment.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      {t('listings.detail.equipment')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {listing.requiredEquipment.map((item: string, idx: number) => (
                        <span key={idx} className="inline-block bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {listing.location && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {t('listings.detail.location')}
                    </p>
                    <p className="text-gray-800">
                      {listing.location}
                      {listing.radiusKm && ` (${listing.radiusKm}km radius)`}
                    </p>
                  </div>
                )}

                {listing.workMode && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {t('listings.detail.workMode')}
                    </p>
                    <p className="text-gray-800">
                      {listing.workMode === 'REMOTE' && t('listings.filters.remote')}
                      {listing.workMode === 'ONSITE' && t('listings.filters.onsite')}
                      {listing.workMode === 'HYBRID' && t('listings.filters.hybrid')}
                    </p>
                  </div>
                )}
              </div>

              {/* Expiry and applicant count */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div>
                    <span className="font-medium">{t('listings.detail.expiresAt')}:</span>{' '}
                    {formatTimeUntil(listing.expiresAt)}
                  </div>
                  <div>
                    <span className="font-medium">{t('listings.detail.applicants')}:</span>{' '}
                    {listing._count?.applications || 0}
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>

          {/* Right column - Sidebar (desktop only) */}
          <div className="lg:col-span-1 space-y-6 hidden lg:block">
            {renderDesktopApplyCard()}

            {/* Agent card */}
            {listing.agent && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  {t('listings.detail.postedBy')}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{listing.agent.name}</p>
                    {listing.agent.domainVerified && (
                      <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    )}
                  </div>
                  {listing.agent.description && (
                    <p className="text-sm text-gray-600">{listing.agent.description}</p>
                  )}
                  {listing.isPro && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                      PRO Agent - High reputation
                    </p>
                  )}
                </div>
              </div>
            )}

            {listing.agentReputation && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  {t('listings.detail.agentReputation')}
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {listing.agentReputation.completedJobs}
                    </p>
                    <p className="text-xs text-gray-500">{t('listings.detail.jobsCompleted')}</p>
                  </div>
                  {listing.agentReputation.avgRating > 0 && (
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">
                          {'★'.repeat(Math.round(listing.agentReputation.avgRating))}
                        </span>
                        <span className="text-sm text-gray-600">
                          {listing.agentReputation.avgRating.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{t('listings.detail.avgRating')}</p>
                    </div>
                  )}
                  {listing.agentReputation.avgPaymentSpeedHours !== null && (
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {listing.agentReputation.avgPaymentSpeedHours}h
                      </p>
                      <p className="text-xs text-gray-500">{t('listings.detail.avgPaymentSpeed')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {user && listing.agent && (
              <button
                onClick={() => setShowReportModal(true)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                {t('reportAgent.reportThis', 'Report this listing')}
              </button>
            )}
          </div>

          {/* Mobile: Agent info below main content */}
          <div className="lg:hidden space-y-6">
            {listing.agent && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  {t('listings.detail.postedBy')}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{listing.agent.name}</p>
                    {listing.agent.domainVerified && (
                      <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    )}
                  </div>
                  {listing.agent.description && (
                    <p className="text-sm text-gray-600">{listing.agent.description}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer className="mt-12 lg:mt-12" />

      {/* ─── Mobile: Sticky Bottom CTA Bar ─────────────────────────────────────── */}
      {showMobileBottomBar && (
        <div className="fixed bottom-0 left-0 right-0 lg:hidden z-50">
          {/* Slide-up apply form (logged in users) */}
          {showMobileApplySheet && canApply && (
            <div ref={applyFormRef} className="bg-white border-t border-gray-200 px-4 pt-4 pb-2 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('listings.detail.yourPitch')}
                </label>
                <button
                  onClick={() => setShowMobileApplySheet(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Close apply form"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <textarea
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                placeholder={t('listings.detail.pitchPlaceholder')}
                rows={3}
                maxLength={500}
                autoFocus
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{pitch.length}/500</span>
                <button
                  onClick={handleApply}
                  disabled={submitting || !pitch.trim()}
                  className="bg-blue-600 text-white font-medium py-2 px-5 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? t('listings.detail.submitting') : 'Submit'}
                </button>
              </div>
            </div>
          )}

          {/* Slide-up inline signup form for FB in-app browser (mobile) */}
          {showInlineSignup && !user && inEmbeddedBrowser && (
            <div className="bg-white border-t border-gray-200 px-4 pt-4 pb-2 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">Create your free account</p>
                <button
                  onClick={() => setShowInlineSignup(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Close signup form"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleInlineSignup} className="space-y-2">
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoFocus
                  autoComplete="name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  autoComplete="email"
                  inputMode="email"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Create password (8+ chars)"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Suspense fallback={<div className="h-[65px] bg-gray-50 rounded border border-gray-200 flex items-center justify-center"><span className="text-xs text-gray-400">Loading security check...</span></div>}>
                  <LazyTurnstile
                    sitekey={TURNSTILE_SITE_KEY}
                    onVerify={(token: string) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken('')}
                    size="normal"
                  />
                </Suspense>
                {signupError && (
                  <p className="text-xs text-red-600">{signupError}</p>
                )}
                <button
                  type="submit"
                  disabled={signupLoading || !captchaToken || !signupName.trim() || !signupEmail.trim() || !signupPassword}
                  className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                >
                  {signupLoading ? 'Creating account...' : 'Sign Up Free to Apply'}
                </button>
              </form>
              <div className="flex items-center justify-between mt-2 mb-1">
                <p className="text-xs text-gray-400">Free forever · No fees</p>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); window.open(window.location.href, '_blank'); }}
                  className="text-xs text-blue-600 hover:text-blue-500"
                >
                  Open in browser &rarr;
                </a>
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 safe-area-pb">
            <div className="flex items-center gap-3">
              {/* Budget teaser */}
              <div className="shrink-0">
                <p className="text-lg font-bold text-green-600">
                  ${listing.budgetUsdc}{listing.budgetFlexible && '+'}
                </p>
                <p className="text-xs text-gray-500">
                  {formatTimeUntil(listing.expiresAt)} left
                </p>
              </div>

              <div className="flex-1 min-w-0">
                {/* Not logged in — FB webview: show inline signup form */}
                {!user && inEmbeddedBrowser && (
                  <button
                    onClick={() => setShowInlineSignup(true)}
                    className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all text-center"
                  >
                    Sign Up Free to Apply
                  </button>
                )}

                {/* Not logged in — Normal browser: OAuth signup */}
                {!user && !inEmbeddedBrowser && (
                  <button
                    onClick={() => handleApplySignup('google')}
                    className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all text-center"
                  >
                    Sign Up Free to Apply
                  </button>
                )}

                {/* Logged in — can apply */}
                {canApply && !showMobileApplySheet && (
                  <button
                    onClick={() => setShowMobileApplySheet(true)}
                    className="w-full py-3 px-4 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all text-center"
                  >
                    Apply Now
                  </button>
                )}

              </div>
            </div>

            {/* Skills hint for non-logged-in users */}
            {!user && !showInlineSignup && !showMobileApplySheet && listing.requiredSkills?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {listing.requiredSkills.slice(0, 3).map((skill: string, idx: number) => (
                  <span key={idx} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {skill}
                  </span>
                ))}
                {listing.requiredSkills.length > 3 && (
                  <span className="text-xs text-gray-400">+{listing.requiredSkills.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom spacer for mobile sticky bar — taller when signup/apply forms are open */}
      {showMobileBottomBar && (
        <div className={`lg:hidden ${showInlineSignup || showMobileApplySheet ? 'h-[420px]' : 'h-28'}`} />
      )}

      {listing.agent && showReportModal && (
        <Suspense fallback={null}>
          <ReportAgentModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            agentId={listing.agent.id}
            agentName={listing.agent.name}
          />
        </Suspense>
      )}
    </div>
  );
}
