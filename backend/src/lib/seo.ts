import { prisma } from './prisma.js';
import fs from 'fs';
import path from 'path';

const SITE_URL = process.env.FRONTEND_URL || 'https://humanpages.ai';
const SUPPORTED_LANGS = ['es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th'];
const DEFAULT_OG_IMAGE = `${SITE_URL}/api/og/default`;
const DEFAULT_TITLE = "Human Pages";
const DEFAULT_DESCRIPTION = 'The future of hiring networks. No commissions, no middlemen.';

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

  const hardcoded = BLOG_POSTS[slug];
  if (hardcoded) {
    postTitle = hardcoded.title;
    postDescription = hardcoded.description;
    postDate = hardcoded.date;
  } else {
    // Query DB for dynamic content items
    const dbPost = await prisma.contentItem.findFirst({
      where: { blogSlug: slug, platform: 'BLOG', status: 'PUBLISHED' },
      select: { blogTitle: true, blogExcerpt: true, metaDescription: true, publishedAt: true, createdAt: true },
    });
    if (!dbPost || !dbPost.blogTitle) return null;

    postTitle = dbPost.blogTitle;
    postDescription = dbPost.metaDescription || dbPost.blogExcerpt || '';
    postDate = (dbPost.publishedAt || dbPost.createdAt).toISOString().slice(0, 10);
  }

  const title = escapeHtml(`${postTitle} | Human Pages`);
  const description = escapeHtml(postDescription);
  const ogImage = `${SITE_URL}/api/og/blog/${slug}`;
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

// Clear template cache (useful for development)
export function clearTemplateCache() {
  indexHtmlTemplate = null;
}
