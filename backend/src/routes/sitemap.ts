import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

const SUPPORTED_LANGS = ['es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th'];
const LISTINGS_PER_PAGE = 500;

function buildHreflangLinks(baseUrl: string, pagePath: string): string {
  let links = '';
  links += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${pagePath}" />\n`;
  links += `    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}${pagePath}" />\n`;
  for (const lang of SUPPORTED_LANGS) {
    links += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}/${lang}${pagePath}" />\n`;
  }
  return links;
}

// Sitemap index — points to static + dynamic listing sitemaps
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';
    const apiBase = `${baseUrl}/api`;

    // Count open listings to determine number of listing sitemap pages
    const listingCount = await prisma.listing.count({ where: { status: 'OPEN' } });
    const listingPages = Math.max(1, Math.ceil(listingCount / LISTINGS_PER_PAGE));

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    xml += '  <sitemap>\n';
    xml += `    <loc>${apiBase}/sitemap-static.xml</loc>\n`;
    xml += '  </sitemap>\n';

    for (let page = 1; page <= listingPages; page++) {
      xml += '  <sitemap>\n';
      xml += `    <loc>${apiBase}/sitemap-listings.xml?page=${page}</loc>\n`;
      xml += '  </sitemap>\n';
    }

    xml += '</sitemapindex>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating sitemap index');
  }
});

// Static pages sitemap
router.get('/sitemap-static.xml', async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';

    const localizedPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/dev', priority: '0.8', changefreq: 'weekly' },
      { url: '/signup', priority: '0.7', changefreq: 'monthly' },
      { url: '/listings', priority: '0.8', changefreq: 'daily' },
      { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
      { url: '/terms', priority: '0.3', changefreq: 'yearly' },
      { url: '/careers', priority: '0.7', changefreq: 'weekly' },
      { url: '/blog', priority: '0.7', changefreq: 'weekly' },
      { url: '/blog/ai-agents-hiring-humans', priority: '0.6', changefreq: 'monthly' },
      { url: '/blog/getting-paid-usdc-freelancers', priority: '0.6', changefreq: 'monthly' },
      { url: '/blog/mcp-protocol-ai-agents', priority: '0.6', changefreq: 'monthly' },
      { url: '/blog/free-moltbook-agent', priority: '0.6', changefreq: 'monthly' },
    ];

    const nonLocalizedPages = [
      { url: '/login', priority: '0.3', changefreq: 'monthly' },
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    for (const page of localizedPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += buildHreflangLinks(baseUrl, page.url);
      xml += '  </url>\n';
    }

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

    for (const page of nonLocalizedPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating static sitemap');
  }
});

// Dynamic listing pages sitemap (paginated)
router.get('/sitemap-listings.xml', async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);

    const listings = await prisma.listing.findMany({
      where: { status: 'OPEN' },
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * LISTINGS_PER_PAGE,
      take: LISTINGS_PER_PAGE,
    });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    for (const listing of listings) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/listings/${listing.id}</loc>\n`;
      xml += `    <lastmod>${listing.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += buildHreflangLinks(baseUrl, `/listings/${listing.id}`);
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating listings sitemap');
  }
});

export default router;
