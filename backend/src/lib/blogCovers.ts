import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

/**
 * Generate a styled cover image for a blog post using SVG → PNG → WebP.
 * Zero API cost, deterministic, no moderation needed.
 *
 * Returns a 1200×630 WebP buffer ready for R2 upload.
 */
export async function generateBlogCover(
  title: string,
  itemId: string,
  style: 'template' | 'pixel' = 'template',
): Promise<Buffer> {
  const svg = style === 'pixel'
    ? generatePixelSvg(title, itemId)
    : generateTemplateSvg(title, itemId);

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const pngBuffer = resvg.render().asPng();

  return sharp(pngBuffer)
    .resize(1200, 630, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Generate a thumbnail from a full-size cover buffer.
 * Returns a 300×158 WebP buffer (~3-5KB).
 */
export async function generateBlogThumbnail(fullBuffer: Buffer): Promise<Buffer> {
  return sharp(fullBuffer)
    .resize(300, 158, { fit: 'cover' })
    .webp({ quality: 70 })
    .toBuffer();
}

// ─── Shared helpers ───

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max - 1) + '\u2026' : s;
}

function wrapText(text: string, maxCharsPerLine: number, maxLines = 3): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.slice(0, maxLines);
}

function pickDesign(itemId: string): number {
  const code = itemId.charCodeAt(0) || 0;
  return code % 5;
}

// ─── Template designs (5 rotating) ───

function generateTemplateSvg(title: string, itemId: string): string {
  const design = pickDesign(itemId);
  const safeTitle = truncate(title, 90);

  switch (design) {
    case 0: return gradientDiagonal(safeTitle);
    case 1: return darkEditorial(safeTitle);
    case 2: return splitColor(safeTitle);
    case 3: return circularAccent(safeTitle);
    case 4: return bannerStrip(safeTitle);
    default: return gradientDiagonal(safeTitle);
  }
}

