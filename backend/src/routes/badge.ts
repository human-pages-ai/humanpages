import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

function generateBadgeSvg(text: string): string {
  // Escape XML special chars
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const escapedText = esc(text);

  // Calculate approximate width (rough estimate: 7px per char + 20px padding)
  const textWidth = text.length * 7;
  const totalWidth = Math.max(200, textWidth + 40);

  return `<svg width="${totalWidth}" height="40" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600&amp;display=swap');
    </style>
  </defs>

  <!-- Background -->
  <rect width="${totalWidth}" height="40" rx="6" fill="#2563eb"/>

  <!-- Text -->
  <text x="${totalWidth / 2}" y="25" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">
    ${escapedText}
  </text>

  <!-- Arrow icon -->
  <path d="M${totalWidth - 15} 16 l4 4 l-4 4" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

// Badge for a specific human
router.get('/:id', async (req, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.params.id },
      select: {
        name: true,
      },
    });

    let badgeText = 'Hire me on Human Pages';

    if (human) {
      // If name is short enough, personalize it
      const personalizedText = `Hire ${human.name} on Human Pages`;
      if (personalizedText.length <= 35) {
        badgeText = personalizedText;
      }
    }

    const svg = generateBadgeSvg(badgeText);

    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=86400'); // cache 24 hours
    res.send(svg);
  } catch (error) {
    // On error, return generic badge
    const svg = generateBadgeSvg('Hire me on Human Pages');
    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(svg);
  }
});

// Generic badge (no ID)
router.get('/', async (req, res) => {
  const svg = generateBadgeSvg('Available on Human Pages');
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

export default router;
