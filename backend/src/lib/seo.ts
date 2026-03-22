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

export function getDevPageMetaHtml(): string | null {
  const html = getIndexHtml();
  if (!html) return null;

  const title = 'Human Pages';
  const description = 'You prompt. Humans deliver. Real-world tasks completed for your AI agent via MCP.';
  const ogImage = `${SITE_URL}/api/og/prompt-to-completion`;
  const canonicalUrl = `${SITE_URL}/dev`;

  const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />
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
    <div id="dev-ssr" style="display:none;padding:2rem;max-width:800px;margin:0 auto;font-family:system-ui,sans-serif">
    <noscript><style>#dev-ssr{display:block!important}</style></noscript>
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
        "API_BASE_URL": "https://humanpages.ai"
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
      <p>Base URL: <code>https://humanpages.ai</code></p>
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

export function getPromptToCompletionMetaHtml(): string | null {
  const html = getIndexHtml();
  if (!html) return null;

  const title = 'Human Pages';
  const description = 'You prompt. Humans deliver. Real-world tasks completed for your AI agent via MCP.';
  const ogImage = `${SITE_URL}/api/og/prompt-to-completion`;
  const canonicalUrl = `${SITE_URL}/prompt-to-completion`;

  const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Human Pages" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${ogImage}" />`;

  const crawlerContent = `
    <div id="use-cases-ssr" style="display:none;padding:2rem;max-width:800px;margin:0 auto;font-family:system-ui,sans-serif">
    <noscript><style>#use-cases-ssr{display:block!important}</style></noscript>
      <h1>Use Cases — Human Pages</h1>
      <p>Real tasks your AI agent can delegate to humans. One prompt, real submissions.</p>

      <h2>Directory Submissions</h2>
      <p>Submit your product to 80+ directories — AI tools, SaaS listings, startup launches, dev platforms. $5 per batch of 10–15 directories. 3-day delivery guarantee.</p>

      <h2>QA Testing</h2>
      <p>Manual cross-device testing that catches what automated tests miss. $3–10 per session.</p>

      <h2>Play Store Beta Testers</h2>
      <p>Recruit 12+ real Android testers for Google's 14-day requirement. $18–30 total.</p>

      <h2>Localization Review</h2>
      <p>Native speakers review your translations in context. $5–15 per language.</p>

      <h2>Competitor Monitoring</h2>
      <p>Weekly intelligence on competitor pricing, features, and positioning. $3–8 per report.</p>

      <h2>Community Management</h2>
      <p>Daily moderation and engagement for Discord, Slack, or Telegram. $25/week.</p>

      <h2>Virtual Assistant</h2>
      <p>Admin, research, scheduling, and recurring tasks handled by a dedicated human. $5–15/hour.</p>

      <p>Full playbooks: <a href="https://github.com/human-pages-ai/hire-humans">github.com/human-pages-ai/hire-humans</a></p>
      <p>Get started: <a href="https://humanpages.ai/dev">humanpages.ai/dev</a></p>
    </div>
    <script>document.getElementById('use-cases-ssr').style.display='none'</script>`;

  let modifiedHtml = html;
  modifiedHtml = modifiedHtml.replace(/<title>.*?<\/title>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="description"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta property="og:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="twitter:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<link rel="canonical"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace('</head>', `${metaTags}\n  </head>`);
  modifiedHtml = modifiedHtml.replace('</body>', `${crawlerContent}\n  </body>`);

  return modifiedHtml;
}

export async function getListingMetaHtml(listingId: string, lang?: string): Promise<string | null> {
  const html = getIndexHtml();
  if (!html) return null;

  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        title: true,
        description: true,
        budgetUsdc: true,
        budgetFlexible: true,
        requiredSkills: true,
        location: true,
        workMode: true,
        status: true,
        expiresAt: true,
        _count: { select: { applications: true } },
      },
    });

    if (!listing) return null;

    // Don't inject meta for closed/expired listings — let SPA handle with a proper message
    if (listing.status !== 'OPEN' || new Date(listing.expiresAt) <= new Date()) return null;

    const budgetNum = Number(listing.budgetUsdc);
    const budgetClean = Number.isInteger(budgetNum) ? budgetNum.toString() : budgetNum.toFixed(0);
    const budget = listing.budgetFlexible ? `$${budgetClean}+` : `$${budgetClean}`;
    const locationStr = listing.location || (listing.workMode === 'REMOTE' ? 'Remote' : '');
    const skillsStr = listing.requiredSkills.slice(0, 3).join(', ');
    const appCount = listing._count.applications;

    const title = escapeHtml(`${listing.title} — ${budget} | Human Pages`);
    const descParts = [skillsStr, locationStr, appCount > 0 ? `${appCount} applied` : 'Be first to apply'].filter(Boolean);
    const description = escapeHtml(descParts.join(' · '));
    const ogImage = `${SITE_URL}/api/og/listing/${listingId}`;
    const unprefixedPath = `/listings/${listingId}`;
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
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Human Pages" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": listing.title,
      "description": (listing.description || '').replace(/<\/script/gi, '<\\/script'),
      "url": canonicalUrl,
      ...(listing.location && {
        "jobLocation": {
          "@type": "Place",
          "address": listing.location,
        },
      }),
      ...(listing.workMode === 'REMOTE' && { "jobLocationType": "TELECOMMUTE" }),
      "baseSalary": {
        "@type": "MonetaryAmount",
        "currency": "USD",
        "value": Number(listing.budgetUsdc),
      },
      "hiringOrganization": { "@type": "Organization", "name": "Human Pages", "url": SITE_URL },
      "employmentType": "TEMPORARY",
      ...(listing.requiredSkills.length > 0 && { "skills": listing.requiredSkills.join(", ") }),
    })}</script>`;

    let modifiedHtml = html;
    modifiedHtml = modifiedHtml.replace(/<title>.*?<\/title>/, '');
    modifiedHtml = modifiedHtml.replace(/<meta name="description"[^>]*>/, '');
    modifiedHtml = modifiedHtml.replace(/<meta property="og:[^>]*>/g, '');
    modifiedHtml = modifiedHtml.replace(/<meta name="twitter:[^>]*>/g, '');
    modifiedHtml = modifiedHtml.replace(/<link rel="canonical"[^>]*>/, '');
    modifiedHtml = modifiedHtml.replace('</head>', `${metaTags}\n  </head>`);

    return modifiedHtml;
  } catch {
    return null;
  }
}

// GPT Setup page: SEO meta tags
export function getGptSetupMetaHtml(): string | null {
  const html = getIndexHtml();
  if (!html) return null;

  const title = 'Connect Human Pages to GPT | Setup Guide';
  const description = 'Give GPT the ability to hire real people. Set up the Human Pages connector in GPT in under 2 minutes. Search freelancers, post jobs, and manage payments.';
  const ogImage = DEFAULT_OG_IMAGE;
  const canonicalUrl = `${SITE_URL}/gpt-setup`;

  const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />
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
      "@type": "HowTo",
      "name": "Connect Human Pages to GPT",
      "description": description,
      "totalTime": "PT2M",
      "step": [
        { "@type": "HowToStep", "name": "Enable Developer Mode", "text": "Open GPT Settings → Apps → Advanced settings → Enable Developer Mode." },
        { "@type": "HowToStep", "name": "Add Human Pages Connector", "text": "Go to Settings → Connectors → Create. Enter the Human Pages MCP URL and select OAuth authentication." },
        { "@type": "HowToStep", "name": "Authorize & Test", "text": "Click Connect, sign in with your agent API key, and start using Human Pages tools in GPT." },
      ],
    })}</script>`;

  return html.replace('</head>', `${metaTags}\n</head>`);
}

// ── Connect pages: server-side OG meta for WhatsApp/Twitter/social crawlers ──
// English-only — no language prefix support

interface PlatformContent {
  name: string;
  headline: string;
  intro: string;
  setupSteps: string[];
  keywords: string[];
}

const CONNECT_PLATFORM_DESCRIPTIONS: Record<string, string> = {
  'android-studio': 'Add HumanPages MCP to Android Studio\'s Gemini integration. Hire testers, designers, and translators for your Android app — from inside your IDE.',
  'chatgpt': 'Add HumanPages as an MCP connector in ChatGPT. Search and hire real humans from any ChatGPT conversation — no code needed.',
  'claude': 'Add HumanPages MCP server to Claude Desktop or Claude Code to search and hire real humans from AI conversations.',
  'clawhub': 'Install HumanPages as an OpenClaw skill via ClawHub. One command to add real human-hiring capabilities to your AI agent.',
  'cursor': 'Add HumanPages MCP server to Cursor IDE to search and hire real humans from your code editor.',
  'gemini': 'Add HumanPages MCP server to Gemini CLI. Find and hire real humans from Google\'s command-line AI assistant.',
  'langchain': 'Use HumanPages MCP tools in LangChain agents and LlamaIndex pipelines. Framework-level integration with automatic tool schema translation.',
  'maxclaw': 'Add HumanPages MCP to MaxClaw — MiniMax\'s cloud-hosted AI agent platform. Deploy a hiring agent in seconds, no setup required.',
  'nanoclaw': 'Add HumanPages MCP to your NanoClaw agent. Hire real humans from a secure, containerized AI assistant connected to WhatsApp, Telegram, Slack, and more.',
  'nanobot': 'Add HumanPages MCP to Nanobot — the open-source framework that turns MCP servers into full AI agents with UI, memory, and reasoning.',
  'openai-agents': 'Use HumanPages MCP tools in your Python agents built with the OpenAI Agents SDK. Search and hire humans programmatically.',
  'openai-responses': 'Use HumanPages as an MCP tool in the OpenAI Responses API. Add type: mcp to your tools array — zero infrastructure needed.',
  'openclaw': 'Add real human-hiring capabilities to any OpenClaw-compatible agent. OpenClaw is the open specification for packaging and distributing AI agent skills.',
  'picoclaw': 'Add HumanPages MCP to PicoClaw — the ultra-lightweight AI assistant for IoT devices, Raspberry Pi, and resource-constrained hardware.',
  'smithery': 'Install HumanPages MCP from the Smithery registry — the largest third-party MCP server directory with a CLI that auto-configures your client.',
  'trustclaw': 'Add HumanPages MCP to TrustClaw — secure cloud-sandboxed AI agent execution by Composio. No local setup, no risk to your dev machine.',
  'windsurf': 'Add HumanPages MCP to Windsurf IDE by Codeium. Hire real humans from Cascade conversations.',
  'zeroclaw': 'Add HumanPages MCP to ZeroClaw — the ultra-lightweight Rust-based agent runtime for edge devices and self-hosted systems.',
};

const CONNECT_PLATFORM_CONTENT: Record<string, PlatformContent> = {
  'picoclaw': {
    name: 'PicoClaw',
    headline: 'Connect PicoClaw to Human Pages',
    intro: 'Add HumanPages MCP server to PicoClaw, the ultra-lightweight Go-based AI assistant for IoT devices, Raspberry Pi, and edge hardware. Hire real humans for tasks directly from your PicoClaw agent.',
    setupSteps: [
      'Install PicoClaw binary for your architecture (ARM, RISC-V, MIPS, x86, LoongArch)',
      'Add HumanPages MCP server to ~/.picoclaw/config.json under tools.mcp.servers',
      'Run picoclaw start to launch your agent with human-hiring capabilities',
    ],
    keywords: ['PicoClaw', 'PicoClaw MCP', 'PicoClaw setup', 'PicoClaw Raspberry Pi', 'PicoClaw AI agent', 'lightweight AI agent', 'edge AI', 'IoT agent', 'PicoClaw HumanPages'],
  },
  'claude': {
    name: 'Claude',
    headline: 'Connect Claude to Human Pages',
    intro: 'Add HumanPages MCP server to Claude Desktop or Claude Code. Search and hire real humans for tasks directly from Claude conversations.',
    setupSteps: [
      'Open Claude Desktop settings or use Claude Code CLI',
      'Add HumanPages MCP server configuration to .mcp.json',
      'Start a conversation and use human-hiring tools',
    ],
    keywords: ['Claude MCP', 'Claude Desktop MCP', 'Claude Code MCP', 'Claude HumanPages', 'Claude hire humans'],
  },
  'cursor': {
    name: 'Cursor',
    headline: 'Connect Cursor to Human Pages',
    intro: 'Add HumanPages MCP server to Cursor IDE. Search and hire real humans for tasks like testing, design, and translation directly from your code editor.',
    setupSteps: [
      'Open Cursor Settings and navigate to MCP servers',
      'Add HumanPages server configuration to .cursor/mcp.json',
      'Enable Agent mode and start using human-hiring tools',
    ],
    keywords: ['Cursor MCP', 'Cursor IDE MCP', 'Cursor HumanPages', 'Cursor hire humans'],
  },
  'windsurf': {
    name: 'Windsurf',
    headline: 'Connect Windsurf to Human Pages',
    intro: 'Add HumanPages MCP server to Windsurf IDE by Codeium. Hire real humans from Cascade conversations.',
    setupSteps: [
      'Open Windsurf settings',
      'Add HumanPages MCP server URL to your configuration',
      'Use Cascade to search and hire humans',
    ],
    keywords: ['Windsurf MCP', 'Windsurf IDE MCP', 'Windsurf Codeium MCP', 'Windsurf HumanPages'],
  },
  'chatgpt': {
    name: 'ChatGPT',
    headline: 'Connect ChatGPT to Human Pages',
    intro: 'Add HumanPages as an MCP connector in ChatGPT. Search and hire real humans from any ChatGPT conversation, no code needed.',
    setupSteps: [
      'Enable Developer Mode in ChatGPT settings',
      'Add Human Pages as an MCP connector with the server URL',
      'Start chatting and use human-hiring tools',
    ],
    keywords: ['ChatGPT MCP', 'ChatGPT connector', 'ChatGPT HumanPages', 'ChatGPT hire humans'],
  },
  'openai-agents': {
    name: 'OpenAI Agents SDK',
    headline: 'Connect OpenAI Agents SDK to Human Pages',
    intro: 'Use HumanPages MCP tools in your Python agents built with the OpenAI Agents SDK. Search and hire humans programmatically.',
    setupSteps: [
      'Install the openai-agents Python package',
      'Configure the HumanPages MCP server as a tool provider',
      'Build agents that can search and hire real humans',
    ],
    keywords: ['OpenAI Agents SDK MCP', 'OpenAI Agents HumanPages', 'Python AI agent hire humans'],
  },
  'openai-responses': {
    name: 'OpenAI Responses API',
    headline: 'Connect OpenAI Responses API to Human Pages',
    intro: 'Use HumanPages as an MCP tool in the OpenAI Responses API. Add type: mcp to your tools array for zero-infrastructure human hiring.',
    setupSteps: [
      'Add a tool with type: mcp to your Responses API call',
      'Set the server URL to the HumanPages MCP endpoint',
      'Call the API and use human-hiring tools in responses',
    ],
    keywords: ['OpenAI Responses API MCP', 'OpenAI MCP tool', 'OpenAI HumanPages'],
  },
  'gemini': {
    name: 'Gemini CLI',
    headline: 'Connect Gemini CLI to Human Pages',
    intro: 'Add HumanPages MCP server to Gemini CLI. Find and hire real humans from Google\'s command-line AI assistant.',
    setupSteps: [
      'Install Gemini CLI',
      'Add HumanPages to your MCP server configuration',
      'Run Gemini and use human-hiring tools',
    ],
    keywords: ['Gemini CLI MCP', 'Gemini MCP server', 'Gemini HumanPages'],
  },
  'android-studio': {
    name: 'Android Studio',
    headline: 'Connect Android Studio to Human Pages',
    intro: 'Add HumanPages MCP to Android Studio\'s Gemini integration. Hire testers, designers, and translators for your Android app from inside your IDE.',
    setupSteps: [
      'Open Android Studio settings for Gemini',
      'Add HumanPages MCP server configuration',
      'Use Gemini in Android Studio to hire humans for app tasks',
    ],
    keywords: ['Android Studio MCP', 'Android Studio Gemini MCP', 'Android Studio HumanPages'],
  },
  'langchain': {
    name: 'LangChain',
    headline: 'Connect LangChain to Human Pages',
    intro: 'Use HumanPages MCP tools in LangChain agents and LlamaIndex pipelines. Framework-level integration with automatic tool schema translation.',
    setupSteps: [
      'Install the langchain-mcp package',
      'Configure the HumanPages MCP server as a tool provider',
      'Build chains and agents with human-hiring capabilities',
    ],
    keywords: ['LangChain MCP', 'LangChain HumanPages', 'LlamaIndex MCP', 'LangChain hire humans'],
  },
  'clawhub': {
    name: 'ClawHub',
    headline: 'Connect ClawHub to Human Pages',
    intro: 'Install HumanPages as an OpenClaw skill via ClawHub, the package registry for AI agent skills. One command to add human-hiring capabilities.',
    setupSteps: [
      'Install the ClawHub CLI',
      'Run clawhub install humanpages to add the skill',
      'Configure your agent to use HumanPages tools',
    ],
    keywords: ['ClawHub MCP', 'ClawHub HumanPages', 'ClawHub skills', 'OpenClaw registry'],
  },
  'openclaw': {
    name: 'OpenClaw',
    headline: 'Connect OpenClaw to Human Pages',
    intro: 'Add real human-hiring capabilities to any OpenClaw-compatible agent. OpenClaw is the open specification for packaging and distributing AI agent skills.',
    setupSteps: [
      'Install the OpenClaw CLI',
      'Run openclaw add humanpages',
      'Configure your project and run your agent',
    ],
    keywords: ['OpenClaw MCP', 'OpenClaw HumanPages', 'OpenClaw skills'],
  },
  'nanoclaw': {
    name: 'NanoClaw',
    headline: 'Connect NanoClaw to Human Pages',
    intro: 'Add HumanPages MCP to your NanoClaw agent. Hire real humans from a secure, containerized AI assistant connected to WhatsApp, Telegram, Slack, and more.',
    setupSteps: [
      'Fork and clone the NanoClaw repository',
      'Add HumanPages MCP server to your .mcp.json configuration',
      'Deploy your NanoClaw agent with human-hiring capabilities',
    ],
    keywords: ['NanoClaw MCP', 'NanoClaw HumanPages', 'NanoClaw Docker', 'NanoClaw WhatsApp bot'],
  },
  'zeroclaw': {
    name: 'ZeroClaw',
    headline: 'Connect ZeroClaw to Human Pages',
    intro: 'Add HumanPages MCP to ZeroClaw, the ultra-lightweight Rust-based agent runtime for edge devices and self-hosted systems.',
    setupSteps: [
      'Install ZeroClaw on your device',
      'Add HumanPages to your ZeroClaw TOML configuration',
      'Start ZeroClaw with human-hiring capabilities',
    ],
    keywords: ['ZeroClaw MCP', 'ZeroClaw HumanPages', 'ZeroClaw Rust agent', 'ZeroClaw edge AI'],
  },
  'nanobot': {
    name: 'Nanobot',
    headline: 'Connect Nanobot to Human Pages',
    intro: 'Add HumanPages MCP to Nanobot, the open-source framework that turns MCP servers into full AI agents with UI, memory, and reasoning.',
    setupSteps: [
      'Install Nanobot',
      'Add HumanPages MCP server to your agent configuration',
      'Launch Nanobot with human-hiring tools',
    ],
    keywords: ['Nanobot MCP', 'Nanobot HumanPages', 'Nanobot AI agent framework'],
  },
  'trustclaw': {
    name: 'TrustClaw',
    headline: 'Connect TrustClaw to Human Pages',
    intro: 'Add HumanPages MCP to TrustClaw, the secure cloud-sandboxed AI agent platform by Composio. No local setup, no risk to your dev machine.',
    setupSteps: [
      'Sign up at trustclaw.app',
      'Add HumanPages as an MCP tool from the dashboard',
      'Deploy your sandboxed agent with human-hiring capabilities',
    ],
    keywords: ['TrustClaw MCP', 'TrustClaw HumanPages', 'TrustClaw Composio', 'cloud AI agent sandbox'],
  },
  'maxclaw': {
    name: 'MaxClaw',
    headline: 'Connect MaxClaw to Human Pages',
    intro: 'Add HumanPages MCP to MaxClaw, MiniMax\'s fully managed cloud agent platform. Deploy a hiring agent in seconds, always-on, free credits to start.',
    setupSteps: [
      'Sign up at maxclaw.ai',
      'Add HumanPages MCP server from the platform settings',
      'Deploy your cloud agent with human-hiring capabilities',
    ],
    keywords: ['MaxClaw MCP', 'MaxClaw HumanPages', 'MaxClaw MiniMax', 'cloud AI agent'],
  },
  'smithery': {
    name: 'Smithery',
    headline: 'Connect Smithery to Human Pages',
    intro: 'Install HumanPages MCP from the Smithery registry, the largest third-party MCP server directory. One CLI command to auto-configure your client.',
    setupSteps: [
      'Install the Smithery CLI',
      'Run smithery install humanpages to add the MCP server',
      'Your client is automatically configured',
    ],
    keywords: ['Smithery MCP', 'Smithery registry', 'Smithery HumanPages', 'MCP server directory'],
  },
};

const CONNECT_OVERVIEW_DESCRIPTION = 'Step-by-step guides to connect your AI app to real humans via the HumanPages MCP server. Works with Claude, ChatGPT, Cursor, Windsurf, OpenAI, Gemini, and more.';

export function getConnectMetaHtml(platform?: string): string | null {
  const html = getIndexHtml();
  if (!html) return null;

  const platformContent = platform ? CONNECT_PLATFORM_CONTENT[platform] : null;
  const title = platform && platformContent
    ? `Connect ${platformContent.name} to Human Pages | Human Pages`
    : 'Connect to Human Pages | Human Pages';
  const description = platform
    ? (CONNECT_PLATFORM_DESCRIPTIONS[platform] || `Connect ${platform} to real humans via the HumanPages MCP server.`)
    : CONNECT_OVERVIEW_DESCRIPTION;
  const ogImage = `${SITE_URL}/api/og/prompt-to-completion`;
  const canonicalPath = platform ? `/dev/connect/${platform}` : '/dev/connect';
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    ${platform && platformContent ? `<meta name="keywords" content="${escapeHtml(platformContent.keywords.join(', '))}" />` : ''}
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Human Pages" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${ogImage}" />`;

  // Generate crawler content and schema.org JSON-LD
  let crawlerContent = '';
  let schemaJsonLd = '';

  if (platform && platformContent) {
    // Single platform view
    const stepsHtml = platformContent.setupSteps
      .map(step => `      <li>${escapeHtml(step)}</li>`)
      .join('\n');

    const howToSteps = platformContent.setupSteps.map((step, index) => ({
      '@type': 'HowToStep',
      'position': index + 1,
      'name': step,
    }));

    crawlerContent = `
    <div id="connect-ssr" style="display:none;padding:2rem;max-width:800px;margin:0 auto;font-family:system-ui,sans-serif">
    <noscript><style>#connect-ssr{display:block!important}</style></noscript>
      <h1>${escapeHtml(platformContent.headline)}</h1>
      <p>${escapeHtml(platformContent.intro)}</p>

      <h2>Setup Steps</h2>
      <ol>
${stepsHtml}
      </ol>

      <p><a href="https://humanpages.ai">Learn more about HumanPages MCP</a></p>
    </div>
    <script>document.getElementById('connect-ssr').style.display='none'</script>`;

    schemaJsonLd = `
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      'name': platformContent.headline,
      'description': platformContent.intro,
      'step': howToSteps,
    })}</script>`;
  } else {
    // Overview page with all platforms
    const platformLinks = Object.entries(CONNECT_PLATFORM_CONTENT)
      .map(([slug, content]) => `      <li><a href="/dev/connect/${slug}">${escapeHtml(content.name)}</a> — ${escapeHtml(content.intro)}</li>`)
      .join('\n');

    crawlerContent = `
    <div id="connect-ssr" style="display:none;padding:2rem;max-width:800px;margin:0 auto;font-family:system-ui,sans-serif">
    <noscript><style>#connect-ssr{display:block!important}</style></noscript>
      <h1>Connect to Human Pages</h1>
      <p>Step-by-step guides to connect your AI app to real humans via the HumanPages MCP server.</p>

      <h2>Supported Platforms</h2>
      <ul>
${platformLinks}
      </ul>
    </div>
    <script>document.getElementById('connect-ssr').style.display='none'</script>`;
  }

  let modifiedHtml = html;
  modifiedHtml = modifiedHtml.replace(/<title>.*?<\/title>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="description"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="keywords"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace(/<meta property="og:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<meta name="twitter:[^>]*>/g, '');
  modifiedHtml = modifiedHtml.replace(/<link rel="canonical"[^>]*>/, '');
  modifiedHtml = modifiedHtml.replace('</head>', `${metaTags}${schemaJsonLd}\n  </head>`);
  modifiedHtml = modifiedHtml.replace('</body>', `${crawlerContent}\n  </body>`);

  return modifiedHtml;
}

// Clear template cache (useful for development)
export function clearTemplateCache() {
  indexHtmlTemplate = null;
}
