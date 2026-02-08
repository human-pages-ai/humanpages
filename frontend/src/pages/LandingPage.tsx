import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import SEO from '../components/SEO';

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

export default function LandingPage() {
  const { t } = useTranslation();

  const TASKS = [
    { icon: '📸', title: t('landing.tasks.photography'), description: t('landing.tasks.photographyDesc') },
    { icon: '🔍', title: t('landing.tasks.research'), description: t('landing.tasks.researchDesc') },
    { icon: '📞', title: t('landing.tasks.phoneCalls'), description: t('landing.tasks.phoneCallsDesc') },
    { icon: '🚗', title: t('landing.tasks.deliveries'), description: t('landing.tasks.deliveriesDesc') },
    { icon: '✍️', title: t('landing.tasks.dataEntry'), description: t('landing.tasks.dataEntryDesc') },
    { icon: '🏪', title: t('landing.tasks.mysteryShopping'), description: t('landing.tasks.mysteryShoppingDesc') },
  ];

  const BENEFITS = [
    { title: t('landing.benefits.findWork'), description: t('landing.benefits.findWorkDesc') },
    { title: t('landing.benefits.keepEarnings'), description: t('landing.benefits.keepEarningsDesc') },
    { title: t('landing.benefits.workAnywhere'), description: t('landing.benefits.workAnywhereDesc') },
  ];

  const TRUST_ITEMS = [
    { icon: '🔒', text: t('landing.trust.dataPrivacy') },
    { icon: '👁️', text: t('landing.trust.visibility') },
    { icon: '💬', text: t('landing.trust.contact') },
  ];

  const FAQS = [
    { q: t('landing.faq.whatIs'), a: t('landing.faq.whatIsAnswer') },
    { q: t('landing.faq.howHired'), a: t('landing.faq.howHiredAnswer') },
    { q: t('landing.faq.howPaid'), a: t('landing.faq.howPaidAnswer') },
    { q: t('landing.faq.available'), a: t('landing.faq.availableAnswer') },
    { q: t('landing.faq.free'), a: t('landing.faq.freeAnswer') },
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
          "description": "AI-to-Human marketplace connecting AI agents with real people for real-world tasks",
          "sameAs": []
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
            { "@type": "ListItem", "position": 2, "name": "Developers", "item": "https://humanpages.ai/dev" },
            { "@type": "ListItem", "position": 3, "name": "Blog", "item": "https://humanpages.ai/blog" }
          ]
        }}
      />
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link to="/" className="text-sm font-medium text-slate-900 hidden sm:inline">
              {t('nav.humans')}
            </Link>
            <Link to="/dev" className="text-sm text-slate-500 hover:text-slate-700 hidden sm:inline">
              {t('nav.developers')}
            </Link>
            <LanguageSwitcher />
            <Link
              to="/signup"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('nav.startProfile')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-16 md:py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl">
            <p className="text-blue-600 font-medium mb-2">{t('landing.hero.tagline')}</p>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
              {t('landing.hero.title')}<br />{t('landing.hero.titleLine2')}
            </h1>
            <p className="mt-4 text-xl text-slate-600">
              {t('landing.hero.subtitle')}
            </p>
            <div className="mt-8">
              <Link
                to="/signup"
                className="inline-block px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                {t('landing.hero.cta')}
              </Link>
              <span className="ml-4 inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                {t('common.free')} · {t('common.noFees')}
              </span>
            </div>
            <p className="mt-4 text-slate-500 text-sm">
              {t('landing.hero.flow')}
            </p>
          </div>
        </div>
      </section>

      {/* What you can do */}
      <section className="py-16 bg-slate-50 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-4">
            {t('landing.tasks.title')}
          </h2>
          <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
            {t('landing.tasks.subtitle')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {TASKS.map((task) => (
              <div
                key={task.title}
                className="bg-white p-6 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <span className="text-3xl">{task.icon}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{task.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{task.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why this works */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
            {t('landing.benefits.title')}
          </h2>
          <div className="space-y-8">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{benefit.title}</h3>
                  <p className="mt-1 text-slate-600">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="py-12 bg-blue-600 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            {t('landing.cta.ready')}
          </h2>
          <p className="mt-2 text-blue-100">
            {t('landing.cta.createListing')}
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
          >
            {t('landing.hero.cta')}
          </Link>
        </div>
      </section>

      {/* Trust & Controls */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
            {t('landing.trust.title')}
          </h2>
          <div className="space-y-4">
            {TRUST_ITEMS.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
            {t('landing.faq.title')}
          </h2>
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-6">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
            {t('landing.cta.startGetting')}
          </h2>
          <p className="mt-2 text-slate-600">
            {t('landing.cta.letOpportunities')}
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('landing.hero.cta')}
          </Link>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-slate-200 px-4">
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

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 md:hidden">
        <Link
          to="/signup"
          className="block w-full text-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('landing.hero.cta')}
        </Link>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
