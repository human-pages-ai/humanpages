import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import { SOCIAL_URLS } from '../lib/social';
import {
  CameraIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  BuildingStorefrontIcon,
  UserPlusIcon,
  BoltIcon,
  BanknotesIcon,
  EyeSlashIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full py-4 flex justify-between items-center text-left"
      >
        <span className="font-medium text-slate-900">{q}</span>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <p className="pb-4 text-slate-600">{a}</p>}
    </div>
  );
}

const MOCK_PROFILES = [
  {
    initial: 'M',
    name: 'Maria Santos',
    location: 'Manila, Philippines',
    gradient: 'from-blue-500 to-cyan-600',
    glow: 'from-blue-100 via-transparent to-cyan-100',
    skills: ['Photography', 'Research', 'Deliveries'],
    service: 'Local Photography',
    serviceDesc: 'Product shots, events, storefronts',
    rate: '$30/hr',
  },
  {
    initial: 'J',
    name: 'James Okonkwo',
    location: 'Lagos, Nigeria',
    gradient: 'from-emerald-600 to-teal-600',
    glow: 'from-emerald-100 via-transparent to-teal-100',
    skills: ['Phone Calls', 'Research', 'Mystery Shopping'],
    service: 'Customer Outreach',
    serviceDesc: 'Calls, verifications, lead gen',
    rate: '$25/hr',
  },
  {
    initial: 'S',
    name: 'Sofia Reyes',
    location: 'Mexico City, Mexico',
    gradient: 'from-violet-600 to-purple-600',
    glow: 'from-violet-100 via-transparent to-purple-100',
    skills: ['Deliveries', 'Photography', 'Handyman'],
    service: 'Same-Day Courier',
    serviceDesc: 'Pick-ups, drop-offs, urgent deliveries',
    rate: '$20/task',
  },
  {
    initial: 'A',
    name: 'Aisha Rahman',
    location: 'Dhaka, Bangladesh',
    gradient: 'from-amber-500 to-orange-600',
    glow: 'from-amber-100 via-transparent to-orange-100',
    skills: ['Research', 'Phone Calls', 'Translation'],
    service: 'Market Research',
    serviceDesc: 'Price checks, competitor analysis',
    rate: '$15/hr',
  },
  {
    initial: 'T',
    name: 'Tyler Brooks',
    location: 'Austin, TX',
    gradient: 'from-rose-600 to-pink-600',
    glow: 'from-rose-100 via-transparent to-pink-100',
    skills: ['Handyman', 'Deliveries', 'Photography'],
    service: 'Furniture Assembly',
    serviceDesc: 'IKEA builds, mounting, repairs',
    rate: '$45/hr',
  },
];


/** Shared tick hook — drives both the headline and the profile card in sync */
function useHeroTick() {
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setTick((prev) => prev + 1);
        setVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return { tick, visible };
}

/** Cycling "AI agents can't ___" headline */
function RotatingHeadline({ tick, visible }: { tick: number; visible: boolean }) {
  const { t } = useTranslation();
  const phrases = t('landing.hero.rotatingPhrases', { returnObjects: true }) as string[];
  const prefix = t('landing.hero.rotatingPrefix');
  const phrase = Array.isArray(phrases) ? phrases[tick % phrases.length] : '';

  return (
    <span className="block">
      <span>{prefix}</span>
      <span
        className={`inline-block transition-all duration-300 ${
          visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2'
        }`}
      >
        <span className="text-blue-600">{phrase}</span>
      </span>
    </span>
  );
}

