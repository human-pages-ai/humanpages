import { useState, ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import Link from '../../components/LocalizedLink';
import { PLATFORMS } from './platforms';

/* ── Copy button ─────────────────────────────────────────────── */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="absolute top-3 right-3 px-2.5 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

/* ── Code block with syntax hint + copy ──────────────────────── */
export function CodeBlock({ code, lang, filename }: { code: string; lang?: string; filename?: string }) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-200">
      {filename && (
        <div className="bg-slate-800 text-slate-400 text-xs px-4 py-2 border-b border-slate-700 font-mono">
          {filename}
        </div>
      )}
      <CopyButton text={code} />
      <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto text-sm leading-relaxed">
        <code className={lang ? `language-${lang}` : ''}>{code}</code>
      </pre>
    </div>
  );
}

/* ── One-click copy prompt (large, prominent) ───────────────── */
export function CopyPrompt({ prompt, label }: { prompt: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <button
      onClick={copy}
      className="w-full text-left bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 rounded-xl p-4 transition-all group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          {label || 'Copy prompt'}
        </span>
        <span className="text-xs text-amber-600 group-hover:text-amber-800 transition-colors">
          {copied ? '✓ Copied!' : 'Click to copy'}
        </span>
      </div>
      <p className="text-sm text-slate-700 font-mono leading-relaxed">{prompt}</p>
    </button>
  );
}

/* ── Step-by-step UI guide ──────────────────────────────────── */
export function StepByStep({ steps }: { steps: { title: string; detail: ReactNode }[] }) {
  return (
    <ol className="space-y-6">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
            {i + 1}
          </div>
          <div className="pt-0.5">
            <p className="font-semibold text-slate-900 mb-1">{step.title}</p>
            <div className="text-sm text-slate-600 leading-relaxed">{step.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── Section heading ─────────────────────────────────────────── */
export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  const sectionId = id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <section id={sectionId} className="mt-16 scroll-mt-20">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">
        <a href={`#${sectionId}`} className="hover:text-slate-600 transition-colors">
          {title}
        </a>
      </h2>
      {children}
    </section>
  );
}

/* ── Info / warning callout ──────────────────────────────────── */
export function Callout({ type = 'info', children }: { type?: 'info' | 'warn' | 'tip'; children: ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    tip: 'bg-green-50 border-green-200 text-green-800',
  };
  const icons = { info: 'ℹ️', warn: '⚠️', tip: '💡' };
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed ${styles[type]}`}>
      <span className="mr-2">{icons[type]}</span>
      {children}
    </div>
  );
}

/* ── Platform hero header ────────────────────────────────────── */
export function PlatformHero({
  gradient,
  icon,
  name,
  tagline,
  docsUrl,
}: {
  gradient: string;
  icon: ReactNode;
  name: string;
  tagline: string;
  docsUrl: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-8 md:p-12 mb-10`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="text-4xl">{icon}</div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{name}</h1>
          <p className="text-slate-600 mt-1">{tagline}</p>
        </div>
      </div>
      <a
        href={docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mt-2"
      >
        Official docs ↗
      </a>
    </div>
  );
}

/* ── Quick-copy card (shown at top for skimmers) ─────────────── */
export function QuickCopyCard({ configs }: { configs: { label: string; code: string }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-10">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick start — copy & paste</p>
      {configs.length > 1 && (
        <div className="flex gap-2 mb-3">
          {configs.map((c, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                i === active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <CodeBlock code={configs[active].code} />
    </div>
  );
}

/* ── "Try it" prompt section (reused on every page) ──────────── */
export function TryItSection({ platformName }: { platformName?: string }) {
  const prompt = platformName
    ? `Search for available humans who can do QA testing on HumanPages.`
    : `Connect to my HumanPages MCP server at https://mcp.humanpages.ai/mcp and search for available humans who can do QA testing.`;
  return (
    <Section title="Try it now">
      <p className="text-slate-600 mb-4">
        Once connected, paste this prompt to verify everything works:
      </p>
      <CopyPrompt prompt={prompt} label="Test prompt" />
    </Section>
  );
}

/* ── Available tools reference ───────────────────────────────── */
export function ToolsReference() {
  const tools = [
    { name: 'search_humans', desc: 'Find available humans by skill, location, or availability' },
    { name: 'get_human', desc: 'Get a human\'s public profile by ID' },
    { name: 'get_human_profile', desc: 'Full profile with contact info (requires agent key)' },
    { name: 'browse_listings', desc: 'Browse open job listings with filters' },
    { name: 'get_listing', desc: 'Get details of a specific listing' },
    { name: 'create_listing', desc: 'Post a new job listing (requires agent key)' },
  ];
  return (
    <Section title="Available MCP tools">
      <div className="grid sm:grid-cols-2 gap-3">
        {tools.map((t) => (
          <div key={t.name} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <code className="text-sm font-semibold text-slate-900">{t.name}</code>
            <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Prev / Next navigation between platform pages ───────────── */
export function PlatformNav({ currentSlug }: { currentSlug: string }) {
  const idx = PLATFORMS.findIndex((p) => p.slug === currentSlug);
  const prev = idx > 0 ? PLATFORMS[idx - 1] : null;
  const next = idx < PLATFORMS.length - 1 ? PLATFORMS[idx + 1] : null;

  return (
    <nav className="mt-20 pt-8 border-t border-slate-100 flex items-center justify-between">
      {prev ? (
        <Link
          to={`/dev/connect/${prev.slug}`}
          className="group flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <span className="text-lg">←</span>
          <span>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 group-hover:text-slate-500">Previous</span>
            {prev.shortName}
          </span>
        </Link>
      ) : (
        <div />
      )}
      <Link
        to="/dev/connect"
        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        All platforms
      </Link>
      {next ? (
        <Link
          to={`/dev/connect/${next.slug}`}
          className="group flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors text-right"
        >
          <span>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 group-hover:text-slate-500">Next</span>
            {next.shortName}
          </span>
          <span className="text-lg">→</span>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}

/* ── Related platforms section ────────────────────────────────── */
export function RelatedPlatforms({ currentSlug, slugs }: { currentSlug: string; slugs: string[] }) {
  const related = PLATFORMS.filter((p) => slugs.includes(p.slug) && p.slug !== currentSlug);
  if (related.length === 0) return null;

  return (
    <Section title="Also works with">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {related.map((p) => (
          <Link
            key={p.slug}
            to={`/dev/connect/${p.slug}`}
            className={`flex items-center gap-3 rounded-lg border border-slate-100 bg-gradient-to-br ${p.bgGradient} p-3 hover:shadow-sm transition-all`}
          >
            <span className="text-xl">{p.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{p.shortName}</p>
              <p className="text-[11px] text-slate-500">{p.tagline}</p>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* ── JSON-LD HowTo schema for SEO rich results ──────────────── */
export function HowToSchema({
  name,
  description,
  steps,
}: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
    tool: {
      '@type': 'HowToTool',
      name: 'HumanPages MCP Server',
    },
    supply: {
      '@type': 'HowToSupply',
      name: 'MCP Server URL: https://mcp.humanpages.ai/mcp',
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
