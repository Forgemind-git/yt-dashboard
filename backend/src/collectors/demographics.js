const dayjs = require('dayjs');
const pool = require('../db/pool');
const { getYouTubeAnalytics } = require('../auth/youtube');

async function collectDemographics(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();

  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate: dayjs(startDate).format('YYYY-MM-DD'),
    endDate: dayjs(endDate).format('YYYY-MM-DD'),
    metrics: 'viewerPercentage',
    dimensions: 'ageGroup,gender',
    sort: 'ageGroup',
  });

  const snapshotDate = dayjs(endDate).format('YYYY-MM-DD');
  let rowsAffected = 0;

  for (const row of data.rows || []) {
    const [ageGroup, gender, viewerPercentage] = row;
    await pool.query(
      `INSERT INTO audience_demographics (snapshot_date, age_group, gender, viewer_percentage)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (snapshot_date, age_group, gender) DO UPDATE SET
         viewer_percentage=EXCLUDED.viewer_percentage`,
      [snapshotDate, ageGroup, gender, viewerPercentage]
    );
    rowsAffected++;
  }

  return rowsAffected;
}

module.exports = collectDemographics;
