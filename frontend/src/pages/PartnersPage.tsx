import { useState, FormEvent } from 'react';
import { Turnstile } from 'react-turnstile';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import { api } from '../lib/api';
import {
  BanknotesIcon,
  ChartBarIcon,
  CpuChipIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

function PartnerContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [userCount, setUserCount] = useState('');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!captchaToken) {
      setErrorMsg('Please complete the captcha.');
      setStatus('error');
      return;
    }
    setStatus('sending');
    setErrorMsg('');

    try {
      await api.submitFeedback({
        type: 'FEEDBACK',
        category: 'partnership',
        title: `Partner enquiry: ${company || name || 'Unknown'}`,
        description: [
          `Name: ${name}`,
          `Email: ${email}`,
          `Company: ${company}`,
          `Website: ${website}`,
          `Estimated users: ${userCount}`,
          `Message: ${message}`,
        ].join('\n'),
        contactName: name || undefined,
        contactEmail: email || undefined,
        captchaToken,
        pageUrl: window.location.href,
        browser: navigator.userAgent.split(' ').pop() || '',
        userAgent: navigator.userAgent,
      });
      setStatus('sent');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <p className="text-green-800 font-medium text-lg">Thanks! We'll be in touch within 24 hours.</p>
        <p className="text-green-600 mt-1 text-sm">Check your email for a confirmation.</p>
        <button
          onClick={() => { setStatus('idle'); setName(''); setEmail(''); setCompany(''); setWebsite(''); setUserCount(''); setMessage(''); setCaptchaToken(''); }}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Submit another enquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="partner-name" className="block text-sm font-medium text-slate-700 mb-1">
            Your name <span className="text-red-500">*</span>
          </label>
          <input
            id="partner-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <label htmlFor="partner-email" className="block text-sm font-medium text-slate-700 mb-1">
            Work email <span className="text-red-500">*</span>
          </label>
          <input
            id="partner-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="jane@jobboard.com"
          />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="partner-company" className="block text-sm font-medium text-slate-700 mb-1">
            Company / Job board name <span className="text-red-500">*</span>
          </label>
          <input
            id="partner-company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
            maxLength={200}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Acme Jobs"
          />
        </div>
        <div>
          <label htmlFor="partner-website" className="block text-sm font-medium text-slate-700 mb-1">
            Website
          </label>
          <input
            id="partner-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={300}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="https://acmejobs.com"
          />
        </div>
      </div>
      <div>
        <label htmlFor="partner-users" className="block text-sm font-medium text-slate-700 mb-1">
          Estimated number of registered users
        </label>
        <select
          id="partner-users"
          value={userCount}
          onChange={(e) => setUserCount(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          <option value="">Select range</option>
          <option value="<1k">Less than 1,000</option>
          <option value="1k-10k">1,000 - 10,000</option>
          <option value="10k-100k">10,000 - 100,000</option>
          <option value="100k-1m">100,000 - 1,000,000</option>
          <option value="1m+">1,000,000+</option>
        </select>
      </div>
      <div>
        <label htmlFor="partner-message" className="block text-sm font-medium text-slate-700 mb-1">
          Anything else you'd like us to know?
        </label>
        <textarea
          id="partner-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
          placeholder="Tell us about your platform, your users, or what you're looking for in a partnership..."
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
        disabled={status === 'sending' || !name.trim() || !email.trim() || !company.trim()}
        className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
      >
        {status === 'sending' ? 'Sending...' : 'Let\'s talk partnership'}
      </button>
    </form>
  );
}

const BENEFITS = [
  {
    icon: BanknotesIcon,
    title: 'Revenue share on every transaction',
    desc: 'Earn a percentage every time an AI agent pays to view a profile or send a job offer to a user you referred. Passive, recurring income from users you already have.',
  },
  {
    icon: ArrowTrendingUpIcon,
    title: 'Monetise dormant profiles',
    desc: 'Most job board users sign up, find a job, and go silent. With Human Pages, those profiles keep earning you money as AI agents discover and reach out to them.',
  },
  {
    icon: UserGroupIcon,
    title: 'Increase user retention',
    desc: 'Give your users a reason to keep their profiles updated. "AI agents are looking for you" is a powerful re-engagement hook that keeps users coming back.',
  },
  {
    icon: CpuChipIcon,
    title: 'AI-ready without building anything',
    desc: 'AI agents are already using Human Pages to find and hire people. Your users get discovered by these agents without you building any AI infrastructure.',
  },
  {
    icon: ChartBarIcon,
    title: 'Demand insights for your market',
    desc: 'See which skills and roles AI agents are searching for most. Use this data to guide your content strategy, job matching, and user acquisition.',
  },
  {
    icon: BoltIcon,
    title: 'Simple integration, zero risk',
    desc: 'A referral link, an embedded widget, or a bulk CSV import. Pick what works for you. No upfront cost, no engineering commitment, no risk.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Your users create profiles',
    desc: 'Via a referral link, embedded widget, or bulk import — whatever fits your platform best.',
  },
  {
    step: '2',
    title: 'AI agents discover them',
    desc: 'Agents search Human Pages for people with the right skills. They pay to view profiles and send job offers.',
  },
  {
    step: '3',
    title: 'You earn on every transaction',
    desc: 'Every paid profile view and job offer generates revenue. You get a share, tracked and paid automatically.',
  },
];

export default function PartnersPage() {
  return (
    <>
      <SEO
        title="Partner with Human Pages — Monetise your job board with AI"
        description="Give your users access to AI-powered job discovery and earn revenue share on every transaction. Zero cost, zero risk, new revenue stream."
        path="/partners"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/signup" className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="py-16 md:py-24 px-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full mb-4">
              Job Board Partner Programme
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
              Your users are sitting on untapped value.<br className="hidden sm:block" />
              Let AI agents unlock it.
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-8">
              AI agents are already paying to find and hire people on Human Pages.
              Send your users our way and earn revenue share on every transaction — forever.
            </p>
            <a
              href="#contact"
              className="inline-block px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-lg shadow-blue-600/25"
            >
              Become a partner
            </a>
          </div>
        </section>

        {/* The problem */}
        <section className="py-16 px-4 border-b border-slate-100">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 text-center">
              The problem every job board faces
            </h2>
            <div className="space-y-4 text-slate-600 text-base sm:text-lg leading-relaxed">
              <p>
                You spend money acquiring users. They create a profile, maybe find a job, then disappear.
                Their profile sits there collecting dust. You've got millions of records and no way to monetise them.
              </p>
              <p>
                Meanwhile, AI agents are the fastest-growing segment in recruiting. They can search, evaluate,
                and make offers at scale — but they need a place to find people. That's what Human Pages is.
              </p>
              <p className="font-medium text-slate-900">
                Your users + our AI agent network = a new revenue stream for both of us.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-slate-50 border-b border-slate-100">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-10 text-center">
              How it works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 px-4 border-b border-slate-100">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-10 text-center">
              Why job boards partner with us
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {BENEFITS.map((b) => (
                <div key={b.title} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <b.icon className="w-8 h-8 text-blue-600 mb-3" />
                  <h3 className="font-semibold text-slate-900 mb-2">{b.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Revenue model */}
        <section className="py-16 px-4 bg-slate-50 border-b border-slate-100">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
              The revenue model
            </h2>
            <p className="text-slate-600 text-lg mb-8">
              AI agents pay per action on Human Pages. You earn a share of every transaction involving a user you referred.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <p className="text-3xl font-bold text-blue-600">$0.05</p>
                <p className="text-slate-600 text-sm mt-1">per profile view</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <p className="text-3xl font-bold text-blue-600">$0.25</p>
                <p className="text-slate-600 text-sm mt-1">per job offer sent</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <p className="text-3xl font-bold text-blue-600">$0.50</p>
                <p className="text-slate-600 text-sm mt-1">per listing created</p>
              </div>
            </div>
            <p className="text-slate-500 text-sm">
              Revenue share percentages are discussed on a per-partner basis depending on volume and integration depth.
              Typical range: 30-50% of transaction revenue from referred users.
            </p>
          </div>
        </section>

        {/* Integration options */}
        <section className="py-16 px-4 border-b border-slate-100">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 text-center">
              Integration options
            </h2>
            <div className="space-y-4">
              {[
                {
                  title: 'Referral link',
                  effort: 'Zero engineering',
                  desc: 'A unique tracked link you share with your users via email, in-app, or on your site. They sign up, you earn.',
                },
                {
                  title: 'Embedded widget',
                  effort: 'One line of code',
                  desc: 'Add a "Get discovered by AI agents" button or banner to your user dashboard. We handle the rest.',
                },
                {
                  title: 'Bulk profile import',
                  effort: 'CSV or API',
                  desc: 'Send us your user profiles in bulk. Users receive an email to claim and verify their profile. Fastest path to revenue.',
                },
                {
                  title: 'Deep API integration',
                  effort: 'Custom',
                  desc: 'Sync profiles in real time, embed our agent matching directly into your platform. For partners who want the full experience.',
                },
              ].map((opt) => (
                <div key={opt.title} className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4">
                  <div className="shrink-0">
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                      {opt.effort}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{opt.title}</h3>
                    <p className="text-slate-600 text-sm mt-0.5">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact form */}
        <section id="contact" className="py-16 px-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 text-center">
              Let's talk
            </h2>
            <p className="text-slate-600 text-center mb-8">
              Tell us about your platform and we'll get back to you within 24 hours with a tailored proposal.
            </p>
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
              <PartnerContactForm />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
