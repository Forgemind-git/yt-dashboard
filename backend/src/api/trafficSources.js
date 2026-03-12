const { Router } = require('express');
const pool = require('../db/pool');
const { parseDateRange } = require('./helpers');

const router = Router();

router.get('/traffic-sources', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT source_type, SUM(views) AS views,
              SUM(estimated_minutes_watched) AS watch_time
       FROM traffic_sources
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY source_type
       ORDER BY views DESC`,
      [from, to]
    );
    res.json(rows);
  } catch (err) {
    console.error('Traffic sources error:', err.message);
    res.status(500).json({ error: 'Failed to fetch traffic sources' });
  }
});

module.exports = router;
