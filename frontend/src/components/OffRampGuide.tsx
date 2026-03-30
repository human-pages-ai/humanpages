import { useState } from 'react';

type Region = 'us' | 'europe' | 'nigeria' | 'philippines' | 'india' | 'latam' | 'other';

interface RegionGuide {
  title: string;
  shortDesc: string;
  topMethod: string;
  topMethodDesc: string;
  steps: string[];
  tips?: string[];
}

const REGION_GUIDES: Record<Region, RegionGuide> = {
  us: {
    title: 'United States',
    shortDesc: 'Send USDC to Coinbase → sell → withdraw to bank (instant)',
    topMethod: 'Coinbase',
    topMethodDesc: 'Fastest option with instant bank transfers',
    steps: [
      '1. Send your USDC from your wallet to your Coinbase account',
      '2. Go to "Sell" and select USDC',
      '3. Choose "USD" and set your amount',
      '4. Click "Sell Now" — you\'ll have USD in your Coinbase account',
      '5. Go to "Withdraw" → "Bank Transfer" → select your bank account',
      '6. Confirm — funds arrive within 1-2 business days (or instantly with Coinbase Pro)',
    ],
    tips: [
      'Coinbase Pro offers instant withdrawals for verified accounts',
      'Some banks may take 1-2 hours for ACH transfers',
      'No fees on crypto → fiat conversion if you hold Coinbase stock',
    ],
  },
  europe: {
    title: 'Europe',
    shortDesc: 'Coinbase or Wise — both support EUR withdrawals',
    topMethod: 'Coinbase (Euro Zone) or Wise (All of Europe)',
    topMethodDesc: 'Fastest option with EUR support',
    steps: [
      '1. Send your USDC to Coinbase (or Wise)',
      '2. Convert USDC to EUR at the best rate',
      '3. Withdraw to your EU bank account',
      '4. Funds arrive within 1-2 business days',
      '',
      'Alternative: Use Wise for lower fees and real mid-market rates',
    ],
    tips: [
      'Coinbase: Fast for EU residents with verified accounts',
      'Wise: Lowest fees, great for cross-border transfers',
      'Check local banking hours — weekend withdrawals may be slower',
    ],
  },
  nigeria: {
    title: 'Nigeria',
    shortDesc: 'Binance P2P — sell USDC for NGN directly to buyers. Or use Luno.',
    topMethod: 'Binance P2P',
    topMethodDesc: 'Peer-to-peer trading for best rates',
    steps: [
      '1. Send your USDC to Binance',
      '2. Navigate to "Binance P2P"',
      '3. Select "Sell USDC" and choose NGN',
      '4. Match with a buyer and confirm payment method (bank transfer, Opay, etc.)',
      '5. Release USDC once NGN is received in your account',
      '6. Withdraw to your Nigerian bank account or mobile money',
    ],
    tips: [
      'Binance P2P often has better rates than fiat on-ramps',
      'Verify buyers with high ratings (5★+)',
      'Use Luno as backup: simpler but slightly higher fees',
      'Opay and other mobile money platforms also available',
    ],
  },
  philippines: {
    title: 'Philippines',
    shortDesc: 'Coins.ph — sell USDC for PHP. Or Binance P2P.',
    topMethod: 'Coins.ph',
    topMethodDesc: 'Local exchange with direct PHP support',
    steps: [
      '1. Send your USDC to Coins.ph',
      '2. Go to "Sell" and select USDC',
      '3. Choose PHP and enter your amount',
      '4. Confirm — you\'ll receive PHP in your Coins.ph wallet',
      '5. Withdraw to your local bank (BDO, BPI, Metrobank, etc.)',
      '6. Funds arrive within 1-2 hours to 1 business day',
    ],
    tips: [
      'Coins.ph is regulated and local — fastest option',
      'Binance P2P also works if you prefer peer trading',
      'GCash withdrawal is instant if available',
    ],
  },
  india: {
    title: 'India',
    shortDesc: 'WazirX or Binance P2P — sell USDC for INR',
    topMethod: 'WazirX',
    topMethodDesc: 'Local exchange with fastest INR withdrawals',
    steps: [
      '1. Send your USDC to WazirX',
      '2. Go to "Sell" and select USDC',
      '3. Choose INR and set your amount',
      '4. Confirm — you\'ll have INR in your WazirX wallet',
      '5. Withdraw to your Indian bank account via NEFT/IMPS',
      '6. Funds arrive within 1 hour to 1 business day',
    ],
    tips: [
      'WazirX is local and regulated — fastest INR rates',
      'IMPS withdrawals are same-day',
      'Binance P2P also works for larger amounts',
      'Avoid RTGS — slower and more expensive',
    ],
  },
  latam: {
    title: 'Latin America',
    shortDesc: 'Binance P2P or Mercado Pago integration',
    topMethod: 'Binance P2P',
    topMethodDesc: 'Best rates for most Latin American countries',
    steps: [
      '1. Send your USDC to Binance',
      '2. Navigate to "Binance P2P"',
      '3. Select "Sell USDC" and choose your local currency (ARS, BRL, CLP, etc.)',
      '4. Match with a buyer and receive payment via local bank or mobile wallet',
      '5. Withdraw to your account',
      '6. Check local platform for more options (Mercado Pago, Ixo, etc.)',
    ],
    tips: [
      'Binance P2P usually offers the best rates',
      'Mercado Pago supports crypto-to-fiat in several LATAM countries',
      'Verify seller ratings carefully',
    ],
  },
  other: {
    title: 'Other Regions',
    shortDesc: 'Coinbase (195 countries) or Binance P2P (most countries)',
    topMethod: 'Coinbase',
    topMethodDesc: 'Widest global coverage',
    steps: [
      '1. Coinbase is available in 195+ countries',
      '2. Send your USDC to your Coinbase account',
      '3. Sell USDC to your local fiat currency',
      '4. Withdraw to your local bank account or payment method',
      '5. If Coinbase isn\'t available, try Binance P2P for peer trading',
    ],
    tips: [
      'Coinbase: Most reliable but may have regional limitations',
      'Binance P2P: Works in most countries, often better rates',
      'Check local crypto regulations before using',
    ],
  },
};

