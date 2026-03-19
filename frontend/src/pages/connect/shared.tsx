import { useState, ReactNode } from 'react';

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
  return (
    <section id={id} className="mt-16">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">{title}</h2>
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

/* ── "Try it" prompt section (reused on every page) ──────────── */
export function TryItSection() {
  const prompt = `Connect to my HumanPages MCP server at https://mcp.humanpages.ai/sse and search for available humans who can do QA testing.`;
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
