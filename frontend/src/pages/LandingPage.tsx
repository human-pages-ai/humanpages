import { useState } from 'react';
import { Link } from 'react-router-dom';

const TASKS = [
  { icon: '📸', title: 'Photography', description: 'On-location photos, product shots, event coverage' },
  { icon: '🔍', title: 'Research', description: 'Local research, price checks, competitor analysis' },
  { icon: '📞', title: 'Phone Calls', description: 'Appointments, verifications, customer outreach' },
  { icon: '🚗', title: 'Deliveries', description: 'Pick-ups, drop-offs, same-day courier' },
  { icon: '✍️', title: 'Data Entry', description: 'Forms, transcription, document processing' },
  { icon: '🏪', title: 'Mystery Shopping', description: 'Store visits, service audits, feedback' },
];

const BENEFITS = [
  { title: 'Let the work find you', description: 'Create your listing once. When someone needs your skills in your area, they\'ll reach out directly.' },
  { title: 'Keep 100% of your earnings', description: 'We don\'t take a cut. You negotiate terms and get paid straight to your wallet or bank.' },
  { title: 'Work anywhere in the world', description: 'Whether you\'re in Tokyo or Toronto, clients can find you based on your skills and location.' },
];

const TRUST_ITEMS = [
  { icon: '🔒', text: 'Your data stays yours. We never sell your information.' },
  { icon: '👁️', text: 'You control visibility. Go invisible anytime.' },
  { icon: '💬', text: 'You choose how to be contacted. Email, Telegram, or both.' },
];

const FAQS = [
  {
    q: 'What is Human Pages?',
    a: 'Think Yellow Pages, but for the AI era. When AI agents or businesses need a human to complete a real-world task, they search Human Pages to find someone with the right skills in the right location.',
  },
  {
    q: 'How do I get hired?',
    a: 'Create your listing with your skills and location. When someone needs help, they\'ll contact you directly via email or Telegram. You decide if the job is right for you.',
  },
  {
    q: 'How do I get paid?',
    a: 'You negotiate payment directly with whoever hires you. Add your wallet or payment details to your profile. We never take a commission.',
  },
  {
    q: 'Is this available in my country?',
    a: 'Yes! Human Pages is a global directory. Just add your location and you\'ll be discoverable for tasks in your area.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. Creating a listing is 100% free, forever. We make money from businesses who use our API—not from you.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-4 flex justify-between items-center text-left"
      >
        <span className="font-medium text-slate-900">{q}</span>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <p className="pb-4 text-slate-600">{a}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-slate-900">
            Human Pages
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-slate-900">
              Humans
            </Link>
            <Link to="/dev" className="text-sm text-slate-500 hover:text-slate-700">
              Developers
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start your profile
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl">
            <p className="text-blue-600 font-medium mb-2">Get hired for real-world tasks</p>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
              Yellow Pages,<br />but for AI.
            </h1>
            <p className="mt-4 text-xl text-slate-600">
              List your skills and location. Get contacted when someone needs your help—locally or anywhere in the world.
            </p>
            <div className="mt-8">
              <Link
                to="/signup"
                className="inline-block px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                Start your profile
              </Link>
              <span className="ml-4 inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                Free · No fees
              </span>
            </div>
            <p className="mt-4 text-slate-500 text-sm">
              Create a profile → get contacted directly → you decide if it's a fit
            </p>
          </div>
        </div>
      </section>

      {/* What you can do */}
      <section className="py-16 bg-slate-50 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-4">
            What you can offer
          </h2>
          <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
            Real-world tasks that only humans can do. Pick what fits your skills.
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
            Why people list on Human Pages
          </h2>
          <div className="space-y-8">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            Ready to get discovered?
          </h2>
          <p className="mt-2 text-blue-100">
            Create your listing in under a minute.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
          >
            Start your profile
          </Link>
        </div>
      </section>

      {/* Trust & Controls */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
            You're in control
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
            Questions & answers
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
            Start getting hired
          </h2>
          <p className="mt-2 text-slate-600">
            Create your listing and let opportunities come to you.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start your profile
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-slate-200 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-slate-500 text-sm">© 2025 Human Pages</span>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-slate-500 hover:text-slate-700">Privacy</a>
            <a href="#" className="text-slate-500 hover:text-slate-700">Terms</a>
            <Link to="/dev" className="text-slate-500 hover:text-slate-700">API</Link>
            <a href="#" className="text-slate-500 hover:text-slate-700">Contact</a>
          </div>
        </div>
      </footer>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 md:hidden">
        <Link
          to="/signup"
          className="block w-full text-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start your profile
        </Link>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
