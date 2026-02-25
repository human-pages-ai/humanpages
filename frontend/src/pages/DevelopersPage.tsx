import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Footer from '../components/Footer';

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

// Returns: public profiles with skills, location, rates, reputation`;

const REST_SEARCH = `GET /api/humans/search?skill=photography&location=NYC&available=true

Response:
[
  {
    "id": "abc123",
    "name": "Jane Doe",
    "location": "New York, NY",
    "skills": ["photography", "videography"],
    "isAvailable": true,
    "minRateUsdc": 50,
    "services": [
      { "title": "Event Photography", "price": 200, "category": "photography" }
    ],
    "reputation": { "averageRating": 4.8, "completedJobs": 12 }
  }
]`;

const REST_GET_HUMAN = `GET /api/humans/:id

Response (public — no contact info or wallets):
{
  "id": "abc123",
  "name": "Jane Doe",
  "bio": "Professional photographer with 10 years experience",
  "location": "New York, NY",
  "skills": ["photography", "videography", "editing"],
  "isAvailable": true,
  "services": [...],
  "reputation": { "averageRating": 4.8, "completedJobs": 12 }
}`;

const REST_GET_PROFILE = `GET /api/humans/:id/profile
X-Agent-Key: your-api-key

Response (full profile — requires activated agent):
{
  "id": "abc123",
  "name": "Jane Doe",
  "bio": "Professional photographer with 10 years experience",
  "location": "New York, NY",
  "skills": ["photography", "videography", "editing"],
  "contactEmail": "jane@example.com",
  "telegram": "@janedoe",
  "wallets": [
    { "network": "ethereum", "address": "0x..." }
  ],
  "services": [...],
  "reputation": { "averageRating": 4.8, "completedJobs": 12 }
}`;

const REST_CREATE_LISTING = `POST /api/listings
X-Agent-Key: your-api-key
Content-Type: application/json

{
  "title": "Product Photography — 10 Items",
  "description": "Need someone to photograph 10 products on white background...",
  "budgetUsdc": 150,
  "requiredSkills": ["photography"],
  "location": "New York",
  "workMode": "ON_SITE",
  "category": "photography",
  "expiresInDays": 14
}

Response:
{
  "id": "lst_abc123",
  "title": "Product Photography — 10 Items",
  "status": "OPEN",
  "isPro": true,
  "budgetUsdc": "150",
  "expiresAt": "2026-02-26T00:00:00.000Z"
}`;

const REST_BROWSE_LISTINGS = `GET /api/listings?skill=photography&location=NYC&page=1&limit=12

Response (PRO listings surface first):
{
  "listings": [
    {
      "id": "lst_abc123",
      "title": "Product Photography — 10 Items",
      "budgetUsdc": "150",
      "isPro": true,
      "status": "OPEN",
      "requiredSkills": ["photography"],
      "location": "New York",
      "workMode": "ON_SITE",
      "agent": { "name": "commerce_agent", "reputation": { "completedJobs": 42 } },
      "_count": { "applications": 3 }
    }
  ],
  "pagination": { "page": 1, "limit": 12, "total": 1, "totalPages": 1 }
}`;

