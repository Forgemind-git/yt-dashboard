const { Router } = require('express');
const pool = require('../db/pool');
const { parseDateRange } = require('./helpers');

const router = Router();

router.get('/channel/timeseries', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT snapshot_date AS date, views, net_subscribers AS subscribers,
              estimated_minutes_watched AS watch_time, estimated_revenue AS revenue
       FROM channel_snapshots
       WHERE snapshot_date BETWEEN $1 AND $2
       ORDER BY snapshot_date`,
      [from, to]
    );
    res.json(rows);
  } catch (err) {
    console.error('Channel timeseries error:', err.message);
    res.status(500).json({ error: 'Failed to fetch channel timeseries' });
  }
});

module.exports = router;
