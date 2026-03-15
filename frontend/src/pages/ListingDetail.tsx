import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { setListingApplyIntent } from '../lib/applyIntent';
import { analytics } from '../lib/analytics';
import { posthog } from '../lib/posthog';
import InlineSignupForm from '../components/InlineSignupForm';

// Lazy-load ReportAgentModal — only downloaded when a logged-in user clicks "Report"
const ReportAgentModal = lazy(() => import('../components/ReportAgentModal'));
import SEO from '../components/SEO';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Listing } from '../components/dashboard/types';
import Footer from '../components/Footer';
import { safeLocalStorage, safeSessionStorage } from '../lib/safeStorage';

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
  const params = useParams<{ id?: string; code?: string }>();
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
  const desktopApplyRef = useRef<HTMLDivElement>(null);
  const hasShownWelcomeToast = useRef(false);

  // Resolved listing ID — either from URL directly (/listings/:id) or resolved from short code (/work/:code)
  const [resolvedId, setResolvedId] = useState<string | undefined>(params.id || undefined);
  // Short link code for analytics tracking (only set when accessed via /work/:code)
  const [linkCode, setLinkCode] = useState<string | undefined>(params.code || undefined);
  const id = resolvedId;

  // Controls visibility of mobile slide-up signup form
  const [showInlineSignup, setShowInlineSignup] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Track whether short code resolution failed (invalid/expired code)
  const [codeNotFound, setCodeNotFound] = useState(false);

  // Resolve short code to listing ID on mount
  useEffect(() => {
    if (params.code && !resolvedId) {
      const normalizedCode = params.code.toLowerCase();
      api.resolveListingCode(normalizedCode).then(({ listingId, code }: { listingId: string; code: string }) => {
        setResolvedId(listingId);
        setLinkCode(code);
        // Persist ref immediately so it survives signup redirect even if listing fetch fails
        safeSessionStorage.setItem('hp_listing_ref', code);
      }).catch(() => {
        setCodeNotFound(true);
        setLoading(false);
      });
    }
  }, [params.code]);

  /** Called by InlineSignupForm after email signup (validation + captcha already handled by the form). */
  const handleEmailSignup = async (data: { name: string; email: string; password: string; captchaToken: string }) => {
    const ref = linkCode || safeSessionStorage.getItem('hp_listing_ref') || undefined;
    // Save listing intent before signup so it persists
    if (listing) setListingApplyIntent(id!, listing.title, listing.requiredSkills);
    await signup(data.email, data.password, data.name, true, data.captchaToken);
    analytics.track('listing_signup_clicked', { listingId: id, method: 'email', title: listing?.title, budget: listing?.budgetUsdc, ref });
    posthog.capture('listing_signup_clicked', { listingId: id, method: 'email', title: listing?.title, budget: listing?.budgetUsdc, ref });
    // Save skills from listing to profile (non-blocking)
    if (listing?.requiredSkills?.length) {
      api.updateProfile({ skills: listing.requiredSkills }).catch(() => {});
    }
    safeLocalStorage.setItem('hp_onboarding_pending', '1');
    // Reload the page so the user state refreshes
    window.location.href = `/listings/${id}?signedup=1${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`;
  };

  const handleShare = async () => {
    // If accessed via short link, share the short URL; otherwise share the current page URL
    const url = linkCode ? `https://humanpages.ai/work/${linkCode}` : id ? `https://humanpages.ai/listings/${id}` : window.location.href;
    const shareTitle = listing ? `${listing.title} — $${listing.budgetUsdc}${listing.budgetFlexible ? '+' : ''} | Human Pages` : 'Human Pages Listing';
    let shared = false;

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url });
        shared = true;
      } catch {
        // User cancelled — not a failure, just don't track
      }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
        shared = true;
      } catch {
        // Clipboard API not available (e.g. non-HTTPS, permission denied)
        toast.error('Could not copy link. Try copying from the address bar.');
      }
    }

    if (shared) {
      analytics.track('listing_share', { listingId: id, title: listing?.title });
      posthog.capture('listing_share', { listingId: id, title: listing?.title });
    }
  };

  useEffect(() => {
    if (resolvedId) {
      loadListing();
    }
  }, [resolvedId]);

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
      const ref = linkCode || searchParams.get('ref') || undefined;
      // Persist ref to sessionStorage so it survives signup redirect
      if (ref) safeSessionStorage.setItem('hp_listing_ref', ref);
      analytics.track('listing_viewed', { listingId: id, title: data.title, budget: data.budgetUsdc, utm_source: utmSource, ref });
      posthog.capture('listing_viewed', { listingId: id, title: data.title, budget: data.budgetUsdc, utm_source: utmSource, ref });
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
    const ref = linkCode || safeSessionStorage.getItem('hp_listing_ref') || undefined;
    // Funnel step 2: signup button clicked
    analytics.track('listing_signup_clicked', { listingId: id, method, title: listing.title, budget: listing.budgetUsdc, ref });
    posthog.capture('listing_signup_clicked', { listingId: id, method, title: listing.title, budget: listing.budgetUsdc, ref });
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

  if (codeNotFound || !listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">{codeNotFound ? 'This link is no longer active' : 'Listing not found'}</p>
        <Link to="/listings" className="text-blue-600 hover:text-blue-800">
          Browse available listings
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
    <div ref={desktopApplyRef} className="sticky top-6 bg-white rounded-lg shadow p-6">
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
                {t(`skillNames.${skill}`, skill)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Not logged in — signup options */}
      {!user && !isClosed && (
        <InlineSignupForm
          mode={inEmbeddedBrowser ? 'email-primary' : 'oauth-primary'}
          onEmailSignup={handleEmailSignup}
          onGoogleSignup={() => handleApplySignup('google')}
          onLinkedInSignup={inEmbeddedBrowser ? undefined : () => handleApplySignup('linkedin')}
          embeddedBrowser={inEmbeddedBrowser}
        />
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
        ogImage={`https://humanpages.ai/api/og/listing/${listing.id}`}
        ogType="website"
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
                onClick={() => {
                  if (!inEmbeddedBrowser) {
                    handleApplySignup('google');
                  } else {
                    // Mobile: open slide-up form. Desktop: scroll to sidebar form.
                    setShowInlineSignup(true);
                    desktopApplyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
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

              {/* Title + Share */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 min-w-0 break-words">
                  {listing.title}
                </h1>
                <button
                  onClick={handleShare}
                  disabled={loading || !listing}
                  aria-label={shareCopied ? 'Link copied to clipboard' : 'Share this listing'}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Share this listing"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  {shareCopied ? 'Copied!' : 'Share'}
                </button>
              </div>

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
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed break-words">
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
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed break-words">
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
                          {t(`skillNames.${skill}`, skill)}
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
                    <p className="text-gray-800 break-words">
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

          {/* Slide-up inline signup form (mobile — all browsers) */}
          {showInlineSignup && !user && (
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
              <InlineSignupForm
                mode={inEmbeddedBrowser ? 'email-primary' : 'oauth-primary'}
                onEmailSignup={handleEmailSignup}
                onGoogleSignup={() => handleApplySignup('google')}
                onLinkedInSignup={inEmbeddedBrowser ? undefined : () => handleApplySignup('linkedin')}
                autoFocus
                compact
                embeddedBrowser={inEmbeddedBrowser}
              />
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

                {/* Not logged in — Normal browser: open signup form */}
                {!user && !inEmbeddedBrowser && (
                  <button
                    onClick={() => setShowInlineSignup(true)}
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
                    {t(`skillNames.${skill}`, skill)}
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
