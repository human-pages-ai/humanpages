import { prisma } from './prisma.js';
import fs from 'fs';
import path from 'path';

const SITE_URL = process.env.FRONTEND_URL || 'https://humanpages.ai';
const SUPPORTED_LANGS = ['es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th'];
const DEFAULT_OG_IMAGE = `${SITE_URL}/api/og/default`;
const DEFAULT_TITLE = "Human Pages";
const DEFAULT_DESCRIPTION = 'Get paid for real-world tasks — AI agents hire freelancers for photography, deliveries, research, and more. Zero platform fees.';

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

function buildHreflangTags(pagePath: string): string {
  let tags = `\n    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${pagePath}" />`;
  tags += `\n    <link rel="alternate" hreflang="en" href="${SITE_URL}${pagePath}" />`;
  for (const lang of SUPPORTED_LANGS) {
    tags += `\n    <link rel="alternate" hreflang="${lang}" href="${SITE_URL}/${lang}${pagePath}" />`;
  }
  return tags;
}

export async function getProfileMetaHtml(humanId: string, lang?: string): Promise<string | null> {
  const html = getIndexHtml();
  if (!html) return null;

  try {
    const human = await prisma.human.findUnique({
      where: { id: humanId },
      select: { name: true, bio: true, location: true, neighborhood: true, locationGranularity: true, skills: true, isAvailable: true },
    });

    if (!human) return null;

    const displayLocation = human.locationGranularity === 'neighborhood' && human.neighborhood && human.location
      ? `${human.neighborhood}, ${human.location}`
      : human.location;

    const title = escapeHtml(`${human.name} | Human Pages`);
    const description = escapeHtml(
      human.bio
        || `${human.name} on Human Pages${displayLocation ? ` in ${displayLocation}` : ''}${human.skills.length > 0 ? ` - ${human.skills.slice(0, 3).join(', ')}` : ''}`
    );
    const ogImage = `${SITE_URL}/api/og/${humanId}`;
    const unprefixedPath = `/humans/${humanId}`;
    const canonicalUrl = lang && lang !== 'en'
      ? `${SITE_URL}/${lang}${unprefixedPath}`
      : `${SITE_URL}${unprefixedPath}`;

    const hreflangTags = buildHreflangTags(unprefixedPath);

    const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />${hreflangTags}
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
      ...(human.location && { "address": {
        "@type": "PostalAddress",
        "addressLocality": human.location,
        ...(human.locationGranularity === 'neighborhood' && human.neighborhood && { "addressRegion": human.neighborhood }),
      } }),
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

export async function getProfileMetaHtmlByUsername(username: string, lang?: string): Promise<string | null> {
  const html = getIndexHtml();
  if (!html) return null;

  try {
    const human = await prisma.human.findUnique({
      where: { username },
      select: { id: true, name: true, bio: true, location: true, neighborhood: true, locationGranularity: true, skills: true, isAvailable: true },
    });

    if (!human) return null;

    return getProfileMetaHtml(human.id, lang);
  } catch {
    return null;
  }
}

// Blog post metadata (must match frontend BlogIndex.tsx)
const BLOG_POSTS: Record<string, { title: string; description: string; date: string }> = {
  'free-moltbook-agent': {
    title: 'How to Build a Free AI Agent That Posts on Moltbook',
    description: 'A step-by-step guide to building an AI agent that posts on Moltbook using free LLMs and free hosting — no credit card required.',
    date: '2026-02-09',
  },
  'ai-agents-hiring-humans': {
    title: 'How AI Agents Are Hiring Humans for Real-World Tasks',
    description: 'The rise of AI agents that can search, negotiate, and pay real people for tasks that require a human touch.',
    date: '2026-02-08',
  },
  'getting-paid-usdc-freelancers': {
    title: 'Getting Paid as a Freelancer: A Guide to Digital Payments',
    description: 'Everything you need to know about receiving payments for freelance work — wallets, networks, and why instant digital payments beat bank transfers.',
    date: '2026-02-08',
  },
  'mcp-protocol-ai-agents': {
    title: 'The MCP Protocol: How AI Agents Discover and Hire People',
    description: 'A technical look at how the Model Context Protocol enables AI agents to find the right human for any real-world task.',
    date: '2026-02-08',
  },
};

export async function getBlogMetaHtml(slug: string, lang?: string): Promise<string | null> {
  const html = getIndexHtml();
  if (!html) return null;

  // Check hardcoded posts first, then DB
  let postTitle: string;
  let postDescription: string;
  let postDate: string;
  let customImageR2Key: string | null = null;

  const hardcoded = BLOG_POSTS[slug];
  if (hardcoded) {
    postTitle = hardcoded.title;
    postDescription = hardcoded.description;
    postDate = hardcoded.date;
  } else {
    // Query DB for dynamic content items
    const dbPost = await prisma.contentItem.findFirst({
      where: { blogSlug: slug, platform: 'BLOG', status: 'PUBLISHED' },
      select: { blogTitle: true, blogExcerpt: true, metaDescription: true, publishedAt: true, createdAt: true, imageR2Key: true },
    });
    if (!dbPost || !dbPost.blogTitle) return null;

    postTitle = dbPost.blogTitle;
    postDescription = dbPost.metaDescription || dbPost.blogExcerpt || '';
    postDate = (dbPost.publishedAt || dbPost.createdAt).toISOString().slice(0, 10);
    customImageR2Key = dbPost.imageR2Key;
  }

  const title = escapeHtml(`${postTitle} | Human Pages`);
  const description = escapeHtml(postDescription);

  let ogImage = `${SITE_URL}/api/og/blog/${slug}`;
  if (customImageR2Key) {
    try {
      const { getSignedDownloadUrl } = await import('./storage.js');
      const signedUrl = await getSignedDownloadUrl(customImageR2Key, 86400);
      if (signedUrl) ogImage = signedUrl;
    } catch {
      // Fall back to generated OG image
    }
  }
  const unprefixedPath = `/blog/${slug}`;
  const canonicalUrl = lang && lang !== 'en'
    ? `${SITE_URL}/${lang}${unprefixedPath}`
    : `${SITE_URL}${unprefixedPath}`;

  const hreflangTags = buildHreflangTags(unprefixedPath);

  const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />${hreflangTags}
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Human Pages" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": postTitle,
      "description": postDescription,
      "datePublished": postDate,
      "image": ogImage,
      "url": canonicalUrl,
      "author": { "@type": "Organization", "name": "Human Pages" },
      "publisher": { "@type": "Organization", "name": "Human Pages", "url": SITE_URL },
    })}</script>`;

  let modifiedHtml = html;
  modifiedHtml = modifiedHtml.replace(/<title>.*?<\/title>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="description"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta property="og:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="twitter:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<link rel="canonical"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace('</head>', `${metaTags}\n  </head>`);

  return modifiedHtml;
}

export function getCareersMetaHtml(lang?: string): string | null {
  const html = getIndexHtml();
  if (!html) return null;

  const title = 'Careers | Human Pages';
  const description = 'Join HumanPages — the AI-to-human marketplace. No CVs required. Work from anywhere, any time zone. We believe in results, not resumes.';
  const ogImage = `${SITE_URL}/api/og/careers`;
  const unprefixedPath = '/careers';
  const canonicalUrl = lang && lang !== 'en'
    ? `${SITE_URL}/${lang}${unprefixedPath}`
    : `${SITE_URL}${unprefixedPath}`;

  const hreflangTags = buildHreflangTags(unprefixedPath);

  const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />${hreflangTags}
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Human Pages" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Careers at HumanPages",
      "description": description,
      "url": canonicalUrl,
      "publisher": { "@type": "Organization", "name": "Human Pages", "url": SITE_URL },
    })}</script>`;

  let modifiedHtml = html;
  modifiedHtml = modifiedHtml.replace(/<title>.*?<\/title>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="description"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta property="og:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="twitter:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<link rel="canonical"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace('</head>', `${metaTags}\n  </head>`);

  return modifiedHtml;
}

