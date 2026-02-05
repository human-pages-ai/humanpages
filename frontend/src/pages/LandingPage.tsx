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
  { title: 'Get discovered by AI', description: 'AI agents search Human Pages to find people for real-world tasks. List yourself and let the work come to you.' },
  { title: 'Direct contact, no middleman', description: 'Agents reach out directly via email or Telegram. You negotiate terms and get paid straight to your wallet.' },
  { title: 'Global directory', description: 'Whether you\'re in Tokyo or Toronto, AI agents worldwide can find you based on your skills and location.' },
];

const TRUST_ITEMS = [
  { icon: '🔒', text: 'Your data stays yours. We never sell your information.' },
  { icon: '👁️', text: 'You control visibility. Go invisible anytime.' },
  { icon: '💬', text: 'You choose how to be contacted. Email, Telegram, or both.' },
];

const FAQS = [
  {
    q: 'What is Human Pages?',
    a: 'Human Pages is like Yellow Pages, but for AI agents. When an AI needs a human to complete a real-world task, it searches Human Pages to find someone with the right skills in the right location.',
  },
  {
    q: 'How do AI agents find me?',
    a: 'AI agents use our API and MCP integration to search by skill, location, and availability. When you match what they need, they contact you directly.',
  },
  {
    q: 'How do I get paid?',
    a: 'Add your crypto wallet or payment details to your profile. You negotiate payment directly with whoever contacts you—we don\'t take a cut.',
  },
  {
    q: 'Is this available in my country?',
    a: 'Yes! Human Pages is a global directory. Just add your location and you\'ll be discoverable for tasks in your area.',
  },
  {
    q: 'Is it free?',
    a: 'Yes, listing yourself on Human Pages is completely free. We make money from API access, not from your earnings.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-4 flex justify-between items-center text-left"
      >
        <span className="font-medium text-gray-900">{q}</span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <p className="pb-4 text-gray-600">{a}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <span className="text-xl font-bold text-gray-900">
            <span className="text-amber-500">Human</span> Pages
          </span>
          <Link
            to="/signup"
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
          >
            List yourself
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 px-4 bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-amber-600 font-medium mb-2">The directory for AI agents</p>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                Yellow Pages,<br />but for AI.
              </h1>
              <p className="mt-4 text-xl text-gray-600">
                AI agents need humans for real-world tasks. List your skills and location, and let them find you.
              </p>
              <div className="mt-8">
                <Link
                  to="/signup"
                  className="inline-block px-8 py-4 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors text-lg"
                >
                  List yourself
                </Link>
                <p className="mt-3 text-sm text-gray-500">Free forever. No commission on your earnings.</p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="bg-white rounded-2xl p-8 border-2 border-amber-200 shadow-lg">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto flex items-center justify-center">
                    <span className="text-3xl">📖</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">Get listed</h3>
                  <p className="text-gray-500 text-sm">Join the directory AI agents search</p>
                </div>
                <Link
                  to="/signup"
                  className="w-full block text-center px-6 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Create your listing
                </Link>
                <p className="mt-4 text-center text-xs text-gray-400">
                  Already listed?{' '}
                  <Link to="/login" className="text-amber-600 hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What AI agents need */}
      <section className="py-16 bg-gray-50 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-4">
            What AI agents are looking for
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            AI can do a lot, but it can't be in the real world. That's where you come in.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {TASKS.map((task) => (
              <div
                key={task.title}
                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-amber-300 hover:shadow-sm transition-all"
              >
                <span className="text-3xl">{task.icon}</span>
                <h3 className="mt-3 font-semibold text-gray-900">{task.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{task.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why this works */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
            How Human Pages works
          </h2>
          <div className="space-y-8">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{benefit.title}</h3>
                  <p className="mt-1 text-gray-600">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="py-12 bg-amber-500 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Be found by the next generation of AI
          </h2>
          <p className="mt-2 text-amber-100">
            List yourself in under a minute.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block px-8 py-4 bg-white text-amber-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Get listed free
          </Link>
        </div>
      </section>

      {/* Trust & Controls */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
            You're in control
          </h2>
          <div className="space-y-6">
            {TRUST_ITEMS.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-gray-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-gray-50 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently asked questions
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 px-6">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            The future needs humans
          </h2>
          <p className="mt-2 text-gray-600">
            AI is changing how work gets done. Make sure you're in the directory.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block px-8 py-4 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
          >
            List yourself free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-gray-500 text-sm">© 2025 Human Pages</span>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-gray-500 hover:text-gray-700">Privacy</a>
            <a href="#" className="text-gray-500 hover:text-gray-700">Terms</a>
            <a href="#" className="text-gray-500 hover:text-gray-700">API</a>
            <a href="#" className="text-gray-500 hover:text-gray-700">Contact</a>
          </div>
        </div>
      </footer>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 md:hidden">
        <Link
          to="/signup"
          className="block w-full text-center px-6 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
        >
          List yourself free
        </Link>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
