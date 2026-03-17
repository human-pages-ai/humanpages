import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Turnstile } from 'react-turnstile';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import { SOCIAL_LINKS } from '../lib/social';
import { api } from '../lib/api';
import {
  ShieldCheckIcon,
  BanknotesIcon,
  GlobeAltIcon,
  CpuChipIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';


function ContactForm() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!captchaToken) {
      setErrorMsg(t('about.formCaptchaError'));
      setStatus('error');
      return;
    }
    setStatus('sending');
    setErrorMsg('');

    try {
      await api.submitFeedback({
        type: 'FEEDBACK',
        category: 'contact',
        title: `Contact form: ${name || 'Anonymous'}`,
        description: message,
        contactName: name || undefined,
        contactEmail: email || undefined,
        captchaToken,
        pageUrl: window.location.href,
        browser: navigator.userAgent.split(' ').pop() || '',
        userAgent: navigator.userAgent,
      });
      setStatus('sent');
      setName('');
      setEmail('');
      setMessage('');
      setCaptchaToken('');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || t('about.formGenericError'));
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <p className="text-green-800 font-medium text-lg">{t('about.formSent')}</p>
        <p className="text-green-600 mt-1 text-sm">{t('about.formSentSub')}</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          {t('about.formSendAnother')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700 mb-1">
            {t('about.formName')} <span className="text-slate-400">({t('common.optional')})</span>
          </label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder={t('about.formNamePlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700 mb-1">
            {t('about.formEmail')} <span className="text-slate-400">({t('common.optional')})</span>
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="you@example.com"
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700 mb-1">
          {t('about.formMessage')} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={1}
          maxLength={5000}
          rows={4}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
          placeholder={t('about.formMessagePlaceholder')}
        />
      </div>
      <Turnstile
        sitekey={TURNSTILE_SITE_KEY}
        onVerify={(token) => setCaptchaToken(token)}
        onExpire={() => setCaptchaToken('')}
      />
      {status === 'error' && errorMsg && (
        <p className="text-red-600 text-sm">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={status === 'sending' || !message.trim()}
        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {status === 'sending' ? t('about.formSending') : t('about.formSend')}
      </button>
    </form>
  );
}

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="About"
        description="Human Pages is the marketplace where AI agents hire humans for real-world tasks. Learn about our mission, how we work, and why we charge zero platform fees."
        path="/about"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "name": "About Human Pages",
          "description": "Human Pages is the AI-to-human task marketplace. AI agents discover and hire verified humans for photography, deliveries, research, and more.",
          "url": "https://humanpages.ai/about",
          "mainEntity": {
            "@type": "Organization",
            "name": "Human Pages",
            "url": "https://humanpages.ai",
            "foundingDate": "2025",
            "description": "The marketplace where AI agents hire humans for real-world tasks. Zero platform fees.",
            "sameAs": SOCIAL_LINKS.map(l => l.href)
          }
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-700 hidden sm:inline">
              {t('nav.home')}
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
        <section className="py-16 md:py-24 px-4 bg-white">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
              {t('about.heroTitle')}
            </h1>
            <p className="mt-6 text-xl text-slate-600 leading-relaxed">
              {t('about.heroSubtitle')}
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">{t('about.missionTitle')}</h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              {t('about.missionP1')}
            </p>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              {t('about.missionP2')}
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 bg-white px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">{t('about.howItWorksTitle')}</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <UserGroupIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">{t('about.forHumansTitle')}</h3>
                  <p className="mt-1 text-slate-600">
                    {t('about.forHumansDesc')}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <CpuChipIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">{t('about.forAgentsTitle')}</h3>
                  <p className="mt-1 text-slate-600">
                    {t('about.forAgentsDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Principles / Trust signals */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">{t('about.principlesTitle')}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                  <BanknotesIcon className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900 text-lg">{t('about.zeroFeesTitle')}</h3>
                <p className="mt-2 text-slate-600 text-sm">
                  {t('about.zeroFeesDesc')}
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 text-lg">{t('about.privacyTitle')}</h3>
                <p className="mt-2 text-slate-600 text-sm">
                  {t('about.privacyDesc')}
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center mb-4">
                  <GlobeAltIcon className="w-6 h-6 text-violet-600" />
                </div>
                <h3 className="font-semibold text-slate-900 text-lg">{t('about.globalTitle')}</h3>
                <p className="mt-2 text-slate-600 text-sm">
                  {t('about.globalDesc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section id="contact" className="py-16 bg-white px-4">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{t('about.contactTitle')}</h2>
            <p className="text-slate-600 mb-6">
              {t('about.contactSubtitle')}
            </p>
            <ContactForm />
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-slate-600 text-sm">
                {t('about.followUs')}{' '}
                {SOCIAL_LINKS.filter(l => l.name !== 'Linktree').map((link, i, arr) => (
                  <span key={link.name}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{link.name}</a>
                    {i < arr.length - 1 ? ', ' : ''}
                  </span>
                ))}
                {' '}{t('about.forUpdates')}
              </p>
              <p className="mt-2 text-slate-600 text-sm">
                {t('about.joinTeam')} <Link to="/careers" className="text-blue-600 hover:underline">{t('about.careersPage')}</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-700 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              {t('about.ctaTitle')}
            </h2>
            <p className="mt-3 text-blue-100 text-lg">
              {t('about.ctaSubtitle')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                to="/signup"
                className="inline-block px-8 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors shadow-lg"
              >
                {t('landing.hero.cta')}
              </Link>
              <Link
                to="/dev"
                className="inline-block px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
              >
                {t('nav.developers')} API
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Featured On */}
      <div className="py-6 bg-slate-50 border-t border-slate-200 text-center">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <p className="text-xs text-slate-400">
            {t('about.featuredOn')}{' '}
            <a href="https://dang.ai/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-500">Dang AI</a>
          </p>
          <a href="https://fazier.com/launches/humanpages.ai" target="_blank" rel="noopener noreferrer">
            <img src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=neutral" width={250} alt="Fazier badge" />
          </a>
        </div>
      </div>

      <Footer />
    </div>
  );
}
