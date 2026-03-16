import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Footer from '../components/Footer';

interface BalanceData {
  balance: string | null;
  currency: string;
  network: string;
  walletAddress: string | null;
  message?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function FundingPage() {
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get('agent');
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasFunded, setWasFunded] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!agentId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/agents/${agentId}/balance`);
      if (!res.ok) throw new Error('Failed to fetch balance');
      const data = await res.json() as BalanceData;
      setBalanceData((prev) => {
        if (prev?.balance === '0.00' && data.balance && parseFloat(data.balance) > 0) {
          setWasFunded(true);
        }
        return data;
      });
      setError(null);
    } catch {
      setError('Could not fetch balance');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const walletAddr = balanceData?.walletAddress;
  const network = balanceData?.network || 'base';
  const balance = balanceData?.balance ?? '0.00';

  const transakUrl = walletAddr
    ? `https://global.transak.com/?cryptoCurrencyCode=USDC&network=${encodeURIComponent(network)}&walletAddress=${encodeURIComponent(walletAddr)}`
    : 'https://global.transak.com/?cryptoCurrencyCode=USDC&network=base';

  return (
    <>
      <SEO title="Fund Your Agent | Human Pages" description="Fund your agent wallet with USDC to hire workers on Human Pages" />
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <header className="border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Logo size="sm" />
              <span className="font-bold text-lg">Human Pages</span>
            </Link>
            <Link to="/dev" className="text-sm text-slate-400 hover:text-white transition-colors">
              Developer Docs
            </Link>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold mb-2">Fund Your Agent</h1>
          <p className="text-slate-400 mb-8">Add USDC to your agent's wallet so it can pay workers on your behalf.</p>

          {!agentId && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-8">
              <p className="text-yellow-200">
                No agent ID specified. Add <code className="bg-slate-800 px-1 rounded">?agent=YOUR_AGENT_ID</code> to the URL.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-8">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {wasFunded && (
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 mb-8 text-center">
              <p className="text-green-200 text-xl font-semibold">You're funded!</p>
              <p className="text-green-300 mt-1">Your agent can now pay workers.</p>
            </div>
          )}

          {/* Balance Card */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
            <div className="text-sm text-slate-400 mb-1">Current Balance</div>
            <div className="text-4xl font-bold mb-1">
              {loading && !balanceData ? '...' : `$${balance}`}
              <span className="text-lg text-slate-400 ml-2">USDC</span>
            </div>
            <div className="text-sm text-slate-500">on {network}</div>

            {walletAddr && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400 mb-1">Wallet Address</div>
                <div className="flex items-center">
                  <code className="text-sm text-slate-200 bg-slate-800 px-3 py-2 rounded font-mono break-all">
                    {walletAddr}
                  </code>
                  <CopyButton text={walletAddr} />
                </div>
                {/* QR Code generated client-side */}
                <div className="mt-4 flex justify-center">
                  <QRCodeSVG
                    value={walletAddr}
                    size={180}
                    bgColor="#0f172a"
                    fgColor="#e2e8f0"
                    className="rounded-lg"
                  />
                </div>
              </div>
            )}

            {!walletAddr && agentId && (
              <div className="mt-4 pt-4 border-t border-slate-700 text-slate-400 text-sm">
                No wallet registered. Use <code className="bg-slate-800 px-1 rounded">set_wallet</code> in your MCP tool to register one.
              </div>
            )}
          </div>

          {/* Funding Options */}
          <h2 className="text-xl font-semibold mb-4">Funding Options</h2>
          <div className="space-y-4 mb-8">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="font-medium mb-1">Send USDC directly</h3>
              <p className="text-sm text-slate-400">If you already have USDC, send it to the wallet address above on {network}.</p>
            </div>

            <a
              href={transakUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors"
            >
              <h3 className="font-medium mb-1">Buy with card via Transak</h3>
              <p className="text-sm text-slate-400">Purchase USDC with credit/debit card. Pre-filled with your wallet address.</p>
              <span className="text-xs text-blue-400 mt-1 inline-block">global.transak.com &rarr;</span>
            </a>

            <a
              href="https://peer.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors"
            >
              <h3 className="font-medium mb-1">Convert via Peer</h3>
              <p className="text-sm text-slate-400">Convert from Wise, PayPal, Venmo, or 15+ other platforms to USDC.</p>
              <span className="text-xs text-blue-400 mt-1 inline-block">peer.xyz &rarr;</span>
            </a>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="font-medium mb-1">Ask someone with crypto</h3>
              <p className="text-sm text-slate-400">Share the wallet address or QR code above with someone who can send USDC.</p>
            </div>
          </div>

          {/* Fiat Alternative */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-2">Don't want to use crypto?</h2>
            <p className="text-sm text-slate-400">
              You can pay workers directly via payment platforms you already use (Wise, PayPal, Venmo, Revolut, etc.).
              Search for workers who accept your preferred platform using the <code className="bg-slate-800 px-1 rounded">fiat_platform</code> filter.
              No crypto needed — you and the worker transact directly.
            </p>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
