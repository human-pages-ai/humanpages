import Link from '../components/LocalizedLink';

/* ─── Variant A: Ultra-minimal. CTA dominates. Workflows is a text link. ─── */
function VariantA() {
  return (
    <section className="pt-20 md:pt-32 pb-16 md:pb-24 px-4 md:px-8 bg-white min-h-[80vh] flex items-center">
      <div className="max-w-5xl mx-auto w-full text-center">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.08]">
          Your agent knows you<br />
          <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">better than your mama</span>
        </h1>
        <p className="mt-6 md:mt-8 text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
          It reads your codebase, knows your roadmap, and hires real humans for the work you shouldn't be doing yourself.
        </p>

        <div className="mt-10 md:mt-14">
          <Link
            to="/dev/connect"
            className="inline-block px-10 md:px-14 py-4 md:py-5 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-all hover:scale-[1.02] text-lg md:text-2xl shadow-xl shadow-orange-200/50"
          >
            Give your AI agent hiring powers
          </Link>
          <p className="text-slate-400 text-sm md:text-base mt-5">
            One line of config. Works with Claude, Cursor, GPT, Gemini &mdash; any MCP agent.
          </p>
          <Link to="/prompt-to-completion" className="inline-block mt-3 text-sm md:text-base text-blue-500 hover:text-blue-600 font-medium">
            See example workflows &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Variant B: CTA + install command preview as social proof ─── */
function VariantB() {
  return (
    <section className="pt-20 md:pt-32 pb-16 md:pb-24 px-4 md:px-8 bg-white min-h-[80vh] flex items-center">
      <div className="max-w-5xl mx-auto w-full text-center">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.08]">
          Your agent knows you<br />
          <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">better than your mama</span>
        </h1>
        <p className="mt-6 md:mt-8 text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
          It reads your codebase, knows your roadmap, and hires real humans for the work you shouldn't be doing yourself.
        </p>

        <div className="mt-10 md:mt-14">
          <Link
            to="/dev/connect"
            className="inline-block px-10 md:px-14 py-4 md:py-5 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-all hover:scale-[1.02] text-lg md:text-2xl shadow-xl shadow-orange-200/50"
          >
            Give your AI agent hiring powers
          </Link>
        </div>

        {/* Install preview */}
        <div className="mt-10 md:mt-14 max-w-lg mx-auto">
          <div className="bg-slate-900 rounded-xl px-6 py-4 text-left font-mono text-sm md:text-base">
            <span className="text-slate-500">$</span>{' '}
            <span className="text-green-400">claude mcp add humanpages</span>{' '}
            <span className="text-slate-400">-- npx -y humanpages</span>
          </div>
          <p className="text-slate-400 text-sm md:text-base mt-4">
            That's it. Your agent can now search, hire, and manage real humans.
          </p>
          <Link to="/prompt-to-completion" className="inline-block mt-2 text-sm md:text-base text-blue-500 hover:text-blue-600 font-medium">
            See what it can do &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Variant C: Question provocation above the headline ─── */
function VariantC() {
  return (
    <section className="pt-20 md:pt-32 pb-16 md:pb-24 px-4 md:px-8 bg-white min-h-[80vh] flex items-center">
      <div className="max-w-5xl mx-auto w-full text-center">
        <p className="text-base md:text-lg text-slate-400 font-medium mb-6">
          Still copy-pasting your URL into startup directories yourself?
        </p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.08]">
          Your agent knows you<br />
          <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">better than your mama</span>
        </h1>
        <p className="mt-6 md:mt-8 text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Let it find, hire, and manage real humans for QA, SEO, localization, and everything else you keep putting off.
        </p>

        <div className="mt-10 md:mt-14 flex flex-col items-center gap-4">
          <Link
            to="/dev/connect"
            className="inline-block px-10 md:px-14 py-4 md:py-5 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-all hover:scale-[1.02] text-lg md:text-2xl shadow-xl shadow-orange-200/50"
          >
            Give your AI agent hiring powers
          </Link>
          <span className="text-slate-400 text-sm md:text-base">
            One line of config &middot;{' '}
            <Link to="/prompt-to-completion" className="text-blue-500 hover:text-blue-600 font-medium">
              see workflows
            </Link>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── Variant D: Dark hero with terminal energy ─── */
function VariantD() {
  return (
    <section className="pt-20 md:pt-32 pb-16 md:pb-24 px-4 md:px-8 bg-slate-950 min-h-[80vh] flex items-center">
      <div className="max-w-5xl mx-auto w-full text-center">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[1.08]">
          Your agent knows you<br />
          <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">better than your mama</span>
        </h1>
        <p className="mt-6 md:mt-8 text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          It reads your codebase, knows your roadmap, and hires real humans for the work you shouldn't be doing yourself.
        </p>

        <div className="mt-10 md:mt-14">
          <Link
            to="/dev/connect"
            className="inline-block px-10 md:px-14 py-4 md:py-5 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-all hover:scale-[1.02] text-lg md:text-2xl shadow-xl shadow-orange-500/20"
          >
            Give your AI agent hiring powers
          </Link>
        </div>

        <div className="mt-10 md:mt-14 max-w-lg mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 text-left font-mono text-sm md:text-base">
            <span className="text-slate-600">$</span>{' '}
            <span className="text-green-400">claude mcp add humanpages</span>{' '}
            <span className="text-slate-500">-- npx -y humanpages</span>
          </div>
          <div className="flex justify-center gap-6 mt-5 text-sm md:text-base">
            <span className="text-slate-500">
              Works with any MCP agent
            </span>
            <span className="text-slate-600">&middot;</span>
            <Link to="/prompt-to-completion" className="text-blue-400 hover:text-blue-300 font-medium">
              See workflows &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Variant E: Split — headline left, CTA right on desktop ─── */
function VariantE() {
  return (
    <section className="pt-20 md:pt-32 pb-16 md:pb-24 px-4 md:px-8 bg-white min-h-[80vh] flex items-center">
      <div className="max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.08]">
            Your agent knows you{' '}
            <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">better than your mama</span>
          </h1>
          <p className="mt-6 md:mt-8 text-xl md:text-2xl text-slate-500 leading-relaxed">
            It reads your codebase, knows your roadmap, and hires real humans for the work you shouldn't be doing yourself.
          </p>
          <div className="mt-8 md:mt-10 flex items-center gap-4 flex-wrap">
            <Link
              to="/dev/connect"
              className="inline-block px-8 md:px-10 py-4 md:py-5 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-all hover:scale-[1.02] text-lg md:text-xl shadow-xl shadow-orange-200/50"
            >
              Give your AI agent hiring powers
            </Link>
            <Link to="/prompt-to-completion" className="text-base md:text-lg text-blue-500 hover:text-blue-600 font-medium">
              See workflows &rarr;
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 rounded-xl px-6 py-4 font-mono text-sm md:text-base">
            <p className="text-slate-500 mb-1"># one command</p>
            <p><span className="text-slate-500">$</span> <span className="text-green-400">claude mcp add humanpages</span> <span className="text-slate-500">-- npx -y humanpages</span></p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔍</span>
              <p className="text-base md:text-lg text-slate-700">Searches for the right person</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">📋</span>
              <p className="text-base md:text-lg text-slate-700">Sends a structured job offer</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">💬</span>
              <p className="text-base md:text-lg text-slate-700">Manages the conversation</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">✅</span>
              <p className="text-base md:text-lg text-slate-700">Reviews and approves delivery</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm md:text-base text-center">You ship code. Your agent handles the rest.</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Comparison Page ─── */
export default function DevHeroVariants() {
  return (
    <div>
      {/* Navigation */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-6 overflow-x-auto">
          <span className="font-bold text-slate-900 shrink-0">Hero Variants</span>
          {['A', 'B', 'C', 'D', 'E'].map(v => (
            <a
              key={v}
              href={`#variant-${v.toLowerCase()}`}
              className="text-base font-medium text-blue-600 hover:text-blue-700 shrink-0"
            >
              Variant {v}
            </a>
          ))}
          <Link to="/dev" className="text-base text-slate-400 hover:text-slate-600 shrink-0 ml-auto">
            &larr; Back to /dev
          </Link>
        </div>
      </div>

      {/* Variant A */}
      <div id="variant-a" className="border-b-4 border-blue-500">
        <div className="bg-blue-500 text-white text-center py-2 text-lg font-bold">A &mdash; Ultra-minimal, text link for workflows</div>
        <VariantA />
      </div>

      {/* Variant B */}
      <div id="variant-b" className="border-b-4 border-green-500">
        <div className="bg-green-500 text-white text-center py-2 text-lg font-bold">B &mdash; CTA + install command preview</div>
        <VariantB />
      </div>

      {/* Variant C */}
      <div id="variant-c" className="border-b-4 border-purple-500">
        <div className="bg-purple-500 text-white text-center py-2 text-lg font-bold">C &mdash; Question provocation above headline</div>
        <VariantC />
      </div>

      {/* Variant D */}
      <div id="variant-d" className="border-b-4 border-orange-500">
        <div className="bg-orange-500 text-white text-center py-2 text-lg font-bold">D &mdash; Dark terminal energy</div>
        <VariantD />
      </div>

      {/* Variant E */}
      <div id="variant-e" className="border-b-4 border-pink-500">
        <div className="bg-pink-500 text-white text-center py-2 text-lg font-bold">E &mdash; Split layout, headline left + demo right</div>
        <VariantE />
      </div>
    </div>
  );
}
