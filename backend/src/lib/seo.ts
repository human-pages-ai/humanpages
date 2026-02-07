import { prisma } from './prisma.js';
import fs from 'fs';
import path from 'path';

const SITE_URL = process.env.FRONTEND_URL || 'https://humanpages.ai';

// Cache the index.html template
let indexHtmlTemplate: string | null = null;

function getIndexHtml(): string | null {
  if (indexHtmlTemplate) return indexHtmlTemplate;

  // Look for the built frontend
  const possiblePaths = [
    path.join(process.cwd(), '../frontend/dist/index.html'),
    path.join(process.cwd(), 'public/index.html'),
    path.join(process.cwd(), '../dist/index.html'),
  ];

  for (const p of possiblePaths) {
    try {
      indexHtmlTemplate = fs.readFileSync(p, 'utf-8');
      return indexHtmlTemplate;
    } catch {
      // Try next path
    }
  }

  return null;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function getProfileMetaHtml(humanId: string): Promise<string | null> {
  const html = getIndexHtml();
  if (!html) return null;

  try {
    const human = await prisma.human.findUnique({
      where: { id: humanId },
      select: { name: true, bio: true, location: true, skills: true, isAvailable: true },
    });

    if (!human) return null;

    const title = escapeHtml(`${human.name} | Human Pages`);
    const description = escapeHtml(
      human.bio
        || `${human.name} on Human Pages${human.location ? ` in ${human.location}` : ''}${human.skills.length > 0 ? ` - ${human.skills.slice(0, 3).join(', ')}` : ''}`
    );
    const ogImage = `${SITE_URL}/api/og/${humanId}`;
    const canonicalUrl = `${SITE_URL}/humans/${humanId}`;

    const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="Human Pages" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      "name": human.name,
      "description": human.bio || undefined,
      "url": canonicalUrl,
      ...(human.location && { "address": { "@type": "PostalAddress", "addressLocality": human.location } }),
      ...(human.skills.length > 0 && { "knowsAbout": human.skills }),
    })}</script>`;

    // Replace existing meta tags OR inject before </head>
    let modifiedHtml = html;

    // Replace the default title
    modifiedHtml = modifiedHtml.replace(/<title>.*?<\/title>/, '');

    // Replace the default description if it exists
    modifiedHtml = modifiedHtml.replace(/<meta name="description"[^>]*>/, '');

    // Remove default OG tags
    modifiedHtml = modifiedHtml.replace(/<meta property="og:[^>]*>/g, '');
    modifiedHtml = modifiedHtml.replace(/<meta name="twitter:[^>]*>/g, '');
    modifiedHtml = modifiedHtml.replace(/<link rel="canonical"[^>]*>/, '');

    // Inject profile-specific meta tags before </head>
    modifiedHtml = modifiedHtml.replace('</head>', `${metaTags}\n  </head>`);

    return modifiedHtml;
  } catch {
    return null;
  }
}

// Clear template cache (useful for development)
export function clearTemplateCache() {
  indexHtmlTemplate = null;
}
