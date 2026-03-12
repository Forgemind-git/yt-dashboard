const pool = require('../db/pool');
const { getYouTubeAnalytics } = require('../auth/youtube');

async function collectDeviceStats(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();

  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'day,deviceType,operatingSystem',
    sort: 'day',
  });

  const rows = data.rows || [];
  if (!rows.length) return 0;

  const values = rows.map((row, i) => {
    const [date, deviceType, os, views, minutesWatched] = row;
    const base = i * 5;
    return { vals: [date, deviceType, os, views, minutesWatched], placeholders: `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5})` };
  });

  await pool.query(
    `INSERT INTO device_stats (snapshot_date, device_type, operating_system, views, estimated_minutes_watched)
     VALUES ${values.map(v => v.placeholders).join(',')}
     ON CONFLICT (snapshot_date, device_type, operating_system) DO UPDATE SET
       views=EXCLUDED.views, estimated_minutes_watched=EXCLUDED.estimated_minutes_watched`,
    values.flatMap(v => v.vals)
  );

  return rows.length;
}

module.exports = collectDeviceStats;
