import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

/**
 * Generate a styled cover image for a listing using SVG → PNG → WebP.
 * Zero API cost, deterministic, no moderation needed.
 *
 * Returns a 600×400 WebP buffer ready for R2 upload.
 */
export async function generateListingCover(title: string, category?: string): Promise<Buffer> {
  const svg = generateListingCoverSvg(title, category);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 600 } });
  const pngBuffer = resvg.render().asPng();

  return sharp(pngBuffer)
    .resize(600, 400, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
}

// Deterministic color palette keyed by first char of title
const GRADIENTS: [string, string][] = [
  ['#2563eb', '#7c3aed'], // blue → purple
  ['#059669', '#0d9488'], // emerald → teal
  ['#dc2626', '#ea580c'], // red → orange
  ['#7c3aed', '#db2777'], // purple → pink
  ['#0284c7', '#2563eb'], // sky → blue
  ['#d97706', '#dc2626'], // amber → red
  ['#059669', '#2563eb'], // emerald → blue
  ['#7c3aed', '#2563eb'], // purple → blue
];

function pickGradient(title: string): [string, string] {
  const code = title.charCodeAt(0) || 0;
  return GRADIENTS[code % GRADIENTS.length];
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max - 1) + '…' : s;
}

/**
 * Wrap text to fit within a max width (approximate, character-count based).
 * Returns an array of lines.
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
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

  return lines.slice(0, 3); // Max 3 lines
}

function generateListingCoverSvg(title: string, category?: string): string {
  const [c1, c2] = pickGradient(title);
  const safeTitle = truncate(title, 80);
  const lines = wrapText(safeTitle, 28);

  const titleY = category ? 170 : 190;
  const lineHeight = 42;

  const titleTspans = lines
    .map((line, i) => `<tspan x="300" dy="${i === 0 ? 0 : lineHeight}">${escXml(line)}</tspan>`)
    .join('\n      ');

  const categoryEl = category
    ? `<rect x="225" y="${titleY + lines.length * lineHeight + 15}" width="${Math.min(category.length * 11 + 30, 300)}" height="32" rx="16" fill="rgba(255,255,255,0.2)"/>
    <text x="300" y="${titleY + lines.length * lineHeight + 37}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="rgba(255,255,255,0.9)" text-anchor="middle">${escXml(truncate(category, 25))}</text>`
    : '';

  return `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="70%" cy="30%" r="50%">
      <stop offset="0%" stop-color="white" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background gradient -->
  <rect width="600" height="400" fill="url(#bg)"/>
  <rect width="600" height="400" fill="url(#glow)"/>

  <!-- Decorative circles -->
  <circle cx="520" cy="80" r="120" fill="rgba(255,255,255,0.06)"/>
  <circle cx="80" cy="350" r="80" fill="rgba(255,255,255,0.04)"/>

  <!-- Title text -->
  <text y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="700" fill="white" text-anchor="middle">
      ${titleTspans}
  </text>

  ${categoryEl}

  <!-- Bottom bar -->
  <rect y="380" width="600" height="20" fill="rgba(0,0,0,0.15)"/>
  <text x="300" y="395" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="rgba(255,255,255,0.7)" text-anchor="middle">humanpages.ai</text>
</svg>`;
}
