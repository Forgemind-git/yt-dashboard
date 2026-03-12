const { Router } = require('express');
const pool = require('../db/pool');

const router = Router();

router.get('/realtime', async (_req, res) => {
  try {
    const { rows: [latest] } = await pool.query(
      `SELECT concurrent_viewers, views_last_60_min, views_last_48_hours, collected_at
       FROM realtime_stats ORDER BY collected_at DESC LIMIT 1`
    );

    const { rows: history } = await pool.query(
      `SELECT concurrent_viewers, views_last_60_min, views_last_48_hours, collected_at
       FROM realtime_stats
       WHERE collected_at > NOW() - INTERVAL '48 hours'
       ORDER BY collected_at`
    );

    res.json({ latest: latest || null, history });
  } catch (err) {
    console.error('Realtime error:', err.message);
    res.status(500).json({ error: 'Failed to fetch realtime data' });
  }
});

module.exports = router;