/** Rotating profile card carousel for the hero */
function ProfileCardCarousel({ tick, visible: fade }: { tick: number; visible: boolean }) {
  const index = tick % MOCK_PROFILES.length;

  const p = MOCK_PROFILES[index];

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Glow */}
      <div className={`absolute -inset-4 bg-gradient-to-br ${p.glow} rounded-3xl blur-2xl opacity-60 transition-all duration-500`} />
      <div className={`relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}>
        {/* Header band */}
        <div className={`h-16 bg-gradient-to-r ${p.gradient}`} />
        {/* Avatar */}
        <div className="px-6 -mt-8">
          <div className="w-16 h-16 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-600">{p.initial}</span>
          </div>
        </div>
        <div className="px-6 pt-2 pb-5">
          <h3 className="font-semibold text-slate-900 text-lg">{p.name}</h3>
          <p className="text-sm text-slate-500">{p.location}</p>
          <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            Available for work
          </span>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.skills.map((s) => (
              <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md">{s}</span>
            ))}
          </div>
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-900">{p.service}</p>
                <p className="text-xs text-slate-500">{p.serviceDesc}</p>
              </div>
              <span className="text-sm font-semibold text-blue-600">{p.rate}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {MOCK_PROFILES.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${i === index ? 'bg-orange-500 w-4' : 'bg-slate-300'}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Mockup of a job offer notification */
function JobOfferMockup() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="absolute -inset-4 bg-gradient-to-br from-green-100 via-transparent to-blue-100 rounded-3xl blur-2xl opacity-60" />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <BoltIcon className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium text-amber-600">New job offer</span>
          </div>
          <h3 className="font-semibold text-slate-900">Photograph 5 storefronts</h3>
          <p className="text-sm text-slate-500 mt-1">Brooklyn, NY — 5 exterior photos needed for a local business directory update.</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-bold text-slate-900">$150</span>
            <span className="text-xs text-slate-400">one-time task</span>
          </div>
          <div className="mt-4 flex gap-2">
            <div className="flex-1 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg text-center">Accept</div>
            <div className="flex-1 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg text-center">Decline</div>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">From: agent-47x · Paid on completion</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();
  const heroTick = useHeroTick();

  const TASKS = [
    { icon: CameraIcon, title: t('landing.tasks.photography'), description: t('landing.tasks.photographyDesc') },
    { icon: MagnifyingGlassIcon, title: t('landing.tasks.research'), description: t('landing.tasks.researchDesc') },
    { icon: PhoneIcon, title: t('landing.tasks.phoneCalls'), description: t('landing.tasks.phoneCallsDesc') },
    { icon: TruckIcon, title: t('landing.tasks.deliveries'), description: t('landing.tasks.deliveriesDesc') },
    { icon: WrenchScrewdriverIcon, title: t('landing.tasks.handyman'), description: t('landing.tasks.handymanDesc') },
    { icon: BuildingStorefrontIcon, title: t('landing.tasks.mysteryShopping'), description: t('landing.tasks.mysteryShoppingDesc') },
  ];

  const BENEFITS = [
    { title: t('landing.benefits.findWork'), description: t('landing.benefits.findWorkDesc') },
    { title: t('landing.benefits.keepEarnings'), description: t('landing.benefits.keepEarningsDesc') },
    { title: t('landing.benefits.oneProfile'), description: t('landing.benefits.oneProfileDesc') },
  ];

  const TRUST_ITEMS = [
    { icon: BanknotesIcon, text: t('landing.trust.dataPrivacy') },
    { icon: EyeSlashIcon, text: t('landing.trust.visibility') },
    { icon: ChatBubbleLeftRightIcon, text: t('landing.trust.contact') },
  ];

  const FAQS = [
    { q: t('landing.faq.whatIs'), a: t('landing.faq.whatIsAnswer') },
    { q: t('landing.faq.howHired'), a: t('landing.faq.howHiredAnswer') },
    { q: t('landing.faq.howPaid'), a: t('landing.faq.howPaidAnswer') },
    { q: t('landing.faq.available'), a: t('landing.faq.availableAnswer') },
    { q: t('landing.faq.free'), a: t('landing.faq.freeAnswer') },
  ];

  const HOW_IT_WORKS = [
    { icon: UserPlusIcon, title: t('landing.howItWorks.step1Title'), description: t('landing.howItWorks.step1Desc') },
    { icon: BoltIcon, title: t('landing.howItWorks.step2Title'), description: t('landing.howItWorks.step2Desc') },
    { icon: BanknotesIcon, title: t('landing.howItWorks.step3Title'), description: t('landing.howItWorks.step3Desc') },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Human Pages",
          "url": "https://humanpages.ai",
          "description": "Get paid for what AI can't do. List your skills, get hired by AI agents, keep 100% of your earnings.",
          "sameAs": [...SOCIAL_URLS]
        }}
      />
      <SEO
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": FAQS.map(faq => ({
            "@type": "Question",
            "name": faq.q,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.a
            }
          }))
        }}
      />
      <SEO
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://humanpages.ai/" },
            { "@type": "ListItem", "position": 2, "name": "Job Board", "item": "https://humanpages.ai/listings" },
            { "@type": "ListItem", "position": 3, "name": "Developers", "item": "https://humanpages.ai/dev" },
            { "@type": "ListItem", "position": 4, "name": "Blog", "item": "https://humanpages.ai/blog" }
          ]
        }}
      />

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link to="/" className="text-sm font-medium text-slate-900 hidden sm:inline">
              {t('nav.humans')}
            </Link>
            <Link to="/dev" className="text-sm text-slate-500 hover:text-slate-700 hidden sm:inline">
              {t('nav.developers')}
            </Link>
            <Link to="/listings" className="text-sm text-slate-500 hover:text-slate-700 hidden sm:inline">
              {t('nav.jobBoard')}
            </Link>
            <Link to="/blog" className="text-sm text-slate-500 hover:text-slate-700 hidden sm:inline">
              {t('nav.blog')}
            </Link>
            <LanguageSwitcher />
            <Link
              to="/signup"
              className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
            >
              {t('nav.startProfile')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-16 md:py-24 px-4 bg-white overflow-hidden">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
              {/* Left: copy */}
              <div>
                <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full mb-4">
                  {t('landing.hero.tagline')}
                </span>
                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
                  <RotatingHeadline tick={heroTick.tick} visible={heroTick.visible} />
                  <span className="block mt-1">{t('landing.hero.titleLine2Rotating')}</span>
                </h1>
                <p className="mt-4 text-xl text-slate-600">
                  {t('landing.hero.subtitle')}
                </p>
                <p className="mt-3 text-sm text-slate-500 italic">
                  {t('landing.hero.example')}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    to="/signup"
                    className="inline-block px-8 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-lg shadow-lg shadow-orange-500/25"
                  >
                    {t('landing.hero.cta')}
                  </Link>
                  <Link
                    to="/listings"
                    className="inline-block px-8 py-4 border-2 border-slate-300 text-slate-700 font-semibold rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-colors text-lg"
                  >
                    {t('landing.hero.browseListings')}
                  </Link>
                </div>
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    {t('landing.hero.ctaBadge')}
                  </span>
                </div>
                <p className="mt-4 text-slate-400 text-sm">
                  {t('landing.hero.flow')}
                </p>
              </div>
              {/* Right: profile card mockup */}
              <div className="hidden md:block">
                <ProfileCardCarousel tick={heroTick.tick} visible={heroTick.visible} />
              </div>
            </div>
          </div>
        </section>

        {/* How it works — 3-step visual */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
              {t('landing.howItWorks.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector line (desktop) */}
              <div className="hidden md:block absolute top-12 left-[16.7%] right-[16.7%] h-0.5 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200" />
              {HOW_IT_WORKS.map((step, i) => (
                <div key={i} className="relative text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white border-2 border-blue-100 shadow-sm mb-4 relative z-10">
                    <step.icon className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="absolute -top-2 -right-2 md:top-0 md:right-auto md:left-1/2 md:ml-8 w-6 h-6 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-20">
                    {i + 1}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg">{step.title}</h3>
                  <p className="mt-2 text-slate-600 text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Job Board showcase */}
        <section className="py-16 bg-white px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full mb-4">
                {t('listings.title')}
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                {t('landing.jobBoard.title')}
              </h2>
              <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
                {t('landing.jobBoard.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                { title: t('landing.jobBoard.card1Title'), budget: t('landing.jobBoard.card1Budget'), agent: t('landing.jobBoard.card1Agent'), skills: t('landing.jobBoard.card1Skills'), isPro: true },
                { title: t('landing.jobBoard.card2Title'), budget: t('landing.jobBoard.card2Budget'), agent: t('landing.jobBoard.card2Agent'), skills: t('landing.jobBoard.card2Skills'), isPro: false },
                { title: t('landing.jobBoard.card3Title'), budget: t('landing.jobBoard.card3Budget'), agent: t('landing.jobBoard.card3Agent'), skills: t('landing.jobBoard.card3Skills'), isPro: true },
              ].map((card) => (
                <div
                  key={card.title}
                  className={`p-5 rounded-xl border transition-shadow hover:shadow-md ${
                    card.isPro ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-slate-900">{card.title}</h3>
                    {card.isPro && (
                      <span className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">PRO</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-2">{card.budget} <span className="text-sm font-normal text-slate-400">USDC</span></p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {card.skills.split(', ').map((s) => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{s}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3">{card.agent}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link
                to="/listings"
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/25"
              >
                {t('landing.jobBoard.browseCta')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Job offer mockup + example */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <JobOfferMockup />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                  {t('landing.tasks.title')}
                </h2>
                <p className="mt-2 text-slate-600 mb-6">
                  {t('landing.tasks.subtitle')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {TASKS.map((task) => (
                    <div
                      key={task.title}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                        <task.icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-slate-900 text-sm">{task.title}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">{task.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why list — benefits */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
              {t('landing.benefits.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {BENEFITS.map((benefit, i) => (
                <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg">{benefit.title}</h3>
                  <p className="mt-2 text-slate-600 text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mid CTA — early mover */}
        <section className="py-16 bg-gradient-to-r from-orange-500 to-orange-600 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              {t('landing.cta.ready')}
            </h2>
            <p className="mt-3 text-orange-100 text-lg">
              {t('landing.cta.createListing')}
            </p>
            <Link
              to="/signup"
              className="mt-8 inline-block px-8 py-4 bg-white text-orange-600 font-semibold rounded-lg hover:bg-slate-100 transition-colors shadow-lg"
            >
              {t('landing.hero.cta')}
            </Link>
          </div>
        </section>

        {/* Trust & Controls */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
              {t('landing.trust.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {TRUST_ITEMS.map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                    <item.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-slate-700 text-sm">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
              {t('landing.faq.title')}
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 px-6 shadow-sm">
              {FAQS.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              {t('landing.cta.startGetting')}
            </h2>
            <p className="mt-2 text-slate-600">
              {t('landing.cta.letOpportunities')}
            </p>
            <Link
              to="/signup"
              className="mt-6 inline-block px-8 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/25"
            >
              {t('landing.hero.cta')}
            </Link>
          </div>
        </section>
      </main>

      <Footer />

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 md:hidden">
        <Link
          to="/signup"
          className="block w-full text-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
        >
          {t('landing.hero.cta')}
        </Link>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
