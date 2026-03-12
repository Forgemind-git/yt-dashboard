const { Router } = require('express');
const pool = require('../db/pool');
const { parseDateRange } = require('./helpers');

const router = Router();

router.get('/videos/top', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT video_id, MAX(title) AS title, MAX(thumbnail_url) AS thumbnail_url,
              SUM(views) AS views, SUM(estimated_minutes_watched) AS watch_time,
              SUM(likes) AS likes, SUM(comments) AS comments
       FROM video_stats
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY video_id
       ORDER BY views DESC
       LIMIT 10`,
      [from, to]
    );
    res.json(rows);
  } catch (err) {
    console.error('Top videos error:', err.message);
    res.status(500).json({ error: 'Failed to fetch top videos' });
  }
});

router.get('/videos/list', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const sort = req.query.sort || 'views';
    const allowedSorts = ['views', 'watch_time', 'likes', 'comments', 'revenue'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'views';

    const { rows } = await pool.query(
      `SELECT video_id, MAX(title) AS title, MAX(thumbnail_url) AS thumbnail_url,
              MAX(published_at) AS published_at,
              SUM(views) AS views, SUM(estimated_minutes_watched) AS watch_time,
              SUM(likes) AS likes, SUM(comments) AS comments,
              SUM(estimated_revenue) AS revenue
       FROM video_stats
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY video_id
       ORDER BY ${sortCol} DESC
       LIMIT $3 OFFSET $4`,
      [from, to, limit, offset]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(DISTINCT video_id) AS total FROM video_stats
       WHERE snapshot_date BETWEEN $1 AND $2`,
      [from, to]
    );

    res.json({
      data: rows,
      total: parseInt(countRows[0].total),
      page,
      limit,
    });
  } catch (err) {
    console.error('Video list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch video list' });
  }
});

router.get('/videos/:videoId', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT snapshot_date AS date, views, estimated_minutes_watched AS watch_time,
              likes, comments, shares, impressions, impressions_ctr AS ctr,
              estimated_revenue AS revenue
       FROM video_stats
       WHERE video_id = $1 AND snapshot_date BETWEEN $2 AND $3
       ORDER BY snapshot_date`,
      [req.params.videoId, from, to]
    );
    res.json(rows);
  } catch (err) {
    console.error('Video detail error:', err.message);
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

module.exports = router;
