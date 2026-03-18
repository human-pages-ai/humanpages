import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import { CheckIcon } from '@heroicons/react/24/solid';

function Check() {
  return <CheckIcon className="w-5 h-5 text-green-600 shrink-0" />;
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
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/signup" className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
              {t('nav.signup')}
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-slate-50">
        {/* Humans — Always Free */}
        <section className="py-12 md:py-16 px-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-b border-blue-100">
          <div className="max-w-2xl mx-auto text-center">
            <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full mb-4">
              {t('pricing.humansBadge')}
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-3">
              {t('pricing.humansHeroTitle')}
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-lg mx-auto mb-2">
              {t('pricing.humansHeroDesc')}
            </p>
            <p className="text-sm text-slate-500 mb-8">
              {t('pricing.humansHeroNoFees')}
            </p>
            <Link
              to="/signup"
              className="inline-block px-6 sm:px-8 py-3 sm:py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-base sm:text-lg shadow-lg shadow-orange-500/25"
            >
              {t('pricing.humansHeroCta')}
            </Link>
            <p className="mt-3 text-xs text-slate-400">{t('pricing.humansHeroTime')}</p>
          </div>
        </section>

        {/* Agent pricing hero */}
        <section className="pt-16 pb-8 px-4 text-center">
          <p className="text-sm font-medium text-blue-600 uppercase tracking-wide mb-2">{t('pricing.agentSectionLabel')}</p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">{t('pricing.heroTitle')}</h2>
          <p className="text-base text-slate-500 max-w-xl mx-auto">{t('pricing.heroSubtitle')}</p>
        </section>

        {/* Tier cards */}
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">

            {/* PRO */}
            <div className="bg-white rounded-2xl border-2 border-blue-500 p-6 flex flex-col relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {t('pricing.proLaunchBadge')}
              </span>
              <h2 className="text-lg font-bold text-slate-900">{t('pricing.proTitle')}</h2>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                <span className="line-through text-slate-400 text-xl mr-2">{t('pricing.proPrice')}</span>
                <span className="text-green-600">FREE</span>
              </p>
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
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.proImages')}
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-700">
                  <Check /> {t('pricing.proDuration')}
                </li>
              </ul>

              <p className="mt-4 text-xs text-slate-500 text-center">{t('pricing.proLaunchNote')}</p>

              <Link to="/dev" className="mt-4 block text-center text-sm font-medium text-white bg-blue-600 rounded-lg py-2.5 hover:bg-blue-700 transition-colors">
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
                  <Check /> {t('pricing.x402Duration')}
                </li>
              </ul>

              <Link to="/dev" className="mt-6 block text-center text-sm font-medium text-blue-600 border border-blue-600 rounded-lg py-2.5 hover:bg-blue-50 transition-colors">
                {t('pricing.getStarted')}
              </Link>
            </div>
          </div>
        </section>

        {/* Bottom CTA for humans */}
        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-slate-600 mb-4">{t('pricing.bottomHumanReminder')}</p>
            <Link to="/signup" className="inline-block text-sm font-medium text-white bg-orange-500 rounded-lg px-6 py-2.5 hover:bg-orange-600 transition-colors">
              {t('pricing.humansHeroCta')}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
