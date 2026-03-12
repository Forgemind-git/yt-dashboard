require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initDatabase = require('./db/init-db');
const runMigrations = require('./db/migrate');
const startScheduler = require('./jobs/scheduler');
const apiRoutes = require('./api');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// API routes
app.use('/api', apiRoutes);

async function start() {
  try {
    // Initialize database and run migrations
    await initDatabase();
    await runMigrations();

    // Start cron scheduler
    startScheduler();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`YT Analytics backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
