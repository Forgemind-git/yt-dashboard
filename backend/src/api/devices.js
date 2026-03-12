const { Router } = require('express');
const pool = require('../db/pool');
const { parseDateRange } = require('./helpers');

const router = Router();

router.get('/devices', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);

    const [byDevice, byOS] = await Promise.all([
      pool.query(
        `SELECT device_type, SUM(views) AS views,
                SUM(estimated_minutes_watched) AS watch_time
         FROM device_stats
         WHERE snapshot_date BETWEEN $1 AND $2
         GROUP BY device_type ORDER BY views DESC`,
        [from, to]
      ),
      pool.query(
        `SELECT operating_system, SUM(views) AS views,
                SUM(estimated_minutes_watched) AS watch_time
         FROM device_stats
         WHERE snapshot_date BETWEEN $1 AND $2
         GROUP BY operating_system ORDER BY views DESC`,
        [from, to]
      ),
    ]);

    res.json({ devices: byDevice.rows, operatingSystems: byOS.rows });
  } catch (err) {
    console.error('Devices error:', err.message);
    res.status(500).json({ error: 'Failed to fetch device data' });
  }
});

module.exports = router;
