import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

function generateOGSvg(name: string, bio: string, location: string, skills: string[], isAvailable: boolean): string {
  const truncatedBio = bio.length > 120 ? bio.substring(0, 117) + '...' : bio;
  const displaySkills = skills.slice(0, 5);

  // Escape XML special chars
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&amp;display=swap');
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#f8fafc"/>

  <!-- Top bar -->
  <rect width="1200" height="6" fill="#2563eb"/>

  <!-- Logo area -->
  <text x="60" y="70" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="700">
    <tspan fill="#1e293b">human</tspan><tspan fill="#2563eb">pages</tspan><tspan fill="#94a3b8" font-weight="400">.ai</tspan>
  </text>

  <!-- Availability badge -->
  <rect x="60" y="100" width="${isAvailable ? 100 : 120}" height="30" rx="15" fill="${isAvailable ? '#dcfce7' : '#f1f5f9'}"/>
  <text x="${isAvailable ? 80 : 75}" y="120" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="${isAvailable ? '#15803d' : '#64748b'}">${isAvailable ? 'Available' : 'Unavailable'}</text>

  <!-- Name -->
  <text x="60" y="190" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="700" fill="#1e293b">${esc(name)}</text>

  <!-- Location -->
  ${location ? `<text x="60" y="230" font-family="Inter, system-ui, sans-serif" font-size="20" fill="#64748b">${esc(location)}</text>` : ''}

  <!-- Bio -->
  ${truncatedBio ? `<text x="60" y="290" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#475569">
    <tspan x="60">${esc(truncatedBio)}</tspan>
  </text>` : ''}

  <!-- Skills -->
  ${displaySkills.map((skill, i) => {
    const x = 60 + i * 160;
    return `<rect x="${x}" y="340" width="145" height="36" rx="18" fill="#e0e7ff"/>
    <text x="${x + 72}" y="363" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="#4338ca" text-anchor="middle">${esc(skill.length > 14 ? skill.substring(0, 12) + '..' : skill)}</text>`;
  }).join('\n  ')}

  <!-- Bottom bar -->
  <rect y="590" width="1200" height="40" fill="#1e293b"/>
  <text x="60" y="616" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#94a3b8">humanpages.ai</text>
</svg>`;
}

// OG image for a specific human profile
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

    const svg = generateOGSvg(
      human.name,
      human.bio || '',
      displayLocation,
      human.skills,
      human.isAvailable
    );

    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=86400'); // cache 24 hours
    res.send(svg);
  } catch (error) {
    res.status(500).send('Error generating image');
  }
});

export default router;
