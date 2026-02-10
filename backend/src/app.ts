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
import agentsRoutes from './routes/agents.js';
import telegramRoutes from './routes/telegram.js';
import sitemapRoutes from './routes/sitemap.js';
import ogRoutes from './routes/og.js';
import badgeRoutes from './routes/badge.js';
import geoRoutes from './routes/geo.js';
import { getProfileMetaHtml, getBlogMetaHtml } from './lib/seo.js';

const app = express();

// Trust first proxy (nginx/ALB) so X-Forwarded-For is used for rate limiting
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
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
app.use('/api/agents', agentsRoutes);
app.use('/api/telegram', telegramRoutes);

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

app.get('/:lang/blog/:slug', (req, res, next) => {
  if (!SUPPORTED_LANGS.includes(req.params.lang)) return next();
  const html = getBlogMetaHtml(req.params.slug, req.params.lang);
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
  next();
});

app.get('/blog/:slug', (req, res, next) => {
  const html = getBlogMetaHtml(req.params.slug);
  if (html) {
    res.set('Content-Type', 'text/html');
    return res.send(html);
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
