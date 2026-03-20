import { Router } from 'express';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';

const router = Router();

/** Escape text for safe inclusion in SVG/XML */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

export function generateDefaultSvg(): string {
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f172a"/>
  <defs>
    <radialGradient id="glow" cx="50%" cy="40%" r="45%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="40%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="5" fill="url(#accent)"/>

  <text x="600" y="200" font-family="system-ui, sans-serif" font-size="88" font-weight="800" letter-spacing="-3" text-anchor="middle">
    <tspan fill="#f1f5f9">human</tspan><tspan fill="#3b82f6">pages</tspan><tspan fill="#f97316" font-weight="500">.ai</tspan>
  </text>

  <text x="600" y="340" font-family="system-ui, sans-serif" font-size="64" font-weight="800" fill="#f1f5f9" text-anchor="middle" letter-spacing="-2">Stop chasing clients.</text>

  <text x="600" y="450" font-family="system-ui, sans-serif" font-size="52" font-weight="700" text-anchor="middle" letter-spacing="-1">
    <tspan fill="#f1f5f9">List your skills. </tspan><tspan fill="#60a5fa">Get hired by AI.</tspan>
  </text>
</svg>`;
}

export function generateProfileSvg(name: string, bio: string, location: string, skills: string[], isAvailable: boolean): string {
  const truncatedBio = bio.length > 120 ? bio.substring(0, 117) + '...' : bio;
  const displaySkills = skills.slice(0, 5);


  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1200" height="630" fill="#f8fafc"/>

  <!-- Top bar -->
  <rect width="1200" height="6" fill="#2563eb"/>

  <!-- Logo area -->
  <text x="60" y="70" font-family="system-ui, sans-serif" font-size="24" font-weight="700">
    <tspan fill="#1e293b">human</tspan><tspan fill="#2563eb">pages</tspan><tspan fill="#f97316" font-weight="400">.ai</tspan>
  </text>

  <!-- Availability badge -->
  <rect x="60" y="100" width="${isAvailable ? 100 : 120}" height="30" rx="15" fill="${isAvailable ? '#dcfce7' : '#f1f5f9'}"/>
  <text x="${isAvailable ? 80 : 75}" y="120" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="${isAvailable ? '#15803d' : '#64748b'}">${isAvailable ? 'Available' : 'Unavailable'}</text>

  <!-- Name -->
  <text x="60" y="190" font-family="system-ui, sans-serif" font-size="48" font-weight="700" fill="#1e293b">${esc(name)}</text>

  <!-- Location -->
  ${location ? `<text x="60" y="230" font-family="system-ui, sans-serif" font-size="20" fill="#64748b">${esc(location)}</text>` : ''}

  <!-- Bio -->
  ${truncatedBio ? `<text x="60" y="290" font-family="system-ui, sans-serif" font-size="18" fill="#475569">
    <tspan x="60">${esc(truncatedBio)}</tspan>
  </text>` : ''}

  <!-- Skills -->
  ${displaySkills.map((skill, i) => {
    const x = 60 + i * 160;
    return `<rect x="${x}" y="340" width="145" height="36" rx="18" fill="#e0e7ff"/>
    <text x="${x + 72}" y="363" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#4338ca" text-anchor="middle">${esc(skill.length > 14 ? skill.substring(0, 12) + '..' : skill)}</text>`;
  }).join('\n  ')}

  <!-- Bottom bar -->
  <rect y="590" width="1200" height="40" fill="#1e293b"/>
  <text x="60" y="616" font-family="system-ui, sans-serif" font-size="16" fill="#94a3b8">humanpages.ai</text>
</svg>`;
}

export function generateBlogSvg(title: string): string {
  // Word-wrap title into lines of ~35 chars
  const words = title.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && (current + ' ' + word).length > 35) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);

  const titleY = 260 - (lines.length - 1) * 25;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#f8fafc"/>
  <rect width="1200" height="6" fill="#2563eb"/>

  <!-- Logo -->
  <text x="600" y="120" font-family="system-ui, sans-serif" font-size="24" font-weight="700" text-anchor="middle">
    <tspan fill="#1e293b">human</tspan><tspan fill="#2563eb">pages</tspan><tspan fill="#f97316" font-weight="400">.ai</tspan>
  </text>

  <!-- Blog badge -->
  <rect x="560" y="145" width="80" height="28" rx="14" fill="#e0e7ff"/>
  <text x="600" y="164" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#4338ca" text-anchor="middle">Blog</text>

  <!-- Title -->
  ${lines.map((line, i) => `<text x="600" y="${titleY + i * 50}" font-family="system-ui, sans-serif" font-size="40" font-weight="700" fill="#1e293b" text-anchor="middle">${esc(line)}</text>`).join('\n  ')}

  <!-- Bottom bar -->
  <rect y="590" width="1200" height="40" fill="#1e293b"/>
  <text x="600" y="616" font-family="system-ui, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">humanpages.ai/blog</text>
</svg>`;
}

