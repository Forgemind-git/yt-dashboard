const { Router } = require('express');
const pool = require('../db/pool');
const { parseDateRange } = require('./helpers');

const router = Router();

router.get('/geography', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT country_code, SUM(views) AS views,
              SUM(estimated_minutes_watched) AS watch_time
       FROM geography_stats
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY country_code
       ORDER BY views DESC`,
      [from, to]
    );
    res.json(rows);
  } catch (err) {
    console.error('Geography error:', err.message);
    res.status(500).json({ error: 'Failed to fetch geography data' });
  }
});

module.exports = router;
