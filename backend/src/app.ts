import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'path';
import { logger } from './lib/logger.js';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import humansRoutes from './routes/humans.js';
import walletsRoutes from './routes/wallets.js';
import fiatPaymentMethodsRoutes from './routes/fiatPaymentMethods.js';
import servicesRoutes from './routes/services.js';
import jobsRoutes from './routes/jobs.js';
import agentActivationRoutes from './routes/agentActivation.js';
import agentsRoutes from './routes/agents.js';
import pushRoutes from './routes/push.js';
import telegramRoutes from './routes/telegram.js';
import whatsappRoutes from './routes/whatsapp.js';
import sitemapRoutes from './routes/sitemap.js';
import ogRoutes from './routes/og.js';
import badgeRoutes from './routes/badge.js';
import geoRoutes from './routes/geo.js';
import affiliateRoutes from './routes/affiliate.js';
import adminRoutes from './routes/admin.js';
import feedbackRoutes from './routes/feedback.js';
import listingsRoutes from './routes/listings.js';
import careersRoutes from './routes/careers.js';
import photosRoutes from './routes/photos.js';
import agentPhotosRoutes from './routes/agentPhotos.js';
import blogApiRoutes from './routes/blog.js';
import cvRouter from './routes/cv.js';
import mcpOAuthRoutes from './routes/mcp-oauth.js';
import mcpRemoteRoutes from './routes/mcp-remote.js';
import { getProfileMetaHtml, getProfileMetaHtmlByUsername, getBlogMetaHtml, getCareersMetaHtml, getDevPageMetaHtml, getPromptToCompletionMetaHtml, getGptSetupMetaHtml, getListingMetaHtml } from './lib/seo.js';
import { getGptSetupGoHtml } from './lib/gpt-setup-page.js';
import { prisma } from './lib/prisma.js';
import { trackServerEvent } from './lib/posthog.js';

const app = express();

// Trust first proxy (nginx/ALB) so X-Forwarded-For is used for rate limiting
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://static.cloudflareinsights.com", "https://us-assets.i.posthog.com"],
      connectSrc: ["'self'", "https://us.i.posthog.com", "https://us-assets.i.posthog.com", "https://auth.privy.io", "wss://relay.walletconnect.com", "wss://relay.walletconnect.org", "wss://www.walletlink.org", "https://*.rpc.privy.systems", "https://explorer-api.walletconnect.com"],
      imgSrc: ["'self'", "data:", "https://*.r2.cloudflarestorage.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      frameSrc: ["'self'", "https://auth.privy.io", "https://verify.walletconnect.com", "https://verify.walletconnect.org", "https://challenges.cloudflare.com"],
      childSrc: ["https://auth.privy.io", "https://verify.walletconnect.com", "https://verify.walletconnect.org"],
    },
  },
}));
app.use(cors({
  origin: (origin, callback) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const allowedOrigins = [
      frontendUrl,
      // ChatGPT MCP connector origins (required for Developer Mode + App Directory)
      'https://chatgpt.com',
      'https://chat.openai.com',
    ];
    // Allow: listed origins, chrome extensions, no-origin (CLI/server-to-server)
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'MCP-Protocol-Version',
    'Mcp-Session-Id',
    'Last-Event-ID',
  ],
  exposedHeaders: [
    'Mcp-Session-Id',
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
}));
// MCP OAuth authorize form uses application/x-www-form-urlencoded
app.use('/oauth/authorize', express.urlencoded({ extended: false, limit: '10kb' }));

// Routes with larger body limits (before global 10kb parser, API-key protected)
app.use('/api/admin/content', express.json({ limit: '2mb' }));
app.use('/api/admin/photo-concepts', express.json({ limit: '2mb' }));
app.use('/api/admin/leads', express.json({ limit: '2mb' }));
app.use('/api/feedback', express.json({ limit: '2mb' }));
app.use('/api/admin/videos', express.json({ limit: '2mb' }));

// Multipart file upload routes MUST be mounted before the global JSON body parser
// to avoid the parser rejecting multipart/form-data requests.
// JSON body parser is added per-path so non-multipart endpoints (PATCH, import-oauth) work.
app.use('/api/photos', express.json({ limit: '10kb' }), photosRoutes);
app.use('/api/agents/photos', agentPhotosRoutes);
app.use('/api/listings', express.json({ limit: '10kb' }), listingsRoutes);
app.use('/api/cv', cvRouter);

