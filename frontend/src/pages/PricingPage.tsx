import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

function Check() {
  return <CheckIcon className="w-5 h-5 text-green-600 shrink-0" />;
}

function Dash() {
  return <XMarkIcon className="w-5 h-5 text-slate-300 shrink-0" />;
}

export default function PricingPage() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title={t('pricing.title')}
        description={t('pricing.description')}
        path="/pricing"
      />

      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="font-semibold text-slate-900">Human Pages</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/signup" className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
              {t('nav.signup')}
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-slate-50">
        {/* Hero */}
        <section className="py-16 px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{t('pricing.heroTitle')}</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">{t('pricing.heroSubtitle')}</p>
        </section>

        {/* Tier cards */}
        <section className="px-4 pb-16">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">

            {/* BASIC */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col">
              <h2 className="text-lg font-bold text-slate-900">{t('pricing.basicTitle')}</h2>
              <p className="text-3xl font-bold text-slate-900 mt-2">{t('pricing.basicPrice')}</p>
              <p className="text-sm text-slate-500 mt-1">{t('pricing.basicActivation')}</p>

              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.basicOffers')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.basicViews')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.basicListings')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <Dash /> {t('pricing.basicImages')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.basicDuration')}
                </li>
              </ul>

              <Link to="/dev" className="mt-6 block text-center text-sm font-medium text-blue-600 border border-blue-600 rounded-lg py-2.5 hover:bg-blue-50 transition-colors">
                {t('pricing.getStarted')}
              </Link>
            </div>

            {/* PRO */}
            <div className="bg-white rounded-2xl border-2 border-blue-500 p-6 flex flex-col relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {t('pricing.popular')}
              </span>
              <h2 className="text-lg font-bold text-slate-900">{t('pricing.proTitle')}</h2>
              <p className="text-3xl font-bold text-slate-900 mt-2">{t('pricing.proPrice')}</p>
              <p className="text-sm text-slate-500 mt-1">{t('pricing.proActivation')}</p>

              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.proOffers')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.proViews')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.proListings')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <Dash /> {t('pricing.proImages')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.proDuration')}
                </li>
              </ul>

              <Link to="/dev" className="mt-6 block text-center text-sm font-medium text-white bg-blue-600 rounded-lg py-2.5 hover:bg-blue-700 transition-colors">
                {t('pricing.getStarted')}
              </Link>
            </div>

            {/* x402 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col">
              <h2 className="text-lg font-bold text-slate-900">{t('pricing.x402Title')}</h2>
              <p className="text-3xl font-bold text-slate-900 mt-2">{t('pricing.x402Price')}</p>
              <p className="text-sm text-slate-500 mt-1">{t('pricing.x402Activation')}</p>

              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.x402Offers')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.x402Views')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.x402Listings')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.x402Images')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.x402Duration')}
                </li>
              </ul>

              <Link to="/dev" className="mt-6 block text-center text-sm font-medium text-blue-600 border border-blue-600 rounded-lg py-2.5 hover:bg-blue-50 transition-colors">
                {t('pricing.getStarted')}
              </Link>
            </div>
          </div>
        </section>

        {/* For Humans callout */}
        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('pricing.forHumansTitle')}</h2>
            <p className="text-slate-600 mb-6">{t('pricing.forHumansDesc')}</p>
            <Link to="/signup" className="inline-block text-sm font-medium text-white bg-blue-600 rounded-lg px-6 py-2.5 hover:bg-blue-700 transition-colors">
              {t('pricing.forHumansCta')}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
