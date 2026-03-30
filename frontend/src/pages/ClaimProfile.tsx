import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeLocalStorage } from '../lib/safeStorage';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Link from '../components/LocalizedLink';

interface ClaimPreview {
  name: string;
  description: string | null;
  location: string | null;
  category: string | null;
  website: string | null;
  listingType: string | null;
}

type ClaimState = 'loading' | 'preview' | 'form' | 'success' | 'expired' | 'claimed' | 'error';

export default function ClaimProfile() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ClaimState>('loading');
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('Invalid claim link');
      return;
    }

    fetch(`/api/claim/${token}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setPreview(data);
          setName(data.name || '');
          setState('preview');
        } else if (res.status === 410) {
          setState('expired');
        } else if (res.status === 400) {
          setState('claimed');
        } else {
          setState('error');
          setError('Listing not found');
        }
      })
      .catch(() => {
        setState('error');
        setError('Failed to load listing');
      });
  }, [token]);

  const handleClaim = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/claim/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, termsAccepted: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to claim profile');
        setSubmitting(false);
        return;
      }

      // Store auth token and redirect
      safeLocalStorage.setItem('token', data.token);
      setState('success');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  // --- Expired state ---
  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <SEO title="Claim Expired" noindex />
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Link Expired</h1>
          <p className="text-gray-600">This claim link has expired. The listing has been removed.</p>
          <Link to="/" className="inline-block text-blue-600 hover:text-blue-500">
            Go to Human Pages
          </Link>
        </div>
      </div>
    );
  }

  // --- Already claimed state ---
  if (state === 'claimed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <SEO title="Already Claimed" noindex />
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Already Claimed</h1>
          <p className="text-gray-600">This listing has already been claimed. If this is yours, please log in.</p>
          <Link to="/login" className="inline-block text-blue-600 hover:text-blue-500">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <SEO title="Claim Error" noindex />
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
          <p className="text-gray-600">{error || 'Unable to load this listing.'}</p>
          <Link to="/" className="inline-block text-blue-600 hover:text-blue-500">
            Go to Human Pages
          </Link>
        </div>
      </div>
    );
  }

  // --- Loading state ---
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SEO title="Claim Your Listing" noindex />
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // --- Success state ---
  if (state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <SEO title="Profile Claimed!" noindex />
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-green-500 text-5xl">&#10003;</div>
          <h1 className="text-2xl font-bold text-gray-900">Profile Claimed!</h1>
          <p className="text-gray-600">Your profile is now live. Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  // --- Preview + Claim Form ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <SEO title="Claim Your Listing" noindex />
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <h1><Link to="/"><Logo size="lg" /></Link></h1>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Claim Your Listing</h2>
          <p className="mt-2 text-gray-600">We found this listing for your business. Claim it to make it yours.</p>
        </div>

        {/* Preview Card */}
        {preview && (
          <div className="bg-white shadow rounded-lg p-6 space-y-3">
            <h3 className="text-xl font-semibold text-gray-900">{preview.name}</h3>
            {preview.location && (
              <p className="text-sm text-gray-500">{preview.location}</p>
            )}
            {preview.category && (
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                {preview.category}
              </span>
            )}
            {preview.description && (
              <p className="text-gray-700 text-sm">{preview.description}</p>
            )}
            {preview.website && (
              <p className="text-sm text-gray-500 truncate">{preview.website}</p>
            )}
          </div>
        )}

        {/* Claim Form */}
        {state === 'form' ? (
          <form className="bg-white shadow rounded-lg p-6 space-y-4" onSubmit={handleClaim}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Display Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                I accept the{' '}
                <a href="/terms" target="_blank" className="text-blue-600 hover:text-blue-500">
                  Terms of Use
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="text-blue-600 hover:text-blue-500">
                  Privacy Policy
                </a>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || !termsAccepted}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Claiming...' : 'Claim This Profile'}
            </button>

            <p className="text-center text-xs text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-500">
                Log in
              </Link>
            </p>
          </form>
        ) : (
          <button
            onClick={() => setState('form')}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Claim This Listing
          </button>
        )}

        <p className="text-center text-xs text-gray-400">
          Not your listing?{' '}
          <Link to="/" className="text-gray-500 hover:text-gray-700">
            Ignore this page
          </Link>
        </p>
      </div>
    </div>
  );
}
