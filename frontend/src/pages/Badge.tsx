import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import { useAuth } from '../hooks/useAuth';
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
      className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="space-y-2">
      {label && <h3 className="text-sm font-medium text-slate-700">{label}</h3>}
      <div className="relative">
        <div className="absolute top-3 right-3 z-10">
          <CopyButton text={code} />
        </div>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default function Badge() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const userId = user?.id || 'your-id';
  const profileUrl = `https://humanpages.ai/humans/${userId}`;
  const badgeUrl = `https://humanpages.ai/api/badge/${userId}`;

  const htmlEmbed = `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer">
  <img src="${badgeUrl}" alt="Hire me on Human Pages" />
</a>`;

  const markdownEmbed = `[![Hire me on Human Pages](${badgeUrl})](${profileUrl})`;

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Embed Badge"
        description="Add a 'Hire me on Human Pages' badge to your website, GitHub, or portfolio."
        path="/badge"
        noindex={true}
      />

      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <Link to="/signup" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Start your profile
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            Get your embed badge
          </h1>
          <p className="text-lg text-slate-600">
            Add a "Hire me on Human Pages" badge to your website, GitHub README, or portfolio to help people find you.
          </p>
        </div>

        {!user && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-900 text-sm">
              <Link to="/login" className="font-medium underline">Sign in</Link> to get your personalized badge link. The examples below use a placeholder ID.
            </p>
          </div>
        )}

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Badge Preview</h2>
            <div className="flex justify-center p-8 bg-slate-50 rounded-lg">
              <svg width="200" height="40" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="40" rx="6" fill="#2563eb"/>
                <text x="100" y="25" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">
                  Hire me on Human Pages
                </text>
              </svg>
            </div>
            <p className="mt-4 text-sm text-slate-600 text-center">
              This badge links to: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{profileUrl}</code>
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Embed Code</h2>

            <div className="space-y-6">
              <CodeBlock code={htmlEmbed} label="HTML (for websites)" />
              <CodeBlock code={markdownEmbed} label="Markdown (for GitHub README)" />
              <CodeBlock code={profileUrl} label="Direct Link (for LinkedIn, etc.)" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Where to use it</h2>
            <ul className="space-y-2 text-slate-600">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span><strong>GitHub README:</strong> Add the Markdown snippet to your profile or project README</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span><strong>Personal website:</strong> Use the HTML snippet in your footer or contact page</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span><strong>LinkedIn, Twitter, etc.:</strong> Share the direct link in your bio or posts</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span><strong>Email signature:</strong> Add the HTML snippet to your email signature</span>
              </li>
            </ul>
          </div>
        </div>

        {user && (
          <div className="mt-8 text-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        )}
      </main>

      <footer className="py-8 bg-white border-t border-slate-200 px-4 mt-12">
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
