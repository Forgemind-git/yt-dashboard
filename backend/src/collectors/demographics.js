const pool = require('../db/pool');
const { getYouTubeAnalytics } = require('../auth/youtube');

async function collectDemographics(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();

  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'viewerPercentage',
    dimensions: 'ageGroup,gender',
    sort: 'ageGroup',
  });

  const rows = data.rows || [];
  if (!rows.length) return 0;

  const values = rows.map((row, i) => {
    const [ageGroup, gender, viewerPercentage] = row;
    const base = i * 4;
    return { vals: [endDate, ageGroup, gender, viewerPercentage], placeholders: `($${base+1},$${base+2},$${base+3},$${base+4})` };
  });

  await pool.query(
    `INSERT INTO audience_demographics (snapshot_date, age_group, gender, viewer_percentage)
     VALUES ${values.map(v => v.placeholders).join(',')}
     ON CONFLICT (snapshot_date, age_group, gender) DO UPDATE SET
       viewer_percentage=EXCLUDED.viewer_percentage`,
    values.flatMap(v => v.vals)
  );

  return rows.length;
}

module.exports = collectDemographics;
