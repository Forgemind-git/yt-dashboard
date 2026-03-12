const dayjs = require('dayjs');
const pool = require('../db/pool');
const { getYouTubeAnalytics } = require('../auth/youtube');

async function collectGeography(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();

  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate: dayjs(startDate).format('YYYY-MM-DD'),
    endDate: dayjs(endDate).format('YYYY-MM-DD'),
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'country',
    sort: '-views',
  });

  const snapshotDate = dayjs(endDate).format('YYYY-MM-DD');
  let rowsAffected = 0;
  for (const row of data.rows || []) {
    const [country, views, minutesWatched] = row;
    await pool.query(
      `INSERT INTO geography_stats (snapshot_date, country_code, views, estimated_minutes_watched)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (snapshot_date, country_code) DO UPDATE SET
         views=EXCLUDED.views, estimated_minutes_watched=EXCLUDED.estimated_minutes_watched`,
      [snapshotDate, country, views, minutesWatched]
    );
    rowsAffected++;
  }

  return rowsAffected;
}

module.exports = collectGeography;
