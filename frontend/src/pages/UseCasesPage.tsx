import { useState } from 'react';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import {
  DevicePhoneMobileIcon,
  LanguageIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  BugAntIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

interface UseCase {
  id: string;
  icon: React.ReactNode;
  title: string;
  tagline: string;
  why: string;
  price: string;
  cadence: string;
  timeline: string;
  deliverables: string[];
  agentSteps: string[];
  playbook: string;
  guarantee?: string;
  isNew?: boolean;
}

const PLAYBOOK_BASE = 'https://github.com/human-pages-ai/hire-humans/blob/main/playbooks';

const USE_CASES: UseCase[] = [
  {
    id: 'directory-submissions',
    icon: <RocketLaunchIcon className="w-7 h-7" />,
    title: 'Directory Submissions',
    tagline: 'Submit your product to 80+ directories — AI tools, SaaS listings, startup launches, dev platforms, and more.',
    why: 'Most directories require manual forms with CAPTCHAs, email confirmations, unique descriptions, and account creation. No API, no shortcut — just a human clicking through.',
    guarantee: 'If the human doesn\'t finish, our staff completes the submissions within 3 days — no extra charge.',
    price: '',
    cadence: 'One-time (revisit every 6–12 months)',
    timeline: '2–4 hours per batch',
    playbook: `${PLAYBOOK_BASE}/directory-submissions.md`,
    deliverables: [
      'Markdown table with directory URL, status (submitted/pending/live/failed), and notes',
      'Account credentials stored securely for future updates',
    ],
    agentSteps: [
      'Search for humans with "SEO", "directory submission", or "data entry" skills',
      'Create a job offer with your product details + target directory list',
      'Human submits to each directory, logs results in a table',
      'Review the deliverable and approve payment',
    ],
  },
  {
    id: 'qa-testing',
    icon: <BugAntIcon className="w-7 h-7" />,
    title: 'QA Testing',
    tagline: 'Manual cross-device testing that catches what automated tests miss.',
    why: 'Humans find broken layouts, confusing UX flows, text truncation, slow interactions, and accessibility barriers that no test suite anticipates.',
    price: '$3–10 per testing session',
    cadence: 'Per release',
    timeline: '2–8 hours',
    playbook: `${PLAYBOOK_BASE}/qa-testing.md`,
    deliverables: [
      'Bug report with steps to reproduce, expected vs. actual behavior, severity',
      'Screenshots and screen recordings',
      'UX feedback and improvement suggestions',
    ],
    agentSteps: [
      'Search for humans with "QA", "testing", or "bug reporting" skills',
      'Send test plan with target flows, devices, and browsers',
      'Human tests and logs bugs in structured format',
      'Triage results and approve payment',
    ],
  },
  {
    id: 'play-store-testing',
    icon: <DevicePhoneMobileIcon className="w-7 h-7" />,
    title: 'Play Store Beta Testers',
    isNew: true,
    tagline: 'Meet Google\'s 12-tester / 14-day requirement. Your agent handles recruitment via API — no manual dashboards.',
    why: 'Google Play requires 12 testers for 14 days before you can publish. Existing solutions like TestersCommunity ($15) are manual web UIs that your AI agent can\'t use, and their credit/barter incentive model means testers participate mainly to earn credits for their own apps — not because they\'re invested in yours. With Human Pages, testers get paid real money (USDC), so they\'re motivated to actually engage with your app.',
    guarantee: 'If a tester doesn\'t complete the 14-day requirement, our staff steps in within 3 days — no extra charge.',
    price: '~$3.50 for 12 testers (or included on Pro)',
    cadence: 'Per app launch',
    timeline: '~18 days (recruitment + 14-day testing window)',
    playbook: `${PLAYBOOK_BASE}/play-store-testing.md`,
    deliverables: [
      'Day 1 screenshot: enrollment confirmation',
      'Day 14 screenshot: app still installed',
      'Optional bug reports during testing period',
    ],
    agentSteps: [
      'Search for humans with Android devices in target regions',
      'Create job offer explaining the closed testing program',
      'Human enrolls, installs app, keeps it for 14 days',
      'Verify screenshots at day 1 and day 14, then pay',
    ],
  },
  {
    id: 'localization',
    icon: <LanguageIcon className="w-7 h-7" />,
    title: 'Localization Review',
    tagline: 'Native speakers review your translations in context — not just grammar, but feel.',
    why: 'Machine translation is grammatically correct but sounds robotic. Only native speakers catch unnatural phrasing, UI text overflow, cultural mismatches, and locale formatting issues.',
    price: '$5–15 per language',
    cadence: 'Per release with new strings',
    timeline: '3–12 hours depending on app size',
    playbook: `${PLAYBOOK_BASE}/localization.md`,
    deliverables: [
      'Issue table: screen, original text, current translation, suggested fix, severity',
      'Overall quality score (1–10)',
      'Top 3 systemic issues across the app',
    ],
    agentSteps: [
      'Search for native speakers of your target language',
      'Share app access + list of screens to review',
      'Human reviews translations in context, flags issues',
      'Review findings, apply fixes, approve payment',
    ],
  },
  {
    id: 'competitor-monitoring',
    icon: <EyeIcon className="w-7 h-7" />,
    title: 'Competitor Monitoring',
    tagline: 'Weekly intelligence on competitor pricing, features, and positioning changes.',
    why: 'Competitor websites use dynamic content, A/B tests, and gated pages that scrapers miss. Humans can sign up for trials, read changelogs, and spot qualitative shifts.',
    price: '$3–8 per weekly report',
    cadence: 'Weekly',
    timeline: '2–4 hours per report',
    playbook: `${PLAYBOOK_BASE}/competitor-monitoring.md`,
    deliverables: [
      'Structured diff report by competitor and category',
      'Screenshots of visual/pricing changes',
      'Significance ratings (high/medium/low) per change',
      'Key takeaways and recommended actions',
    ],
    agentSteps: [
      'Search for humans with "research", "competitive analysis", or "market research" skills',
      'Define 2–5 competitors and what to track (pricing, features, messaging)',
      'Human monitors weekly, delivers structured report',
      'Review report, set up recurring job for ongoing monitoring',
    ],
  },
  {
    id: 'community-management',
    icon: <ChatBubbleLeftRightIcon className="w-7 h-7" />,
    title: 'Community Management',
    tagline: 'Daily moderation and engagement for Discord, Slack, forums, or Telegram.',
    why: 'Relationship-building requires a real person. Moderation decisions need judgment about tone, intent, and context. Bots managing communities feel inauthentic and drive people away.',
    price: '$25/week',
    cadence: 'Daily (with weekly summary)',
    timeline: '2–4 hours/day',
    playbook: `${PLAYBOOK_BASE}/community-management.md`,
    deliverables: [
      'Daily presence during agreed hours with <4h response time',
      'Moderation actions logged',
      'Weekly summary: member count, message volume, top discussions, sentiment',
    ],
    agentSteps: [
      'Search for humans with "community management", "moderation", or "customer support" skills',
      'Share community guidelines, escalation rules, and access credentials',
      'Human moderates daily, engages with members, files weekly report',
      'Review weekly summary, adjust guidelines as needed',
    ],
  },
  {
    id: 'virtual-assistant',
    icon: <UserIcon className="w-7 h-7" />,
    title: 'Virtual Assistant',
    tagline: 'Delegate admin, research, scheduling, and other recurring tasks to a dedicated human assistant.',
    why: 'Many tasks are too unstructured or context-dependent for automation — inbox triage, travel booking, vendor outreach, data cleanup, appointment scheduling. A human assistant adapts to your workflow without you building custom tooling.',
    price: '$5–15/hour',
    cadence: 'Ongoing (daily or weekly)',
    timeline: '1–4 hours/day',
    playbook: `${PLAYBOOK_BASE}/virtual-assistant.md`,
    deliverables: [
      'Completed tasks logged with status and notes',
      'Daily or weekly summary of work done',
      'Proactive flags on items needing your attention',
    ],
    agentSteps: [
      'Search for humans with "virtual assistant", "admin", or "data entry" skills',
      'Create a job offer with task list and priority order',
      'Human works through tasks, asks clarifying questions via job messages',
      'Review completed work, set up recurring job for ongoing support',
    ],
  },
];


function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'use-cases' }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return <p className="text-sm text-green-700 font-medium">You're in. We'll let you know when physical services launch near you.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        className="flex-1 w-full sm:w-auto px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {status === 'loading' ? 'Subscribing...' : 'Notify me'}
      </button>
      {status === 'error' && <p className="text-xs text-red-500 mt-1">Something went wrong. Try again.</p>}
    </form>
  );
}

