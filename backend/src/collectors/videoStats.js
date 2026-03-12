const dayjs = require('dayjs');
const pool = require('../db/pool');
const { getYouTubeAnalytics, getYouTubeData } = require('../auth/youtube');

async function getUploadedVideoIds() {
  const youtube = await getYouTubeData();

  // Get uploads playlist ID (costs 1 quota unit vs 100 for search.list)
  const { data: channelData } = await youtube.channels.list({
    part: 'contentDetails',
    mine: true,
  });

  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  const videoIds = [];
  let pageToken = undefined;

  do {
    const { data } = await youtube.playlistItems.list({
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
    });
    for (const item of data.items || []) {
      videoIds.push(item.contentDetails.videoId);
    }
    pageToken = data.nextPageToken;
  } while (pageToken && videoIds.length < 500);

  return videoIds;
}

async function getVideoMetadata(videoIds) {
  const youtube = await getYouTubeData();
  const metadata = {};

  // Batch in groups of 50
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const { data } = await youtube.videos.list({
      part: 'snippet',
      id: batch.join(','),
    });
    for (const item of data.items || []) {
      metadata[item.id] = {
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        publishedAt: item.snippet.publishedAt,
      };
    }
  }

  return metadata;
}

async function collectVideoStats(startDate, endDate) {
  const analytics = await getYouTubeAnalytics();
  const videoIds = await getUploadedVideoIds();
  const metadata = await getVideoMetadata(videoIds);

  const { data } = await analytics.reports.query({
    ids: 'channel==MINE',
    startDate: dayjs(startDate).format('YYYY-MM-DD'),
    endDate: dayjs(endDate).format('YYYY-MM-DD'),
    metrics: 'views,estimatedMinutesWatched,likes,comments,shares,averageViewDuration',
    dimensions: 'video',
    sort: '-views',
    maxResults: 200,
  });

  const snapshotDate = dayjs(endDate).format('YYYY-MM-DD');
  let rowsAffected = 0;
  const rows = data.rows || [];

  for (const row of rows) {
    const [videoId, views, minutesWatched, likes, comments, shares, avgDuration] = row;
    const meta = metadata[videoId] || {};

    await pool.query(
      `INSERT INTO video_stats
        (video_id, snapshot_date, title, thumbnail_url, published_at, views,
         estimated_minutes_watched, likes, comments, shares,
         average_view_duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (video_id, snapshot_date) DO UPDATE SET
         title=COALESCE(EXCLUDED.title, video_stats.title),
         thumbnail_url=COALESCE(EXCLUDED.thumbnail_url, video_stats.thumbnail_url),
         published_at=COALESCE(EXCLUDED.published_at, video_stats.published_at),
         views=EXCLUDED.views, estimated_minutes_watched=EXCLUDED.estimated_minutes_watched,
         likes=EXCLUDED.likes, comments=EXCLUDED.comments,
         shares=EXCLUDED.shares, average_view_duration=EXCLUDED.average_view_duration`,
      [videoId, snapshotDate, meta.title || null, meta.thumbnail || null,
       meta.publishedAt || null, views, minutesWatched, likes,
       comments, shares, avgDuration]
    );
    rowsAffected++;
  }

  return rowsAffected;
}

module.exports = collectVideoStats;
