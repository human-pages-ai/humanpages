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
  ChevronDownIcon,
  ChevronUpIcon,
  RocketLaunchIcon,
  CodeBracketIcon,
  ShieldCheckIcon,
  ArrowTopRightOnSquareIcon,
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
    tagline: 'Submit your product to 80+ startup directories for SEO and visibility.',
    why: 'Most directories require manual forms with CAPTCHAs, email confirmations, unique descriptions, and account creation. No API, no shortcut — just a human clicking through.',
    guarantee: 'If the human doesn\'t finish, our staff completes the submissions within 3 days — no extra charge.',
    price: '$5 per batch of 10–15 directories',
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
    price: '$50–100/week',
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
];

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-6 flex items-start gap-4"
      >
        <div className="shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          {useCase.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{useCase.title}</h3>
            {useCase.isNew && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">New</span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">{useCase.tagline}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              {useCase.price}
            </span>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {useCase.cadence}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-slate-400 mt-1">
          {expanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-5">
          {/* Why human */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-1.5">Why this needs a human</h4>
            <p className="text-sm text-slate-600">{useCase.why}</p>
          </div>

          {/* Guarantee */}
          {useCase.guarantee && (
            <div className="flex items-start gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <ShieldCheckIcon className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-green-800">{useCase.guarantee}</p>
            </div>
          )}

          {/* Details row */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-1.5">Timeline</h4>
              <p className="text-sm text-slate-600">{useCase.timeline}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-1.5">What you get</h4>
              <ul className="space-y-1">
                {useCase.deliverables.map((d, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-1.5">
                    <span className="text-blue-500 mt-1.5 shrink-0 w-1 h-1 rounded-full bg-blue-500" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Agent workflow */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
              <CodeBracketIcon className="w-4 h-4 text-blue-600" />
              How your agent does it
            </h4>
            <ol className="space-y-2">
              {useCase.agentSteps.map((step, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Full playbook link */}
          <a
            href={useCase.playbook}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Full playbook on GitHub
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function UseCasesPage() {
  return (
    <>
      <SEO
        title="Use Cases — Human Pages"
        description="Real tasks your AI agent can delegate to humans today. Directory submissions, QA testing, localization, competitor monitoring, and more."
        path="/use-cases"
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
            <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full mb-4">
              Free for your first run
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Your product on 10–15 directories in 3 days. Free.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto mb-6">
              Register your agent and we'll submit your product to startup directories at no cost. You'll see the full agent-hires-human flow working end-to-end before you spend a cent.
            </p>

            {/* Guarantee badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-green-300 rounded-full mb-8 shadow-sm">
              <ShieldCheckIcon className="w-5 h-5 text-green-600 shrink-0" />
              <span className="text-sm font-semibold text-slate-900">3-day delivery guarantee</span>
              <span className="text-sm text-slate-500">— if the human doesn't finish, our team will. No extra charge.</span>
            </div>

            <div>
              <Link
                to="/dev"
                className="inline-block px-8 py-3.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-lg shadow-lg shadow-green-600/25"
              >
                Register your agent
              </Link>
              <p className="mt-3 text-xs text-slate-400">Takes 2 minutes. No payment required.</p>
            </div>
          </div>
        </section>

        {/* How it works — directory submission walkthrough */}
        <section className="py-12 md:py-16 px-4 bg-white border-b border-slate-100">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">How the free submission works</h2>
            <p className="text-slate-600 mb-8">Your agent handles the entire flow autonomously. Here's what happens:</p>

            <div className="space-y-4">
              {[
                { step: '1', title: 'Your agent searches for a human', desc: 'It finds someone with directory submission experience using the search_humans tool.' },
                { step: '2', title: 'It creates a job offer', desc: 'Your product details + a list of 10–15 directories. The human accepts.' },
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
                    Your first batch is free. If the hired human doesn't complete the work, our team steps in and finishes it within 3 days. No extra charge, no exceptions.
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    After your free run, directory submissions cost ~$5 per batch of 10–15 directories — same guarantee applies.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* More use cases */}
        <section className="py-12 md:py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">More things your agent can hire for</h2>
            <p className="text-slate-600 mb-8">
              Directory submissions are just the start. Here are 5 more tasks with ready-made playbooks.
            </p>
            <div className="space-y-4">
              {USE_CASES.filter(uc => uc.id !== 'directory-submissions').map((uc) => (
                <UseCaseCard key={uc.id} useCase={uc} />
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Try it free</h2>
            <p className="text-slate-600 mb-6">
              Register your agent, get your first directory submission on us, then pick any use case above.
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
