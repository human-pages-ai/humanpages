import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger.js';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import humansRoutes from './routes/humans.js';
import walletsRoutes from './routes/wallets.js';
import servicesRoutes from './routes/services.js';
import jobsRoutes from './routes/jobs.js';
import telegramRoutes from './routes/telegram.js';

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
app.use('/api/telegram', telegramRoutes);

export default app;
