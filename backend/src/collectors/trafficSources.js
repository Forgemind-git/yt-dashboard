const pool = require('../db/pool');
const { getYouTubeAnalytics } = require('../auth/youtube');

async function collectTrafficSources(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();

  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'day,insightTrafficSourceType',
    sort: 'day',
  });

  const rows = data.rows || [];
  if (rows.length === 0) return 0;

  // Batch insert
  const values = [];
  const params = [];
  let idx = 1;

  for (const row of rows) {
    const [date, sourceType, views, minutesWatched] = row;
    values.push(`($${idx},$${idx+1},$${idx+2},$${idx+3})`);
    params.push(date, sourceType, views, minutesWatched);
    idx += 4;
  }

  await pool.query(
    `INSERT INTO traffic_sources (snapshot_date, source_type, views, estimated_minutes_watched)
     VALUES ${values.join(',')}
     ON CONFLICT (snapshot_date, source_type) DO UPDATE SET
       views=EXCLUDED.views, estimated_minutes_watched=EXCLUDED.estimated_minutes_watched`,
    params
  );

  return rows.length;
}

module.exports = collectTrafficSources;
