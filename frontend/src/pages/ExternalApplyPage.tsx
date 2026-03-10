import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../components/SEO';
import Logo from '../components/Logo';
import Footer from '../components/Footer';

interface PostingData {
  id: string;
  title: string;
  description: string;
  suggestedSkills: string[];
  suggestedLocation: string | null;
  suggestedEquipment: string[];
  createdAt: string;
}

type PageState = 'loading' | 'ready' | 'submitting' | 'submitted' | 'error' | 'closed';

export default function ExternalApplyPage() {
  const { magicToken } = useParams<{ magicToken: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [posting, setPosting] = useState<PostingData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pitch, setPitch] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!magicToken) return;

    fetch(`/api/concierge-postings/public/${magicToken}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setPosting(data);
          setPageState('ready');
        } else if (res.status === 410) {
          const data = await res.json();
          setErrorMessage(data.message || 'This posting is no longer available.');
          setPageState('closed');
        } else {
          setErrorMessage('Posting not found.');
          setPageState('error');
        }
      })
      .catch(() => {
        setErrorMessage('Failed to load posting. Please try again.');
        setPageState('error');
      });
  }, [magicToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !email.trim() || !pitch.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (pitch.trim().length < 10) {
      setFormError('Please write a bit more about yourself (at least 10 characters).');
      return;
    }

    setPageState('submitting');

    try {
      const res = await fetch(`/api/concierge-postings/public/${magicToken}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          pitch: pitch.trim(),
          portfolioUrl: portfolioUrl.trim() || undefined,
          website: website || undefined, // Honeypot
        }),
      });

      if (res.ok) {
        setPageState('submitted');
      } else {
        const data = await res.json();
        setFormError(data.error || data.message || 'Something went wrong. Please try again.');
        setPageState('ready');
      }
    } catch {
      setFormError('Network error. Please check your connection and try again.');
      setPageState('ready');
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (pageState === 'error' || pageState === 'closed') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <SEO title="Posting Not Available" />
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">{pageState === 'closed' ? '🔒' : '🔍'}</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {pageState === 'closed' ? 'Posting Closed' : 'Posting Not Found'}
            </h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <Link
              to="/"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Visit Humans.com
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (pageState === 'submitted') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <SEO title="Application Submitted" />
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Application Submitted!</h1>
            <p className="text-gray-600 mb-6">
              Thanks for your interest! We'll review your application and get back to you soon.
              Check your email for a confirmation.
            </p>
            <Link
              to="/signup"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create an Account for More Opportunities
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SEO title={posting ? `Apply: ${posting.title}` : 'Apply'} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
        </Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {posting && (
          <>
            {/* Posting Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{posting.title}</h1>

              {/* Context badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {posting.suggestedLocation && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-700">
                    📍 {posting.suggestedLocation}
                  </span>
                )}
                {posting.suggestedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700"
                  >
                    {skill}
                  </span>
                ))}
                {posting.suggestedEquipment.map((eq) => (
                  <span
                    key={eq}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-50 text-green-700"
                  >
                    🔧 {eq}
                  </span>
                ))}
              </div>

              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{posting.description}</p>
            </div>

            {/* Application Form */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Apply for this opportunity</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot — hidden from humans, bots fill it */}
                <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Your full name"
                    required
                    maxLength={100}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your@email.com"
                    required
                    maxLength={254}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+1 (555) 123-4567"
                    maxLength={30}
                  />
                </div>

                <div>
                  <label htmlFor="pitch" className="block text-sm font-medium text-gray-700 mb-1">
                    Tell us about yourself <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="pitch"
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
                    placeholder="Brief intro: your experience, why you're interested, and your availability..."
                    required
                    maxLength={1000}
                  />
                  <div className="text-xs text-gray-400 mt-1 text-right">{pitch.length}/1000</div>
                </div>

                <div>
                  <label htmlFor="portfolioUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Portfolio / Work Samples <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="portfolioUrl"
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://your-portfolio.com"
                    maxLength={500}
                  />
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>
                )}

                <button
                  type="submit"
                  disabled={pageState === 'submitting'}
                  className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {pageState === 'submitting' ? 'Submitting...' : 'Submit Application'}
                </button>
              </form>

              <p className="text-xs text-gray-400 mt-4 text-center">
                By applying, you agree to our{' '}
                <Link to="/terms" className="underline">Terms</Link> and{' '}
                <Link to="/privacy" className="underline">Privacy Policy</Link>.
              </p>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
