require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const initDatabase = require('./db/init-db');
const runMigrations = require('./db/migrate');
const startScheduler = require('./jobs/scheduler');
const apiRoutes = require('./api');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet());

// CORS — restrict to known origin
app.use(cors({ origin: process.env.CORS_ORIGIN || 'https://yt.srv879786.hstgr.cloud' }));

app.use(express.json());

// Rate limiting for expensive AI and collection endpoints
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Health check (no auth required)
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Apply rate limits before API routes
app.use('/api/ai-insights', aiRateLimit);
app.use('/api/collect/trigger', aiRateLimit);

// API routes
app.use('/api', apiRoutes);

// DB connection with retry loop
async function connectWithRetry(fn, retries = 5, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`DB attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function start() {
  try {
    await connectWithRetry(initDatabase);
    await runMigrations();

    // Start cron scheduler
    startScheduler();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`YT Analytics backend running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down gracefully...`);
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
      // Force exit after 10s
      setTimeout(() => {
        console.error('Forced exit after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