export function getDevPageMetaHtml(lang?: string): string | null {
  const html = getIndexHtml();
  if (!html) return null;

  const title = 'MCP Server & API for AI Agents | Human Pages';
  const description = 'Give your AI agent the ability to hire real people. Install the humanpages MCP server (npx humanpages) or use the REST API to search, hire, and pay freelancers.';
  const ogImage = DEFAULT_OG_IMAGE;
  const unprefixedPath = '/dev';
  const canonicalUrl = lang && lang !== 'en'
    ? `${SITE_URL}/${lang}${unprefixedPath}`
    : `${SITE_URL}${unprefixedPath}`;

  const hreflangTags = buildHreflangTags(unprefixedPath);

  const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />${hreflangTags}
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Human Pages" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Human Pages MCP Server",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Cross-platform",
      "description": "MCP server and REST API for AI agents to search and hire humans for real-world tasks",
      "url": canonicalUrl,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    })}</script>`;

  // Crawler-visible content block — rendered below <div id="root"></div>
  // so JS-capable browsers see the React app, while crawlers/AI agents see real content.
  const crawlerContent = `
    <div id="dev-ssr" style="padding:2rem;max-width:800px;margin:0 auto;font-family:system-ui,sans-serif">
      <h1>Human Pages — MCP Server &amp; API for AI Agents</h1>
      <p>Give your AI agent the ability to hire real people for physical tasks. Search by skill, location, and availability. Send job offers. Pay in USDC.</p>

      <h2>Install the MCP Server</h2>
      <p>npm package: <strong>humanpages</strong> (published on npm, 31 tools)</p>

      <h3>Option A: Add to .mcp.json (Claude Desktop, Cursor, Windsurf)</h3>
      <pre><code>{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"],
      "env": {
        "API_BASE_URL": "https://api.humanpages.ai"
      }
    }
  }
}</code></pre>

      <h3>Option B: Claude Code CLI</h3>
      <pre><code>claude mcp add humanpages -- npx -y humanpages</code></pre>

      <h2>Available Tools (31 total)</h2>
      <ul>
        <li><strong>search_humans</strong> — Search by skill, location, availability</li>
        <li><strong>get_human</strong> — Get a human's public profile</li>
        <li><strong>get_human_profile</strong> — Get full profile with contact info (requires agent API key)</li>
        <li><strong>register_agent</strong> — Register your AI agent and get an API key</li>
        <li><strong>activate_agent</strong> — Activate agent (auto-PRO during launch)</li>
        <li><strong>create_job</strong> — Send a job offer to a specific human</li>
        <li><strong>create_listing</strong> — Post a job listing on the public board</li>
        <li><strong>update_listing</strong> — Update an open listing's details and cover photo (supports URL upload or AI generation)</li>
        <li><strong>browse_listings</strong> — Browse open listings by skill, location, budget</li>
        <li><strong>make_offer</strong> — Make an offer to a listing applicant</li>
      </ul>

      <h2>REST API</h2>
      <p>Base URL: <code>https://api.humanpages.ai</code></p>
      <ul>
        <li><code>GET /api/humans/search?skill=photography&amp;location=NYC</code> — Search (public)</li>
        <li><code>GET /api/humans/:id</code> — Public profile</li>
        <li><code>GET /api/humans/:id/profile</code> — Full profile (requires API key)</li>
        <li><code>POST /api/agents/register</code> — Register agent, get API key</li>
        <li><code>POST /api/jobs</code> — Create job offer (requires API key)</li>
        <li><code>POST /api/listings</code> — Create listing (requires API key)</li>
        <li><code>GET /api/listings</code> — Browse listings (public)</li>
      </ul>

      <h2>Agent Tiers</h2>
      <ul>
        <li><strong>PRO (free during launch)</strong>: 15 job offers/day, 50 profile views/day. Agents get PRO immediately on registration.</li>
        <li><strong>x402 pay-per-use</strong>: $0.05/profile view, $0.25/job offer, $0.50/listing (USDC on Base)</li>
      </ul>

      <h2>Links</h2>
      <ul>
        <li>npm: <a href="https://www.npmjs.com/package/humanpages">npmjs.com/package/humanpages</a></li>
        <li>Website: <a href="https://humanpages.ai">humanpages.ai</a></li>
        <li>Full docs: <a href="https://humanpages.ai/llms.txt">humanpages.ai/llms.txt</a></li>
      </ul>
    </div>
    <script>document.getElementById('dev-ssr').style.display='none'</script>`;

  let modifiedHtml = html;
  modifiedHtml = modifiedHtml.replace(/<title>.*?<\/title>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="description"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta property="og:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="twitter:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<link rel="canonical"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace('</head>', `${metaTags}\n  </head>`);
  // Inject crawler content after root div
  modifiedHtml = modifiedHtml.replace('</body>', `${crawlerContent}\n  </body>`);

  return modifiedHtml;
}

// Clear template cache (useful for development)
export function clearTemplateCache() {
  indexHtmlTemplate = null;
}
