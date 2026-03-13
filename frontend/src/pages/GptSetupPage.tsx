import { useState, useEffect } from 'react';
import Link from '../components/LocalizedLink';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Footer from '../components/Footer';

// ---------------------------------------------------------------------------
// Inline clipboard utility (InAppBrowserBanner only exports its default)
// ---------------------------------------------------------------------------

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / in-app webviews
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// CopyButton — 44px min touch target per WCAG 2.5.5
// ---------------------------------------------------------------------------

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied to clipboard' : `Copy ${label}`}
      className={`px-3 py-2 text-xs font-medium rounded transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
        copied
          ? 'bg-green-500 text-white'
          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
      }`}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// FAQItem — accessible accordion with ARIA
// ---------------------------------------------------------------------------

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
  id,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  id: string;
}) {
  const headingId = `faq-heading-${id}`;
  const panelId = `faq-panel-${id}`;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden transition-all">
      <button
        id={headingId}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors text-left min-h-[48px]"
      >
        <span className="font-semibold text-slate-900">{question}</span>
        <svg
          className={`w-5 h-5 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-slate-600"
        >
          {answer}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG illustrations with accessible titles
// ---------------------------------------------------------------------------

function SettingsGearSVG() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900" role="img" aria-label="Settings gear illustration">
      <title>Settings gear</title>
      <defs>
        <style>{`
          @keyframes rotate-gear {
            from { transform: rotate(0deg); transform-origin: 50px 30px; }
            to { transform: rotate(360deg); transform-origin: 50px 30px; }
          }
          .gear { animation: rotate-gear 6s linear infinite; }
          @media (prefers-reduced-motion: reduce) {
            .gear { animation: none; }
          }
        `}</style>
      </defs>
      <g className="gear">
        <rect x="45" y="2" width="10" height="12" fill="currentColor" />
        <rect x="73" y="13" width="12" height="10" transform="rotate(45 79 18)" fill="currentColor" />
        <rect x="82" y="45" width="12" height="10" fill="currentColor" />
        <rect x="73" y="73" width="12" height="10" transform="rotate(45 79 78)" fill="currentColor" />
        <rect x="45" y="86" width="10" height="12" fill="currentColor" />
        <rect x="15" y="73" width="12" height="10" transform="rotate(45 21 78)" fill="currentColor" />
        <rect x="6" y="45" width="12" height="10" fill="currentColor" />
        <rect x="15" y="13" width="12" height="10" transform="rotate(45 21 18)" fill="currentColor" />
        <circle cx="50" cy="50" r="18" fill="currentColor" />
        <circle cx="50" cy="50" r="12" fill="white" />
      </g>
      <g transform="translate(50, 70)">
        <rect x="-20" y="-6" width="40" height="12" rx="6" fill="#e2e8f0" />
        <circle cx="10" cy="0" r="5" fill="#2563eb" />
      </g>
    </svg>
  );
}

function ConnectorPlugSVG() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full text-blue-600" role="img" aria-label="Connector plug illustration">
      <title>Connector plug</title>
      <rect x="20" y="10" width="6" height="30" fill="currentColor" />
      <rect x="38" y="10" width="6" height="30" fill="currentColor" />
      <rect x="56" y="10" width="6" height="30" fill="currentColor" />
      <rect x="74" y="10" width="6" height="30" fill="currentColor" />
      <rect x="16" y="35" width="68" height="16" rx="4" fill="currentColor" />
      <g fill="white">
        <rect x="22" y="52" width="4" height="28" rx="2" />
        <rect x="40" y="52" width="4" height="28" rx="2" />
        <rect x="58" y="52" width="4" height="28" rx="2" />
        <rect x="76" y="52" width="4" height="28" rx="2" />
      </g>
      <line x1="50" y1="80" x2="50" y2="90" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="95" r="3" fill="currentColor" />
    </svg>
  );
}

function ChatBubbleSVG() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label="Chat bubble illustration">
      <title>Chat bubble</title>
      <defs>
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-4px); }
          }
          .sparkle { animation: float 3s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .sparkle { animation: none; }
          }
        `}</style>
      </defs>
      <path d="M 15 15 L 85 15 L 85 65 L 25 65 L 15 80 L 20 65 L 15 65 Z" fill="#2563eb" />
      <g className="sparkle">
        <circle cx="35" cy="35" r="2" fill="#f97316" />
        <circle cx="35" cy="25" r="2" fill="#f97316" />
        <circle cx="35" cy="45" r="2" fill="#f97316" />
      </g>
      <g className="sparkle" style={{ animationDelay: '0.5s' }}>
        <circle cx="70" cy="40" r="2" fill="#f97316" />
        <circle cx="60" cy="40" r="2" fill="#f97316" />
        <circle cx="80" cy="40" r="2" fill="#f97316" />
      </g>
      <circle cx="45" cy="40" r="3" fill="white" opacity="0.7" />
      <circle cx="55" cy="40" r="3" fill="white" opacity="0.7" />
      <circle cx="65" cy="40" r="3" fill="white" opacity="0.7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ToolCard
// ---------------------------------------------------------------------------

function ToolCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-all hover:shadow-md">
      <div className="w-12 h-12 mb-4 text-blue-600">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GptSetupPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.step-card').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const faqs = [
    {
      question: 'Is this free?',
      answer:
        'Yes, during our launch period. First 100 agents get free PRO access to Human Pages with unlimited tool use, advanced filtering, and unlimited job offers.',
    },
    {
      question: 'What tools are available?',
      answer:
        'Over 31 tools including search by skill and location, post job listings, send offers to humans, manage payments, browse freelancer profiles, and track ongoing jobs in real-time.',
    },
    {
      question: 'Do I need coding skills?',
      answer:
        'No. Just enable Developer Mode in GPT settings, add the Human Pages connector URL, and authorize. Then start typing prompts like "Find a photographer in Tokyo" and GPT handles the rest.',
    },
    {
      question: 'What about Claude, Cursor, or other AI agents?',
      answer:
        'Head to our /dev page for instructions on connecting Human Pages to Claude Code, Cursor, and other AI development tools using the MCP protocol.',
    },
  ];

  const toolCards = [
    {
      title: 'Search Humans',
      description: 'Find freelancers by skill, location, and availability. Browse verified profiles with ratings and reviews.',
    },
    {
      title: 'Post Listings',
      description: 'Create job postings with budget, requirements, and timeline. Humans apply and bid on your tasks.',
    },
    {
      title: 'Send Job Offers',
      description: 'Target specific humans directly. Make personalized offers with custom terms and compensation.',
    },
    {
      title: 'Manage Payments',
      description: 'Process payments in USDC on Ethereum. Escrow protects both you and the human.',
    },
    {
      title: 'Browse Talent',
      description: 'Explore our catalog of verified freelancers. Filter by skills, rates, location, and availability.',
    },
    {
      title: 'Track Jobs',
      description: 'Monitor job progress in real-time. Message humans, review work, and manage disputes.',
    },
  ];

  const examplePrompts = [
    'Find a photographer in Tokyo available this weekend for a photo shoot',
    'Post a job listing for a delivery driver in Miami, $25/hour, 20 hours per week',
    'Search for web developers with React and Node.js skills in Berlin, willing to work part-time',
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
          50% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        .gradient-bg {
          background: linear-gradient(-45deg, #2563eb, #7c3aed, #2563eb);
          background-size: 400% 400%;
          animation: gradient 15s ease infinite;
        }
        .pulse-button {
          animation: pulse-glow 2s infinite;
        }
        .step-card {
          opacity: 0;
        }
        /* CSS-only fallback: make step cards visible after 2s even without JS */
        @supports (animation: none) {
          .step-card { animation: fadeInUp 0.6s ease-out 2s forwards; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up,
          .gradient-bg,
          .pulse-button,
          .step-card {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      <SEO
        title="Connect Human Pages to GPT"
        description="Give GPT the ability to hire real people. Set up the Human Pages connector in GPT in under 2 minutes. Search freelancers, post jobs, and manage payments."
        path="/gpt-setup"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-700 whitespace-nowrap">
              Home
            </Link>
            <Link to="/dev" className="text-sm text-slate-500 hover:text-slate-700 whitespace-nowrap">
              Developers
            </Link>
            <LanguageSwitcher />
            <Link
              to="/signup?utm_source=gpt_setup"
              className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors whitespace-nowrap"
            >
              Start Now
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 md:py-32 px-4">
          <div className="absolute inset-0 gradient-bg opacity-10 -z-10" />

          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-6 px-4 py-2 bg-blue-50 rounded-full border border-blue-200">
              <span className="text-sm font-semibold text-blue-700">Works with GPT 5.3 + Agent Mode</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Connect Human Pages to GPT
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 mb-8 max-w-2xl mx-auto">
              Give GPT the ability to hire real people. Search freelancers by skill, post jobs, send offers, and manage payments — all from natural language prompts.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#setup"
                className="px-8 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-all pulse-button shadow-lg"
              >
                Start Setup (2 min)
              </a>
              <a
                href="#faq"
                className="px-8 py-4 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>

        {/* Prerequisites Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">Prerequisites</h2>

            <div className="grid gap-4">
              {[
                {
                  icon: '✓',
                  text: 'GPT Pro, Plus, Business, Enterprise, or Education account',
                },
                {
                  icon: '✓',
                  text: 'Developer Mode enabled in GPT settings',
                },
                {
                  icon: '✓',
                  text: (
                    <>
                      A Human Pages agent API key (
                      <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                        register here
                      </Link>
                      )
                    </>
                  ),
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold flex-shrink-0 text-sm">
                    {item.icon}
                  </div>
                  <span className="text-slate-700 font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Step-by-Step Guide */}
        <section id="setup" className="py-20 px-4 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">3-Step Setup Guide</h2>

            {/* Step 1 */}
            <div className="step-card mb-8 grid md:grid-cols-2 gap-8 items-center bg-white rounded-2xl p-8 border border-slate-200">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                    1
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Enable Developer Mode</h3>
                </div>

                <p className="text-slate-600 mb-6">
                  Open GPT Settings → Apps → Advanced settings → Enable Developer Mode. This unlocks the ability to add custom MCP connectors.
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Path:</strong> Settings → Apps → Advanced settings → Enable Developer Mode
                  </p>
                </div>
              </div>

              <div className="w-full h-64 md:h-full">
                <SettingsGearSVG />
              </div>
            </div>

            {/* Step 2 */}
            <div className="step-card mb-8 grid md:grid-cols-2 gap-8 items-center bg-white rounded-2xl p-8 border border-slate-200">
              <div className="w-full h-64 md:h-full order-2 md:order-1">
                <ConnectorPlugSVG />
              </div>

              <div className="order-1 md:order-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                    2
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Add Human Pages Connector</h3>
                </div>

                <p className="text-slate-600 mb-6">
                  Go to Settings → Connectors → Create. Fill in the information below:
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">Name</label>
                    <div className="flex items-center gap-2 bg-slate-100 p-3 rounded-lg">
                      <code className="flex-1 text-slate-700 font-mono text-sm">Human Pages</code>
                      <CopyButton text="Human Pages" label="Copy" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">Description</label>
                    <div className="flex items-start gap-2">
                      <code className="flex-1 text-slate-700 font-mono text-xs bg-slate-100 p-3 rounded-lg break-words">
                        Search, hire, and pay real humans for physical tasks. Browse freelancers by skill and location, post job listings, send offers, and manage payments.
                      </code>
                      <CopyButton
                        text="Search, hire, and pay real humans for physical tasks. Browse freelancers by skill and location, post job listings, send offers, and manage payments."
                        label="Copy"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">URL</label>
                    <div className="flex items-center gap-2 bg-slate-100 p-3 rounded-lg">
                      <code className="flex-1 text-blue-600 font-mono text-sm break-all">https://mcp.humanpages.ai/api/mcp</code>
                      <CopyButton text="https://mcp.humanpages.ai/api/mcp" label="Copy" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">Authentication</label>
                    <div className="bg-slate-100 p-3 rounded-lg">
                      <code className="text-slate-700 font-mono text-sm">OAuth</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="step-card grid md:grid-cols-2 gap-8 items-center bg-white rounded-2xl p-8 border border-slate-200">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                    3
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Authorize & Test</h3>
                </div>

                <p className="text-slate-600 mb-6">
                  Click the "Connect" button next to Human Pages. Sign in with your agent API key, then authorize the connection. Now you're ready to use it!
                </p>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-900">
                    <strong>Next:</strong> Try one of these prompts to test →
                  </p>
                </div>

                <div className="space-y-2">
                  {examplePrompts.map((prompt, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-start gap-2"
                    >
                      <p className="text-sm text-slate-800 flex-1">{prompt}</p>
                      <CopyButton text={prompt} label="Copy" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full h-64 md:h-full">
                <ChatBubbleSVG />
              </div>
            </div>
          </div>
        </section>

        {/* What You Can Do */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">What You Can Do</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {toolCards.map((card, idx) => (
                <div key={idx} className="animate-fade-in-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <ToolCard
                    icon={
                      idx === 0 ? (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      ) : idx === 1 ? (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      ) : idx === 2 ? (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : idx === 3 ? (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      ) : idx === 4 ? (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      ) : (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      )
                    }
                    title={card.title}
                    description={card.description}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-20 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Frequently Asked Questions</h2>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <FAQItem
                  key={idx}
                  id={String(idx)}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openFAQ === idx}
                  onToggle={() => setOpenFAQ(openFAQ === idx ? null : idx)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-violet-600">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Connect?</h2>
            <p className="text-xl text-blue-100 mb-8">
              You're just 2 minutes away from giving GPT the power to hire real people.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#setup"
                className="px-8 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Go to Setup
              </a>
              <Link
                to="/signup?utm_source=gpt_setup_cta"
                className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
              >
                Create Agent Account
              </Link>
            </div>

            <p className="text-sm text-blue-100 mt-6">
              Questions? Join our{' '}
              <a href="https://discord.gg/humanpages" className="text-white underline hover:no-underline">
                Discord community
              </a>
            </p>
          </div>
        </section>

        {/* Alt Platforms Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Using a Different AI Platform?</h3>
            <p className="text-slate-600 mb-6">
              We support Claude Code, Cursor, and other AI development tools through the MCP protocol.
            </p>
            <Link
              to="/dev"
              className="inline-block px-6 py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
            >
              View Developer Setup
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
