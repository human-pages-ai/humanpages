import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import humansRoutes from './routes/humans.js';
import walletsRoutes from './routes/wallets.js';
import servicesRoutes from './routes/services.js';
import jobsRoutes from './routes/jobs.js';
import telegramRoutes from './routes/telegram.js';

const app = express();

app.use(cors());
app.use(express.json());

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