export default function OffRampGuide() {
  const [selectedRegion, setSelectedRegion] = useState<Region>('us');
  const guide = REGION_GUIDES[selectedRegion];

  const regions: { value: Region; label: string }[] = [
    { value: 'us', label: '🇺🇸 United States' },
    { value: 'europe', label: '🇪🇺 Europe' },
    { value: 'nigeria', label: '🇳🇬 Nigeria' },
    { value: 'philippines', label: '🇵🇭 Philippines' },
    { value: 'india', label: '🇮🇳 India' },
    { value: 'latam', label: '🌎 Latin America' },
    { value: 'other', label: '🌍 Other' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">How to Cash Out</h2>
      <p className="text-sm text-gray-600 mb-6">Convert your USDC to local currency in just a few minutes</p>

      {/* Region Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Select your region:</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {regions.map((region) => (
            <button
              key={region.value}
              onClick={() => setSelectedRegion(region.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedRegion === region.value
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {region.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Region Guide */}
      <div className="border border-blue-200 rounded-lg bg-blue-50 p-4 mb-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{guide.title}</h3>
          <p className="text-sm text-gray-600 mb-3">{guide.shortDesc}</p>
          <p className="text-xs font-medium text-blue-700 bg-blue-100 inline-block px-2.5 py-1 rounded-full">
            Recommended: {guide.topMethod}
          </p>
        </div>

        {/* Steps */}
        <div className="mt-5 bg-white rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Step-by-step:</p>
          {guide.steps.map((step, idx) => (
            <div key={idx} className="flex gap-3">
              {step ? (
                <>
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-xs font-medium">
                      {idx + 1}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 pt-0.5">{step}</p>
                </>
              ) : (
                <div className="w-full border-t border-gray-200 my-1" />
              )}
            </div>
          ))}
        </div>

        {/* Tips */}
        {guide.tips && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-900 mb-2">Pro Tips:</p>
            <ul className="space-y-1">
              {guide.tips.map((tip, idx) => (
                <li key={idx} className="text-xs text-amber-800 flex gap-2">
                  <span className="flex-shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Universal Pro Tip */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-green-900 mb-2">💡 Pro Tip: Skip Crypto Entirely</p>
        <p className="text-sm text-green-800 mb-2">
          Add a fiat payment method (Wise, PayPal, Venmo, etc.) so agents can pay you directly without crypto. No conversion needed!
        </p>
        <p className="text-xs text-green-700">Go to your <strong>Payment Methods</strong> tab to set this up.</p>
      </div>
    </div>
  );
}
