const pool = require('../db/pool');
const { getYouTubeAnalytics } = require('../auth/youtube');

async function collectGeography(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();

  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'country',
    sort: '-views',
  });

  const rows = data.rows || [];
  if (!rows.length) return 0;

  const values = rows.map((row, i) => {
    const [country, views, minutesWatched] = row;
    const base = i * 4;
    return { vals: [endDate, country, views, minutesWatched], placeholders: `($${base+1},$${base+2},$${base+3},$${base+4})` };
  });

  await pool.query(
    `INSERT INTO geography_stats (snapshot_date, country_code, views, estimated_minutes_watched)
     VALUES ${values.map(v => v.placeholders).join(',')}
     ON CONFLICT (snapshot_date, country_code) DO UPDATE SET
       views=EXCLUDED.views, estimated_minutes_watched=EXCLUDED.estimated_minutes_watched`,
    values.flatMap(v => v.vals)
  );

  return rows.length;
}

module.exports = collectGeography;
