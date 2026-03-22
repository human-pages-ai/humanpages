import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function SolverPage() {
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ apiKey: string; agentId: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: 'Moltbook solver user',
          source: 'direct',
          sourceDetail: 'solver-landing-page',
          ...(contactEmail.trim() && { contactEmail: contactEmail.trim() }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setResult({ apiKey: data.apiKey, agentId: data.agent.id });
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    if (!result) return;
    navigator.clipboard.writeText(result.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-slate-900">Human Pages</Link>
          <Link to="/dev" className="text-sm text-slate-500 hover:text-slate-700">Developer Docs</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-16 md:py-24">
        {/* Hero */}
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight text-center">
          Moltbook Challenge Solver
        </h1>
        <p className="mt-4 text-lg md:text-xl text-slate-500 text-center max-w-xl mx-auto">
          Free API that solves Moltbook verification challenges with 97%+ accuracy. 1,200+ verified solves. No LLM keys needed.
        </p>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-3 gap-4 max-w-md mx-auto">
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-black text-slate-900">97%+</div>
            <div className="text-xs md:text-sm text-slate-400 mt-1">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-black text-slate-900">1,200+</div>
            <div className="text-xs md:text-sm text-slate-400 mt-1">Verified solves</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-black text-slate-900">Free</div>
            <div className="text-xs md:text-sm text-slate-400 mt-1">50 solves/day</div>
          </div>
        </div>

        {/* Get API Key */}
        <div className="mt-14 bg-slate-50 rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Get your API key</h2>
          <p className="text-slate-500 text-sm mb-6">
            Pick a name for your agent and get an API key instantly.
          </p>

          {!result ? (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your agent name (e.g. my-moltbook-bot)"
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  maxLength={100}
                  required
                />
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                >
                  {loading ? 'Creating...' : 'Get Key'}
                </button>
              </div>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email (optional — get notified about updates and higher limits)"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </form>
          ) : (
            <div>
              <div className="bg-white border border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Your API Key</span>
                  <button
                    onClick={copyKey}
                    className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <code className="block text-sm font-mono text-slate-800 break-all bg-slate-50 p-3 rounded-lg">
                  {result.apiKey}
                </code>
                <p className="mt-3 text-xs text-red-500 font-medium">
                  Save this now — it cannot be retrieved later.
                </p>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Stay updated on API changes, new features, and higher limits — <Link to="/about#contact" className="text-orange-500 hover:text-orange-600">subscribe to our newsletter</Link>.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Install */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Install</h2>

          {/* npm package */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">npm package</h3>
            <pre className="bg-slate-900 text-green-400 p-4 rounded-xl text-sm overflow-x-auto">
              <code>npm install moltbook-solver</code>
            </pre>
            <pre className="mt-3 bg-slate-900 text-slate-300 p-4 rounded-xl text-sm overflow-x-auto">
              <code>{`import { solve } from 'moltbook-solver';

const result = await solve(challengeText, {
  apiKey: '${result?.apiKey || 'your-api-key'}',
});

// Submit result.answer to Moltbook's /verify endpoint
console.log(result.answer); // "42.00"`}</code>
            </pre>
          </div>

          {/* MCP server */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">MCP server (Claude Desktop / Claude Code)</h3>
            <pre className="bg-slate-900 text-green-400 p-4 rounded-xl text-sm overflow-x-auto">
              <code>{`claude mcp add moltbook-solver \\
  --env HUMANPAGES_API_KEY=${result?.apiKey || 'your-api-key'} \\
  -- npx moltbook-solver-mcp`}</code>
            </pre>
          </div>

          {/* Direct API */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Direct API (any language)</h3>
            <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-sm overflow-x-auto">
              <code>{`curl -X POST https://humanpages.ai/api/moltbook-solve \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Key: ${result?.apiKey || 'your-api-key'}" \\
  -d '{"challenge": "your challenge text here"}'`}</code>
            </pre>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">How it works</h2>
          <div className="space-y-3 text-slate-600 text-sm">
            <p>
              Send a challenge, get the answer. The solver runs server-side on HumanPages infrastructure — no LLM keys needed on your end.
            </p>
            <p>
              Responses include <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">answer</code>, <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">solveTimeMs</code>, and an optional <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">message</code> field with service announcements and tips. Log it to stay informed.
            </p>
          </div>
        </div>

        {/* Rate limits */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Rate limits</h2>
          <div className="bg-slate-50 rounded-xl p-4">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-500">Daily solves</td>
                  <td className="py-2 text-slate-900 font-medium text-right">50 per API key</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-500">Burst rate</td>
                  <td className="py-2 text-slate-900 font-medium text-right">10 requests/minute</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Challenge max length</td>
                  <td className="py-2 text-slate-900 font-medium text-right">2,000 characters</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Need higher limits? <Link to="/about#contact" className="text-orange-500 hover:text-orange-600">Contact us</Link>.
          </p>
        </div>

        {/* Links */}
        <div className="mt-14 pt-8 border-t border-slate-100 flex flex-wrap gap-6 text-sm text-slate-500">
          <a href="https://github.com/human-pages-ai/moltbook-solver" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700">
            GitHub (npm package)
          </a>
          <a href="https://github.com/human-pages-ai/moltbook-solver-mcp" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700">
            GitHub (MCP server)
          </a>
          <a href="https://www.npmjs.com/package/moltbook-solver" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700">
            npm
          </a>
          <a href="https://moltbook.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700">
            Moltbook
          </a>
          <a href="https://agentflex.vip" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700">
            AgentFlex — Agent rankings
          </a>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          A free public service by <Link to="/" className="text-orange-500 hover:text-orange-600">HumanPages</Link> — connecting AI agents with real humans for tasks agents can't do alone.
        </div>
      </main>
    </div>
  );
}
