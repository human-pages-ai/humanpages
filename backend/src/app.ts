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
import { getProfileMetaHtml, getProfileMetaHtmlByUsername, getBlogMetaHtml, getCareersMetaHtml } from './lib/seo.js';

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
app.use(express.json({ limit: '2mb' }));
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
app.use('/api/admin/content', express.json({ limit: '2mb' }));
app.use('/api/admin', adminRoutes);
app.use('/api/blog', blogApiRoutes);
app.use('/api/feedback', express.json({ limit: '2mb' }), feedbackRoutes);
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

// Serve frontend static files in production
const frontendDistPath = path.join(process.cwd(), '../frontend/dist');

// Try to serve static files from the frontend build
app.use(express.static(frontendDistPath, { index: false }));

// Blog posts & Profile pages: inject dynamic meta tags for social sharing / SEO
const SUPPORTED_LANGS = ['es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th', 'fr', 'pt'];

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
