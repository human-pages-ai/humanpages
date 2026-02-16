import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import SEO from '../components/SEO';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ReportAgent() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SEO title={t('report.title')} noindex />
        <div className="text-center">
          <p className="text-gray-600">{t('report.invalidToken')}</p>
          <Link to="/" className="text-blue-600 hover:underline mt-4 inline-block">
            {t('common.backHome')}
          </Link>
        </div>
      </div>
    );
  }

  // Decode token to get agentId (JWT payload is base64)
  let agentId = '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    agentId = payload.agentId || '';
  } catch {
    // ignore decode errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    setSubmitting(true);
    setError('');

    try {
      const resp = await fetch(`${API_URL}/api/agents/${agentId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          description: description || undefined,
          token,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || 'Failed to submit report');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || t('report.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SEO title={t('report.title')} noindex />
        <div className="max-w-md w-full mx-auto bg-white rounded-lg shadow p-8 text-center">
          <div className="text-green-600 text-4xl mb-4">&#10003;</div>
          <h2 className="text-xl font-semibold mb-2">{t('report.submitted')}</h2>
          <p className="text-gray-600">{t('report.submittedDesc')}</p>
          <Link to="/" className="text-blue-600 hover:underline mt-6 inline-block">
            {t('common.backHome')}
          </Link>
        </div>
      </div>
    );
  }

  const REASONS = [
    { value: 'SPAM', label: t('report.reasons.spam') },
    { value: 'FRAUD', label: t('report.reasons.fraud') },
    { value: 'HARASSMENT', label: t('report.reasons.harassment') },
    { value: 'IRRELEVANT', label: t('report.reasons.irrelevant') },
    { value: 'OTHER', label: t('report.reasons.other') },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title={t('report.title')} noindex />
      <nav className="bg-white shadow">
        <div className="max-w-lg mx-auto px-4 py-4">
          <Link to="/"><Logo /></Link>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-semibold mb-2">{t('report.title')}</h1>
          <p className="text-sm text-gray-600 mb-6">{t('report.description')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('report.reasonLabel')}
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('report.selectReason')}</option>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('report.descriptionLabel')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={t('report.descriptionPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">{description.length}/1000</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !reason}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? t('common.loading') : t('report.submit')}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
