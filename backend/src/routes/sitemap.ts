import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

const SUPPORTED_LANGS = ['es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th'];

function buildHreflangLinks(baseUrl: string, pagePath: string): string {
  let links = '';
  links += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${pagePath}" />\n`;
  links += `    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}${pagePath}" />\n`;
  for (const lang of SUPPORTED_LANGS) {
    links += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}/${lang}${pagePath}" />\n`;
  }
  return links;
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    // Get all humans for profile pages
    const humans = await prisma.human.findMany({
      select: { id: true, username: true, lastActiveAt: true },
      orderBy: { lastActiveAt: 'desc' },
      take: 50000, // sitemap limit
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';

    // Pages that get hreflang alternates
    const localizedPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/dev', priority: '0.8', changefreq: 'weekly' },
      { url: '/signup', priority: '0.7', changefreq: 'monthly' },
      { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
      { url: '/terms', priority: '0.3', changefreq: 'yearly' },
      { url: '/blog', priority: '0.7', changefreq: 'weekly' },
      { url: '/blog/ai-agents-hiring-humans', priority: '0.6', changefreq: 'monthly' },
      { url: '/blog/getting-paid-usdc-freelancers', priority: '0.6', changefreq: 'monthly' },
      { url: '/blog/mcp-protocol-ai-agents', priority: '0.6', changefreq: 'monthly' },
    ];

    // Pages that don't get hreflang (not localized)
    const nonLocalizedPages = [
      { url: '/login', priority: '0.3', changefreq: 'monthly' },
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    // Localized static pages — English (unprefixed) version with hreflang
    for (const page of localizedPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += buildHreflangLinks(baseUrl, page.url);
      xml += '  </url>\n';
    }

    // Localized static pages — each non-English language version
    for (const lang of SUPPORTED_LANGS) {
      for (const page of localizedPages) {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/${lang}${page.url}</loc>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += buildHreflangLinks(baseUrl, page.url);
        xml += '  </url>\n';
      }
    }

    // Non-localized static pages
    for (const page of nonLocalizedPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    // Profile pages — English (unprefixed) with hreflang
    for (const human of humans) {
      const lastmod = human.lastActiveAt ? human.lastActiveAt.toISOString().split('T')[0] : '';
      const pagePath = `/humans/${human.id}`;
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${pagePath}</loc>\n`;
      if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += buildHreflangLinks(baseUrl, pagePath);
      xml += '  </url>\n';
    }

    // Profile pages — each non-English language version
    for (const lang of SUPPORTED_LANGS) {
      for (const human of humans) {
        const lastmod = human.lastActiveAt ? human.lastActiveAt.toISOString().split('T')[0] : '';
        const pagePath = `/humans/${human.id}`;
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/${lang}${pagePath}</loc>\n`;
        if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.6</priority>\n';
        xml += buildHreflangLinks(baseUrl, pagePath);
        xml += '  </url>\n';
      }
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600'); // cache 1 hour
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

export default router;