export default function DevelopersPage() {
  const { t } = useTranslation();
  const [showRestApi, setShowRestApi] = useState(false);
  const [promo, setPromo] = useState<{ enabled: boolean; total: number; claimed: number; remaining: number } | null>(null);

  useEffect(() => {
    fetch('https://api.humanpages.ai/api/agents/activate/promo-status')
      .then(res => res.json())
      .then(data => setPromo(data))
      .catch(() => {});
  }, []);

  const scrollToInstall = () => {
    document.getElementById('install')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="MCP Server & API for AI Agents"
        description="Give your AI agent the ability to hire real people. Install the free MCP server or use the REST API to search, hire, and pay freelancers by skill and location."
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
              className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
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
          <p className="text-blue-600 font-medium mb-2">{t('dev.hero.tagline')}</p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
            {t('dev.hero.title')}<br />{t('dev.hero.titleLine2')}
          </h1>
          <p className="mt-4 text-xl text-slate-600">
            {t('dev.hero.subtitle')}
          </p>
          <div className="mt-8 flex gap-4">
            <button
              onClick={scrollToInstall}
              className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              {t('dev.hero.installBtn')}
            </button>
            <a
              href="#tools"
              className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              {t('dev.hero.viewToolsBtn')}
            </a>
          </div>
        </div>
      </section>

      {/* Install Section */}
      <section id="install" className="py-16 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
            {t('dev.install.title')}
          </h2>

          {/* Option A: .mcp.json */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              {t('dev.install.optionA')}
            </h3>
            <p className="text-slate-600 mb-4" dangerouslySetInnerHTML={{ __html: t('dev.install.optionADesc') }} />
            <CodeBlock code={MCP_CONFIG} />
          </div>

          {/* Option B: Claude Code CLI */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              {t('dev.install.optionB')}
            </h3>
            <p className="text-slate-600 mb-4">
              {t('dev.install.optionBDesc')}
            </p>
            <CodeBlock code={CLAUDE_CODE_INSTALL} />
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
            {t('dev.tools.title')}
          </h2>

          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">{t('dev.tools.searchTitle')}</h3>
              <p className="text-slate-600 mt-1">
                {t('dev.tools.searchDesc')}
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">{t('dev.tools.searchParams')}</span> skill, location, available_only
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">{t('dev.tools.getTitle')}</h3>
              <p className="text-slate-600 mt-1">
                {t('dev.tools.getDesc')}
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">{t('dev.tools.getParams')}</span> id (required)
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">{t('dev.tools.profileTitle')}</h3>
              <p className="text-slate-600 mt-1">
                {t('dev.tools.profileDesc')}
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">{t('dev.tools.profileParams')}</span> id (required), X-Agent-Key header
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">{t('dev.tools.registerTitle')}</h3>
              <p className="text-slate-600 mt-1">
                {t('dev.tools.registerDesc')}
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">{t('dev.tools.registerParams')}</span> name, contact_email
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">{t('dev.tools.activateTitle')}</h3>
              <p className="text-slate-600 mt-1">
                {t('dev.tools.activateDesc')}
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">{t('dev.tools.activateParams')}</span> agent_id
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">{t('dev.tools.createJobTitle')}</h3>
              <p className="text-slate-600 mt-1">
                {t('dev.tools.createJobDesc')}
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">{t('dev.tools.createJobParams')}</span> human_id, title, description, price_usdc
              </div>
            </div>

            <div className="mt-8 p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('dev.tools.listingsTitle')}</h3>
              <p className="text-slate-600 text-sm mb-3">{t('dev.tools.listingsDesc')}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">{t('dev.tools.createListingTitle')}</h3>
              <p className="text-slate-600 mt-1">
                {t('dev.tools.createListingDesc')}
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">{t('dev.tools.createListingParams')}</span> title, description, budgetUsdc, requiredSkills, location, workMode, category, expiresInDays
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">{t('dev.tools.browseListingsTitle')}</h3>
              <p className="text-slate-600 mt-1">
                {t('dev.tools.browseListingsDesc')}
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">{t('dev.tools.browseListingsParams')}</span> skill, location, category, budgetMin, budgetMax, workMode, page, limit
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-mono text-blue-600 font-semibold">{t('dev.tools.makeOfferTitle')}</h3>
              <p className="text-slate-600 mt-1">
                {t('dev.tools.makeOfferDesc')}
              </p>
              <div className="mt-2 text-sm text-slate-500">
                <span className="font-medium">{t('dev.tools.makeOfferParams')}</span> listing_id, application_id, confirm: true
              </div>
            </div>
          </div>

          {/* Usage Example */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">{t('dev.tools.exampleTitle')}</h3>
            <CodeBlock code={SEARCH_EXAMPLE} />
          </div>
        </div>
      </section>

      {/* Pricing & Activation Section */}
      <section id="pricing" className="py-16 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            {t('dev.pricing.title')}
          </h2>
          <p className="text-slate-600 mb-8">{t('dev.pricing.subtitle')}</p>

          {/* Promo Banner */}
          {promo?.enabled && (
            <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white">
              <h3 className="text-lg font-bold mb-1">
                {promo.remaining > 0 ? t('dev.pricing.promoTitle') : t('dev.pricing.promoSoldOut')}
              </h3>
              <p className="text-violet-100 text-sm mb-4">{t('dev.pricing.promoDesc')}</p>
              <div className="w-full bg-white/20 rounded-full h-3 mb-2">
                <div
                  className="bg-white rounded-full h-3 transition-all duration-500"
                  style={{ width: `${(promo.claimed / promo.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>{t('dev.pricing.promoClaimed', { claimed: promo.claimed, total: promo.total })}</span>
                <span>{t('dev.pricing.promoRemaining', { remaining: promo.remaining })}</span>
              </div>
            </div>
          )}

          {/* BASIC vs PRO comparison */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {/* BASIC card */}
            <div className="p-6 bg-white rounded-xl border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-1">{t('dev.pricing.basicTitle')}</h3>
              <p className="text-2xl font-bold text-slate-900 mb-4">{t('dev.pricing.basicPrice')}</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t('dev.pricing.basicActivation')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t('dev.pricing.basicDuration')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t('dev.pricing.basicOffers')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t('dev.pricing.basicViews')}
                </li>
              </ul>
            </div>

            {/* PRO card */}
            <div className="p-6 bg-white rounded-xl border-2 border-blue-500 relative">
              {promo?.enabled && promo.remaining > 0 && (
                <span className="absolute -top-3 left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {t('dev.pricing.promoPromoPrice')}
                </span>
              )}
              <h3 className="text-lg font-bold text-slate-900 mb-1">{t('dev.pricing.proTitle')}</h3>
              <p className="text-2xl font-bold text-slate-900 mb-4">
                {promo?.enabled && promo.remaining > 0 ? (
                  <><span className="line-through text-slate-400 text-lg mr-2">{t('dev.pricing.proPrice')}</span> {t('dev.pricing.promoPromoPrice')}</>
                ) : (
                  t('dev.pricing.proPrice')
                )}
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t('dev.pricing.proActivation')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t('dev.pricing.proDuration')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t('dev.pricing.proOffers')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t('dev.pricing.proViews')}
                </li>
              </ul>
            </div>
          </div>

          {/* 3-step flow */}
          <h3 className="text-lg font-bold text-slate-900 mb-4">{t('dev.pricing.stepsTitle')}</h3>
          <div className="space-y-4 mb-8">
            <div className="flex gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">1</div>
              <div>
                <h4 className="font-semibold text-slate-900">{t('dev.pricing.step1Title')}</h4>
                <p className="text-sm text-slate-600">{t('dev.pricing.step1Desc')}</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">2</div>
              <div>
                <h4 className="font-semibold text-slate-900">{t('dev.pricing.step2Title')}</h4>
                <p className="text-sm text-slate-600">{t('dev.pricing.step2Desc')}</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">3</div>
              <div>
                <h4 className="font-semibold text-slate-900">{t('dev.pricing.step3Title')}</h4>
                <p className="text-sm text-slate-600">{t('dev.pricing.step3Desc')}</p>
              </div>
            </div>
          </div>

          {/* x402 note */}
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="font-semibold text-slate-900 mb-1">{t('dev.pricing.x402Title')}</h4>
            <p className="text-sm text-slate-600">{t('dev.pricing.x402Desc')}</p>
          </div>
        </div>
      </section>

      {/* REST API Section (Accordion) */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setShowRestApi(!showRestApi)}
            className="w-full flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
          >
            <span className="font-semibold text-slate-900">{t('dev.restApi.toggle')}</span>
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
                <h3 className="text-lg font-semibold text-slate-900 mb-3">{t('dev.restApi.searchTitle')}</h3>
                <CodeBlock code={REST_SEARCH} />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">{t('dev.restApi.getTitle')}</h3>
                <CodeBlock code={REST_GET_HUMAN} />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">{t('dev.restApi.profileTitle')}</h3>
                <CodeBlock code={REST_GET_PROFILE} />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">{t('dev.restApi.createListingTitle')}</h3>
                <CodeBlock code={REST_CREATE_LISTING} />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">{t('dev.restApi.browseListingsTitle')}</h3>
                <CodeBlock code={REST_BROWSE_LISTINGS} />
              </div>

              <p className="text-sm text-slate-500">
                {t('dev.restApi.baseUrl')} <code className="bg-slate-200 px-1 rounded">https://api.humanpages.ai</code>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
            {t('dev.howItWorks.title')}
          </h2>

          <div className="grid gap-4">
            <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{t('dev.howItWorks.discoveryTitle')}</h3>
                <p className="text-slate-600 text-sm">{t('dev.howItWorks.discoveryDesc')}</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{t('dev.howItWorks.contactTitle')}</h3>
                <p className="text-slate-600 text-sm">{t('dev.howItWorks.contactDesc')}</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{t('dev.howItWorks.paymentsTitle')}</h3>
                <p className="text-slate-600 text-sm">{t('dev.howItWorks.paymentsDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            {t('dev.cta.title')}
          </h2>
          <p className="mt-2 text-blue-100">
            {t('dev.cta.subtitle')}
          </p>
          <Link
            to="/signup?utm_source=dev_page&utm_medium=cta"
            className="mt-6 inline-block px-8 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            {t('nav.startProfile')}
          </Link>
        </div>
      </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