// Global body parser — 10kb limit for all other routes (bot/abuse protection)
// Skip JSON parser for multipart/file upload routes (already handled per-path above)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/cv') || req.path.startsWith('/api/photos') || req.path.startsWith('/api/agents/photos') || req.path.startsWith('/api/listings')) {
    return next();
  }
  express.json({ limit: '10kb' })(req, res, next);
});

// TODO: Add gzip compression middleware (85% bandwidth savings)
// Add after installing 'compression' package:
// import compression from 'compression';
// app.use(compression({ level: 6, threshold: 1024 }));

app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'humans-api' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/humans', humansRoutes);
app.use('/api/wallets', walletsRoutes);
app.use('/api/fiat-payment-methods', fiatPaymentMethodsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/agents/activate', agentActivationRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blog', blogApiRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/feedback', feedbackRoutes);

// MCP OAuth 2.0 endpoints (well-known discovery, client registration, authorize, token)
app.use(mcpOAuthRoutes);
// MCP Streamable HTTP transport (POST/GET/DELETE /mcp)
app.use('/api', mcpRemoteRoutes);

// Geo detection
app.use('/api/geo', geoRoutes);

// SEO routes
app.use(sitemapRoutes);
app.use('/api', sitemapRoutes);
app.use('/api/og', ogRoutes);
app.use('/api/badge', badgeRoutes);

// Newsletter signup (public, rate-limited by IP via express defaults)
app.post('/api/newsletter', express.json({ limit: '1kb' }), async (req, res) => {
  const { email, source } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  try {
    const normalizedEmail = email.toLowerCase().trim();
    await prisma.influencerLead.upsert({
      where: { dedupeKey: `newsletter:${normalizedEmail}` },
      update: {},
      create: {
        name: normalizedEmail,
        email: normalizedEmail,
        dedupeKey: `newsletter:${normalizedEmail}`,
        list: 'newsletter',
        notes: `Newsletter signup from ${source || 'unknown'} page`,
        platforms: ['newsletter'],
        status: 'NEW',
        source: 'MANUAL',
      },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Newsletter signup failed');
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ===== Bot crawl tracking for GEO-sensitive routes =====
const AI_BOT_PATTERNS: Record<string, RegExp> = {
  'GPTBot': /GPTBot/i,
  'ChatGPT-User': /ChatGPT-User/i,
  'ClaudeBot': /ClaudeBot/i,
  'Anthropic-Docs': /Anthropic-Docs/i,
  'PerplexityBot': /PerplexityBot/i,
  'Google-Extended': /Google-Extended/i,
  'Googlebot': /Googlebot/i,
  'Applebot': /Applebot/i,
  'Bingbot': /bingbot/i,
  'Bytespider': /Bytespider/i,
  'YandexBot': /YandexBot/i,
  'FacebookBot': /facebookexternalhit/i,
  'LinkedInBot': /LinkedInBot/i,
};

app.use(['/llms.txt', '/.well-known/openapi.json', '/.well-known/ai-plugin.json'], (req, res, next) => {
  const userAgent = req.get('user-agent') || '';
  for (const [botName, pattern] of Object.entries(AI_BOT_PATTERNS)) {
    if (pattern.test(userAgent)) {
      logger.info({ bot: botName, path: req.path, ip: req.ip }, 'AI bot crawl detected');
      trackServerEvent(`bot:${botName}`, 'ai_bot_crawl', {
        path: req.path,
        botName,
        userAgent: userAgent.substring(0, 200),
      }, req);
      break;
    }
  }
  next();
});

// Serve frontend static files in production
const frontendDistPath = path.join(process.cwd(), '../frontend/dist');

// Try to serve static files from the frontend build
app.use(express.static(frontendDistPath, { index: false }));

// Blog posts & Profile pages: inject dynamic meta tags for social sharing / SEO
const SUPPORTED_LANGS = ['es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th', 'fr', 'pt'];

// Dev page: inject meta tags + crawler-visible content for AI agents and non-JS crawlers
app.get('/:lang/dev', (req, res, next) => {
  if (!SUPPORTED_LANGS.includes(req.params.lang)) return next();
  const html = getDevPageMetaHtml(req.params.lang);
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
  next();
});

app.get('/dev', (req, res, next) => {
  const html = getDevPageMetaHtml();
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
  next();
});

// Prompt to completion page: inject meta tags + crawler-visible content
app.get('/:lang/prompt-to-completion', (req, res, next) => {
  if (!SUPPORTED_LANGS.includes(req.params.lang)) return next();
  const html = getPromptToCompletionMetaHtml(req.params.lang);
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
  next();
});

app.get('/prompt-to-completion', (req, res, next) => {
  const html = getPromptToCompletionMetaHtml();
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
  next();
});

// GPT Setup page: inject meta tags for social sharing / SEO
app.get('/gpt-setup', (req, res, next) => {
  const html = getGptSetupMetaHtml();
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
  next();
});

// GPT one-click install — smart landing page (mobile-first, tap-driven)
// When we're in the App Directory: redirect straight there (true one-click)
// Until then: serve a landing page that copies the MCP URL and guides setup
app.get('/gpt-setup/go', (_req, res) => {
  const appDirectoryUrl = process.env.GPT_APP_DIRECTORY_URL;
  if (appDirectoryUrl) {
    return res.redirect(302, appDirectoryUrl);
  }

  const mcpUrl = 'https://mcp.humanpages.ai/api/mcp';
  const frontendUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  return res.send(getGptSetupGoHtml(mcpUrl, frontendUrl));
});

// Careers page: inject meta tags for social sharing (keeps "Stop chasing clients." OG image)
app.get('/:lang/careers', (req, res, next) => {
  if (!SUPPORTED_LANGS.includes(req.params.lang)) return next();
  const html = getCareersMetaHtml(req.params.lang);
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
  next();
});

app.get('/careers', (req, res, next) => {
  const html = getCareersMetaHtml();
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
  next();
});

app.get('/:lang/blog/:slug', async (req, res, next) => {
  if (!SUPPORTED_LANGS.includes(req.params.lang)) return next();
  try {
    const html = await getBlogMetaHtml(req.params.slug, req.params.lang);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

app.get('/blog/:slug', async (req, res, next) => {
  try {
    const html = await getBlogMetaHtml(req.params.slug);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

// Listing pages: redirect /listings/:id → /work/:code (short link as canonical URL)
// If no short link exists yet (pre-backfill), fall through to serve meta HTML directly.
app.get('/:lang/listings/:id', async (req, res, next) => {
  if (!SUPPORTED_LANGS.includes(req.params.lang)) return next();
  try {
    const link = await prisma.listingLink.findFirst({
      where: { listingId: req.params.id },
      orderBy: { createdAt: 'asc' },
      select: { code: true },
    });
    if (link) {
      return res.redirect(302, `/${req.params.lang}/work/${link.code}`);
    }
    // No short link yet — serve meta HTML directly
    const html = await getListingMetaHtml(req.params.id, req.params.lang);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

app.get('/listings/:id', async (req, res, next) => {
  // Skip API-like paths (the /api/listings route handles those)
  if (req.params.id === 'api') return next();
  try {
    const link = await prisma.listingLink.findFirst({
      where: { listingId: req.params.id },
      orderBy: { createdAt: 'asc' },
      select: { code: true },
    });
    if (link) {
      return res.redirect(302, `/work/${link.code}`);
    }
    // No short link yet — serve meta HTML directly
    const html = await getListingMetaHtml(req.params.id);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

// Short listing links with language prefix: /:lang/work/:code → resolve code → serve listing page with OG meta
app.get('/:lang/work/:code', async (req, res, next) => {
  if (!SUPPORTED_LANGS.includes(req.params.lang)) return next();
  try {
    const link = await prisma.listingLink.findUnique({
      where: { code: req.params.code.toLowerCase() },
      select: { listingId: true, code: true },
    });
    if (!link) return next(); // Fall through to SPA (shows 404)

    // Increment click count (fire-and-forget)
    prisma.listingLink.update({
      where: { code: link.code },
      data: { clicks: { increment: 1 } },
    }).catch((err: unknown) => logger.warn({ err, code: link.code }, 'Failed to increment link click count'));

    // Inject OG meta tags so the short link previews correctly on social
    const html = await getListingMetaHtml(link.listingId, req.params.lang);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

// Short listing links: /work/:code → resolve code → serve listing page with OG meta
app.get('/work/:code', async (req, res, next) => {
  try {
    const link = await prisma.listingLink.findUnique({
      where: { code: req.params.code.toLowerCase() },
      select: { listingId: true, code: true },
    });
    if (!link) return next(); // Fall through to SPA (shows 404)

    // Increment click count (fire-and-forget)
    prisma.listingLink.update({
      where: { code: link.code },
      data: { clicks: { increment: 1 } },
    }).catch((err: unknown) => logger.warn({ err, code: link.code }, 'Failed to increment link click count'));

    // Inject OG meta tags so the short link previews correctly on social
    const html = await getListingMetaHtml(link.listingId);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

// Profile pages: inject dynamic meta tags for social sharing / SEO

app.get('/:lang/humans/:id', async (req, res, next) => {
  if (!SUPPORTED_LANGS.includes(req.params.lang)) return next();
  try {
    const html = await getProfileMetaHtml(req.params.id, req.params.lang);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

app.get('/humans/:id', async (req, res, next) => {
  try {
    const html = await getProfileMetaHtml(req.params.id);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

app.get('/:lang/u/:username', async (req, res, next) => {
  if (!SUPPORTED_LANGS.includes(req.params.lang)) return next();
  try {
    const html = await getProfileMetaHtmlByUsername(req.params.username, req.params.lang);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

app.get('/u/:username', async (req, res, next) => {
  try {
    const html = await getProfileMetaHtmlByUsername(req.params.username);
    if (html) {
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch {
    // Fall through to SPA
  }
  next();
});

// /from/:slug — short redirect links for outreach tracking
const FROM_SLUGS: Record<string, { utm_source: string; utm_medium: string; utm_campaign: string }> = {
  // Lagos — Telegram (sponsored)
  'mjane':            { utm_source: 'telegram', utm_medium: 'sponsored', utm_campaign: 'lagos_mjane' },
  'jobnetworking':    { utm_source: 'telegram', utm_medium: 'sponsored', utm_campaign: 'lagos_jobnetworking' },
  'mjane-wa':         { utm_source: 'whatsapp', utm_medium: 'sponsored', utm_campaign: 'lagos_mjane' },
  'jobnetworking-wa': { utm_source: 'whatsapp', utm_medium: 'sponsored', utm_campaign: 'lagos_jobnetworking' },
  // Digital Nomads — Telegram
  'offchain-bali':    { utm_source: 'telegram', utm_medium: 'organic', utm_campaign: 'nomad_offchain_bali' },
  'cryptojobslist':   { utm_source: 'telegram', utm_medium: 'organic', utm_campaign: 'nomad_cryptojobslist' },
  'dnxchat':          { utm_source: 'telegram', utm_medium: 'organic', utm_campaign: 'nomad_dnxchat' },
  // Digital Nomads — Reddit
  'beermoney':        { utm_source: 'reddit', utm_medium: 'organic', utm_campaign: 'nomad_beermoney' },
  'workonline':       { utm_source: 'reddit', utm_medium: 'organic', utm_campaign: 'nomad_workonline' },
  'digitalnomad':     { utm_source: 'reddit', utm_medium: 'organic', utm_campaign: 'nomad_digitalnomad' },
  'sidehustle':       { utm_source: 'reddit', utm_medium: 'organic', utm_campaign: 'nomad_sidehustle' },
  'slavelabour':      { utm_source: 'reddit', utm_medium: 'organic', utm_campaign: 'nomad_slavelabour' },
  'jobsforbitcoin':   { utm_source: 'reddit', utm_medium: 'organic', utm_campaign: 'nomad_jobsforbitcoin' },
  // Digital Nomads — Facebook
  'fb-chiangmai':     { utm_source: 'facebook', utm_medium: 'organic', utm_campaign: 'nomad_chiangmai' },
  'fb-digitalnomads': { utm_source: 'facebook', utm_medium: 'organic', utm_campaign: 'nomad_digitalnomads' },
  'fb-aroundtheworld':{ utm_source: 'facebook', utm_medium: 'organic', utm_campaign: 'nomad_aroundtheworld' },
  'fb-jobs':          { utm_source: 'facebook', utm_medium: 'organic', utm_campaign: 'nomad_jobs' },
  'fb-thailand':      { utm_source: 'facebook', utm_medium: 'organic', utm_campaign: 'thailand_nomads' },
  // Digital Nomads — WhatsApp
  'wa-thailand':      { utm_source: 'whatsapp', utm_medium: 'organic', utm_campaign: 'nomad_thailand' },
  'wa-sea':           { utm_source: 'whatsapp', utm_medium: 'organic', utm_campaign: 'nomad_sea' },
  'wa-bali':          { utm_source: 'whatsapp', utm_medium: 'organic', utm_campaign: 'nomad_bali' },
  // Thailand — other
  'line-thailand':    { utm_source: 'line', utm_medium: 'organic', utm_campaign: 'thailand_openchat' },
  'pantip':           { utm_source: 'pantip', utm_medium: 'organic', utm_campaign: 'thailand_pantip' },
  // Lagos — Nairaland
  'nairaland':        { utm_source: 'nairaland', utm_medium: 'organic', utm_campaign: 'lagos_nairaland' },
  // Lagos — Linktree outreach
  'ngvacancy':        { utm_source: 'linktree', utm_medium: 'referral', utm_campaign: 'lagos_ngvacancy' },
  'workready':        { utm_source: 'linktree', utm_medium: 'referral', utm_campaign: 'lagos_workready' },
  'remoteafrica':     { utm_source: 'linktree', utm_medium: 'referral', utm_campaign: 'lagos_remoteafrica' },
  'gngjobs':          { utm_source: 'linktree', utm_medium: 'referral', utm_campaign: 'lagos_gngjobs' },
  'envisagehub':      { utm_source: 'linktree', utm_medium: 'referral', utm_campaign: 'lagos_envisagehub' },
  'linkedinlocal':    { utm_source: 'linktree', utm_medium: 'referral', utm_campaign: 'lagos_linkedinlocal' },
  // Lagos — Telegram (outreach round 2)
  'jobnow':           { utm_source: 'telegram', utm_medium: 'sponsored', utm_campaign: 'lagos_jobnow' },
  'jobvacancies':     { utm_source: 'telegram', utm_medium: 'sponsored', utm_campaign: 'lagos_jobvacancies' },
  // Lagos — WhatsApp groups
  'wa-lagos':         { utm_source: 'whatsapp', utm_medium: 'organic', utm_campaign: 'lagos_whatsapp' },
  // Somaliland — direct outreach
  'somalijobs':       { utm_source: 'somalijobs', utm_medium: 'partnership', utm_campaign: 'somaliland_somalijobs' },
  'somalijobs-tg':    { utm_source: 'telegram', utm_medium: 'sponsored', utm_campaign: 'somaliland_somalijobs' },
  'somalijobs-fb':    { utm_source: 'facebook', utm_medium: 'organic', utm_campaign: 'somaliland_somalijobs' },
  'qaranjobs':        { utm_source: 'qaranjobs', utm_medium: 'partnership', utm_campaign: 'somaliland_qaranjobs' },
  'joblink-so':       { utm_source: 'joblink', utm_medium: 'partnership', utm_campaign: 'somaliland_joblink' },
  // Crypto job boards
  'board-cryptojobs': { utm_source: 'cryptojobslist', utm_medium: 'paid', utm_campaign: 'jobboard_cryptojobslist' },
  'board-web3career': { utm_source: 'web3career', utm_medium: 'paid', utm_campaign: 'jobboard_web3career' },
  'board-remote3':    { utm_source: 'remote3', utm_medium: 'paid', utm_campaign: 'jobboard_remote3' },
  'board-laborx':     { utm_source: 'laborx', utm_medium: 'paid', utm_campaign: 'jobboard_laborx' },
};

app.get('/from/:slug', (req, res) => {
  const params = FROM_SLUGS[req.params.slug];
  if (!params) {
    return res.redirect(302, '/');
  }
  const url = new URL('/', 'https://humanpages.ai');
  url.searchParams.set('utm_source', params.utm_source);
  url.searchParams.set('utm_medium', params.utm_medium);
  url.searchParams.set('utm_campaign', params.utm_campaign);
  res.redirect(302, url.toString());
});

// SPA catch-all: serve index.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // In development, frontend is served by Vite
      res.status(404).json({ error: 'Frontend not built. Run: cd frontend && npm run build' });
    }
  });
});

export default app;