// Design 1: Gradient diagonal — bold gradient bg, geometric divider, centered white title
function gradientDiagonal(title: string): string {
  const lines = wrapText(title, 35);
  const titleY = 280 - (lines.length - 1) * 25;
  const tspans = lines
    .map((line, i) => `<tspan x="600" dy="${i === 0 ? 0 : 52}">${escXml(line)}</tspan>`)
    .join('\n    ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <radialGradient id="glow" cx="70%" cy="30%" r="50%">
      <stop offset="0%" stop-color="white" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <!-- Geometric divider -->
  <polygon points="0,450 1200,380 1200,390 0,460" fill="rgba(255,255,255,0.1)"/>
  <polygon points="0,470 1200,400 1200,410 0,480" fill="rgba(255,255,255,0.06)"/>
  <!-- Decorative circles -->
  <circle cx="1050" cy="100" r="150" fill="rgba(255,255,255,0.05)"/>
  <circle cx="150" cy="550" r="100" fill="rgba(255,255,255,0.04)"/>
  <!-- Title -->
  <text y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="700" fill="white" text-anchor="middle">
    ${tspans}
  </text>
  <!-- Bottom bar -->
  <rect y="600" width="1200" height="30" fill="rgba(0,0,0,0.15)"/>
  <text x="600" y="622" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="rgba(255,255,255,0.7)" text-anchor="middle">humanpages.ai/blog</text>
</svg>`;
}

// Design 2: Dark editorial — slate bg, brand accent bar, centered title + "Blog" badge
function darkEditorial(title: string): string {
  const lines = wrapText(title, 35);
  const titleY = 290 - (lines.length - 1) * 25;
  const tspans = lines
    .map((line, i) => `<tspan x="600" dy="${i === 0 ? 0 : 52}">${escXml(line)}</tspan>`)
    .join('\n    ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="40%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="45%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0f172a"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="5" fill="url(#accent)"/>
  <!-- Logo -->
  <text x="600" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700" text-anchor="middle">
    <tspan fill="#f1f5f9">human</tspan><tspan fill="#3b82f6">pages</tspan><tspan fill="#f97316" font-weight="400">.ai</tspan>
  </text>
  <!-- Blog badge -->
  <rect x="560" y="145" width="80" height="28" rx="14" fill="#1e3a5f"/>
  <text x="600" y="164" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#60a5fa" text-anchor="middle">Blog</text>
  <!-- Title -->
  <text y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="700" fill="#f1f5f9" text-anchor="middle">
    ${tspans}
  </text>
  <!-- Bottom bar -->
  <rect y="590" width="1200" height="40" fill="#0b1120"/>
  <text x="600" y="616" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">humanpages.ai/blog</text>
</svg>`;
}

// Design 3: Split color — left blue panel, right white with dark title
function splitColor(title: string): string {
  const lines = wrapText(title, 28, 4);
  const titleY = 280 - (lines.length - 1) * 22;
  const tspans = lines
    .map((line, i) => `<tspan x="820" dy="${i === 0 ? 0 : 48}">${escXml(line)}</tspan>`)
    .join('\n    ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="leftBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <!-- Left panel -->
  <rect width="440" height="630" fill="url(#leftBg)"/>
  <!-- Right panel -->
  <rect x="440" width="760" height="630" fill="#f8fafc"/>
  <!-- Left decorative elements -->
  <circle cx="220" cy="315" r="120" fill="rgba(255,255,255,0.08)"/>
  <circle cx="100" cy="500" r="60" fill="rgba(255,255,255,0.05)"/>
  <!-- Left branding -->
  <text x="220" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700" text-anchor="middle">
    <tspan fill="#e0e7ff">human</tspan><tspan fill="white">pages</tspan>
  </text>
  <text x="220" y="310" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#93c5fd" text-anchor="middle">.ai/blog</text>
  <!-- Blue accent line at split -->
  <rect x="438" width="4" height="630" fill="#2563eb"/>
  <!-- Title on right -->
  <text y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="38" font-weight="700" fill="#1e293b" text-anchor="middle">
    ${tspans}
  </text>
  <!-- Bottom accent -->
  <rect y="620" width="1200" height="10" fill="#2563eb"/>
</svg>`;
}

// Design 4: Circular accent — off-white bg, large semi-transparent brand circles, dark title
function circularAccent(title: string): string {
  const lines = wrapText(title, 35);
  const titleY = 290 - (lines.length - 1) * 25;
  const tspans = lines
    .map((line, i) => `<tspan x="600" dy="${i === 0 ? 0 : 52}">${escXml(line)}</tspan>`)
    .join('\n    ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#f8fafc"/>
  <!-- Large decorative circles -->
  <circle cx="200" cy="150" r="250" fill="#dbeafe" opacity="0.5"/>
  <circle cx="1000" cy="480" r="300" fill="#ede9fe" opacity="0.4"/>
  <circle cx="600" cy="0" r="180" fill="#fed7aa" opacity="0.3"/>
  <!-- Top accent bar -->
  <rect width="1200" height="5" fill="#2563eb"/>
  <!-- Blog badge -->
  <rect x="540" y="140" width="120" height="32" rx="16" fill="#e0e7ff"/>
  <text x="600" y="161" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#4338ca" text-anchor="middle">BLOG POST</text>
  <!-- Title -->
  <text y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="700" fill="#1e293b" text-anchor="middle">
    ${tspans}
  </text>
  <!-- Bottom -->
  <rect y="595" width="1200" height="35" fill="#1e293b"/>
  <text x="600" y="618" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">humanpages.ai/blog</text>
</svg>`;
}

// Design 5: Banner strip — three horizontal bands, title in center band
function bannerStrip(title: string): string {
  const lines = wrapText(title, 35);
  const titleY = 295 - (lines.length - 1) * 25;
  const tspans = lines
    .map((line, i) => `<tspan x="600" dy="${i === 0 ? 0 : 52}">${escXml(line)}</tspan>`)
    .join('\n    ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- Three horizontal bands -->
  <rect width="1200" height="180" fill="#2563eb"/>
  <rect y="180" width="1200" height="280" fill="#0f172a"/>
  <rect y="460" width="1200" height="170" fill="#f97316"/>
  <!-- Transition lines -->
  <rect y="178" width="1200" height="4" fill="#1e40af"/>
  <rect y="458" width="1200" height="4" fill="#ea580c"/>
  <!-- Logo on top band -->
  <text x="600" y="100" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="700" text-anchor="middle">
    <tspan fill="white">human</tspan><tspan fill="#93c5fd">pages</tspan><tspan fill="#fed7aa" font-weight="400">.ai</tspan>
  </text>
  <rect x="520" y="115" width="160" height="2" fill="rgba(255,255,255,0.2)"/>
  <!-- Title in center band -->
  <text y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="700" fill="#f1f5f9" text-anchor="middle">
    ${tspans}
  </text>
  <!-- Blog label in bottom band -->
  <text x="600" y="540" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="white" text-anchor="middle">BLOG</text>
</svg>`;
}

// ─── Pixel art style ───

function generatePixelSvg(title: string, _itemId: string): string {
  const lines = wrapText(title, 30, 3);
  const titleY = 280 - (lines.length - 1) * 25;

  // Retro color palette
  const colors = ['#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7'];

  const tspans = lines
    .map((line, i) => `<tspan x="600" dy="${i === 0 ? 0 : 52}">${escXml(line)}</tspan>`)
    .join('\n    ');

  // Generate grid pattern overlay
  let gridLines = '';
  for (let x = 0; x <= 1200; x += 20) {
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="630" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;
  }
  for (let y = 0; y <= 630; y += 20) {
    gridLines += `<line x1="0" y1="${y}" x2="1200" y2="${y}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;
  }

  // Chunky pixel blocks (decorative)
  let blocks = '';
  const blockColors = [colors[3], colors[4], colors[5], colors[9], colors[10]];
  const positions = [
    [40, 40, 60], [120, 60, 40], [1080, 40, 60], [1020, 80, 40],
    [40, 520, 40], [100, 540, 60], [1100, 500, 40], [1040, 540, 60],
    [200, 60, 20], [980, 60, 20], [200, 560, 20], [980, 560, 20],
  ];
  positions.forEach(([x, y, size], i) => {
    blocks += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${blockColors[i % blockColors.length]}" opacity="0.6"/>`;
  });

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark background -->
  <rect width="1200" height="630" fill="${colors[0]}"/>
  <!-- Grid overlay -->
  ${gridLines}
  <!-- Pixel blocks -->
  ${blocks}
  <!-- Pixel border (top and bottom) -->
  <rect width="1200" height="8" fill="${colors[9]}"/>
  <rect y="8" width="1200" height="4" fill="${colors[3]}"/>
  <rect y="618" width="1200" height="4" fill="${colors[3]}"/>
  <rect y="622" width="1200" height="8" fill="${colors[9]}"/>
  <!-- Side borders -->
  <rect width="8" height="630" fill="${colors[9]}"/>
  <rect x="8" width="4" height="630" fill="${colors[3]}"/>
  <rect x="1188" width="4" height="630" fill="${colors[3]}"/>
  <rect x="1192" width="8" height="630" fill="${colors[9]}"/>
  <!-- Blog label -->
  <rect x="520" y="130" width="160" height="36" fill="${colors[9]}"/>
  <rect x="524" y="134" width="152" height="28" fill="${colors[0]}"/>
  <text x="600" y="155" font-family="'Courier New', Courier, monospace" font-size="16" font-weight="700" fill="${colors[10]}" text-anchor="middle">[ BLOG ]</text>
  <!-- Title (monospace-style) -->
  <text y="${titleY}" font-family="'Courier New', Courier, monospace" font-size="40" font-weight="700" fill="${colors[4]}" text-anchor="middle">
    ${tspans}
  </text>
  <!-- Bottom bar -->
  <rect x="12" y="570" width="1176" height="2" fill="${colors[9]}" opacity="0.5"/>
  <text x="600" y="600" font-family="'Courier New', Courier, monospace" font-size="14" fill="${colors[11]}" text-anchor="middle">humanpages.ai/blog</text>
</svg>`;
}
