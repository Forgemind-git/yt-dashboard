const dayjs = require('dayjs');
const pool = require('../db/pool');
const { getYouTubeAnalytics } = require('../auth/youtube');

async function collectDeviceStats(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();

  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate: dayjs(startDate).format('YYYY-MM-DD'),
    endDate: dayjs(endDate).format('YYYY-MM-DD'),
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'day,deviceType,operatingSystem',
    sort: 'day',
  });

  let rowsAffected = 0;
  for (const row of data.rows || []) {
    const [date, deviceType, os, views, minutesWatched] = row;
    await pool.query(
      `INSERT INTO device_stats (snapshot_date, device_type, operating_system, views, estimated_minutes_watched)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (snapshot_date, device_type, operating_system) DO UPDATE SET
         views=EXCLUDED.views, estimated_minutes_watched=EXCLUDED.estimated_minutes_watched`,
      [date, deviceType, os, views, minutesWatched]
    );
    rowsAffected++;
  }

  return rowsAffected;
}

module.exports = collectDeviceStats;
