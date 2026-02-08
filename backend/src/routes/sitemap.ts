import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/sitemap.xml', async (req, res) => {
  try {
    // Get all humans for profile pages
    const humans = await prisma.human.findMany({
      select: { id: true, username: true, lastActiveAt: true },
      orderBy: { lastActiveAt: 'desc' },
      take: 50000, // sitemap limit
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';

    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/dev', priority: '0.8', changefreq: 'weekly' },
      { url: '/signup', priority: '0.7', changefreq: 'monthly' },
      { url: '/login', priority: '0.3', changefreq: 'monthly' },
      { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
      { url: '/terms', priority: '0.3', changefreq: 'yearly' },
      { url: '/blog', priority: '0.7', changefreq: 'weekly' },
      { url: '/blog/ai-agents-hiring-humans', priority: '0.6', changefreq: 'monthly' },
      { url: '/blog/getting-paid-usdc-freelancers', priority: '0.6', changefreq: 'monthly' },
      { url: '/blog/mcp-protocol-ai-agents', priority: '0.6', changefreq: 'monthly' },
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    // Profile pages
    for (const human of humans) {
      const lastmod = human.lastActiveAt ? human.lastActiveAt.toISOString().split('T')[0] : '';
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/humans/${human.id}</loc>\n`;
      if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
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
