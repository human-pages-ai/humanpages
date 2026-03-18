import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { VouchCard } from '../shared/VouchCard';
import { Vouch, Profile } from './types';

export default function VouchSection() {
  const { t, i18n } = useTranslation();
  const [given, setGiven] = useState<Vouch[]>([]);
  const [received, setReceived] = useState<Vouch[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadVouches();
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch { /* profile load failed */ }
  };

  const loadVouches = async () => {
    try {
      const data = await api.getMyVouches();
      setGiven(data.given);
      setReceived(data.received);
    } catch { /* vouch load failed */ }
    finally { setLoading(false); }
  };

  const handleVouch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    try {
      await api.createVouch({ username: username.trim(), comment: comment.trim() || undefined });
      toast.success(t('dashboard.vouches.vouchSuccess'));
      setUsername('');
      setComment('');
      setShowForm(false);
      await loadVouches();
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (voucheeId: string) => {
    try {
      await api.revokeVouch(voucheeId);
      toast.success(t('dashboard.vouches.revokeSuccess'));
      await loadVouches();
    } catch (error: any) {
      toast.error(error.message || t('toast.genericError'));
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      {/* Share & Vouch Card — same component as wizard */}
      {profile?.username && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Get Vouched</h2>
          <VouchCard
            username={profile.username}
            vouchCount={received.length}
            vouchTarget={10}
          />
        </div>
      )}

      {/* Vouches Received */}
      <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.vouches.title')}</h2>
            <p className="text-slate-500 text-sm">{t('dashboard.vouches.subtitle')}</p>
          </div>
          {received.length > 0 && (
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
              {received.length}
            </span>
          )}
        </div>

        {received.length === 0 ? (
          <p className="text-sm text-slate-400">{t('dashboard.vouches.noVouchesReceived')}</p>
        ) : (
          <div className="space-y-3">
            {received.map((v) => (
              <div key={v.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="shrink-0 w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-medium">
                  {(v.voucher.username || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900 text-sm">
                    {v.voucher.username ? `@${v.voucher.username}` : 'Anonymous'}
                  </span>
                  {v.comment && <p className="text-sm text-slate-600 mt-0.5">{v.comment}</p>}
                  <span className="text-xs text-slate-400 mt-1 block">
                    {new Date(v.createdAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vouches Given */}
      <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.vouches.given')}</h2>
            <p className="text-slate-500 text-sm">
              {t('dashboard.vouches.vouchLimit', { count: given.length, max: 10 })}
            </p>
          </div>
          {given.length < 10 && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              {showForm ? t('common.cancel') : t('dashboard.vouches.vouchFor')}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleVouch} className="mb-4 p-4 bg-slate-50 rounded-lg space-y-3">
            <div>
              <label htmlFor="vouch-username" className="block text-sm font-medium text-slate-700 mb-1">
                {t('dashboard.vouches.vouchPlaceholder')}
              </label>
              <input
                id="vouch-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label htmlFor="vouch-comment" className="block text-sm font-medium text-slate-700 mb-1">
                {t('dashboard.vouches.commentPlaceholder')}
              </label>
              <input
                id="vouch-comment"
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('dashboard.vouches.commentExample')}
                maxLength={200}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-400 mt-1">{t('common.optional')} · {comment.length}/200</p>
            </div>
            <button
              type="submit"
              disabled={submitting || !username.trim()}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? t('common.loading') : t('dashboard.vouches.vouchButton')}
            </button>
          </form>
        )}

        {given.length === 0 ? (
          <p className="text-sm text-slate-400">{t('dashboard.vouches.noVouchesGiven')}</p>
        ) : (
          <div className="space-y-2">
            {given.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-slate-900 text-sm">
                    {v.vouchee.username ? `@${v.vouchee.username}` : 'Anonymous'}
                  </span>
                  {v.comment && (
                    <span className="text-xs text-slate-500 truncate hidden sm:inline">— {v.comment}</span>
                  )}
                </div>
                <button
                  onClick={() => handleRevoke(v.vouchee.id)}
                  className="shrink-0 text-xs text-red-600 hover:text-red-800 font-medium ml-2"
                >
                  {t('dashboard.vouches.revoke')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