export default function UseCasesPage() {
  return (
    <>
      <SEO
        title="HumanPages.ai | Real-world tasks for your AI Agent"
        description="You prompt, humans deliver. Connect the MCP and delegate tasks automatically."
        path="/use-cases"
        ogImage="https://humanpages.ai/api/og/use-cases"
      />

      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4">
            <Link to="/dev" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:inline">
              Developers
            </Link>
            <Link to="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:inline">
              Pricing
            </Link>
            <LanguageSwitcher />
            <Link to="/dev" className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-slate-50">
        {/* Free trial hero */}
        <section className="py-14 md:py-20 px-4 bg-gradient-to-br from-green-50 via-white to-blue-50 border-b border-green-100">
          <div className="max-w-2xl mx-auto text-center">
            {/* pricing badge hidden */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Publish to 10–15 directories in one prompt
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto mb-6">
              Your agent hires a human, sends the brief, and gets back a full report — AI tool directories, SaaS listings, startup launches, dev platforms, and more.
            </p>
            <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto mb-6">
              You'll experience the full agent-hires-human flow end-to-end. One prompt, real submissions.
            </p>

            {/* Guarantee badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-green-300 rounded-full mb-8 shadow-sm">
              <ShieldCheckIcon className="w-5 h-5 text-green-600 shrink-0" />
              <span className="text-sm font-semibold text-slate-900">3-day delivery guarantee</span>
              <span className="text-sm text-slate-500">— if the human doesn't deliver, our team will. No extra charge.</span>
            </div>

            <div>
              <Link
                to="/dev"
                className="inline-block px-8 py-3.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-lg shadow-lg shadow-green-600/25"
              >
                Register your agent
              </Link>
              {/* pricing note hidden */}
            </div>
          </div>
        </section>

        {/* How it works — directory submission walkthrough */}
        <section className="py-12 md:py-16 px-4 bg-white border-b border-slate-100">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">How directory submission works</h2>
            <p className="text-slate-600 mb-8">Your agent handles the entire flow autonomously. Here's what happens:</p>

            <div className="space-y-4">
              {[
                { step: '1', title: 'Your agent searches for a human', desc: 'It finds someone with directory submission experience using the search_humans MCP tool.' },
                { step: '2', title: 'It creates a job offer', desc: 'Your product details + a list of 10–15 directories matched to your product type (AI tools, SaaS, dev tools, etc.). The human accepts.' },
                { step: '3', title: 'The human submits to each directory', desc: 'Manual forms, CAPTCHAs, email confirmations — all handled. They log every result.' },
                { step: '4', title: 'You get a deliverable', desc: 'A table with every directory URL, submission status, and notes. Your agent verifies and approves.' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 text-sm font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{item.title}</h3>
                    <p className="text-sm text-slate-600 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-5 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-green-800 font-semibold">
                    3-day delivery guarantee
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    If the hired human doesn't deliver, our team steps in and finishes it within 3 days. No extra charge, no exceptions.
                  </p>
                  {/* pricing note hidden */}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* More use cases */}
        <section className="py-12 md:py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">More things your agent can hire for</h2>
            <p className="text-slate-600 mb-8">
              Directory submissions are just the start. Here are 6 more tasks with ready-made playbooks.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {USE_CASES.filter(uc => uc.id !== 'directory-submissions').map((uc) => (
                <a
                  key={uc.id}
                  href={uc.playbook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    {uc.icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">{uc.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{uc.tagline}</p>
                  <span className="inline-block mt-3 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    {uc.price}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Coming soon: physical services */}
        <section className="py-12 px-4 bg-white border-t border-slate-100">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-medium text-blue-600 uppercase tracking-wide mb-2">Coming soon</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Physical services in your region</h2>
            <p className="text-slate-600 mb-6">
              We're expanding beyond digital tasks. Soon your agent will be able to hire humans for photography, deliveries, on-site inspections, and other physical services — matched to your location.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Sign up to our newsletter to get notified when physical services launch in your area.
            </p>
            <NewsletterForm />
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Try it now</h2>
            <p className="text-slate-600 mb-6">
              Register your agent, run your first directory submission, then pick any use case above.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/dev"
                className="inline-block px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Register your agent
              </Link>
              <Link
                to="/pricing"
                className="inline-block px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
