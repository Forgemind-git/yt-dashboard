const { Router } = require('express');
const pool = require('../db/pool');
const { parseDateRange } = require('./helpers');

const router = Router();

router.get('/demographics', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT age_group, gender, AVG(viewer_percentage) AS viewer_percentage
       FROM audience_demographics
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY age_group, gender
       ORDER BY age_group, gender`,
      [from, to]
    );
    res.json(rows);
  } catch (err) {
    console.error('Demographics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch demographics' });
  }
});

module.exports = router;
