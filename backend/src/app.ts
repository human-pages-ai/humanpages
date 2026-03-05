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
import servicesRoutes from './routes/services.js';
import jobsRoutes from './routes/jobs.js';
import agentActivationRoutes from './routes/agentActivation.js';
import agentsRoutes from './routes/agents.js';
import telegramRoutes from './routes/telegram.js';
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
import { getProfileMetaHtml, getProfileMetaHtmlByUsername, getBlogMetaHtml, getCareersMetaHtml, getDevPageMetaHtml } from './lib/seo.js';
import { trackServerEvent } from './lib/posthog.js';

const app = express();

// Trust first proxy (nginx/ALB) so X-Forwarded-For is used for rate limiting
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://static.cloudflareinsights.com", "https://us-assets.i.posthog.com"],
      connectSrc: ["'self'", "https://us.i.posthog.com", "https://us-assets.i.posthog.com"],
      imgSrc: ["'self'", "data:", "https://*.r2.cloudflarestorage.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
    },
  },
}));
app.use(cors({
  origin: (origin, callback) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Allow: frontend, chrome extensions, no-origin (CLI/server-to-server)
    if (!origin || origin === frontendUrl || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
// Routes with larger body limits (before global 10kb parser, API-key protected)
app.use('/api/admin/content', express.json({ limit: '2mb' }));
app.use('/api/admin/photo-concepts', express.json({ limit: '2mb' }));
app.use('/api/admin/leads', express.json({ limit: '2mb' }));
app.use('/api/feedback', express.json({ limit: '2mb' }));
app.use('/api/admin/videos', express.json({ limit: '2mb' }));

// Global body parser — 10kb limit for all other routes (bot/abuse protection)
app.use(express.json({ limit: '10kb' }));
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
app.use('/api/services', servicesRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/agents/activate', agentActivationRoutes);
app.use('/api/agents/photos', agentPhotosRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blog', blogApiRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/photos', photosRoutes);

// Geo detection
app.use('/api/geo', geoRoutes);

// SEO routes
app.use(sitemapRoutes);
app.use('/api', sitemapRoutes);
app.use('/api/og', ogRoutes);
app.use('/api/badge', badgeRoutes);

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
