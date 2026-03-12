const { Router } = require('express');
const pool = require('../db/pool');
const { parseDateRange, pctChange } = require('./helpers');

const router = Router();

router.get('/overview', async (req, res) => {
  try {
    const { from, to, prevFrom, prevTo } = parseDateRange(req.query);

    const [current, previous] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(views), 0) AS views,
           COALESCE(SUM(estimated_minutes_watched), 0) AS watch_time,
           COALESCE(SUM(net_subscribers), 0) AS net_subscribers,
           COALESCE(AVG(impressions_ctr), 0) AS avg_ctr,
           COALESCE(SUM(estimated_revenue), 0) AS revenue,
           COALESCE(SUM(impressions), 0) AS impressions
         FROM channel_snapshots WHERE snapshot_date BETWEEN $1 AND $2`,
        [from, to]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(views), 0) AS views,
           COALESCE(SUM(estimated_minutes_watched), 0) AS watch_time,
           COALESCE(SUM(net_subscribers), 0) AS net_subscribers,
           COALESCE(AVG(impressions_ctr), 0) AS avg_ctr,
           COALESCE(SUM(estimated_revenue), 0) AS revenue,
           COALESCE(SUM(impressions), 0) AS impressions
         FROM channel_snapshots WHERE snapshot_date BETWEEN $1 AND $2`,
        [prevFrom, prevTo]
      ),
    ]);

    const cur = current.rows[0];
    const prev = previous.rows[0];

    res.json({
      views: { value: parseInt(cur.views), change: pctChange(cur.views, prev.views) },
      watchTime: { value: parseInt(cur.watch_time), change: pctChange(cur.watch_time, prev.watch_time) },
      subscribers: { value: parseInt(cur.net_subscribers), change: pctChange(cur.net_subscribers, prev.net_subscribers) },
      ctr: { value: parseFloat(cur.avg_ctr), change: pctChange(cur.avg_ctr, prev.avg_ctr) },
      revenue: { value: parseFloat(cur.revenue), change: pctChange(cur.revenue, prev.revenue) },
      impressions: { value: parseInt(cur.impressions), change: pctChange(cur.impressions, prev.impressions) },
    });
  } catch (err) {
    console.error('Overview error:', err.message);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

module.exports = router;
