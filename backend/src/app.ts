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
import cvRouter from './routes/cv.js';
import mcpOAuthRoutes from './routes/mcp-oauth.js';
import mcpRemoteRoutes from './routes/mcp-remote.js';
import { getProfileMetaHtml, getProfileMetaHtmlByUsername, getBlogMetaHtml, getCareersMetaHtml, getDevPageMetaHtml, getGptSetupMetaHtml, getListingMetaHtml } from './lib/seo.js';
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
    // Allow: frontend, chrome extensions, no-origin (CLI/server-to-server)
    if (!origin || origin === frontendUrl || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
// MCP OAuth authorize form uses application/x-www-form-urlencoded
app.use('/oauth/authorize', express.urlencoded({ extended: false, limit: '10kb' }));

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
app.use('/api/fiat-payment-methods', fiatPaymentMethodsRoutes);
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
app.use('/api/cv', cvRouter);

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

// GPT Setup page: inject meta tags for social sharing / SEO
app.get('/gpt-setup', (req, res, next) => {
  const html = getGptSetupMetaHtml();
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
  next();
});

// GPT one-click install — smart landing page
// When we're in the App Directory: redirect straight there (true one-click)
// Until then: serve a landing page that auto-copies the MCP URL and redirects to ChatGPT
app.get('/gpt-setup/go', (_req, res) => {
  const appDirectoryUrl = process.env.GPT_APP_DIRECTORY_URL;
  if (appDirectoryUrl) {
    return res.redirect(302, appDirectoryUrl);
  }

  const mcpUrl = 'https://mcp.humanpages.ai/api/mcp';
  const frontendUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';

  // Serve a self-contained landing page that:
  // 1. Auto-copies the MCP server URL to clipboard
  // 2. Shows a countdown animation
  // 3. Redirects to ChatGPT after 4 seconds
  // 4. Gives the user clear instructions on what to do next
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect Human Pages to GPT</title>
  <meta name="description" content="One-click setup for Human Pages MCP connector in GPT">
  <meta property="og:title" content="Connect Human Pages to GPT">
  <meta property="og:description" content="Add Human Pages to your GPT in seconds">
  <meta property="og:url" content="${frontendUrl}/gpt-setup/go">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{max-width:480px;width:100%;margin:24px;padding:48px 36px;background:#1e293b;border-radius:20px;border:1px solid #334155;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.4)}
    h1{font-size:28px;font-weight:700;margin-bottom:8px}
    .subtitle{color:#94a3b8;font-size:15px;margin-bottom:32px}
    .url-box{background:#0f172a;border:2px solid #f97316;border-radius:12px;padding:14px 18px;font-family:'SF Mono',Monaco,monospace;font-size:14px;color:#f97316;word-break:break-all;margin-bottom:24px;position:relative;cursor:pointer;transition:border-color .2s}
    .url-box:hover{border-color:#fb923c}
    .copied-badge{position:absolute;top:-10px;right:12px;background:#16a34a;color:#fff;font-size:11px;font-weight:600;padding:2px 10px;border-radius:99px;opacity:0;transition:opacity .3s}
    .copied-badge.show{opacity:1}
    .status{margin-bottom:28px;min-height:60px}
    .status-text{font-size:18px;font-weight:600;margin-bottom:4px}
    .status-sub{color:#94a3b8;font-size:13px}
    .countdown{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;border:3px solid #f97316;font-size:24px;font-weight:700;color:#f97316;margin-bottom:16px;position:relative}
    .countdown-ring{position:absolute;inset:-3px;border-radius:50%;border:3px solid transparent;border-top-color:#f97316;animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .steps{text-align:left;background:#0f172a;border-radius:12px;padding:20px 24px;margin-bottom:24px}
    .step{display:flex;gap:12px;padding:8px 0;font-size:14px;color:#cbd5e1}
    .step-num{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:#f97316;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
    .step.active{color:#f8fafc;font-weight:500}
    .step.done .step-num{background:#16a34a}
    .btn{display:inline-block;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none;transition:all .15s;cursor:pointer;border:none}
    .btn-primary{background:#f97316;color:#fff}
    .btn-primary:hover{background:#ea580c;transform:translateY(-1px)}
    .btn-secondary{background:#334155;color:#e2e8f0;margin-top:8px;font-size:14px;padding:10px 24px}
    .btn-secondary:hover{background:#475569}
    .manual{margin-top:20px;font-size:13px;color:#64748b}
    .manual a{color:#f97316;text-decoration:none}
    .manual a:hover{text-decoration:underline}
    .logo{font-size:32px;margin-bottom:16px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">&#x1F91D;</div>
    <h1>Connecting to GPT</h1>
    <p class="subtitle">Human Pages MCP Server</p>

    <div class="url-box" id="urlBox" onclick="copyUrl()">
      ${mcpUrl}
      <span class="copied-badge" id="copiedBadge">Copied!</span>
    </div>

    <div class="status" id="statusArea">
      <div class="countdown" id="countdown">
        <span id="countNum">4</span>
        <div class="countdown-ring"></div>
      </div>
      <div class="status-text" id="statusText">Copying URL to clipboard...</div>
      <div class="status-sub" id="statusSub">Opening GPT in a moment</div>
    </div>

    <div class="steps">
      <div class="step done" id="step1">
        <span class="step-num">1</span>
        <span>Visit this link (you're here!)</span>
      </div>
      <div class="step active" id="step2">
        <span class="step-num">2</span>
        <span>In GPT: Settings &rarr; Apps &rarr; Create</span>
      </div>
      <div class="step" id="step3">
        <span class="step-num">3</span>
        <span>Paste the URL &amp; select OAuth &rarr; done!</span>
      </div>
    </div>

    <a class="btn btn-primary" id="goBtn" href="https://chatgpt.com" target="_blank" rel="noopener">
      Open GPT Now &rarr;
    </a>
    <br>
    <button class="btn btn-secondary" onclick="copyUrl()">
      Copy URL Again
    </button>

    <div class="manual">
      Need help? <a href="${frontendUrl}/en/gpt-setup">View full setup guide</a>
    </div>
  </div>

  <script>
    const MCP_URL = '${mcpUrl}';
    let copied = false;

    async function copyUrl() {
      try {
        await navigator.clipboard.writeText(MCP_URL);
        copied = true;
        document.getElementById('copiedBadge').classList.add('show');
        setTimeout(() => document.getElementById('copiedBadge').classList.remove('show'), 2000);
      } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = MCP_URL;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copied = true;
        document.getElementById('copiedBadge').classList.add('show');
        setTimeout(() => document.getElementById('copiedBadge').classList.remove('show'), 2000);
      }
    }

    // Auto-copy on load
    copyUrl().then(() => {
      document.getElementById('statusText').textContent = 'URL copied to clipboard!';
    }).catch(() => {
      document.getElementById('statusText').textContent = 'Click the URL above to copy it';
    });

    // Countdown
    let count = 4;
    const timer = setInterval(() => {
      count--;
      document.getElementById('countNum').textContent = count;
      if (count <= 0) {
        clearInterval(timer);
        document.getElementById('statusText').textContent = 'GPT is opening...';
        document.getElementById('statusSub').textContent = 'Go to Settings → Apps → Create → Paste the URL';
        document.getElementById('step2').classList.add('active');
        window.open('https://chatgpt.com', '_blank', 'noopener');
      }
    }, 1000);
  </script>
</body>
</html>`);
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
