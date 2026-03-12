const { Router } = require('express');
const pool = require('../db/pool');
const runFullCollection = require('../jobs/masterCollector');

const router = Router();

router.get('/collection/logs', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const { rows } = await pool.query(
      `SELECT run_id, collector_name, status, rows_affected, error_message, started_at, finished_at
       FROM collection_logs ORDER BY started_at DESC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('Collection logs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch collection logs' });
  }
});

router.post('/collect/trigger', async (_req, res) => {
  try {
    // Run in background, return immediately
    const runId = runFullCollection().catch(err => {
      console.error('Manual collection failed:', err.message);
    });
    res.json({ message: 'Collection triggered', status: 'running' });
  } catch (err) {
    console.error('Trigger error:', err.message);
    res.status(500).json({ error: 'Failed to trigger collection' });
  }
});

module.exports = router;
