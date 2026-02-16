export default function BrandKit() {
  const colors = [
    { name: 'Slate', dark: '#64748b', light: '#94a3b8' },
    { name: 'Emerald', dark: '#10b981', light: '#059669' },
    { name: 'Light Emerald', dark: '#34d399', light: '#10b981' },
    { name: 'Teal', dark: '#14b8a6', light: '#0d9488' },
    { name: 'Cyan', dark: '#06b6d4', light: '#0891b2' },
    { name: 'Sky', dark: '#38bdf8', light: '#0ea5e9' },
    { name: 'Bright Cyan', dark: '#22d3ee', light: '#06b6d4' },
    { name: 'Amber', dark: '#f59e0b', light: '#d97706' },
    { name: 'Orange', dark: '#fb923c', light: '#ea580c' },
    { name: 'Deep Orange (current)', dark: '#f97316', light: '#ea580c' },
    { name: 'Red', dark: '#ef4444', light: '#dc2626' },
    { name: 'Rose', dark: '#f43f5e', light: '#e11d48' },
    { name: 'Pink', dark: '#ec4899', light: '#db2777' },
    { name: 'Violet', dark: '#8b5cf6', light: '#7c3aed' },
    { name: 'Light Violet', dark: '#a78bfa', light: '#8b5cf6' },
    { name: 'Purple', dark: '#c084fc', light: '#9333ea' },
    { name: 'Green', dark: '#4ade80', light: '#16a34a' },
    { name: 'Yellow', dark: '#facc15', light: '#ca8a04' },
  ];

  const SealIcon = ({ size = 160, bg = '#1e293b', h = '#e2e8f0' }: { size?: number; bg?: string; h?: string }) => (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="102" fill={bg} />
      <path d="M 140 78 L 140 432" stroke={h} strokeWidth="58" strokeLinecap="round" fill="none" />
      <path d="M 140 260 C 140 260 192 190 270 190 C 346 190 364 254 364 294 L 364 432" stroke={h} strokeWidth="58" strokeLinecap="round" fill="none" />
      <circle cx="406" cy="406" r="56" fill={bg} />
      <circle cx="406" cy="406" r="46" fill="#2563eb" />
      <path d="M 385 406 L 399 420 L 428 391" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );

  const ProfileIcon = ({ size = 160, bg = '#1e293b', h = '#e2e8f0' }: { size?: number; bg?: string; h?: string }) => (
    <svg width={size} height={size} viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="200" r="200" fill={bg} />
      <path d="M 112 62 L 112 338" stroke={h} strokeWidth="46" strokeLinecap="round" fill="none" />
      <path d="M 112 204 C 112 204 152 148 214 148 C 276 148 290 200 290 232 L 290 338" stroke={h} strokeWidth="46" strokeLinecap="round" fill="none" />
      <circle cx="322" cy="322" r="44" fill={bg} stroke={bg} strokeWidth="6" />
      <circle cx="322" cy="322" r="36" fill="#2563eb" />
      <path d="M 306 322 L 318 334 L 340 312" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );

  const Wordmark = ({ aiColor, humanColor, pagesColor }: { aiColor: string; humanColor: string; pagesColor: string }) => (
    <svg viewBox="0 0 640 80" xmlns="http://www.w3.org/2000/svg" className="h-10 w-auto">
      <text x="0" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontSize="50" fontWeight="700" letterSpacing="-1.5">
        <tspan fill={humanColor}>human</tspan>
        <tspan fill={pagesColor}>pages</tspan>
        <tspan fill={aiColor}>.ai</tspan>
      </text>
    </svg>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Brand Kit</h1>
        <p className="text-slate-500 mb-10">Logo assets, wordmark, and .ai color options. Internal use only.</p>

        {/* Icon variations */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-blue-500 mb-6">Icon Mark</h2>
          <div className="flex flex-wrap gap-8 items-end">
            <div className="text-center">
              <SealIcon size={128} bg="#1e293b" h="#e2e8f0" />
              <p className="text-xs text-slate-500 mt-3">Dark BG</p>
            </div>
            <div className="text-center">
              <SealIcon size={128} bg="#ffffff" h="#1e293b" />
              <p className="text-xs text-slate-500 mt-3">Light BG</p>
            </div>
            <div className="text-center">
              <ProfileIcon size={128} bg="#1e293b" h="#e2e8f0" />
              <p className="text-xs text-slate-500 mt-3">Profile (circle crop)</p>
            </div>
            <div className="text-center">
              <ProfileIcon size={128} bg="#ffffff" h="#1e293b" />
              <p className="text-xs text-slate-500 mt-3">Profile light</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-end mt-6">
            {[64, 48, 32, 16].map((s) => (
              <div key={s} className="text-center">
                <SealIcon size={s} bg="#1e293b" h="#e2e8f0" />
                <p className="text-[10px] text-slate-600 mt-2">{s}px</p>
              </div>
            ))}
          </div>
        </section>

        {/* .ai color picker */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-blue-500 mb-2">.ai Color Options</h2>
          <p className="text-slate-500 text-sm mb-6">This color will also be used for CTA buttons across the site.</p>

          {/* Dark bg */}
          <div className="bg-slate-800 rounded-xl p-6 mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Dark background</p>
            <div className="space-y-1">
              {colors.map((c) => (
                <div key={c.name + '-dark'} className="flex items-center gap-4 py-2 px-3 rounded-lg hover:bg-slate-700/50 transition-colors">
                  <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: c.dark }} />
                  <span className="w-32 text-sm text-slate-400 flex-shrink-0">{c.name}</span>
                  <span className="w-20 text-xs font-mono text-slate-600 flex-shrink-0">{c.dark}</span>
                  <svg viewBox="0 0 640 50" className="h-8 w-auto">
                    <text x="0" y="38" fontFamily="system-ui,sans-serif" fontSize="40" fontWeight="700" letterSpacing="-1.2">
                      <tspan fill="#e2e8f0">human</tspan>
                      <tspan fill="#2563eb">pages</tspan>
                      <tspan fill={c.dark}>.ai</tspan>
                    </text>
                  </svg>
                </div>
              ))}
            </div>
          </div>

          {/* Light bg */}
          <div className="bg-white rounded-xl p-6">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Light background</p>
            <div className="space-y-1">
              {colors.map((c) => (
                <div key={c.name + '-light'} className="flex items-center gap-4 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: c.light }} />
                  <span className="w-32 text-sm text-slate-500 flex-shrink-0">{c.name}</span>
                  <span className="w-20 text-xs font-mono text-slate-400 flex-shrink-0">{c.light}</span>
                  <svg viewBox="0 0 640 50" className="h-8 w-auto">
                    <text x="0" y="38" fontFamily="system-ui,sans-serif" fontSize="40" fontWeight="700" letterSpacing="-1.2">
                      <tspan fill="#1e293b">human</tspan>
                      <tspan fill="#2563eb">pages</tspan>
                      <tspan fill={c.light}>.ai</tspan>
                    </text>
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Wordmark with icon */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-blue-500 mb-6">Full Wordmark</h2>
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl p-8">
              <Wordmark humanColor="#e2e8f0" pagesColor="#2563eb" aiColor="#f97316" />
            </div>
            <div className="bg-white rounded-xl p-8">
              <Wordmark humanColor="#1e293b" pagesColor="#2563eb" aiColor="#ea580c" />
            </div>
          </div>
        </section>

        {/* Social exports */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-blue-500 mb-2">Social Media Exports</h2>
          <p className="text-slate-500 text-sm mb-6">SVG files in <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">/brand/</code> — convert to PNG for upload.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'Twitter/X Profile', file: 'twitter-profile-400x400.svg', size: '400x400' },
              { name: 'Twitter/X Banner', file: 'twitter-banner-1500x500.svg', size: '1500x500' },
              { name: 'LinkedIn Profile', file: 'linkedin-profile-400x400.svg', size: '400x400' },
              { name: 'LinkedIn Banner', file: 'linkedin-banner-1584x396.svg', size: '1584x396' },
              { name: 'YouTube Profile', file: 'youtube-profile-800x800.svg', size: '800x800' },
              { name: 'App Icon', file: 'icon-512x512.svg', size: '512x512' },
            ].map((asset) => (
              <div key={asset.file} className="bg-slate-800 rounded-lg overflow-hidden">
                <div className="p-3 border-b border-slate-700 flex justify-between items-center">
                  <span className="text-xs text-slate-400">{asset.name}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{asset.size}</span>
                </div>
                <div className="p-4 flex justify-center bg-slate-900">
                  <img src={`/brand/${asset.file}`} alt={asset.name} className="max-h-24 w-auto" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-slate-600 text-xs text-center">Internal brand reference — not indexed by search engines.</p>
      </div>
    </div>
  );
}