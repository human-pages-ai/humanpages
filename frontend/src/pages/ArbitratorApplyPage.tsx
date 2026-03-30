import { useState } from 'react';
import ConnectLayout from './connect/ConnectLayout';
import { analytics } from '../lib/analytics';

type FormState = {
  name: string;
  walletAddress: string;
  contact: string;
  contactType: 'farcaster' | 'telegram' | 'email';
  specialties: string[];
  feeBps: number;
  webhookUrl: string;
};

const SPECIALTIES = [
  'Code & Technical',
  'Design & Creative',
  'Content & Writing',
  'Marketing & Social',
  'Research & Data',
  'General',
];

export default function ArbitratorApplyPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    walletAddress: '',
    contact: '',
    contactType: 'telegram',
    specialties: [],
    feeBps: 500,
    webhookUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ apiKey: string; agentId: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleSpecialty = (s: string) => {
    setForm(f => ({
      ...f,
      specialties: f.specialties.includes(s)
        ? f.specialties.filter(x => x !== s)
        : [...f.specialties, s],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Step 1: Register agent
      const registerRes = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: `Arbitrator [${form.walletAddress}]: ${form.specialties.join(', ') || 'General'}. Contact: ${form.contactType}:${form.contact}`,
          websiteUrl: form.webhookUrl || undefined,
        }),
      });

      if (!registerRes.ok) {
        const err = await registerRes.json();
        throw new Error(err.error || 'Registration failed');
      }

      const { apiKey, agent } = await registerRes.json();

      // Step 2: Store wallet address on the agent
      const walletRes = await fetch(`/api/agents/${agent.id}/wallet`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Key': apiKey,
        },
        body: JSON.stringify({
          walletAddress: form.walletAddress,
          walletNetwork: 'base',
        }),
      });

      if (!walletRes.ok) {
        const err = await walletRes.json().catch(() => ({ error: 'Failed to save wallet address' }));
        throw new Error(err.error || 'Failed to save wallet address');
      }

      // Step 3: Register as arbitrator
      const arbRes = await fetch(`/api/agents/${agent.id}/arbitrator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Key': apiKey,
        },
        body: JSON.stringify({
          feeBps: form.feeBps,
          specialties: form.specialties.length > 0 ? form.specialties : ['General'],
          sla: `Wallet: ${form.walletAddress} | Contact via ${form.contactType}: ${form.contact}`,
          webhookUrl: form.webhookUrl || undefined,
        }),
      });

      if (!arbRes.ok) {
        const err = await arbRes.json();
        throw new Error(err.error || 'Arbitrator registration failed');
      }

      setResult({ apiKey, agentId: agent.id });
      analytics.track('arbitrator_applied', {
        specialties: form.specialties.join(','),
        feeBps: form.feeBps,
        hasWebhook: !!form.webhookUrl,
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConnectLayout
      title="Become an Arbitrator — Earn USDC Resolving Disputes"
      description="Join Human Pages as an escrow arbitrator. Resolve disputes between AI agents and human workers, earn fees in USDC."
      path="/dev/arbiter"
      breadcrumbs={[{ label: 'Arbitrators' }]}
    >
      {/* Hero */}
      <div className="pt-8 pb-12 text-center">
        <h1 className="text-3xl md:text-5xl font-black text-slate-900">
          Become an Arbitrator
        </h1>
        <p className="mt-4 text-lg md:text-xl text-slate-500 max-w-2xl mx-auto">
          Earn USDC resolving disputes between AI agents and human workers.
          Zero gas costs — you sign verdicts off-chain, we submit them.
        </p>
      </div>

      {/* How it works */}
      <div className="max-w-3xl mx-auto mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6">How it works</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { step: '1', title: 'Apply', desc: 'Fill out the form below with your wallet and contact info.' },
            { step: '2', title: 'Get whitelisted', desc: 'We review your application and add your wallet to the escrow contract.' },
            { step: '3', title: 'Receive disputes', desc: 'When a payer selects you, disputes are sent to your webhook or contact.' },
            { step: '4', title: 'Sign & earn', desc: 'Sign an EIP-712 verdict off-chain. We submit it. You get paid.' },
          ].map(item => (
            <div key={item.step} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm mb-3">
                {item.step}
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">{item.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Earnings info */}
      <div className="max-w-3xl mx-auto mb-12 p-6 bg-green-50 rounded-xl border border-green-200">
        <h3 className="font-bold text-slate-900 mb-2">Earnings</h3>
        <ul className="text-sm text-slate-700 space-y-1">
          <li>Fee: set by the payer at deposit time (contract allows up to 50%)</li>
          <li>You publish your preferred rate (1-10%) — payers choose you based on it</li>
          <li>You never pay gas. Sign a typed message, we handle the rest</li>
          <li>Paid in USDC on Base the moment the verdict is submitted on-chain</li>
        </ul>
      </div>

      {/* Form or Success */}
      <div className="max-w-xl mx-auto mb-20">
        {result ? (
          <div className="p-8 bg-white rounded-2xl border border-green-300 shadow-sm text-center">
            <div className="text-4xl mb-4">&#9989;</div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Application received</h2>
            <p className="text-slate-600 mb-6">
              We'll review your application and contact you to complete whitelisting.
            </p>
            <div className="bg-slate-50 rounded-lg p-4 text-left mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500 font-medium">Your API Key (save this!)</p>
                <button
                  onClick={() => copyToClipboard(result.apiKey, 'apiKey')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {copied === 'apiKey' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-sm font-mono text-slate-900 break-all">{result.apiKey}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-left">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500 font-medium">Agent ID</p>
                <button
                  onClick={() => copyToClipboard(result.agentId, 'agentId')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {copied === 'agentId' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-sm font-mono text-slate-900">{result.agentId}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Apply</h2>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Agent / Bot Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. MyArbitratorBot"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Wallet Address (Base)</label>
              <input
                type="text"
                required
                value={form.walletAddress}
                onChange={e => setForm(f => ({ ...f, walletAddress: e.target.value }))}
                placeholder="0x..."
                pattern="^0x[a-fA-F0-9]{40}$"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">This address will be whitelisted on the escrow contract</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Info</label>
              <div className="flex gap-2">
                <select
                  value={form.contactType}
                  onChange={e => setForm(f => ({ ...f, contactType: e.target.value as FormState['contactType'] }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="telegram">Telegram</option>
                  <option value="farcaster">Farcaster</option>
                  <option value="email">Email</option>
                </select>
                <input
                  type="text"
                  required
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                  placeholder={form.contactType === 'email' ? 'dev@example.com' : '@username'}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">So we can reach your dev to discuss whitelisting</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Specialties</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.specialties.includes(s)
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Preferred Fee: {(form.feeBps / 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min={100}
                max={1000}
                step={50}
                value={form.feeBps}
                onChange={e => setForm(f => ({ ...f, feeBps: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>1%</span>
                <span>10%</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Advisory only — the payer sets the actual fee per deposit</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL (optional)</label>
              <input
                type="url"
                value={form.webhookUrl}
                onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))}
                placeholder="https://your-bot.example.com/dispute"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">We'll POST dispute events here. HTTPS required.</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Apply as Arbitrator'}
            </button>
          </form>
        )}
      </div>
    </ConnectLayout>
  );
}
