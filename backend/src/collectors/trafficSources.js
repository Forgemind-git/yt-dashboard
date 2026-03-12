const dayjs = require('dayjs');
const pool = require('../db/pool');
const { getYouTubeAnalytics } = require('../auth/youtube');

async function collectTrafficSources(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();

  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate: dayjs(startDate).format('YYYY-MM-DD'),
    endDate: dayjs(endDate).format('YYYY-MM-DD'),
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'day,insightTrafficSourceType',
    sort: 'day',
  });

  let rowsAffected = 0;
  for (const row of data.rows || []) {
    const [date, sourceType, views, minutesWatched] = row;
    await pool.query(
      `INSERT INTO traffic_sources (snapshot_date, source_type, views, estimated_minutes_watched)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (snapshot_date, source_type) DO UPDATE SET
         views=EXCLUDED.views, estimated_minutes_watched=EXCLUDED.estimated_minutes_watched`,
      [date, sourceType, views, minutesWatched]
    );
    rowsAffected++;
  }

  return rowsAffected;
}

module.exports = collectTrafficSources;
