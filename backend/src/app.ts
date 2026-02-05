import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import humansRoutes from './routes/humans.js';
import walletsRoutes from './routes/wallets.js';
import jobsRoutes from './routes/jobs.js';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'humans-api' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/humans', humansRoutes);
app.use('/api/wallets', walletsRoutes);
app.use('/api/jobs', jobsRoutes);

export default app;
