const pool = require('../db/pool');
const { getYouTubeAnalytics } = require('../auth/youtube');
const dayjs = require('dayjs');

async function collectRealtimeStats() {
  const analytics = await getYouTubeAnalytics();
  const now = dayjs();

  // Get last 48 hours of data for the realtime view
  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate: now.subtract(2, 'day').format('YYYY-MM-DD'),
    endDate: now.format('YYYY-MM-DD'),
    metrics: 'views',
  });

  const totalViews48h = data.rows?.[0]?.[0] || 0;

  // Get last 60 minutes approximation (today's views as proxy)
  const { data: todayData } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate: now.format('YYYY-MM-DD'),
    endDate: now.format('YYYY-MM-DD'),
    metrics: 'views',
  });

  const viewsToday = todayData.rows?.[0]?.[0] || 0;

  const result = await pool.query(
    `INSERT INTO realtime_stats (concurrent_viewers, views_last_60_min, views_last_48_hours)
     VALUES ($1, $2, $3) RETURNING id`,
    [0, viewsToday, totalViews48h]
  );

  return result.rowCount;
}

module.exports = collectRealtimeStats;
