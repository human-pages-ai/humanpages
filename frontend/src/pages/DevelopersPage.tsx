import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import SEO from '../components/SEO';

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <CopyButton text={code} />
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const MCP_CONFIG = `{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"],
      "env": {
        "API_BASE_URL": "https://api.humanpages.ai"
      }
    }
  }
}`;

const CLAUDE_CODE_INSTALL = `claude mcp add humanpages -- npx -y humanpages`;

const SEARCH_EXAMPLE = `// Search for photographers in NYC
const results = await mcp.callTool("search_humans", {
  skill: "photography",
  location: "New York",
  available_only: true
});

// Returns: name, contact, wallet addresses, services`;

const REST_SEARCH = `GET /api/humans/search?skill=photography&location=NYC&available=true

Response:
[
  {
    "id": "abc123",
    "name": "Jane Doe",
    "location": "New York, NY",
    "skills": ["photography", "videography"],
    "contactEmail": "jane@example.com",
    "telegram": "@janedoe",
    "wallets": [
      { "network": "ethereum", "address": "0x..." }
    ],
    "services": [
      { "title": "Event Photography", "priceRange": "$200-500" }
    ]
  }
]`;

const REST_GET_HUMAN = `GET /api/humans/:id

Response:
{
  "id": "abc123",
  "name": "Jane Doe",
  "bio": "Professional photographer with 10 years experience",
  "location": "New York, NY",
  "skills": ["photography", "videography", "editing"],
  "contactEmail": "jane@example.com",
  "telegram": "@janedoe",
  "isAvailable": true,
  "linkedinUrl": "https://linkedin.com/in/janedoe",
  "wallets": [...],
  "services": [...]
}`;

export default function DevelopersPage() {
  const { t } = useTranslation();
  const [showRestApi, setShowRestApi] = useState(false);

  const scrollToInstall = () => {
    document.getElementById('install')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="API & MCP Server"
        description="Integrate Human Pages into your AI agent. Install the MCP server or use the REST API to search humans by skill and location."
        canonical="https://humanpages.ai/dev"
        path="/dev"
      />
      <SEO
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Human Pages MCP Server",
          "applicationCategory": "DeveloperApplication",
          "operatingSystem": "Cross-platform",
          "description": "MCP server for AI agents to search and hire humans for real-world tasks",
          "url": "https://humanpages.ai/dev",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          }
        }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">
              {t('nav.humans')}
            </Link>
            <Link to="/dev" className="text-sm font-medium text-slate-900">
              {t('nav.developers')}
            </Link>
            <LanguageSwitcher />
            <Link
              to="/signup?utm_source=dev_page"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('nav.startProfile')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-16 md:py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-blue-600 font-medium mb-2">For AI Agents & Developers</p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
            Find humans for<br />real-world tasks
          </h1>
          <p className="mt-4 text-xl text-slate-600">
            Human Pages is a directory of real people for real-world tasks.
            Install the MCP server (or call the REST API) and your agent can search humans by skill and location.
          </p>
          <div className="mt-8 flex gap-4">
            <button
              onClick={scrollToInstall}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Install MCP Server
            </button>
            <a
              href="#tools"
              className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              View Tools
            </a>
          </div>
        </div>
      </section>

      {/* Install Section */}
      <section id="install" className="py-16 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
            Install via MCP
          </h2>

          {/* Option A: .mcp.json */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Option A: Add to .mcp.json (recommended)
            </h3>
            <p className="text-slate-600 mb-4">
              Add this to your project's <code className="bg-slate-200 px-1 rounded">.mcp.json</code> file:
            </p>
            <CodeBlock code={MCP_CONFIG} />
          </div>

          {/* Option B: Claude Code CLI */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Option B: Claude Code CLI
            </h3>
            <p className="text-slate-600 mb-4">
              Or add directly via the Claude Code CLI:
            </p>
            <CodeBlock code={CLAUDE_CODE_INSTALL} />
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
            Available Tools
          </h2>

          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">search_humans</h3>
              <p className="text-slate-600 mt-1">
                Search for humans by skill, location, and availability. Returns contact info and wallet addresses.
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">Parameters:</span> skill, location, available_only
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">get_human</h3>
              <p className="text-slate-600 mt-1">
                Get detailed profile for a specific human including bio, services, and social profiles.
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">Parameters:</span> id (required)
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">record_job</h3>
              <p className="text-slate-600 mt-1">
                Record that a task has been assigned (for analytics and reputation building).
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">Parameters:</span> human_id, task_description, task_category, agreed_price
              </div>
            </div>
          </div>

          {/* Usage Example */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Example Usage</h3>
            <CodeBlock code={SEARCH_EXAMPLE} />
          </div>
        </div>
      </section>

      {/* REST API Section (Accordion) */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setShowRestApi(!showRestApi)}
            className="w-full flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
          >
            <span className="font-semibold text-slate-900">Prefer HTTP? REST API Reference</span>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${showRestApi ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showRestApi && (
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Search Humans</h3>
                <CodeBlock code={REST_SEARCH} />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Get Human by ID</h3>
                <CodeBlock code={REST_GET_HUMAN} />
              </div>

              <p className="text-sm text-slate-500">
                Base URL: <code className="bg-slate-200 px-1 rounded">https://api.humanpages.ai</code>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
            How it works
          </h2>

          <div className="grid gap-4">
            <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Discovery only</h3>
                <p className="text-slate-600 text-sm">No escrow, no custody. We connect you with humans—you handle the rest.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Direct contact</h3>
                <p className="text-slate-600 text-sm">No platform messaging. Humans share their email, WhatsApp, or Telegram for direct communication.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Peer-to-peer payments</h3>
                <p className="text-slate-600 text-sm">Platform never touches funds. Pay via their payment link, wallet, or preferred method.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Need humans in your directory?
          </h2>
          <p className="mt-2 text-blue-100">
            Share the signup link with your community to grow the supply.
          </p>
          <Link
            to="/signup?utm_source=dev_page&utm_medium=cta"
            className="mt-6 inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
          >
            {t('nav.startProfile')}
          </Link>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-slate-200 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-slate-500 text-sm">{t('landing.footer.copyright')}</span>
          <div className="flex gap-6 text-sm">
            <Link to="/privacy" className="text-slate-500 hover:text-slate-700">{t('landing.footer.privacy')}</Link>
            <Link to="/terms" className="text-slate-500 hover:text-slate-700">{t('landing.footer.terms')}</Link>
            <Link to="/dev" className="text-slate-500 hover:text-slate-700">{t('landing.footer.api')}</Link>
            <a href="https://facebook.com/humanpages" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-700">{t('landing.footer.contact')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
