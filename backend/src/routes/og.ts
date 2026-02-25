import { Router } from 'express';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';

const router = Router();

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

  <text x="600" y="250" font-family="system-ui, sans-serif" font-size="72" font-weight="800" letter-spacing="-3" text-anchor="middle">
    <tspan fill="#f1f5f9">human</tspan><tspan fill="#3b82f6">pages</tspan><tspan fill="#f97316" font-weight="500">.ai</tspan>
  </text>

  <text x="600" y="350" font-family="system-ui, sans-serif" font-size="44" font-weight="700" fill="#f1f5f9" text-anchor="middle">Stop chasing clients.</text>

  <text x="600" y="420" font-family="system-ui, sans-serif" font-size="32" font-weight="500" fill="#60a5fa" text-anchor="middle">List your skills and let AI bring them to you.</text>
</svg>`;
}

export function generateProfileSvg(name: string, bio: string, location: string, skills: string[], isAvailable: boolean): string {
  const truncatedBio = bio.length > 120 ? bio.substring(0, 117) + '...' : bio;
  const displaySkills = skills.slice(0, 5);

  // Escape XML special chars
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

// Cache default PNG in memory
let defaultPngCache: Buffer | null = null;
let careersPngCache: Buffer | null = null;

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
