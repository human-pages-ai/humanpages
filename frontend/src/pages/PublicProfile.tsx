import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

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
  wallets: Wallet[];
  services: Service[];
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicHuman | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    api.getHumanById(id)
      .then(setProfile)
      .catch((err) => setError(err.message || 'Profile not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.name ? `${profile.name} on Humans` : 'Humans Profile',
          url,
        });
      } catch {
        // User cancelled or share failed, fall back to copy
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
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'This profile does not exist.'}</p>
          <Link to="/" className="text-indigo-600 hover:text-indigo-500">
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold">Humans</Link>
          <Link
            to="/login"
            className="text-indigo-600 hover:text-indigo-500 text-sm"
          >
            Sign in
          </Link>
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  {profile.isAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Bio */}
            {profile.bio && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
                <p className="text-gray-600">{profile.bio}</p>
              </div>
            )}

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Skills</h2>
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
            )}

            {/* Services */}
            {profile.services && profile.services.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Services</h2>
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
            )}

            {/* Contact */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact</h2>
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

            {/* Wallets */}
            {profile.wallets && profile.wallets.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Payment Wallets</h2>
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
                  href={`mailto:${profile.contactEmail}?subject=Inquiry from Humans`}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact
                </a>
              )}
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
