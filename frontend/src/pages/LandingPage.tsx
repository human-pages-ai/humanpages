import { useState } from 'react';
import { Link } from 'react-router-dom';

const TASKS = [
  { icon: '📸', title: 'Photos', description: 'Take photos of locations, products, or events' },
  { icon: '🏃', title: 'Errands', description: 'Pick up, drop off, or deliver items locally' },
  { icon: '📞', title: 'Calls', description: 'Make phone calls or verify information' },
  { icon: '🔍', title: 'Research', description: 'Find information, compare prices, scout locations' },
  { icon: '🛒', title: 'Shopping', description: 'Purchase items and handle returns' },
  { icon: '👋', title: 'Visits', description: 'Visit places, attend events, or meet people' },
];

const BENEFITS = [
  { title: 'Work on your terms', description: 'Choose what tasks you want, set your own schedule, work from anywhere.' },
  { title: 'Get paid fairly', description: 'Set your own rates. Get paid directly to your wallet. No middleman fees.' },
  { title: 'Build your reputation', description: 'Your profile grows with each completed task. Good work leads to more opportunities.' },
];

const TRUST_ITEMS = [
  { icon: '🔒', text: 'Your data stays yours. We never sell your information.' },
  { icon: '👁️', text: 'You control visibility. Go invisible anytime.' },
  { icon: '💬', text: 'You choose how to be contacted. Email, Telegram, or both.' },
];

const FAQS = [
  {
    q: 'How do I get tasks?',
    a: 'Create your profile with your skills and location. When AI agents or businesses need help matching your profile, they\'ll reach out directly.',
  },
  {
    q: 'How do I get paid?',
    a: 'Add your crypto wallet or payment details to your profile. Payment terms are agreed directly with whoever contacts you.',
  },
  {
    q: 'Is this available in my country?',
    a: 'Yes! Humans works worldwide. Just add your location and you\'ll be discoverable for local tasks.',
  },
  {
    q: 'What if I want to stop receiving requests?',
    a: 'Toggle your availability off anytime from your dashboard. You can come back whenever you\'re ready.',
  },
  {
    q: 'Is it free?',
    a: 'Yes, creating a profile is completely free. We don\'t take any cut from your earnings.',
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
          <span className="text-xl font-bold text-gray-900">Humans</span>
          <Link
            to="/signup"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Create profile
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                Get paid for quick, real‑world help.
              </h1>
              <p className="mt-4 text-xl text-gray-600">
                Make a profile, choose what you'll do, and get contacted when tasks match.
              </p>
              <div className="mt-8">
                <Link
                  to="/signup"
                  className="inline-block px-8 py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-lg"
                >
                  Create profile
                </Link>
                <p className="mt-3 text-sm text-gray-500">Takes ~60 seconds. Edit anytime.</p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full mx-auto flex items-center justify-center">
                    <span className="text-3xl">👤</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">Create your profile</h3>
                  <p className="text-gray-500 text-sm">Join thousands of humans worldwide</p>
                </div>
                <Link
                  to="/signup"
                  className="w-full block text-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Get started
                </Link>
                <p className="mt-4 text-center text-xs text-gray-400">
                  Already have an account?{' '}
                  <Link to="/login" className="text-indigo-600 hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What you do */}
      <section className="py-16 bg-gray-50 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
            What you can do
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {TASKS.map((task) => (
              <div
                key={task.title}
                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all"
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
            Why this works for you
          </h2>
          <div className="space-y-8">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <section className="py-12 bg-indigo-600 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Ready to start?
          </h2>
          <p className="mt-2 text-indigo-100">
            Create your profile in under a minute.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block px-8 py-4 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Create profile
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
            Join humans worldwide
          </h2>
          <p className="mt-2 text-gray-600">
            Create your profile and start getting opportunities.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block px-8 py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Create profile
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-gray-500 text-sm">© 2025 Humans</span>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-gray-500 hover:text-gray-700">Privacy</a>
            <a href="#" className="text-gray-500 hover:text-gray-700">Terms</a>
            <a href="#" className="text-gray-500 hover:text-gray-700">Contact</a>
          </div>
        </div>
      </footer>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 md:hidden">
        <Link
          to="/signup"
          className="block w-full text-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Create profile
        </Link>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
