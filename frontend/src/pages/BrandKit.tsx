const DownloadIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

function AssetCard({ label, file, size, aspect }: { label: string; file: string; size: string; aspect?: string }) {
  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="p-3 border-b border-slate-700 flex justify-between items-center">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-[10px] text-slate-600 font-mono">{size}</span>
      </div>
      <div className={`flex justify-center items-center bg-slate-900 p-3 ${aspect === 'wide' ? 'h-24' : aspect === 'square' ? 'h-32' : 'h-20'}`}>
        <img src={`/brand/${file}`} alt={label} className="max-h-full max-w-full object-contain" />
      </div>
      <a
        href={`/brand/${file}`}
        download={file}
        className="flex items-center justify-center gap-1.5 p-2 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-slate-700/50 transition-colors border-t border-slate-700"
      >
        <DownloadIcon /> Download PNG
      </a>
    </div>
  );
}

interface Platform {
  name: string;
  handle: string;
  status: 'live' | 'create';
  assets: { label: string; file: string; size: string; aspect?: string }[];
}

const platforms: Platform[] = [
  {
    name: 'Twitter / X',
    handle: '@HumanPagesAI',
    status: 'live',
    assets: [
      { label: 'Profile', file: 'twitter-profile-400x400.png', size: '400x400', aspect: 'square' },
      { label: 'Banner', file: 'twitter-banner-1500x500.png', size: '1500x500', aspect: 'wide' },
    ],
  },
  {
    name: 'LinkedIn',
    handle: 'HumanPagesAI',
    status: 'create',
    assets: [
      { label: 'Profile', file: 'linkedin-profile-400x400.png', size: '400x400', aspect: 'square' },
      { label: 'Banner', file: 'linkedin-banner-1584x396.png', size: '1584x396', aspect: 'wide' },
    ],
  },
  {
    name: 'Facebook',
    handle: 'HumanPagesAI',
    status: 'live',
    assets: [
      { label: 'Profile', file: 'facebook-profile-400x400.png', size: '400x400', aspect: 'square' },
      { label: 'Cover', file: 'facebook-cover-820x312.png', size: '820x312', aspect: 'wide' },
    ],
  },
  {
    name: 'Instagram',
    handle: 'HumanPagesAI',
    status: 'live',
    assets: [
      { label: 'Profile', file: 'instagram-profile-400x400.png', size: '400x400', aspect: 'square' },
    ],
  },
  {
    name: 'TikTok',
    handle: '@HumanPagesAI',
    status: 'create',
    assets: [
      { label: 'Profile', file: 'tiktok-profile-400x400.png', size: '400x400', aspect: 'square' },
    ],
  },
  {
    name: 'YouTube',
    handle: '@HumanPagesAI',
    status: 'create',
    assets: [
      { label: 'Profile', file: 'youtube-profile-800x800.png', size: '800x800', aspect: 'square' },
      { label: 'Banner', file: 'youtube-banner-2560x1440.png', size: '2560x1440', aspect: 'wide' },
    ],
  },
  {
    name: 'Threads',
    handle: '@HumanPagesAI',
    status: 'create',
    assets: [
      { label: 'Profile', file: 'threads-profile-400x400.png', size: '400x400', aspect: 'square' },
    ],
  },
  {
    name: 'Reddit',
    handle: 'u/HumanPages',
    status: 'live',
    assets: [
      { label: 'Avatar', file: 'reddit-avatar-256x256.png', size: '256x256', aspect: 'square' },
      { label: 'Banner', file: 'reddit-banner-1920x384.png', size: '1920x384', aspect: 'wide' },
    ],
  },
  {
    name: 'Bluesky',
    handle: '@humanpagesai.bsky.social',
    status: 'create',
    assets: [
      { label: 'Profile', file: 'bluesky-profile-1000x1000.png', size: '1000x1000', aspect: 'square' },
      { label: 'Banner', file: 'bluesky-banner-3000x1000.png', size: '3000x1000', aspect: 'wide' },
    ],
  },
  {
    name: 'Discord',
    handle: 'HumanPagesAI',
    status: 'create',
    assets: [
      { label: 'Server Icon', file: 'discord-icon-512x512.png', size: '512x512', aspect: 'square' },
      { label: 'Server Banner', file: 'discord-banner-960x540.png', size: '960x540', aspect: 'wide' },
    ],
  },
  {
    name: 'Telegram',
    handle: '@HumanPagesAI',
    status: 'create',
    assets: [
      { label: 'Channel Photo', file: 'telegram-photo-512x512.png', size: '512x512', aspect: 'square' },
    ],
  },
  {
    name: 'Mastodon',
    handle: '@HumanPagesAI@mastodon.social',
    status: 'create',
    assets: [
      { label: 'Profile', file: 'mastodon-profile-400x400.png', size: '400x400', aspect: 'square' },
      { label: 'Header', file: 'mastodon-header-1500x500.png', size: '1500x500', aspect: 'wide' },
    ],
  },
  {
    name: 'Truth Social',
    handle: '@HumanPagesAI',
    status: 'create',
    assets: [
      { label: 'Profile', file: 'truthsocial-profile-400x400.png', size: '400x400', aspect: 'square' },
      { label: 'Banner', file: 'truthsocial-banner-1500x500.png', size: '1500x500', aspect: 'wide' },
    ],
  },
  {
    name: 'Farcaster',
    handle: 'HumanPagesAI',
    status: 'create',
    assets: [
      { label: 'Profile', file: 'farcaster-profile-400x400.png', size: '400x400', aspect: 'square' },
    ],
  },
  {
    name: 'Snapchat',
    handle: '@HumanPagesAI',
    status: 'create',
    assets: [
      { label: 'Profile', file: 'snapchat-profile-400x400.png', size: '400x400', aspect: 'square' },
    ],
  },
];

