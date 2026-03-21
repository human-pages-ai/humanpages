import Link from '../../components/LocalizedLink';
import ConnectLayout from './ConnectLayout';
import { PLATFORMS, getPlatformsByCategory } from './platforms';
import { useState } from 'react';
import { analytics } from '../../lib/analytics';
import { CodeBlock, Section, Callout } from './shared';

/* ── SVG connection diagram ──────────────────────────────────── */
function ConnectionDiagram() {
  return (
    <svg viewBox="0 0 800 200" className="w-full max-w-3xl mx-auto my-8" aria-label="MCP connection flow diagram">
      {/* Your App */}
      <rect x="20" y="60" width="180" height="80" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
      <text x="110" y="95" textAnchor="middle" className="text-sm" fill="#334155" fontWeight="600" fontSize="14">Your AI Agent</text>
      <text x="110" y="115" textAnchor="middle" fill="#94a3b8" fontSize="11">Claude, GPT, Cursor…</text>

      {/* Arrow 1 */}
      <line x1="200" y1="100" x2="290" y2="100" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />
      <text x="245" y="90" textAnchor="middle" fill="#94a3b8" fontSize="10">MCP</text>

      {/* HumanPages MCP */}
      <rect x="290" y="50" width="220" height="100" rx="12" fill="#fefce8" stroke="#fbbf24" strokeWidth="2" />
      <text x="400" y="85" textAnchor="middle" fill="#92400e" fontWeight="700" fontSize="14">HumanPages MCP</text>
      <text x="400" y="105" textAnchor="middle" fill="#a16207" fontSize="11">mcp.humanpages.ai/mcp</text>
      <text x="400" y="125" textAnchor="middle" fill="#a16207" fontSize="10">search · hire · manage</text>

      {/* Arrow 2 */}
      <line x1="510" y1="100" x2="600" y2="100" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />

      {/* Humans */}
      <rect x="600" y="60" width="180" height="80" rx="12" fill="#f0fdf4" stroke="#86efac" strokeWidth="2" />
      <text x="690" y="95" textAnchor="middle" fill="#166534" fontWeight="600" fontSize="14">Real Humans</text>
      <text x="690" y="115" textAnchor="middle" fill="#4ade80" fontSize="11">Skills · Availability · Rates</text>

      {/* Arrow marker */}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
      </defs>
    </svg>
  );
}

/* ── Platform card ───────────────────────────────────────────── */
function PlatformCard({ platform }: { platform: typeof PLATFORMS[number] }) {
  return (
    <Link
      to={`/dev/connect/${platform.slug}`}
      className={`block rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md bg-gradient-to-br ${platform.bgGradient} p-5 transition-all group`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{platform.icon}</span>
        <h3 className="font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
          {platform.shortName}
        </h3>
      </div>
      <p className="text-sm text-slate-600 mb-3">{platform.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {platform.transport.map((t) => (
          <span key={t} className="text-[10px] uppercase tracking-wider font-medium bg-white/70 text-slate-500 px-2 py-0.5 rounded-full">
            {t}
          </span>
        ))}
      </div>
    </Link>
  );
}

/* ── Server URL copy widget ──────────────────────────────────── */
function ServerUrlCopy() {
  const [copied, setCopied] = useState(false);
  const url = 'https://mcp.humanpages.ai/mcp';
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    analytics.track('dev_server_url_copied');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="inline-flex items-center bg-slate-900 rounded-lg overflow-hidden max-w-lg mx-auto">
      <code className="text-sm text-slate-300 px-4 py-2.5 select-all">{url}</code>
      <button
        onClick={copy}
        className="bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold px-4 py-2.5 transition-colors"
      >
        {copied ? 'Copied!' : 'Copy URL'}
      </button>
    </div>
  );
}

/* ── Main overview page ──────────────────────────────────────── */
export default function ConnectOverview() {
  const categories = getPlatformsByCategory();

  return (
    <ConnectLayout
      title="Connect to HumanPages MCP"
      description="Step-by-step guides to connect your AI app to real humans via the HumanPages MCP server. Works with Claude, ChatGPT, Cursor, Windsurf, OpenAI, Gemini, and more."
      path="/dev/connect"
      breadcrumbs={[{ label: 'Connect' }]}
    >
      {/* Hero */}
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1 rounded-full mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {PLATFORMS.length} platforms supported
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
          Connect your AI to real humans
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-6">
          One MCP server. Every major platform. Pick your tool and follow the guide — you'll be searching for real humans in under a minute.
        </p>
        <ServerUrlCopy />
      </div>

      <ConnectionDiagram />

      {/* Quick-start: one-liner */}
      <div className="max-w-2xl mx-auto mt-8 mb-16">
        <Callout type="tip">
          <strong>Fastest start:</strong> If you use Claude Code, run this one command:
        </Callout>
        <div className="mt-3">
          <CodeBlock code="claude mcp add humanpages -- npx -y humanpages" lang="bash" />
        </div>
      </div>

      {/* Platform grid by category */}
      {Object.entries(categories).map(([key, cat]) => {
        if (cat.platforms.length === 0) return null;
        return (
          <Section key={key} title={cat.label}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.platforms.map((p) => (
                <PlatformCard key={p.id} platform={p} />
              ))}
            </div>
          </Section>
        );
      })}

      {/* Universal config */}
      <Section title="Universal MCP config">
        <p className="text-slate-600 mb-4">
          Most platforms that support MCP accept this JSON format. Drop it into your config file and change the key name if needed.
        </p>
        <CodeBlock
          filename="any-platform/mcp.json"
          lang="json"
          code={`{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"],
      "env": {
        "API_BASE_URL": "https://humanpages.ai"
      }
    }
  }
}`}
        />
        <p className="text-sm text-slate-500 mt-3">
          For remote (HTTP/SSE) connections — use <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">https://mcp.humanpages.ai/mcp</code> as the server URL instead.
        </p>
      </Section>

      {/* CTA */}
      <div className="text-center mt-20 py-12 bg-slate-50 rounded-2xl">
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Don't see your platform?</h2>
        <p className="text-slate-600 mb-6">
          Any MCP-compatible client can connect. Use the universal config above, or reach out and we'll write a guide.
        </p>
        <a
          href="https://github.com/humanpages/mcp-server/issues"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => analytics.track('dev_external_link_clicked', { label: 'request_platform_guide', url: 'https://github.com/humanpages/mcp-server/issues' })}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
        >
          Request a platform guide →
        </a>
      </div>
    </ConnectLayout>
  );
}
