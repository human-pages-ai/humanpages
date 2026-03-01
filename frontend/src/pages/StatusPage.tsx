import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import SEO from '../components/SEO';
import Footer from '../components/Footer';

interface HealthStatus {
  ok: boolean;
  responseTime: number;
  lastChecked: Date;
}

const POLL_INTERVAL = 30_000;

export default function StatusPage() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    const start = Date.now();
    try {
      const res = await fetch('/health');
      const elapsed = Date.now() - start;
      setHealth({ ok: res.ok, responseTime: elapsed, lastChecked: new Date() });
    } catch {
      setHealth({ ok: false, responseTime: 0, lastChecked: new Date() });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [checkHealth]);

  const operational = health?.ok ?? false;

  return (
    <>
      <SEO
        title={t('status.title')}
        description={t('status.description')}
        path="/status"
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
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('status.title')}</h1>
            <p className="text-slate-500 mb-8">{t('status.subtitle')}</p>

            {/* Overall status banner */}
            <div className={`rounded-xl border p-6 mb-8 ${operational ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-3">
                {loading ? (
                  <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse" />
                ) : operational ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className={`text-lg font-semibold ${operational ? 'text-green-800' : 'text-red-800'}`}>
                  {loading ? t('common.loading') : operational ? t('status.allOperational') : t('status.disruption')}
                </span>
              </div>
            </div>

            {/* Service rows */}
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {/* API */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  {loading ? (
                    <div className="w-3 h-3 rounded-full bg-slate-200 animate-pulse" />
                  ) : (
                    <div className={`w-3 h-3 rounded-full ${operational ? 'bg-green-500' : 'bg-red-500'}`} />
                  )}
                  <span className="font-medium text-slate-900">{t('status.api')}</span>
                </div>
                <span className={`text-sm ${operational ? 'text-green-600' : 'text-red-600'}`}>
                  {loading ? '—' : operational ? t('status.operational') : t('status.down')}
                </span>
              </div>

              {/* Website */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="font-medium text-slate-900">{t('status.website')}</span>
                </div>
                <span className="text-sm text-green-600">{t('status.operational')}</span>
              </div>
            </div>

            {/* Metrics */}
            {health && (
              <div className="mt-6 flex flex-wrap gap-6 text-sm text-slate-500">
                <div>
                  <span className="font-medium text-slate-700">{t('status.responseTime')}:</span>{' '}
                  {health.responseTime}ms
                </div>
                <div>
                  <span className="font-medium text-slate-700">{t('status.lastChecked')}:</span>{' '}
                  {health.lastChecked.toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