export default function BrandKit() {
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

  const liveCount = platforms.filter(p => p.status === 'live').length;
  const totalCount = platforms.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Brand Kit</h1>
        <p className="text-slate-500 mb-10">Logo assets, social media images, and brand guidelines. Internal use only.</p>

        {/* Brand Identity */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-blue-500 mb-6">Brand Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Icon marks */}
            <div className="bg-slate-800 rounded-xl p-6">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Icon Mark</p>
              <div className="flex flex-wrap gap-6 items-end">
                <div className="text-center">
                  <SealIcon size={96} bg="#1e293b" h="#e2e8f0" />
                  <p className="text-[10px] text-slate-600 mt-2">App icon</p>
                </div>
                <div className="text-center">
                  <ProfileIcon size={96} bg="#1e293b" h="#e2e8f0" />
                  <p className="text-[10px] text-slate-600 mt-2">Profile</p>
                </div>
                <div className="text-center">
                  <SealIcon size={96} bg="#ffffff" h="#1e293b" />
                  <p className="text-[10px] text-slate-600 mt-2">Light</p>
                </div>
              </div>
              <div className="flex gap-3 items-end mt-4">
                {[48, 32, 16].map((s) => (
                  <div key={s} className="text-center">
                    <SealIcon size={s} bg="#1e293b" h="#e2e8f0" />
                    <p className="text-[9px] text-slate-700 mt-1">{s}px</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Wordmark */}
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-xl p-6">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Wordmark — dark</p>
                <Wordmark humanColor="#e2e8f0" pagesColor="#2563eb" aiColor="#f97316" />
              </div>
              <div className="bg-white rounded-xl p-6">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Wordmark — light</p>
                <Wordmark humanColor="#1e293b" pagesColor="#2563eb" aiColor="#ea580c" />
              </div>
            </div>
          </div>

          {/* Brand colors */}
          <div className="mt-6 bg-slate-800 rounded-xl p-6">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Brand Colors</p>
            <div className="flex flex-wrap gap-4">
              {[
                { name: 'Slate', hex: '#1e293b', label: 'Background' },
                { name: 'Blue', hex: '#2563eb', label: 'Primary / links' },
                { name: 'Deep Orange', hex: '#f97316', label: 'CTA accent / .ai' },
                { name: 'Orange Hover', hex: '#ea580c', label: 'CTA hover' },
                { name: 'Amber', hex: '#f59e0b', label: 'PRO badges' },
                { name: 'Light Slate', hex: '#e2e8f0', label: 'Text on dark' },
              ].map((c) => (
                <div key={c.hex} className="flex items-center gap-2.5 bg-slate-900 rounded-lg px-3 py-2">
                  <div className="w-6 h-6 rounded-full flex-shrink-0 ring-1 ring-slate-700" style={{ background: c.hex }} />
                  <div>
                    <p className="text-xs font-medium text-slate-300">{c.name}</p>
                    <p className="text-[10px] text-slate-600 font-mono">{c.hex} — {c.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platform sections */}
        <section>
          <div className="flex items-baseline gap-3 mb-6">
            <h2 className="text-lg font-semibold text-blue-500">Social Media Assets</h2>
            <span className="text-xs text-slate-600">{liveCount}/{totalCount} live</span>
          </div>

          <div className="space-y-8">
            {platforms.map((platform) => (
              <div key={platform.name} className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                {/* Platform header */}
                <div className="px-5 py-3 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-200">{platform.name}</h3>
                    <span className="text-xs text-slate-500 font-mono">{platform.handle}</span>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    platform.status === 'live'
                      ? 'bg-green-900/50 text-green-400 ring-1 ring-green-800'
                      : 'bg-slate-800 text-slate-500 ring-1 ring-slate-700'
                  }`}>
                    {platform.status === 'live' ? 'Live' : 'To create'}
                  </span>
                </div>

                {/* Assets grid */}
                <div className="p-4">
                  <div className={`grid gap-4 ${platform.assets.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {platform.assets.map((asset) => (
                      <AssetCard key={asset.file} label={asset.label} file={asset.file} size={asset.size} aspect={asset.aspect} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-slate-600 text-xs text-center mt-12">Internal brand reference — not indexed by search engines.</p>
      </div>
    </div>
  );
}
