import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import SEO from '../components/SEO';

interface Wallet {
  network: string;
  address: string;
  label?: string;
}

interface Service {
  title: string;
  description: string;
  category: string;
  priceRange?: string;
}

interface PublicHuman {
  id: string;
  name: string;
  bio?: string;
  location?: string;
  skills: string[];
  contactEmail?: string;
  telegram?: string;
  isAvailable: boolean;
  paymentPreference?: 'ESCROW' | 'UPFRONT' | 'BOTH';
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  wallets: Wallet[];
  services: Service[];
}

export default function PublicProfile() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicHuman | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    api.getHumanById(id)
      .then((data) => {
        setProfile(data);
        analytics.track('profile_view', { profileId: id });
      })
      .catch((err) => setError(err.message || t('errors.notFound')))
      .finally(() => setLoading(false));
  }, [id, t]);

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.name ? `${profile.name} on Human Pages` : 'Human Pages Profile',
          url,
        });
      } catch {
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('errors.notFound')}</h1>
          <p className="text-gray-600 mb-4">{error || t('errors.notFound')}</p>
          <Link to="/" className="text-indigo-600 hover:text-indigo-500">
            {t('nav.home')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={profile.name}
        description={profile.bio || `${profile.name} on Human Pages - ${profile.skills.slice(0, 3).join(', ')}`}
        canonical={`https://humanpages.ai/humans/${id}`}
        ogImage={`https://humanpages.ai/api/og/${id}`}
        ogType="profile"
        path={`/humans/${id}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Person",
          "name": profile.name,
          "description": profile.bio,
          "url": `https://humanpages.ai/humans/${id}`,
          ...(profile.location && { "address": { "@type": "PostalAddress", "addressLocality": profile.location } }),
          ...(profile.skills.length > 0 && { "knowsAbout": profile.skills }),
          ...(profile.services.length > 0 && {
            "makesOffer": profile.services.map(s => ({
              "@type": "Offer",
              "itemOffered": {
                "@type": "Service",
                "name": s.title,
                "description": s.description,
                ...(s.category && { "category": s.category }),
              },
              ...(s.priceRange && { "priceSpecification": { "@type": "PriceSpecification", "price": s.priceRange } }),
            }))
          })
        }}
      />
      <nav className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link
              to="/login"
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {t('auth.signIn')}
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 px-6 py-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
                {profile.location && (
                  <p className="text-indigo-200 mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {profile.location}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    profile.isAvailable
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {profile.isAvailable ? t('publicProfile.available') : t('publicProfile.unavailable')}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Bio */}
            {profile.bio && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('dashboard.profile.bio')}</h2>
                <p className="text-gray-600">{profile.bio}</p>
              </div>
            )}

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 ? (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('dashboard.profile.skills')}</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('dashboard.profile.skills')}</h2>
                <p className="text-gray-500 text-sm">{t('publicProfile.noSkills')}</p>
              </div>
            )}

            {/* Payment Preference */}
            {profile.paymentPreference && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('publicProfile.paymentPreference')}</h2>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                  profile.paymentPreference === 'UPFRONT'
                    ? 'bg-amber-100 text-amber-700'
                    : profile.paymentPreference === 'ESCROW'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {t(`dashboard.paymentPreference.${profile.paymentPreference.toLowerCase()}`)}
                </span>
              </div>
            )}

            {/* Services */}
            {profile.services && profile.services.length > 0 ? (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.services.title')}</h2>
                <div className="space-y-3">
                  {profile.services.map((service, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{service.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                        </div>
                        {service.priceRange && (
                          <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded">
                            {service.priceRange}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 mt-2 inline-block">
                        {service.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.services.title')}</h2>
                <p className="text-gray-500 text-sm">{t('publicProfile.noServices')}</p>
              </div>
            )}

            {/* Contact */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('publicProfile.contactInfo')}</h2>
              <div className="space-y-2">
                {profile.contactEmail && (
                  <a
                    href={`mailto:${profile.contactEmail}`}
                    className="flex items-center gap-2 text-gray-600 hover:text-indigo-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {profile.contactEmail}
                  </a>
                )}
                {profile.telegram && (
                  <a
                    href={`https://t.me/${profile.telegram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-600 hover:text-indigo-600"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.234.169.337.015.102.034.331.019.51z"/>
                    </svg>
                    {profile.telegram}
                  </a>
                )}
              </div>
            </div>

            {/* Social Profiles */}
            {(profile.linkedinUrl || profile.twitterUrl || profile.githubUrl ||
              profile.instagramUrl || profile.youtubeUrl || profile.websiteUrl) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.profile.socialProfiles')}</h2>
                <div className="flex flex-wrap gap-3">
                  {profile.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      {t('dashboard.profile.linkedin')}
                    </a>
                  )}
                  {profile.twitterUrl && (
                    <a
                      href={profile.twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      {t('dashboard.profile.twitter')}
                    </a>
                  )}
                  {profile.githubUrl && (
                    <a
                      href={profile.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      {t('dashboard.profile.github')}
                    </a>
                  )}
                  {profile.instagramUrl && (
                    <a
                      href={profile.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      {t('dashboard.profile.instagram')}
                    </a>
                  )}
                  {profile.youtubeUrl && (
                    <a
                      href={profile.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      {t('dashboard.profile.youtube')}
                    </a>
                  )}
                  {profile.websiteUrl && (
                    <a
                      href={profile.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                      </svg>
                      {t('dashboard.profile.website')}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Wallets */}
            {profile.wallets && profile.wallets.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.wallets.title')}</h2>
                <div className="space-y-2">
                  {profile.wallets.map((wallet, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm capitalize">{wallet.network}</span>
                        {wallet.label && (
                          <span className="text-xs text-gray-500">{wallet.label}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-mono mt-1 break-all">
                        {wallet.address}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              {profile.contactEmail && (
                <a
                  href={`mailto:${profile.contactEmail}?subject=Inquiry from Human Pages`}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {t('publicProfile.hireMe')}
                </a>
              )}
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {copied ? t('common.copied') : 'Share'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