export function generateCareersSvg(): string {
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f172a"/>
  <defs>
    <radialGradient id="glow" cx="50%" cy="40%" r="45%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="40%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="5" fill="url(#accent)"/>

  <text x="600" y="200" font-family="system-ui, sans-serif" font-size="72" font-weight="800" letter-spacing="-3" text-anchor="middle">
    <tspan fill="#f1f5f9">human</tspan><tspan fill="#3b82f6">pages</tspan><tspan fill="#f97316" font-weight="500">.ai</tspan>
  </text>

  <rect x="510" y="230" width="180" height="36" rx="18" fill="#f97316" opacity="0.9"/>
  <text x="600" y="254" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">WE'RE HIRING</text>

  <text x="600" y="340" font-family="system-ui, sans-serif" font-size="44" font-weight="700" fill="#f1f5f9" text-anchor="middle">Stop chasing clients.</text>

  <text x="600" y="410" font-family="system-ui, sans-serif" font-size="32" font-weight="500" fill="#60a5fa" text-anchor="middle">Join us and build the future of human-AI work.</text>

  <text x="600" y="540" font-family="system-ui, sans-serif" font-size="20" font-weight="400" fill="#94a3b8" text-anchor="middle">No CVs required · Remote · Any time zone · Freelance or full-time</text>
</svg>`;
}

export function generateListingSvg(title: string, budgetUsdc: number, budgetFlexible: boolean, skills: string[], location: string): string {
  // Sanitize inputs defensively
  const safeTitle = (title || 'Untitled Listing').trim() || 'Untitled Listing';
  const safeLocation = (location || '').length > 50 ? location.substring(0, 47) + '...' : (location || '');
  const safeSkills = (skills || []).filter(s => typeof s === 'string' && s.trim().length > 0);

  // Word-wrap title into lines of ~30 chars, handling long single words
  const words = safeTitle.split(/\s+/).filter(w => w.length > 0);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    // Break single words longer than 30 chars
    if (word.length > 30) {
      if (current) { lines.push(current); current = ''; }
      lines.push(word.substring(0, 27) + '...');
    } else if (current && (current + ' ' + word).length > 30) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  const titleLines = lines.slice(0, 3); // Max 3 lines

  // Format budget — strip trailing .000000 from Decimal type, cap at 9,999,999
  const budgetNum = Math.max(0, Math.min(9999999, Math.round(budgetUsdc || 0)));
  const budgetClean = budgetNum.toString();
  const budgetStr = budgetFlexible ? `$${budgetClean}+` : `$${budgetClean}`;
  const displaySkills = safeSkills.slice(0, 4);

  const titleY = 200;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f172a"/>
  <defs>
    <radialGradient id="glow" cx="50%" cy="35%" r="50%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="40%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="5" fill="url(#accent)"/>

  <!-- Logo -->
  <text x="60" y="70" font-family="system-ui, sans-serif" font-size="24" font-weight="700">
    <tspan fill="#f1f5f9">human</tspan><tspan fill="#3b82f6">pages</tspan><tspan fill="#f97316" font-weight="400">.ai</tspan>
  </text>

  <!-- Budget badge -->
  <rect x="60" y="100" width="${budgetStr.length * 22 + 40}" height="48" rx="24" fill="#16a34a"/>
  <text x="${60 + (budgetStr.length * 22 + 40) / 2}" y="131" font-family="system-ui, sans-serif" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">${esc(budgetStr)}</text>

  <!-- Title -->
  ${titleLines.map((line, i) => `<text x="60" y="${titleY + i * 48}" font-family="system-ui, sans-serif" font-size="40" font-weight="700" fill="#f1f5f9">${esc(line)}</text>`).join('\n  ')}

  <!-- Location -->
  ${safeLocation ? `<text x="60" y="${titleY + titleLines.length * 48 + 10}" font-family="system-ui, sans-serif" font-size="22" fill="#94a3b8">${esc(safeLocation)}</text>` : ''}

  <!-- Skills -->
  ${displaySkills.map((skill, i) => {
    const x = 60 + i * 180;
    const y = 440;
    return `<rect x="${x}" y="${y}" width="168" height="36" rx="18" fill="#1e3a5f"/>
    <text x="${x + 84}" y="${y + 23}" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#60a5fa" text-anchor="middle">${esc(skill.length > 16 ? skill.substring(0, 14) + '..' : skill)}</text>`;
  }).join('\n  ')}

  <!-- Bottom bar -->
  <rect y="580" width="1200" height="50" fill="#0b1120"/>
  <text x="60" y="612" font-family="system-ui, sans-serif" font-size="18" fill="#64748b">humanpages.ai/listings</text>
  <text x="1140" y="612" font-family="system-ui, sans-serif" font-size="16" fill="#64748b" text-anchor="end">Apply free — keep 100% of earnings</text>
