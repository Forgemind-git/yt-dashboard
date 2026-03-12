const pool = require('../db/pool');
const { getYouTubeAnalytics, getYouTubeData } = require('../auth/youtube');

async function collectChannelStats(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();
  const youtube = await getYouTubeData();

  // Get daily analytics
  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration',
    dimensions: 'day',
    sort: 'day',
  });

  // Get channel totals
  const { data: channelData } = await youtube.channels.list({
    part: 'statistics',
    mine: true,
  });

  const channel = channelData.items?.[0]?.statistics || {};
  const totalSubs = parseInt(channel.subscriberCount || '0', 10);
  const totalViews = parseInt(channel.viewCount || '0', 10);
  const totalVideos = parseInt(channel.videoCount || '0', 10);

  const rows = data.rows || [];
  if (rows.length === 0) return 0;

  // Batch insert using multi-row VALUES
  const values = [];
  const params = [];
  let idx = 1;

  for (const row of rows) {
    const [date, views, minutesWatched, subsGained, subsLost, avgDuration] = row;
    values.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9})`);
    params.push(date, views, minutesWatched, subsGained, subsLost, subsGained - subsLost,
      avgDuration, totalSubs, totalViews, totalVideos);
    idx += 10;
  }

  await pool.query(
    `INSERT INTO channel_snapshots
      (snapshot_date, views, estimated_minutes_watched, subscribers_gained, subscribers_lost,
       net_subscribers, average_view_duration,
       total_subscribers, total_views, total_videos)
     VALUES ${values.join(',')}
     ON CONFLICT (snapshot_date) DO UPDATE SET
       views=EXCLUDED.views, estimated_minutes_watched=EXCLUDED.estimated_minutes_watched,
       subscribers_gained=EXCLUDED.subscribers_gained, subscribers_lost=EXCLUDED.subscribers_lost,
       net_subscribers=EXCLUDED.net_subscribers, average_view_duration=EXCLUDED.average_view_duration,
       total_subscribers=EXCLUDED.total_subscribers,
       total_views=EXCLUDED.total_views, total_videos=EXCLUDED.total_videos`,
    params
  );

  return rows.length;
}

module.exports = collectChannelStats;