</svg>`;
}

export function generatePromptToCompletionSvg(): string {
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f172a"/>
  <defs>
    <radialGradient id="glow" cx="50%" cy="40%" r="45%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="40%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="5" fill="url(#accent)"/>

  <text x="600" y="200" font-family="system-ui, sans-serif" font-size="88" font-weight="800" letter-spacing="-3" text-anchor="middle">
    <tspan fill="#f1f5f9">human</tspan><tspan fill="#3b82f6">pages</tspan><tspan fill="#f97316" font-weight="500">.ai</tspan>
  </text>

  <text x="600" y="340" font-family="DejaVu Sans Mono, monospace" font-size="50" font-weight="700" fill="#f1f5f9" text-anchor="middle" letter-spacing="-1">Let your AI agent hire</text>

  <text x="600" y="450" font-family="DejaVu Sans Mono, monospace" font-size="42" font-weight="700" text-anchor="middle" letter-spacing="-1">
    <tspan fill="#f1f5f9">real </tspan><tspan fill="#f97316">humans.</tspan><tspan fill="#60a5fa"> From one prompt.</tspan>
  </text>
</svg>`;
}

export function generateConnectSvg(platform: string): string {
  const platforms: Record<string, string> = {
    'claude': 'Claude',
    'cursor': 'Cursor',
    'windsurf': 'Windsurf',
    'chatgpt': 'ChatGPT',
    'openai-agents': 'OpenAI Agents SDK',
    'openai-responses': 'OpenAI Responses API',
    'gemini': 'Gemini CLI',
    'android-studio': 'Android Studio',
    'langchain': 'LangChain',
    'clawhub': 'ClawHub',
    'openclaw': 'OpenClaw',
    'nanoclaw': 'NanoClaw',
    'zeroclaw': 'ZeroClaw',
    'nanobot': 'Nanobot',
    'trustclaw': 'TrustClaw',
    'picoclaw': 'PicoClaw',
    'maxclaw': 'MaxClaw',
    'smithery': 'Smithery',
  };

  const name = platforms[platform] || platform;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f172a"/>
  <defs>
    <radialGradient id="glow" cx="50%" cy="40%" r="45%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="40%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="5" fill="url(#accent)"/>

  <text x="600" y="200" font-family="system-ui, sans-serif" font-size="88" font-weight="800" letter-spacing="-3" text-anchor="middle">
    <tspan fill="#f1f5f9">human</tspan><tspan fill="#3b82f6">pages</tspan><tspan fill="#f97316" font-weight="500">.ai</tspan>
  </text>

  <text x="600" y="340" font-family="DejaVu Sans Mono, monospace" font-size="50" font-weight="700" fill="#f1f5f9" text-anchor="middle" letter-spacing="-1">Connect ${esc(name)} to</text>

  <text x="600" y="450" font-family="DejaVu Sans Mono, monospace" font-size="42" font-weight="700" text-anchor="middle" letter-spacing="-1">
    <tspan fill="#f1f5f9">real </tspan><tspan fill="#f97316">humans.</tspan><tspan fill="#60a5fa"> Via MCP.</tspan>
  </text>
</svg>`;
}

// Cache PNG images in memory
let defaultPngCache: Buffer | null = null;
let careersPngCache: Buffer | null = null;
let promptToCompletionPngCache: Buffer | null = null;
const connectPngCache: Map<string, Buffer> = new Map();

// Default OG image (served as PNG)
router.get('/default', (req, res) => {
  try {
    if (!defaultPngCache) {
      const svg = generateDefaultSvg();
      defaultPngCache = svgToPng(svg);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800'); // cache 7 days
    res.send(defaultPngCache);
  } catch (error) {
    res.status(500).send('Error generating image');
  }
});

// Prompt to completion OG image (also used for /dev page)
router.get('/prompt-to-completion', (req, res) => {
  try {
    if (!promptToCompletionPngCache) {
      const svg = generatePromptToCompletionSvg();
      promptToCompletionPngCache = svgToPng(svg);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800'); // cache 7 days
    res.send(promptToCompletionPngCache);
  } catch (error) {
    res.status(500).send('Error generating image');
  }
});

// Careers OG image (served as PNG)
router.get('/careers', (req, res) => {
  try {
    if (!careersPngCache) {
      const svg = generateCareersSvg();
      careersPngCache = svgToPng(svg);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800'); // cache 7 days
    res.send(careersPngCache);
  } catch (error) {
    res.status(500).send('Error generating image');
  }
});

// Connect platform OG image (served as PNG)
router.get('/connect/:platform', (req, res) => {
  try {
    const platform = req.params.platform;
    if (!connectPngCache.has(platform)) {
      const svg = generateConnectSvg(platform);
      connectPngCache.set(platform, svgToPng(svg));
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800'); // cache 7 days
    res.send(connectPngCache.get(platform));
  } catch (error) {
    res.status(500).send('Error generating image');
  }
});

// Blog post OG image (served as PNG)
router.get('/blog/:slug', (req, res) => {
  try {
    const titles: Record<string, string> = {
      'free-moltbook-agent': 'How to Build a Free AI Agent That Posts on Moltbook',
      'ai-agents-hiring-humans': 'How AI Agents Are Hiring Humans for Real-World Tasks',
      'getting-paid-usdc-freelancers': 'Getting Paid as a Freelancer: A Guide to Digital Payments',
      'mcp-protocol-ai-agents': 'The MCP Protocol: How AI Agents Discover and Hire People',
    };

    const title = titles[req.params.slug];
    if (!title) {
      return res.status(404).send('Not found');
    }

    const svg = generateBlogSvg(title);
    const png = svgToPng(svg);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800'); // cache 7 days
    res.send(png);
  } catch (error) {
    res.status(500).send('Error generating image');
  }
});

// OG image for a listing (served as PNG)
router.get('/listing/:id', async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      select: {
        title: true,
        budgetUsdc: true,
        budgetFlexible: true,
        requiredSkills: true,
        location: true,
        workMode: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!listing) {
      return res.status(404).send('Not found');
    }

    // Don't generate OG images for closed/expired listings
    if (listing.status !== 'OPEN' || new Date(listing.expiresAt) <= new Date()) {
      return res.status(410).send('Listing no longer available');
    }

    const svg = generateListingSvg(
      listing.title,
      Number(listing.budgetUsdc),
      listing.budgetFlexible,
      listing.requiredSkills,
      listing.location || (listing.workMode === 'REMOTE' ? 'Remote' : '')
    );

    const png = svgToPng(svg);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600'); // cache 1 hour (listings change more often)
    res.send(png);
  } catch (error) {
    res.status(500).send('Error generating image');
  }
});

// OG image for a specific human profile (served as PNG)
router.get('/:id', async (req, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.params.id },
      select: {
        name: true,
        bio: true,
        location: true,
        neighborhood: true,
        locationGranularity: true,
        skills: true,
        isAvailable: true,
      },
    });

    if (!human) {
      return res.status(404).send('Not found');
    }

    const displayLocation = human.locationGranularity === 'neighborhood' && human.neighborhood && human.location
      ? `${human.neighborhood}, ${human.location}`
      : human.location || '';

    const svg = generateProfileSvg(
      human.name,
      human.bio || '',
      displayLocation,
      human.skills,
      human.isAvailable
    );

    const png = svgToPng(svg);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // cache 24 hours
    res.send(png);
  } catch (error) {
    res.status(500).send('Error generating image');
  }
});

export default router;
