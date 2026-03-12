const { Router } = require('express');
const pool = require('../db/pool');
const { parseDateRange } = require('./helpers');

const router = Router();

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/** Exponential Weighted Moving Average — recent days weighted more heavily */
function ewma(values, alpha = 0.3) {
  if (!values.length) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i] + (1 - alpha) * result;
  }
  return result;
}

/** Herfindahl-Hirschman Index — measures concentration (0=diverse, 10000=monopoly) */
function hhi(shares) {
  return shares.reduce((sum, s) => sum + s * s, 0);
}

/** Diversity index: 1 - normalized HHI (0=monopoly, 1=perfectly diverse) */
function diversityIndex(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const shares = values.map(v => (v / total) * 100);
  const n = shares.length;
  if (n <= 1) return 0;
  const raw = hhi(shares);
  const minHHI = 10000 / n;
  const maxHHI = 10000;
  return Math.max(0, Math.min(1, 1 - (raw - minHHI) / (maxHHI - minHHI)));
}

/** Safe percentage change */
function pctChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Safe division */
function safeDivide(a, b, fallback = 0) {
  return b && b !== 0 ? a / b : fallback;
}

/** Round to N decimal places */
function round(val, decimals = 2) {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

/** Clamp between min and max */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/** Linear regression slope over an array of numbers */
function linearSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

/** Standard deviation */
function stddev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ============================================================================
// 1. ENHANCED GROWTH PROJECTIONS
// ============================================================================
router.get('/insights/growth', async (req, res) => {
  try {
    // Current totals
    const { rows: [latest] } = await pool.query(
      `SELECT total_subscribers, total_views, total_videos, snapshot_date
       FROM channel_snapshots ORDER BY snapshot_date DESC LIMIT 1`
    );
    if (!latest) return res.json({ projections: [], trends: [], weekOverWeek: {}, momentum: 0, velocityChart: [] });

    const currentSubs = parseInt(latest.total_subscribers) || 0;
    const currentViews = parseInt(latest.total_views) || 0;
    const currentVideos = parseInt(latest.total_videos) || 0;

    // Last 90 days daily data for EWMA + velocity chart
    const { rows: dailyData } = await pool.query(
      `SELECT snapshot_date, views, net_subscribers, estimated_minutes_watched,
              subscribers_gained, subscribers_lost
       FROM channel_snapshots
       WHERE snapshot_date > CURRENT_DATE - 91
       ORDER BY snapshot_date ASC`
    );

    // EWMA-based daily rates
    const dailyViews = dailyData.map(d => parseFloat(d.views) || 0);
    const dailySubs = dailyData.map(d => parseFloat(d.net_subscribers) || 0);

    const ewmaViews = ewma(dailyViews, 0.15);
    const ewmaSubs = ewma(dailySubs, 0.15);

    // Simple averages for period comparison
    const calcPeriodAvg = (data, days) => {
      const slice = data.slice(-days);
      if (!slice.length) return { avgSubs: 0, avgViews: 0, totalSubs: 0, totalViews: 0, days: 0 };
      return {
        avgSubs: slice.reduce((a, d) => a + (parseFloat(d.net_subscribers) || 0), 0) / slice.length,
        avgViews: slice.reduce((a, d) => a + (parseFloat(d.views) || 0), 0) / slice.length,
        totalSubs: slice.reduce((a, d) => a + (parseFloat(d.net_subscribers) || 0), 0),
        totalViews: slice.reduce((a, d) => a + (parseFloat(d.views) || 0), 0),
        days: slice.length,
      };
    };

    const p7 = calcPeriodAvg(dailyData, 7);
    const p28 = calcPeriodAvg(dailyData, 28);
    const p90 = calcPeriodAvg(dailyData, 90);

    // Week-over-week comparison (this week, last week, 2 weeks ago)
    const thisWeek = dailyData.slice(-7);
    const lastWeek = dailyData.slice(-14, -7);
    const twoWeeksAgo = dailyData.slice(-21, -14);

    const weekStats = (arr) => ({
      views: arr.reduce((a, d) => a + (parseFloat(d.views) || 0), 0),
      subs: arr.reduce((a, d) => a + (parseFloat(d.net_subscribers) || 0), 0),
      watchTime: arr.reduce((a, d) => a + (parseFloat(d.estimated_minutes_watched) || 0), 0),
      days: arr.length,
    });

    const wow = {
      thisWeek: weekStats(thisWeek),
      lastWeek: weekStats(lastWeek),
      twoWeeksAgo: weekStats(twoWeeksAgo),
    };
    wow.viewsChange = round(pctChange(wow.thisWeek.views, wow.lastWeek.views));
    wow.subsChange = round(pctChange(wow.thisWeek.subs, wow.lastWeek.subs));

    // Growth momentum score (0-100)
    const subTrend7vs28 = p28.avgSubs > 0 ? clamp((p7.avgSubs / p28.avgSubs - 1) * 50 + 50, 0, 100) : 50;
    const viewTrend7vs28 = p28.avgViews > 0 ? clamp((p7.avgViews / p28.avgViews - 1) * 50 + 50, 0, 100) : 50;
    const subSlope = linearSlope(dailySubs.slice(-14));
    const viewSlope = linearSlope(dailyViews.slice(-14));
    const accelerationScore = clamp((subSlope > 0 ? 25 : 0) + (viewSlope > 0 ? 25 : 0) + 25, 0, 50);
    const momentum = clamp(Math.round(subTrend7vs28 * 0.3 + viewTrend7vs28 * 0.3 + accelerationScore * 0.4), 0, 100);

    // Best and worst days
    let bestDay = null, worstDay = null;
    if (dailyData.length > 0) {
      const sorted = [...dailyData].sort((a, b) => (parseFloat(b.views) || 0) - (parseFloat(a.views) || 0));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      bestDay = { date: best.snapshot_date, views: parseInt(best.views) || 0, subs: parseInt(best.net_subscribers) || 0 };
      worstDay = { date: worst.snapshot_date, views: parseInt(worst.views) || 0, subs: parseInt(worst.net_subscribers) || 0 };
    }

    // Milestone projections using EWMA rate
    const subMilestones = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
    const viewMilestones = [1000, 10000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000];
    const projections = [];

    for (const milestone of subMilestones) {
      if (milestone <= currentSubs) continue;
      const remaining = milestone - currentSubs;
      const daysToReach = ewmaSubs > 0 ? Math.ceil(remaining / ewmaSubs) : null;
      const date = daysToReach ? new Date(Date.now() + daysToReach * 86400000).toISOString().split('T')[0] : null;
      projections.push({ type: 'subscribers', milestone, current: currentSubs, remaining, daysToReach, projectedDate: date, dailyRate: round(ewmaSubs, 1) });
      if (projections.filter(p => p.type === 'subscribers').length >= 3) break;
    }

    for (const milestone of viewMilestones) {
      if (milestone <= currentViews) continue;
      const remaining = milestone - currentViews;
      const daysToReach = ewmaViews > 0 ? Math.ceil(remaining / ewmaViews) : null;
      const date = daysToReach ? new Date(Date.now() + daysToReach * 86400000).toISOString().split('T')[0] : null;
      projections.push({ type: 'views', milestone, current: currentViews, remaining, daysToReach, projectedDate: date, dailyRate: Math.round(ewmaViews) });
      if (projections.filter(p => p.type === 'views').length >= 3) break;
    }

    // Growth trends
    const trends = [];
    if (p7.avgSubs > p28.avgSubs * 1.2) {
      trends.push({ signal: 'accelerating', metric: 'subscribers', message: `Sub growth accelerating: ${round(p7.avgSubs, 1)}/day (7d) vs ${round(p28.avgSubs, 1)}/day (28d)`, severity: 'positive' });
    } else if (p7.avgSubs < p28.avgSubs * 0.8) {
      trends.push({ signal: 'slowing', metric: 'subscribers', message: `Sub growth slowing: ${round(p7.avgSubs, 1)}/day (7d) vs ${round(p28.avgSubs, 1)}/day (28d)`, severity: 'warning' });
    } else {
      trends.push({ signal: 'stable', metric: 'subscribers', message: `Sub growth stable: ${round(p7.avgSubs, 1)}/day (7d)`, severity: 'neutral' });
    }

    if (p7.avgViews > p28.avgViews * 1.2) {
      trends.push({ signal: 'accelerating', metric: 'views', message: `View growth accelerating: ${Math.round(p7.avgViews)}/day (7d) vs ${Math.round(p28.avgViews)}/day (28d)`, severity: 'positive' });
    } else if (p7.avgViews < p28.avgViews * 0.8) {
      trends.push({ signal: 'slowing', metric: 'views', message: `View growth slowing: ${Math.round(p7.avgViews)}/day (7d) vs ${Math.round(p28.avgViews)}/day (28d)`, severity: 'warning' });
    } else {
      trends.push({ signal: 'stable', metric: 'views', message: `View growth stable: ${Math.round(p7.avgViews)}/day (7d)`, severity: 'neutral' });
    }

    // Velocity chart data (last 90 days)
    const velocityChart = dailyData.map(d => ({
      date: d.snapshot_date,
      views: parseInt(d.views) || 0,
      subs: parseInt(d.net_subscribers) || 0,
      watchTime: parseInt(d.estimated_minutes_watched) || 0,
    }));

    res.json({
      current: { subscribers: currentSubs, views: currentViews, videos: currentVideos },
      growthRates: {
        '7d': { subs: round(p7.avgSubs, 1), views: round(p7.avgViews) },
        '28d': { subs: round(p28.avgSubs, 1), views: round(p28.avgViews) },
        '90d': { subs: round(p90.avgSubs, 1), views: round(p90.avgViews) },
        ewma: { subs: round(ewmaSubs, 1), views: round(ewmaViews) },
      },
      projections,
      trends,
      weekOverWeek: wow,
      momentum,
      bestDay,
      worstDay,
      velocityChart,
    });
  } catch (err) {
    console.error('Growth insights error:', err.message);
    res.status(500).json({ error: 'Failed to compute growth insights' });
  }
});

// ============================================================================
// 2. ENHANCED CONTENT SCORING
// ============================================================================
router.get('/insights/content-score', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);

    // Channel averages for the period
    const { rows: [avg] } = await pool.query(
      `SELECT
         AVG(views) AS avg_views,
         AVG(estimated_minutes_watched) AS avg_watch_time,
         AVG(likes) AS avg_likes,
         AVG(comments) AS avg_comments,
         AVG(shares) AS avg_shares,
         AVG(average_view_duration) AS avg_duration
       FROM (
         SELECT video_id,
           SUM(views) AS views,
           SUM(estimated_minutes_watched) AS estimated_minutes_watched,
           SUM(likes) AS likes,
           SUM(comments) AS comments,
           SUM(shares) AS shares,
           AVG(average_view_duration) AS average_view_duration
         FROM video_stats
         WHERE snapshot_date BETWEEN $1 AND $2
         GROUP BY video_id
       ) sub`,
      [from, to]
    );

    const avgViews = parseFloat(avg?.avg_views || 1);
    const avgWatchTime = parseFloat(avg?.avg_watch_time || 1);
    const avgLikes = parseFloat(avg?.avg_likes || 1);
    const avgComments = parseFloat(avg?.avg_comments || 1);
    const avgShares = parseFloat(avg?.avg_shares || 0);
    const avgDuration = parseFloat(avg?.avg_duration || 1);

    // Score each video, including recent vs previous performance within date range
    const { rows: videos } = await pool.query(
      `SELECT video_id, MAX(title) AS title, MAX(thumbnail_url) AS thumbnail_url,
              MAX(published_at) AS published_at,
              SUM(views) AS views,
              SUM(estimated_minutes_watched) AS watch_time,
              SUM(likes) AS likes,
              SUM(comments) AS comments,
              SUM(shares) AS shares,
              AVG(average_view_duration) AS avg_view_duration
       FROM video_stats
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY video_id
       ORDER BY views DESC`,
      [from, to]
    );

    // Get recent 7d vs previous 7d performance per video (within the date range)
    const { rows: trajectoryData } = await pool.query(
      `SELECT video_id,
              SUM(CASE WHEN snapshot_date > ($2::date - 7) THEN views ELSE 0 END) AS recent_views,
              SUM(CASE WHEN snapshot_date <= ($2::date - 7) AND snapshot_date > ($2::date - 14) THEN views ELSE 0 END) AS prev_views
       FROM video_stats
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY video_id`,
      [from, to]
    );
    const trajectoryMap = {};
    for (const t of trajectoryData) {
      const recent = parseInt(t.recent_views) || 0;
      const prev = parseInt(t.prev_views) || 0;
      trajectoryMap[t.video_id] = {
        recentViews: recent,
        prevViews: prev,
        change: round(pctChange(recent, prev)),
        direction: recent > prev * 1.1 ? 'rising' : recent < prev * 0.9 ? 'declining' : 'stable',
      };
    }

    const now = new Date();
    const scored = videos.map(v => {
      const views = parseInt(v.views) || 0;
      const watchTime = parseInt(v.watch_time) || 0;
      const likes = parseInt(v.likes) || 0;
      const comments = parseInt(v.comments) || 0;
      const shares = parseInt(v.shares) || 0;
      const avgDur = parseFloat(v.avg_view_duration) || 0;

      // Retention score: video avg duration vs channel avg
      const retentionScore = safeDivide(avgDur, avgDuration, 1);

      // Engagement funnel
      const likeRate = safeDivide(likes, views) * 100;
      const commentRate = safeDivide(comments, views) * 100;
      const shareRate = safeDivide(shares, views) * 100;
      const totalEngagementRate = safeDivide(likes + comments + shares, views) * 100;

      // Age normalization — newer videos score higher for same raw numbers
      const publishDate = v.published_at ? new Date(v.published_at) : null;
      const daysSincePublish = publishDate ? Math.max(1, Math.floor((now - publishDate) / 86400000)) : 90;
      const ageMultiplier = Math.min(2.0, Math.sqrt(90 / daysSincePublish));

      // Composite score (0-based, 100 = channel average)
      const viewScore = safeDivide(views, avgViews);
      const watchScore = safeDivide(watchTime, avgWatchTime);
      const likeScore = safeDivide(likes, avgLikes);
      const retScore = retentionScore;

      const rawScore = (viewScore * 0.25 + watchScore * 0.25 + likeScore * 0.2 + retScore * 0.3) * 100;
      const normalizedScore = Math.round(rawScore * ageMultiplier);

      let grade;
      if (normalizedScore >= 250) grade = 'S';
      else if (normalizedScore >= 175) grade = 'A';
      else if (normalizedScore >= 120) grade = 'B';
      else if (normalizedScore >= 70) grade = 'C';
      else grade = 'D';

      const trajectory = trajectoryMap[v.video_id] || { recentViews: 0, prevViews: 0, change: 0, direction: 'unknown' };

      return {
        video_id: v.video_id,
        title: v.title,
        thumbnail_url: v.thumbnail_url,
        published_at: v.published_at,
        daysSincePublish,
        views,
        watch_time: watchTime,
        likes,
        comments,
        shares,
        score: normalizedScore,
        grade,
        retentionScore: round(retentionScore),
        engagementFunnel: {
          views,
          likes,
          likeRate: round(likeRate),
          comments,
          commentRate: round(commentRate),
          shares,
          shareRate: round(shareRate),
          totalEngagementRate: round(totalEngagementRate),
        },
        ageMultiplier: round(ageMultiplier),
        trajectory,
      };
    });

    // Grade distribution
    const gradeDistribution = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const v of scored) gradeDistribution[v.grade]++;

    res.json({
      channelAvg: {
        views: Math.round(avgViews),
        watchTime: Math.round(avgWatchTime),
        likes: Math.round(avgLikes),
        comments: Math.round(avgComments),
        shares: Math.round(avgShares),
        avgDuration: Math.round(avgDuration),
      },
      gradeDistribution,
      videos: scored,
    });
  } catch (err) {
    console.error('Content score error:', err.message);
    res.status(500).json({ error: 'Failed to compute content scores' });
  }
});

// ============================================================================
// 3. ENHANCED UPLOAD TIMING
// ============================================================================
router.get('/insights/upload-timing', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         video_id,
         MAX(title) AS title,
         MAX(published_at) AS published_at,
         SUM(views) AS total_views,
         SUM(likes) AS total_likes,
         SUM(comments) AS total_comments,
         SUM(estimated_minutes_watched) AS total_watch_time
       FROM video_stats
       WHERE published_at IS NOT NULL
       GROUP BY video_id
       ORDER BY total_views DESC`
    );

    const byDay = {};
    const byHour = {};
    const heatmap = {}; // day -> hour -> stats

    for (const day of DAY_NAMES) {
      byDay[day] = { count: 0, totalViews: 0, totalLikes: 0, totalComments: 0, totalWatchTime: 0 };
      heatmap[day] = {};
      for (let h = 0; h < 24; h++) {
        heatmap[day][h] = { count: 0, totalViews: 0, totalLikes: 0 };
      }
    }
    for (let h = 0; h < 24; h++) {
      byHour[h] = { count: 0, totalViews: 0, totalLikes: 0, totalComments: 0, totalWatchTime: 0 };
    }

    for (const video of rows) {
      const pub = new Date(video.published_at);
      if (isNaN(pub.getTime())) continue;
      const day = DAY_NAMES[pub.getUTCDay()];
      const hour = pub.getUTCHours();
      const views = parseInt(video.total_views) || 0;
      const likes = parseInt(video.total_likes) || 0;
      const comments = parseInt(video.total_comments) || 0;
      const watchTime = parseInt(video.total_watch_time) || 0;

      byDay[day].count++;
      byDay[day].totalViews += views;
      byDay[day].totalLikes += likes;
      byDay[day].totalComments += comments;
      byDay[day].totalWatchTime += watchTime;

      byHour[hour].count++;
      byHour[hour].totalViews += views;
      byHour[hour].totalLikes += likes;
      byHour[hour].totalComments += comments;
      byHour[hour].totalWatchTime += watchTime;

      heatmap[day][hour].count++;
      heatmap[day][hour].totalViews += views;
      heatmap[day][hour].totalLikes += likes;
    }

    const MIN_SAMPLE = 3;

    const dayAnalysis = DAY_NAMES.map(day => {
      const d = byDay[day];
      const hasSample = d.count >= MIN_SAMPLE;
      return {
        day,
        videosPublished: d.count,
        avgViews: d.count > 0 ? Math.round(d.totalViews / d.count) : 0,
        avgLikes: d.count > 0 ? Math.round(d.totalLikes / d.count) : 0,
        avgEngagementRate: d.totalViews > 0 ? round((d.totalLikes + d.totalComments) / d.totalViews * 100) : 0,
        avgWatchTimeMinutes: d.count > 0 ? Math.round(d.totalWatchTime / d.count) : 0,
        sampleWarning: !hasSample,
      };
    }).sort((a, b) => b.avgViews - a.avgViews);

    const hourAnalysis = Object.entries(byHour)
      .filter(([, d]) => d.count > 0)
      .map(([hour, d]) => {
        const h = parseInt(hour);
        return {
          hour: h,
          hourLabel: `${h.toString().padStart(2, '0')}:00 UTC`,
          videosPublished: d.count,
          avgViews: Math.round(d.totalViews / d.count),
          avgLikes: Math.round(d.totalLikes / d.count),
          avgEngagementRate: d.totalViews > 0 ? round((d.totalLikes + d.totalComments) / d.totalViews * 100) : 0,
          sampleWarning: d.count < MIN_SAMPLE,
        };
      })
      .sort((a, b) => b.avgViews - a.avgViews);

    // Flatten heatmap for frontend: array of { day, hour, count, avgViews }
    const heatmapData = [];
    for (const day of DAY_NAMES) {
      for (let h = 0; h < 24; h++) {
        const cell = heatmap[day][h];
        heatmapData.push({
          day,
          dayIndex: DAY_NAMES.indexOf(day),
          hour: h,
          count: cell.count,
          avgViews: cell.count > 0 ? Math.round(cell.totalViews / cell.count) : 0,
        });
      }
    }

    const bestDay = dayAnalysis[0] || null;
    const bestHour = hourAnalysis[0] || null;

    res.json({
      recommendation: bestDay && bestHour
        ? `Best upload time: ${bestDay.day}s around ${bestHour.hourLabel} (avg ${bestDay.avgViews.toLocaleString()} views)`
        : 'Not enough data to recommend upload times',
      byDay: dayAnalysis,
      byHour: hourAnalysis,
      heatmap: heatmapData,
      totalVideosAnalyzed: rows.length,
      minSampleSize: MIN_SAMPLE,
    });
  } catch (err) {
    console.error('Upload timing error:', err.message);
    res.status(500).json({ error: 'Failed to analyze upload timing' });
  }
});

// ============================================================================
// 4. ENHANCED OUTLIER DETECTION
// ============================================================================
router.get('/insights/outliers', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);

    // Video totals with z-scores
    const { rows } = await pool.query(
      `WITH video_totals AS (
         SELECT video_id, MAX(title) AS title, MAX(thumbnail_url) AS thumbnail_url,
                MAX(published_at) AS published_at,
                SUM(views) AS views, SUM(likes) AS likes,
                SUM(comments) AS comments, SUM(shares) AS shares,
                SUM(estimated_minutes_watched) AS watch_time,
                AVG(average_view_duration) AS avg_duration
         FROM video_stats WHERE snapshot_date BETWEEN $1 AND $2
         GROUP BY video_id
       ),
       stats AS (
         SELECT AVG(views) AS mean_views, STDDEV(views) AS std_views,
                AVG(likes) AS mean_likes, STDDEV(likes) AS std_likes
         FROM video_totals
       )
       SELECT v.*, s.mean_views, s.std_views, s.mean_likes, s.std_likes,
              CASE WHEN s.std_views > 0 THEN (v.views - s.mean_views) / s.std_views ELSE 0 END AS z_score
       FROM video_totals v, stats s
       ORDER BY z_score DESC`,
      [from, to]
    );

    // Traffic sources per video date range (to identify drivers)
    const { rows: trafficRows } = await pool.query(
      `SELECT source_type, SUM(views) AS views
       FROM traffic_sources
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY source_type
       ORDER BY views DESC`,
      [from, to]
    );
    const totalTrafficViews = trafficRows.reduce((a, r) => a + (parseInt(r.views) || 0), 0);
    const trafficBreakdown = trafficRows.map(r => ({
      source: r.source_type,
      views: parseInt(r.views) || 0,
      pct: round(safeDivide(parseInt(r.views) || 0, totalTrafficViews) * 100),
    }));

    const now = new Date();

    const enrichVideo = (r) => {
      const views = parseInt(r.views) || 0;
      const likes = parseInt(r.likes) || 0;
      const comments = parseInt(r.comments) || 0;
      const shares = parseInt(r.shares) || 0;
      const watchTime = parseInt(r.watch_time) || 0;
      const zScore = round(parseFloat(r.z_score) || 0);

      const engagementRate = views > 0 ? round((likes + comments + shares) / views * 100) : 0;
      const avgEngRate = parseFloat(r.mean_views) > 0 ? round((parseFloat(r.mean_likes)) / parseFloat(r.mean_views) * 100) : 0;
      const engagementVsAvg = avgEngRate > 0 ? round((engagementRate / avgEngRate - 1) * 100) : 0;

      // Velocity: views per day since publish
      const publishDate = r.published_at ? new Date(r.published_at) : null;
      const daysSincePublish = publishDate ? Math.max(1, Math.floor((now - publishDate) / 86400000)) : null;
      const velocity = daysSincePublish ? round(views / daysSincePublish) : null;

      // Why analysis
      const reasons = [];
      if (engagementRate > avgEngRate * 1.5) reasons.push('Unusually high engagement rate');
      if (likes > parseFloat(r.mean_likes || 0) * 2) reasons.push('Significantly more likes than average');
      if (comments > 0 && views > 0 && (comments / views) > 0.01) reasons.push('High comment rate suggests strong discussion');
      if (velocity && velocity > parseFloat(r.mean_views || 0) / 28) reasons.push('High view velocity — accumulating views fast');
      if (watchTime > 0 && views > 0 && (watchTime / views) > 5) reasons.push('Strong retention (high watch time per view)');

      return {
        video_id: r.video_id,
        title: r.title,
        thumbnail_url: r.thumbnail_url,
        published_at: r.published_at,
        views,
        likes,
        comments,
        shares,
        watch_time: watchTime,
        z_score: zScore,
        engagementRate,
        engagementVsAvg,
        velocity,
        daysSincePublish,
        reasons,
      };
    };

    const overperformers = rows
      .filter(r => parseFloat(r.z_score) > 1.5)
      .map(r => ({
        ...enrichVideo(r),
        label: parseFloat(r.z_score) > 3 ? 'viral' : 'breakout',
      }));

    const underperformers = rows
      .filter(r => parseFloat(r.z_score) < -1)
      .slice(-10)
      .reverse()
      .map(r => ({
        ...enrichVideo(r),
        label: parseFloat(r.z_score) < -2 ? 'severely_underperforming' : 'underperforming',
      }));

    res.json({
      overperformers,
      underperformers,
      channelMean: Math.round(parseFloat(rows[0]?.mean_views || 0)),
      channelStdDev: Math.round(parseFloat(rows[0]?.std_views || 0)),
      trafficContext: trafficBreakdown.slice(0, 5),
    });
  } catch (err) {
    console.error('Outliers error:', err.message);
    res.status(500).json({ error: 'Failed to detect outliers' });
  }
});

// ============================================================================
// 5. ENHANCED SUMMARY (10-15 rich insights)
// ============================================================================
router.get('/insights/summary', async (req, res) => {
  try {
    const { from, to, prevFrom, prevTo } = parseDateRange(req.query);

    const [currentRes, previousRes, topVideoRes, topSourcesRes, topCountriesRes, videosByDayRes, uploadFreqRes, engagementRes, prevEngRes] = await Promise.all([
      pool.query(
        `SELECT SUM(views) AS views, SUM(estimated_minutes_watched) AS watch_time,
                SUM(net_subscribers) AS subs, SUM(subscribers_gained) AS subs_gained,
                SUM(subscribers_lost) AS subs_lost, COUNT(*) AS days,
                AVG(average_view_duration) AS avg_duration
         FROM channel_snapshots WHERE snapshot_date BETWEEN $1 AND $2`, [from, to]),
      pool.query(
        `SELECT SUM(views) AS views, SUM(estimated_minutes_watched) AS watch_time,
                SUM(net_subscribers) AS subs, AVG(average_view_duration) AS avg_duration
         FROM channel_snapshots WHERE snapshot_date BETWEEN $1 AND $2`, [prevFrom, prevTo]),
      pool.query(
        `SELECT MAX(title) AS title, video_id, SUM(views) AS views, SUM(likes) AS likes
         FROM video_stats WHERE snapshot_date BETWEEN $1 AND $2
         GROUP BY video_id ORDER BY views DESC LIMIT 3`, [from, to]),
      pool.query(
        `SELECT source_type, SUM(views) AS views FROM traffic_sources
         WHERE snapshot_date BETWEEN $1 AND $2 GROUP BY source_type ORDER BY views DESC`, [from, to]),
      pool.query(
        `SELECT country_code, SUM(views) AS views FROM geography_stats
         WHERE snapshot_date BETWEEN $1 AND $2 GROUP BY country_code ORDER BY views DESC LIMIT 5`, [from, to]),
      // Videos by day of week
      pool.query(
        `SELECT video_id, MAX(published_at) AS published_at, SUM(views) AS views
         FROM video_stats WHERE published_at IS NOT NULL GROUP BY video_id`),
      // Upload frequency: count videos published in current vs prev period
      pool.query(
        `SELECT
           COUNT(DISTINCT CASE WHEN published_at::date BETWEEN $1 AND $2 THEN video_id END) AS current_uploads,
           COUNT(DISTINCT CASE WHEN published_at::date BETWEEN $3 AND $4 THEN video_id END) AS prev_uploads
         FROM video_stats
         WHERE published_at IS NOT NULL`, [from, to, prevFrom, prevTo]),
      // Engagement for current period
      pool.query(
        `SELECT SUM(views) AS views, SUM(likes) AS likes, SUM(comments) AS comments, SUM(shares) AS shares
         FROM video_stats WHERE snapshot_date BETWEEN $1 AND $2`, [from, to]),
      // Engagement for prev period
      pool.query(
        `SELECT SUM(views) AS views, SUM(likes) AS likes, SUM(comments) AS comments, SUM(shares) AS shares
         FROM video_stats WHERE snapshot_date BETWEEN $1 AND $2`, [prevFrom, prevTo]),
    ]);

    const cur = currentRes.rows[0];
    const prev = previousRes.rows[0];
    const insights = [];

    const curViews = parseInt(cur?.views || 0);
    const prevViews = parseInt(prev?.views || 0);
    const curSubs = parseInt(cur?.subs || 0);
    const prevSubs = parseInt(prev?.subs || 0);
    const curWatchTime = parseInt(cur?.watch_time || 0);
    const prevWatchTime = parseInt(prev?.watch_time || 0);
    const curDuration = parseFloat(cur?.avg_duration || 0);
    const prevDuration = parseFloat(prev?.avg_duration || 0);
    const days = parseInt(cur?.days || 1);

    // 1. View trend
    const viewChange = round(pctChange(curViews, prevViews));
    if (viewChange > 20) {
      insights.push({ category: 'growth', type: 'positive', title: 'Views Surging', text: `Views up ${viewChange}% vs previous period (${curViews.toLocaleString()} total)`, metric: curViews, delta: viewChange });
    } else if (viewChange < -20) {
      insights.push({ category: 'growth', type: 'warning', title: 'Views Declining', text: `Views down ${Math.abs(viewChange)}% vs previous period`, metric: curViews, delta: viewChange });
    } else {
      insights.push({ category: 'growth', type: 'neutral', title: 'Views Stable', text: `Views steady at ${curViews.toLocaleString()} (${viewChange > 0 ? '+' : ''}${viewChange}%)`, metric: curViews, delta: viewChange });
    }

    // 2. Subscriber growth
    if (curSubs !== 0) {
      const subChange = round(pctChange(curSubs, prevSubs));
      const dailyAvg = round(curSubs / days, 1);
      const type = curSubs > 0 ? (subChange > 10 ? 'positive' : 'info') : 'warning';
      insights.push({ category: 'growth', type, title: 'Subscriber Growth', text: `${curSubs > 0 ? 'Gained' : 'Lost'} ${Math.abs(curSubs)} subscribers (${dailyAvg}/day avg)${prevSubs ? `, ${subChange > 0 ? '+' : ''}${subChange}% vs prev period` : ''}`, metric: curSubs, delta: subChange });
    }

    // 3. Watch time
    const watchHours = Math.round(curWatchTime / 60);
    const prevWatchHours = Math.round(prevWatchTime / 60);
    if (watchHours > 0) {
      const wtChange = round(pctChange(watchHours, prevWatchHours));
      insights.push({ category: 'engagement', type: wtChange > 0 ? 'positive' : wtChange < -15 ? 'warning' : 'neutral', title: 'Watch Time', text: `${watchHours.toLocaleString()} hours total (${Math.round(watchHours / days)}/day), ${wtChange > 0 ? '+' : ''}${wtChange}% vs prev`, metric: watchHours, delta: wtChange });
    }

    // 4. Retention trend
    if (curDuration > 0 && prevDuration > 0) {
      const durChange = round(pctChange(curDuration, prevDuration));
      const durMin = Math.floor(curDuration / 60);
      const durSec = Math.round(curDuration % 60);
      insights.push({ category: 'engagement', type: durChange > 5 ? 'positive' : durChange < -10 ? 'warning' : 'neutral', title: 'Avg View Duration', text: `${durMin}m ${durSec}s average view duration (${durChange > 0 ? '+' : ''}${durChange}% vs prev)`, metric: round(curDuration), delta: durChange });
    }

    // 5. Top video
    if (topVideoRes.rows.length > 0) {
      const top = topVideoRes.rows[0];
      insights.push({ category: 'content', type: 'info', title: 'Top Video', text: `"${top.title}" led with ${parseInt(top.views).toLocaleString()} views and ${parseInt(top.likes).toLocaleString()} likes`, metric: parseInt(top.views) });
    }

    // 6. Engagement rate trend
    const curEng = engagementRes.rows[0];
    const prevEng = prevEngRes.rows[0];
    const curEngViews = parseInt(curEng?.views || 0);
    const curEngActions = (parseInt(curEng?.likes || 0) + parseInt(curEng?.comments || 0) + parseInt(curEng?.shares || 0));
    const prevEngViews = parseInt(prevEng?.views || 0);
    const prevEngActions = (parseInt(prevEng?.likes || 0) + parseInt(prevEng?.comments || 0) + parseInt(prevEng?.shares || 0));
    const curEngRate = safeDivide(curEngActions, curEngViews) * 100;
    const prevEngRate = safeDivide(prevEngActions, prevEngViews) * 100;
    if (curEngRate > 0) {
      const engChange = round(pctChange(curEngRate, prevEngRate));
      insights.push({ category: 'engagement', type: engChange > 10 ? 'positive' : engChange < -15 ? 'warning' : 'neutral', title: 'Engagement Rate', text: `${round(curEngRate)}% engagement rate (${engChange > 0 ? '+' : ''}${engChange}% vs prev period)`, metric: round(curEngRate), delta: engChange });
    }

    // 7. Traffic diversity
    const trafficSources = topSourcesRes.rows;
    const totalTraffic = trafficSources.reduce((a, r) => a + (parseInt(r.views) || 0), 0);
    if (trafficSources.length > 0) {
      const topSource = trafficSources[0];
      const topPct = round(safeDivide(parseInt(topSource.views) || 0, totalTraffic) * 100);
      const trafficDiversity = diversityIndex(trafficSources.map(r => parseInt(r.views) || 0));

      if (topPct > 70) {
        insights.push({ category: 'traffic', type: 'warning', title: 'Traffic Concentration Risk', text: `${topPct}% of views from ${topSource.source_type.replace(/_/g, ' ')} — diversify to reduce risk`, metric: topPct });
      } else {
        insights.push({ category: 'traffic', type: 'info', title: 'Primary Traffic Source', text: `${topSource.source_type.replace(/_/g, ' ')} drives ${topPct}% of views. Diversity score: ${round(trafficDiversity * 100)}/100`, metric: topPct });
      }
    }

    // 8. Geographic insight
    const geoData = topCountriesRes.rows;
    if (geoData.length > 0) {
      const geoTotal = geoData.reduce((a, r) => a + (parseInt(r.views) || 0), 0);
      const top3 = geoData.slice(0, 3).map(r => `${r.country_code} (${round(safeDivide(parseInt(r.views) || 0, geoTotal) * 100)}%)`).join(', ');
      insights.push({ category: 'audience', type: 'info', title: 'Top Audiences', text: `Top markets: ${top3}`, metric: geoData.length });
    }

    // 9. Upload frequency
    const freq = uploadFreqRes.rows[0];
    const curUploads = parseInt(freq?.current_uploads || 0);
    const prevUploads = parseInt(freq?.prev_uploads || 0);
    if (prevUploads > 0 && curUploads < prevUploads) {
      const dropPct = round(pctChange(curUploads, prevUploads));
      insights.push({ category: 'consistency', type: 'warning', title: 'Upload Frequency Dropped', text: `Published ${curUploads} videos (down from ${prevUploads} last period). Consistency impacts algorithm visibility.`, metric: curUploads, delta: dropPct });
    } else if (curUploads > 0) {
      insights.push({ category: 'consistency', type: curUploads >= prevUploads ? 'positive' : 'info', title: 'Upload Activity', text: `Published ${curUploads} video${curUploads === 1 ? '' : 's'} this period${prevUploads ? ` (was ${prevUploads} last period)` : ''}`, metric: curUploads });
    }

    // 10. Best day of week correlation
    const videoDayPerf = {};
    for (const v of videosByDayRes.rows) {
      if (!v.published_at) continue;
      const pub = new Date(v.published_at);
      if (isNaN(pub.getTime())) continue;
      const day = DAY_NAMES[pub.getUTCDay()];
      if (!videoDayPerf[day]) videoDayPerf[day] = { count: 0, totalViews: 0 };
      videoDayPerf[day].count++;
      videoDayPerf[day].totalViews += parseInt(v.views) || 0;
    }
    const dayEntries = Object.entries(videoDayPerf)
      .filter(([, d]) => d.count >= 2)
      .map(([day, d]) => ({ day, avgViews: Math.round(d.totalViews / d.count), count: d.count }))
      .sort((a, b) => b.avgViews - a.avgViews);

    if (dayEntries.length >= 2) {
      const best = dayEntries[0];
      const worst = dayEntries[dayEntries.length - 1];
      if (best.avgViews > worst.avgViews * 1.3) {
        const multiplier = round(best.avgViews / worst.avgViews, 1);
        insights.push({ category: 'actionable', type: 'info', title: 'Best Upload Day', text: `Videos published on ${best.day} average ${best.avgViews.toLocaleString()} views — ${multiplier}x more than ${worst.day}`, metric: best.avgViews });
      }
    }

    // 11. Subscriber churn
    const subsGained = parseInt(cur?.subs_gained || 0);
    const subsLost = parseInt(cur?.subs_lost || 0);
    if (subsGained > 0 && subsLost > 0) {
      const churnRate = round(safeDivide(subsLost, subsGained) * 100);
      insights.push({ category: 'growth', type: churnRate > 30 ? 'warning' : 'info', title: 'Subscriber Retention', text: `Gained ${subsGained}, lost ${subsLost} subs (${churnRate}% churn rate)${churnRate > 30 ? ' — consider improving early video hooks' : ''}`, metric: churnRate });
    }

    res.json({ insights });
  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// ============================================================================
// 6. NEW: RETENTION INTELLIGENCE
// ============================================================================
router.get('/insights/retention', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);

    // Per-video retention stats
    const { rows: videos } = await pool.query(
      `SELECT video_id, MAX(title) AS title, MAX(thumbnail_url) AS thumbnail_url,
              AVG(average_view_duration) AS avg_duration,
              SUM(views) AS views,
              SUM(estimated_minutes_watched) AS watch_time
       FROM video_stats
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY video_id
       HAVING SUM(views) > 0
       ORDER BY AVG(average_view_duration) DESC`,
      [from, to]
    );

    // Channel average retention
    const { rows: [channelAvg] } = await pool.query(
      `SELECT AVG(average_view_duration) AS avg_duration
       FROM channel_snapshots
       WHERE snapshot_date BETWEEN $1 AND $2`,
      [from, to]
    );
    const channelAvgDuration = parseFloat(channelAvg?.avg_duration || 0);

    // Retention trend over time
    const { rows: retentionTrend } = await pool.query(
      `SELECT snapshot_date, average_view_duration
       FROM channel_snapshots
       WHERE snapshot_date BETWEEN $1 AND $2
       ORDER BY snapshot_date ASC`,
      [from, to]
    );

    const rankedVideos = videos.map(v => {
      const avgDur = parseFloat(v.avg_duration) || 0;
      const views = parseInt(v.views) || 0;
      const watchTime = parseInt(v.watch_time) || 0;
      const vsChannelAvg = channelAvgDuration > 0 ? round((avgDur / channelAvgDuration - 1) * 100) : 0;
      // Retention efficiency: total engaged minutes
      const engagedMinutes = watchTime;

      return {
        video_id: v.video_id,
        title: v.title,
        thumbnail_url: v.thumbnail_url,
        avgDurationSeconds: round(avgDur),
        avgDurationFormatted: `${Math.floor(avgDur / 60)}m ${Math.round(avgDur % 60)}s`,
        views,
        watchTimeMinutes: watchTime,
        engagedMinutes,
        vsChannelAvg,
      };
    });

    const bestRetention = rankedVideos.slice(0, 5);
    const worstRetention = rankedVideos.length > 5 ? rankedVideos.slice(-5).reverse() : [];

    const trendData = retentionTrend.map(r => ({
      date: r.snapshot_date,
      avgDuration: parseFloat(r.average_view_duration) || 0,
    }));

    // Is retention trending up or down?
    const durations = trendData.map(d => d.avgDuration);
    const retSlope = linearSlope(durations);
    const retentionDirection = retSlope > 0.5 ? 'improving' : retSlope < -0.5 ? 'declining' : 'stable';

    res.json({
      channelAvgDuration: round(channelAvgDuration),
      channelAvgFormatted: `${Math.floor(channelAvgDuration / 60)}m ${Math.round(channelAvgDuration % 60)}s`,
      retentionDirection,
      retentionSlope: round(retSlope, 3),
      trend: trendData,
      bestRetention,
      worstRetention,
      allVideos: rankedVideos,
    });
  } catch (err) {
    console.error('Retention insights error:', err.message);
    res.status(500).json({ error: 'Failed to compute retention insights' });
  }
});

// ============================================================================
// 7. NEW: TRAFFIC SOURCE ROI
// ============================================================================
router.get('/insights/traffic-roi', async (req, res) => {
  try {
    const { from, to, prevFrom, prevTo } = parseDateRange(req.query);

    // Current period traffic
    const { rows: currentTraffic } = await pool.query(
      `SELECT source_type,
              SUM(views) AS views,
              SUM(estimated_minutes_watched) AS watch_time
       FROM traffic_sources
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY source_type
       ORDER BY views DESC`,
      [from, to]
    );

    // Previous period traffic
    const { rows: prevTraffic } = await pool.query(
      `SELECT source_type,
              SUM(views) AS views,
              SUM(estimated_minutes_watched) AS watch_time
       FROM traffic_sources
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY source_type
       ORDER BY views DESC`,
      [prevFrom, prevTo]
    );

    const prevMap = {};
    for (const r of prevTraffic) {
      prevMap[r.source_type] = { views: parseInt(r.views) || 0, watchTime: parseInt(r.watch_time) || 0 };
    }

    const totalViews = currentTraffic.reduce((a, r) => a + (parseInt(r.views) || 0), 0);
    const totalWatchTime = currentTraffic.reduce((a, r) => a + (parseInt(r.watch_time) || 0), 0);

    const sources = currentTraffic.map(r => {
      const views = parseInt(r.views) || 0;
      const watchTime = parseInt(r.watch_time) || 0;
      const prev = prevMap[r.source_type] || { views: 0, watchTime: 0 };
      const viewShare = round(safeDivide(views, totalViews) * 100);
      const watchTimePerView = round(safeDivide(watchTime, views), 1); // minutes per view (quality metric)
      const viewsChange = round(pctChange(views, prev.views));
      const isGrowing = views > prev.views * 1.05;
      const isShrinking = views < prev.views * 0.95;

      return {
        source: r.source_type,
        views,
        watchTime,
        viewShare,
        watchTimePerView,
        qualityRank: watchTimePerView, // higher = better quality traffic
        viewsChange,
        trend: isGrowing ? 'growing' : isShrinking ? 'shrinking' : 'stable',
        prevViews: prev.views,
      };
    });

    // Sort by quality (watch time per view)
    const byQuality = [...sources].sort((a, b) => b.watchTimePerView - a.watchTimePerView);

    // Diversity index
    const viewShares = sources.map(s => s.views);
    const diversity = round(diversityIndex(viewShares) * 100);

    // HHI raw
    const hhiRaw = Math.round(hhi(sources.map(s => safeDivide(s.views, totalViews) * 100)));

    res.json({
      sources,
      byQuality,
      diversityScore: diversity,
      hhiIndex: hhiRaw,
      diversityLabel: diversity > 70 ? 'Well Diversified' : diversity > 40 ? 'Moderately Diversified' : 'Concentrated',
      totalViews,
      totalWatchTime,
    });
  } catch (err) {
    console.error('Traffic ROI error:', err.message);
    res.status(500).json({ error: 'Failed to compute traffic ROI' });
  }
});

// ============================================================================
// 8. NEW: CHANNEL HEALTH SCORE
// ============================================================================
router.get('/insights/channel-health', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);

    // Get daily channel data for the period
    const { rows: dailyData } = await pool.query(
      `SELECT snapshot_date, views, net_subscribers, estimated_minutes_watched,
              average_view_duration, subscribers_gained, subscribers_lost
       FROM channel_snapshots
       WHERE snapshot_date BETWEEN $1 AND $2
       ORDER BY snapshot_date ASC`,
      [from, to]
    );

    if (!dailyData.length) {
      return res.json({ overallScore: 0, factors: [], historical: [], message: 'No data available for this period' });
    }

    // --- Factor 1: Growth Consistency (20%) ---
    const dailySubs = dailyData.map(d => parseFloat(d.net_subscribers) || 0);
    const avgDailySubs = dailySubs.reduce((a, b) => a + b, 0) / dailySubs.length;
    const subStdDev = stddev(dailySubs);
    const subCV = avgDailySubs !== 0 ? Math.abs(subStdDev / avgDailySubs) : 1; // coefficient of variation
    // Lower CV = more consistent; score inversely proportional
    const growthConsistency = clamp(Math.round(100 - subCV * 30), 0, 100);

    // --- Factor 2: View Trend (20%) ---
    const dailyViews = dailyData.map(d => parseFloat(d.views) || 0);
    const viewSlope = linearSlope(dailyViews);
    const avgViews = dailyViews.reduce((a, b) => a + b, 0) / dailyViews.length;
    // Normalize slope relative to average views
    const normalizedViewSlope = avgViews > 0 ? viewSlope / avgViews : 0;
    const viewTrend = clamp(Math.round(50 + normalizedViewSlope * 500), 0, 100);

    // --- Factor 3: Engagement Rate Trend (15%) ---
    const { rows: engData } = await pool.query(
      `SELECT snapshot_date,
              SUM(views) AS views, SUM(likes) AS likes, SUM(comments) AS comments
       FROM video_stats
       WHERE snapshot_date BETWEEN $1 AND $2
       GROUP BY snapshot_date
       ORDER BY snapshot_date ASC`,
      [from, to]
    );
    const dailyEngRates = engData.map(d => {
      const v = parseInt(d.views) || 0;
      const l = parseInt(d.likes) || 0;
      const c = parseInt(d.comments) || 0;
      return v > 0 ? (l + c) / v * 100 : 0;
    });
    const engSlope = linearSlope(dailyEngRates);
    const avgEngRate = dailyEngRates.length > 0 ? dailyEngRates.reduce((a, b) => a + b, 0) / dailyEngRates.length : 0;
    const engTrend = clamp(Math.round(50 + engSlope * 200 + (avgEngRate > 3 ? 20 : avgEngRate > 1 ? 10 : 0)), 0, 100);

    // --- Factor 4: Upload Consistency (15%) ---
    const { rows: uploadData } = await pool.query(
      `SELECT COUNT(DISTINCT video_id) AS uploads,
              MIN(published_at) AS first_upload, MAX(published_at) AS last_upload
       FROM video_stats
       WHERE published_at IS NOT NULL AND published_at::date BETWEEN $1 AND $2`,
      [from, to]
    );
    const uploads = parseInt(uploadData[0]?.uploads || 0);
    const rangeDays = dailyData.length;
    const expectedUploads = Math.max(1, Math.round(rangeDays / 7)); // at least 1/week
    const uploadConsistency = clamp(Math.round(safeDivide(uploads, expectedUploads) * 70 + 30), 0, 100);

    // --- Factor 5: Audience Diversity (15%) ---
    const { rows: geoData } = await pool.query(
      `SELECT country_code, SUM(views) AS views FROM geography_stats
       WHERE snapshot_date BETWEEN $1 AND $2 GROUP BY country_code`, [from, to]
    );
    const { rows: trafficData } = await pool.query(
      `SELECT source_type, SUM(views) AS views FROM traffic_sources
       WHERE snapshot_date BETWEEN $1 AND $2 GROUP BY source_type`, [from, to]
    );
    const geoDiversity = diversityIndex(geoData.map(r => parseInt(r.views) || 0));
    const trafficDiversity = diversityIndex(trafficData.map(r => parseInt(r.views) || 0));
    const audienceDiversity = clamp(Math.round((geoDiversity * 0.5 + trafficDiversity * 0.5) * 100), 0, 100);

    // --- Factor 6: Retention Quality (15%) ---
    const durations = dailyData.map(d => parseFloat(d.average_view_duration) || 0).filter(d => d > 0);
    const durSlope = linearSlope(durations);
    const avgDur = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    // Base score on avg duration (over 3 min = good baseline) + trend
    const durationBase = clamp(Math.round(safeDivide(avgDur, 180) * 50), 0, 60);
    const durationTrend = clamp(Math.round(durSlope > 0 ? 20 : durSlope > -0.5 ? 10 : 0), 0, 40);
    const retentionQuality = clamp(durationBase + durationTrend, 0, 100);

    // --- Composite Score ---
    const factors = [
      { name: 'Growth Consistency', weight: 0.20, score: growthConsistency, explanation: `Sub growth coefficient of variation: ${round(subCV, 2)}. ${growthConsistency > 70 ? 'Very consistent growth.' : growthConsistency > 40 ? 'Moderate consistency.' : 'Growth is erratic — aim for more steady content.'}` },
      { name: 'View Trend', weight: 0.20, score: viewTrend, explanation: `Daily views are ${viewTrend > 60 ? 'trending upward' : viewTrend > 40 ? 'relatively stable' : 'trending downward'}. Slope: ${round(viewSlope, 1)} views/day.` },
      { name: 'Engagement Rate', weight: 0.15, score: engTrend, explanation: `Avg engagement rate: ${round(avgEngRate)}%. ${engSlope > 0 ? 'Trending up.' : 'Consider adding more CTAs.'}` },
      { name: 'Upload Consistency', weight: 0.15, score: uploadConsistency, explanation: `${uploads} uploads in ${rangeDays} days (expected ~${expectedUploads}). ${uploadConsistency > 70 ? 'Good cadence.' : 'Upload more regularly to maintain algorithm favor.'}` },
      { name: 'Audience Diversity', weight: 0.15, score: audienceDiversity, explanation: `Geographic diversity: ${round(geoDiversity * 100)}/100, traffic diversity: ${round(trafficDiversity * 100)}/100.` },
      { name: 'Retention Quality', weight: 0.15, score: retentionQuality, explanation: `Avg duration: ${Math.floor(avgDur / 60)}m ${Math.round(avgDur % 60)}s. ${durSlope > 0 ? 'Improving.' : 'Consider hooking viewers earlier.'}` },
    ];

    const overallScore = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));

    // Historical health scores (weekly buckets)
    const historical = [];
    const bucketSize = 7;
    for (let i = 0; i < dailyData.length; i += bucketSize) {
      const bucket = dailyData.slice(i, i + bucketSize);
      if (bucket.length < 3) continue;
      const bViews = bucket.map(d => parseFloat(d.views) || 0);
      const bSubs = bucket.map(d => parseFloat(d.net_subscribers) || 0);
      const bViewSlope = linearSlope(bViews);
      const bAvgViews = bViews.reduce((a, b) => a + b, 0) / bViews.length;
      const bNormSlope = bAvgViews > 0 ? bViewSlope / bAvgViews : 0;
      const bSubCV = bSubs.length > 1 ? Math.abs(safeDivide(stddev(bSubs), bSubs.reduce((a, b) => a + b, 0) / bSubs.length, 1)) : 1;
      const score = clamp(Math.round(
        (100 - bSubCV * 30) * 0.4 +
        (50 + bNormSlope * 500) * 0.6
      ), 0, 100);
      historical.push({
        weekStart: bucket[0].snapshot_date,
        weekEnd: bucket[bucket.length - 1].snapshot_date,
        score,
      });
    }

    const healthLabel = overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : overallScore >= 40 ? 'Fair' : overallScore >= 20 ? 'Needs Work' : 'Critical';

    res.json({
      overallScore,
      healthLabel,
      factors,
      historical,
    });
  } catch (err) {
    console.error('Channel health error:', err.message);
    res.status(500).json({ error: 'Failed to compute channel health' });
  }
});

// ============================================================================
// 9. NEW: ACTIONABLE RECOMMENDATIONS
// ============================================================================
router.get('/insights/recommendations', async (req, res) => {
  try {
    const { from, to, prevFrom, prevTo } = parseDateRange(req.query);

    // Gather all the data we need in parallel
    const [channelRes, uploadTimingRes, trafficRes, engagementRes, prevEngRes, gapRes, retentionRes] = await Promise.all([
      // Current channel stats
      pool.query(
        `SELECT SUM(views) AS views, SUM(net_subscribers) AS subs,
                SUM(estimated_minutes_watched) AS watch_time,
                AVG(average_view_duration) AS avg_duration, COUNT(*) AS days
         FROM channel_snapshots WHERE snapshot_date BETWEEN $1 AND $2`, [from, to]),
      // Upload timing data
      pool.query(
        `SELECT video_id, MAX(published_at) AS published_at, SUM(views) AS views, SUM(likes) AS likes
         FROM video_stats WHERE published_at IS NOT NULL GROUP BY video_id`),
      // Traffic sources comparison
      pool.query(
        `SELECT source_type,
                SUM(CASE WHEN snapshot_date BETWEEN $1 AND $2 THEN views ELSE 0 END) AS cur_views,
                SUM(CASE WHEN snapshot_date BETWEEN $3 AND $4 THEN views ELSE 0 END) AS prev_views
         FROM traffic_sources
         WHERE snapshot_date BETWEEN $3 AND $2
         GROUP BY source_type ORDER BY cur_views DESC`,
        [from, to, prevFrom, prevTo]),
      // Current engagement
      pool.query(
        `SELECT SUM(views) AS views, SUM(likes) AS likes, SUM(comments) AS comments, SUM(shares) AS shares
         FROM video_stats WHERE snapshot_date BETWEEN $1 AND $2`, [from, to]),
      // Prev engagement
      pool.query(
        `SELECT SUM(views) AS views, SUM(likes) AS likes, SUM(comments) AS comments, SUM(shares) AS shares
         FROM video_stats WHERE snapshot_date BETWEEN $1 AND $2`, [prevFrom, prevTo]),
      // Upload gaps
      pool.query(
        `SELECT DISTINCT published_at::date AS pub_date
         FROM video_stats
         WHERE published_at IS NOT NULL
         ORDER BY pub_date DESC LIMIT 30`),
      // Retention data
      pool.query(
        `SELECT AVG(average_view_duration) AS cur_avg
         FROM channel_snapshots WHERE snapshot_date BETWEEN $1 AND $2`, [from, to]),
    ]);

    const recommendations = [];

    // 1. Best traffic source recommendation
    const traffic = trafficRes.rows;
    if (traffic.length > 0) {
      const best = traffic[0];
      const curViews = parseInt(best.cur_views) || 0;
      const prevViews = parseInt(best.prev_views) || 0;
      const growing = curViews > prevViews;
      const totalCurViews = traffic.reduce((a, r) => a + (parseInt(r.cur_views) || 0), 0);
      const share = round(safeDivide(curViews, totalCurViews) * 100);

      recommendations.push({
        priority: 'high',
        category: 'traffic',
        title: `Optimize for ${best.source_type.replace(/_/g, ' ')}`,
        description: `Your top traffic source is "${best.source_type.replace(/_/g, ' ')}" driving ${share}% of views${growing ? ' and it\'s growing' : ''}. ${
          best.source_type === 'SUGGESTED' ? 'Improve thumbnails and titles to boost click-through from suggestions.' :
          best.source_type === 'SEARCH' ? 'Focus on SEO — optimize titles, descriptions, and tags for search.' :
          best.source_type === 'EXTERNAL' ? 'Keep promoting on external platforms — it\'s working.' :
          best.source_type === 'BROWSE' ? 'Homepage/browse is strong — maintain consistent uploads to stay in feeds.' :
          'Continue creating content that performs well in this channel.'
        }`,
        dataPoint: `${curViews.toLocaleString()} views (${share}% share)`,
      });

      // Find fastest growing source
      const growingSources = traffic
        .filter(r => (parseInt(r.prev_views) || 0) > 0)
        .map(r => ({ source: r.source_type, growth: pctChange(parseInt(r.cur_views) || 0, parseInt(r.prev_views) || 0) }))
        .filter(r => r.growth > 10)
        .sort((a, b) => b.growth - a.growth);

      if (growingSources.length > 0 && growingSources[0].source !== best.source_type) {
        const gs = growingSources[0];
        recommendations.push({
          priority: 'medium',
          category: 'traffic',
          title: `Emerging traffic: ${gs.source.replace(/_/g, ' ')}`,
          description: `"${gs.source.replace(/_/g, ' ')}" grew ${round(gs.growth)}% vs last period. Investigate what\'s driving this and double down.`,
          dataPoint: `+${round(gs.growth)}% growth`,
        });
      }
    }

    // 2. Upload timing recommendation
    const timingVideos = uploadTimingRes.rows;
    if (timingVideos.length >= 5) {
      const dayPerf = {};
      for (const v of timingVideos) {
        const pub = new Date(v.published_at);
        if (isNaN(pub.getTime())) continue;
        const day = DAY_NAMES[pub.getUTCDay()];
        const hour = pub.getUTCHours();
        if (!dayPerf[day]) dayPerf[day] = { views: 0, count: 0 };
        dayPerf[day].views += parseInt(v.views) || 0;
        dayPerf[day].count++;
      }
      const dayEntries = Object.entries(dayPerf)
        .filter(([, d]) => d.count >= 2)
        .map(([day, d]) => ({ day, avgViews: d.views / d.count, count: d.count }))
        .sort((a, b) => b.avgViews - a.avgViews);

      if (dayEntries.length >= 2) {
        const best = dayEntries[0];
        const worst = dayEntries[dayEntries.length - 1];
        if (best.avgViews > worst.avgViews * 1.2) {
          recommendations.push({
            priority: 'medium',
            category: 'timing',
            title: `Publish on ${best.day}s`,
            description: `Videos published on ${best.day} average ${Math.round(best.avgViews).toLocaleString()} views — ${round(best.avgViews / worst.avgViews, 1)}x more than ${worst.day}. Prioritize ${best.day} uploads.`,
            dataPoint: `${Math.round(best.avgViews).toLocaleString()} avg views on ${best.day}s (${best.count} videos)`,
          });
        }
      }
    }

    // 3. Upload gap warning
    const pubDates = gapRes.rows.map(r => new Date(r.pub_date));
    if (pubDates.length >= 2) {
      const now = new Date();
      const daysSinceLast = Math.floor((now - pubDates[0]) / 86400000);
      // Avg gap between recent uploads
      let totalGap = 0;
      for (let i = 0; i < Math.min(pubDates.length - 1, 10); i++) {
        totalGap += Math.floor((pubDates[i] - pubDates[i + 1]) / 86400000);
      }
      const avgGap = totalGap / Math.min(pubDates.length - 1, 10);

      if (daysSinceLast > avgGap * 1.5 && daysSinceLast > 5) {
        recommendations.push({
          priority: 'high',
          category: 'consistency',
          title: 'Upload gap detected',
          description: `It\'s been ${daysSinceLast} days since your last upload (your average is every ${Math.round(avgGap)} days). Gaps in uploads reduce algorithm visibility and can lead to subscriber churn.`,
          dataPoint: `${daysSinceLast} days since last upload`,
        });
      }
    }

    // 4. Engagement trend recommendation
    const curEng = engagementRes.rows[0];
    const prevEng = prevEngRes.rows[0];
    const curEngViews = parseInt(curEng?.views || 0);
    const curEngActions = (parseInt(curEng?.likes || 0) + parseInt(curEng?.comments || 0));
    const prevEngViews = parseInt(prevEng?.views || 0);
    const prevEngActions = (parseInt(prevEng?.likes || 0) + parseInt(prevEng?.comments || 0));
    const curEngRate = safeDivide(curEngActions, curEngViews) * 100;
    const prevEngRate = safeDivide(prevEngActions, prevEngViews) * 100;

    if (prevEngRate > 0 && curEngRate < prevEngRate * 0.85) {
      recommendations.push({
        priority: 'high',
        category: 'engagement',
        title: 'Engagement rate declining',
        description: `Engagement rate dropped from ${round(prevEngRate)}% to ${round(curEngRate)}%. Try: ask questions in your videos, use pinned comments, add end screens with polls, or respond to comments to boost conversation.`,
        dataPoint: `${round(curEngRate)}% (was ${round(prevEngRate)}%)`,
      });
    } else if (curEngRate > prevEngRate * 1.15 && curEngRate > 0) {
      recommendations.push({
        priority: 'low',
        category: 'engagement',
        title: 'Engagement improving — keep it up',
        description: `Engagement rate improved from ${round(prevEngRate)}% to ${round(curEngRate)}%. Whatever you changed is working. Keep it up.`,
        dataPoint: `${round(curEngRate)}% (+${round(pctChange(curEngRate, prevEngRate))}%)`,
      });
    }

    // 5. Retention recommendation
    const curAvgDur = parseFloat(retentionRes.rows[0]?.cur_avg || 0);
    if (curAvgDur > 0 && curAvgDur < 120) {
      recommendations.push({
        priority: 'high',
        category: 'retention',
        title: 'Improve viewer retention',
        description: `Average view duration is ${Math.floor(curAvgDur / 60)}m ${Math.round(curAvgDur % 60)}s. Aim for at least 2-3 minutes. Try: stronger hooks in the first 15 seconds, pattern interrupts every 30-60 seconds, and preview value at the start.`,
        dataPoint: `${Math.floor(curAvgDur / 60)}m ${Math.round(curAvgDur % 60)}s avg`,
      });
    } else if (curAvgDur >= 300) {
      recommendations.push({
        priority: 'low',
        category: 'retention',
        title: 'Excellent retention',
        description: `Average view duration of ${Math.floor(curAvgDur / 60)}m ${Math.round(curAvgDur % 60)}s is strong. This signals high content quality to the algorithm. Keep producing in-depth content.`,
        dataPoint: `${Math.floor(curAvgDur / 60)}m ${Math.round(curAvgDur % 60)}s avg`,
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => (priorityOrder[a.priority] || 9) - (priorityOrder[b.priority] || 9));

    res.json({ recommendations: recommendations.slice(0, 7) });
  } catch (err) {
    console.error('Recommendations error:', err.message);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// ============================================================================
// UTILITY: Pearson Correlation
// ============================================================================
function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 3 || n !== ys.length) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// ============================================================================
// UTILITY: Keyword extraction
// ============================================================================
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'is','it','this','that','from','as','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should','may',
  'might','shall','can','need','must','i','you','he','she','we','they','my',
  'your','his','her','our','their','its','me','him','us','them','what','which',
  'who','whom','how','when','where','why','not','no','all','each','every',
  'both','few','more','most','other','some','such','than','too','very','just',
  'about','into','through','during','before','after','above','below','between',
  'out','off','over','under','again','further','then','once','here','there',
  'so','if','up','down','new','video','part','episode','ep','vs',
]);

function extractKeywords(title) {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF\s]/g, ' ')  // keep Tamil unicode + alphanumeric
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// ============================================================================
// ENDPOINT: /insights/lifecycle — Video Lifecycle Curves
// ============================================================================
router.get('/insights/lifecycle', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vs.video_id, vs.title, vs.published_at, vs.snapshot_date,
             vs.views,
             (vs.snapshot_date - vs.published_at::date) AS days_since_publish
      FROM video_stats vs
      WHERE vs.published_at IS NOT NULL
        AND (vs.snapshot_date - vs.published_at::date) >= 0
      ORDER BY vs.video_id, vs.snapshot_date
    `);

    // Group by video_id
    const videoMap = {};
    for (const row of result.rows) {
      if (!videoMap[row.video_id]) {
        videoMap[row.video_id] = {
          videoId: row.video_id,
          title: row.title,
          publishedAt: row.published_at,
          snapshots: [],
        };
      }
      videoMap[row.video_id].snapshots.push({
        date: row.snapshot_date,
        views: parseInt(row.views) || 0,
        daysSincePublish: parseInt(row.days_since_publish) || 0,
      });
    }

    const videos = Object.values(videoMap)
      .filter(v => v.snapshots.length >= 1)
      .sort((a, b) => {
        const aMax = Math.max(...a.snapshots.map(s => s.views));
        const bMax = Math.max(...b.snapshots.map(s => s.views));
        return bMax - aMax;
      })
      .slice(0, 20);

    // For each video, compute daily view gains and bucket into stages
    const lifecycles = videos.map(v => {
      const sorted = v.snapshots.sort((a, b) => a.daysSincePublish - b.daysSincePublish);
      const totalViews = sorted[sorted.length - 1]?.views || 0;
      const ageDays = sorted[sorted.length - 1]?.daysSincePublish || 0;

      // Compute daily gains
      const dailyGains = [];
      if (sorted.length === 1) {
        // Single snapshot: attribute all views to the current age bucket
        dailyGains.push({ day: sorted[0].daysSincePublish, gain: sorted[0].views });
      } else {
        for (let i = 1; i < sorted.length; i++) {
          const gain = Math.max(0, sorted[i].views - sorted[i - 1].views);
          dailyGains.push({ day: sorted[i].daysSincePublish, gain });
        }
      }

      // Bucket into lifecycle stages
      const stages = {
        launch: { days: '0-3', views: 0 },
        momentum: { days: '4-14', views: 0 },
        settling: { days: '15-30', views: 0 },
        longTail: { days: '31-90', views: 0 },
        evergreen: { days: '90+', views: 0 },
      };

      for (const dg of dailyGains) {
        if (dg.day <= 3) stages.launch.views += dg.gain;
        else if (dg.day <= 14) stages.momentum.views += dg.gain;
        else if (dg.day <= 30) stages.settling.views += dg.gain;
        else if (dg.day <= 90) stages.longTail.views += dg.gain;
        else stages.evergreen.views += dg.gain;
      }

      const totalGains = Object.values(stages).reduce((s, st) => s + st.views, 0) || 1;
      const stageShares = {};
      for (const [k, st] of Object.entries(stages)) {
        stageShares[k] = round((st.views / totalGains) * 100, 1);
      }

      // Classify lifecycle type
      let lifecycleType = 'steady_grower';
      if (stageShares.launch > 60) lifecycleType = 'viral_spike';
      else if ((stageShares.longTail + stageShares.evergreen) > 30 && ageDays > 30) lifecycleType = 'evergreen';
      else if (ageDays > 7) {
        // Check if peak was after day 7
        const peakDay = dailyGains.reduce((best, dg) => dg.gain > best.gain ? dg : best, { gain: 0, day: 0 });
        if (peakDay.day > 7) lifecycleType = 'slow_burn';
      }

      return {
        videoId: v.videoId,
        title: v.title,
        publishedAt: v.publishedAt,
        totalViews: totalViews,
        ageDays,
        lifecycleType,
        stages,
        stageShares,
        curve: dailyGains.slice(0, 90),  // daily gain curve up to 90 days
      };
    }).filter(v => v.ageDays >= 7);

    // Channel profile: dominant lifecycle types
    const typeCounts = {};
    lifecycles.forEach(v => {
      typeCounts[v.lifecycleType] = (typeCounts[v.lifecycleType] || 0) + 1;
    });
    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

    res.json({
      videos: lifecycles,
      channelProfile: {
        dominantType: dominantType ? dominantType[0] : 'unknown',
        typeCounts,
        totalAnalyzed: lifecycles.length,
      },
    });
  } catch (err) {
    console.error('Lifecycle error:', err.message);
    res.status(500).json({ error: 'Failed to compute lifecycle curves' });
  }
});

// ============================================================================
// ENDPOINT: /insights/content-patterns — Content Pattern Detection
// ============================================================================
router.get('/insights/content-patterns', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vs.video_id, vs.title, vs.views, vs.likes,
             vs.average_view_duration, vs.published_at
      FROM video_stats vs
      WHERE vs.snapshot_date = (
        SELECT MAX(snapshot_date) FROM video_stats WHERE video_id = vs.video_id
      )
      AND vs.views > 0
      ORDER BY vs.views DESC
    `);

    const videos = result.rows.map(r => ({
      videoId: r.video_id,
      title: r.title || '',
      views: parseInt(r.views) || 0,
      likes: parseInt(r.likes) || 0,
      avgDuration: parseFloat(r.average_view_duration) || 0,
      publishedAt: r.published_at,
    }));

    const avgViews = videos.length > 0 ? videos.reduce((s, v) => s + v.views, 0) / videos.length : 1;

    // Format detection: shorts (<90s) vs long-form
    const shorts = videos.filter(v => v.avgDuration > 0 && v.avgDuration < 90);
    const longForm = videos.filter(v => v.avgDuration >= 90);
    const formats = [];
    if (shorts.length > 0) {
      const avgShortViews = shorts.reduce((s, v) => s + v.views, 0) / shorts.length;
      formats.push({
        format: 'Short-form (<90s)',
        count: shorts.length,
        avgViews: Math.round(avgShortViews),
        performanceVsAvg: round(safeDivide(avgShortViews, avgViews) * 100 - 100, 1),
      });
    }
    if (longForm.length > 0) {
      const avgLongViews = longForm.reduce((s, v) => s + v.views, 0) / longForm.length;
      formats.push({
        format: 'Long-form (90s+)',
        count: longForm.length,
        avgViews: Math.round(avgLongViews),
        performanceVsAvg: round(safeDivide(avgLongViews, avgViews) * 100 - 100, 1),
      });
    }

    // Language detection: Tamil unicode presence
    const tamilVideos = videos.filter(v => /[\u0B80-\u0BFF]/.test(v.title));
    const englishVideos = videos.filter(v => !/[\u0B80-\u0BFF]/.test(v.title));
    const languages = [];
    if (tamilVideos.length > 0) {
      const avgTamil = tamilVideos.reduce((s, v) => s + v.views, 0) / tamilVideos.length;
      languages.push({ language: 'Tamil', count: tamilVideos.length, avgViews: Math.round(avgTamil), performanceVsAvg: round(safeDivide(avgTamil, avgViews) * 100 - 100, 1) });
    }
    if (englishVideos.length > 0) {
      const avgEng = englishVideos.reduce((s, v) => s + v.views, 0) / englishVideos.length;
      languages.push({ language: 'English', count: englishVideos.length, avgViews: Math.round(avgEng), performanceVsAvg: round(safeDivide(avgEng, avgViews) * 100 - 100, 1) });
    }

    // Keyword analysis
    const keywordMap = {};
    for (const v of videos) {
      const keywords = extractKeywords(v.title);
      for (const kw of keywords) {
        if (!keywordMap[kw]) keywordMap[kw] = { keyword: kw, videos: [] };
        keywordMap[kw].videos.push(v);
      }
    }

    const keywords = Object.values(keywordMap)
      .filter(k => k.videos.length >= 2)
      .map(k => {
        const kwAvg = k.videos.reduce((s, v) => s + v.views, 0) / k.videos.length;
        return {
          keyword: k.keyword,
          videoCount: k.videos.length,
          avgViews: Math.round(kwAvg),
          performanceVsAvg: round(safeDivide(kwAvg, avgViews) * 100 - 100, 1),
        };
      })
      .sort((a, b) => b.performanceVsAvg - a.performanceVsAvg)
      .slice(0, 15);

    // Title length buckets
    const lengthBuckets = [
      { label: 'Short (< 30 chars)', min: 0, max: 30, videos: [] },
      { label: 'Medium (30-60 chars)', min: 30, max: 60, videos: [] },
      { label: 'Long (60+ chars)', min: 60, max: 999, videos: [] },
    ];
    for (const v of videos) {
      const len = v.title.length;
      for (const b of lengthBuckets) {
        if (len >= b.min && len < b.max) { b.videos.push(v); break; }
      }
    }
    const titleLengths = lengthBuckets.map(b => ({
      label: b.label,
      count: b.videos.length,
      avgViews: b.videos.length > 0 ? Math.round(b.videos.reduce((s, v) => s + v.views, 0) / b.videos.length) : 0,
    }));

    res.json({ formats, languages, keywords, titleLengths, totalVideos: videos.length });
  } catch (err) {
    console.error('Content patterns error:', err.message);
    res.status(500).json({ error: 'Failed to analyze content patterns' });
  }
});

// ============================================================================
// ENDPOINT: /insights/upload-gaps — Upload Gap Impact
// ============================================================================
router.get('/insights/upload-gaps', async (req, res) => {
  try {
    // Get publish dates
    const pubResult = await pool.query(`
      SELECT DISTINCT published_at::date AS pub_date
      FROM video_stats
      WHERE published_at IS NOT NULL
      ORDER BY pub_date
    `);
    const pubDates = pubResult.rows.map(r => new Date(r.pub_date));

    // Get daily channel performance
    const perfResult = await pool.query(`
      SELECT snapshot_date, views, subscribers_gained
      FROM channel_snapshots
      ORDER BY snapshot_date
    `);
    const dailyPerf = perfResult.rows.map(r => ({
      date: new Date(r.snapshot_date),
      views: parseInt(r.views) || 0,
      subs: parseInt(r.subscribers_gained) || 0,
    }));

    if (pubDates.length < 2 || dailyPerf.length < 7) {
      return res.json({ gaps: [], summary: null, frequencyTrend: null });
    }

    // Compute gaps between uploads
    const gaps = [];
    for (let i = 1; i < pubDates.length; i++) {
      const diffMs = pubDates[i] - pubDates[i - 1];
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays >= 3) {
        // Find daily performance during this gap
        const gapStart = pubDates[i - 1];
        const gapEnd = pubDates[i];
        const gapPerf = dailyPerf.filter(d => d.date > gapStart && d.date < gapEnd);
        const avgGapViews = gapPerf.length > 0 ? gapPerf.reduce((s, d) => s + d.views, 0) / gapPerf.length : 0;
        const avgGapSubs = gapPerf.length > 0 ? gapPerf.reduce((s, d) => s + d.subs, 0) / gapPerf.length : 0;

        gaps.push({
          from: gapStart.toISOString().split('T')[0],
          to: gapEnd.toISOString().split('T')[0],
          durationDays: diffDays,
          avgDailyViews: Math.round(avgGapViews),
          avgDailySubs: round(avgGapSubs, 1),
        });
      }
    }

    // Compare gap days vs active days
    const pubDateSet = new Set(pubDates.map(d => d.toISOString().split('T')[0]));
    const activeDays = dailyPerf.filter(d => pubDateSet.has(d.date.toISOString().split('T')[0]));
    const gapDays = dailyPerf.filter(d => !pubDateSet.has(d.date.toISOString().split('T')[0]));

    const avgActiveViews = activeDays.length > 0 ? activeDays.reduce((s, d) => s + d.views, 0) / activeDays.length : 0;
    const avgGapViews = gapDays.length > 0 ? gapDays.reduce((s, d) => s + d.views, 0) / gapDays.length : 0;
    const avgActiveSubs = activeDays.length > 0 ? activeDays.reduce((s, d) => s + d.subs, 0) / activeDays.length : 0;
    const avgGapSubs = gapDays.length > 0 ? gapDays.reduce((s, d) => s + d.subs, 0) / gapDays.length : 0;

    const costPerGapDay = Math.round(avgGapViews - avgActiveViews);

    // Upload frequency trend (last 30/60/90 days)
    const now = new Date();
    const freq = {};
    for (const window of [30, 60, 90]) {
      const cutoff = new Date(now - window * 24 * 60 * 60 * 1000);
      const count = pubDates.filter(d => d >= cutoff).length;
      freq[`${window}d`] = { uploads: count, avgDaysBetween: count > 1 ? round(window / count, 1) : null };
    }

    res.json({
      gaps: gaps.sort((a, b) => b.durationDays - a.durationDays).slice(0, 15),
      summary: {
        totalGaps: gaps.length,
        avgGapDuration: gaps.length > 0 ? round(gaps.reduce((s, g) => s + g.durationDays, 0) / gaps.length, 1) : 0,
        avgActiveViews: Math.round(avgActiveViews),
        avgGapViews: Math.round(avgGapViews),
        avgActiveSubs: round(avgActiveSubs, 1),
        avgGapSubs: round(avgGapSubs, 1),
        costPerGapDay,
        viewImpactPct: round(pctChange(avgGapViews, avgActiveViews), 1),
      },
      frequencyTrend: freq,
    });
  } catch (err) {
    console.error('Upload gaps error:', err.message);
    res.status(500).json({ error: 'Failed to analyze upload gaps' });
  }
});

// ============================================================================
// ENDPOINT: /insights/subscriber-quality — Subscriber Quality Score
// ============================================================================
router.get('/insights/subscriber-quality', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT snapshot_date, subscribers_gained, subscribers_lost,
             (COALESCE(subscribers_gained, 0) - COALESCE(subscribers_lost, 0)) AS net_subscribers,
             views
      FROM channel_snapshots
      WHERE snapshot_date >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY snapshot_date
    `);

    const rows = result.rows.map(r => ({
      date: r.snapshot_date,
      gained: parseInt(r.subscribers_gained) || 0,
      lost: parseInt(r.subscribers_lost) || 0,
      net: parseInt(r.net_subscribers) || 0,
      views: parseInt(r.views) || 0,
    }));

    if (rows.length < 7) {
      return res.json({ qualityScore: null, message: 'Need at least 7 days of data' });
    }

    // Churn rate per day
    const churnRates = rows.map(r => r.gained > 0 ? (r.lost / r.gained) * 100 : 0);
    const avgChurnRate = churnRates.reduce((a, b) => a + b, 0) / churnRates.length;
    const qualityScore = clamp(round(100 - avgChurnRate, 1), 0, 100);

    // Detect churn spikes (>2σ)
    const meanLost = rows.reduce((s, r) => s + r.lost, 0) / rows.length;
    const stdLost = Math.sqrt(rows.reduce((s, r) => s + Math.pow(r.lost - meanLost, 2), 0) / rows.length);
    const churnSpikes = rows
      .filter(r => r.lost > meanLost + 2 * stdLost && stdLost > 0)
      .map(r => ({
        date: r.date,
        lost: r.lost,
        gained: r.gained,
        zScore: round((r.lost - meanLost) / stdLost, 2),
      }));

    // Weekly cohort analysis
    const weeks = [];
    for (let i = 0; i < rows.length; i += 7) {
      const weekRows = rows.slice(i, i + 7);
      if (weekRows.length < 3) continue;
      const weekGained = weekRows.reduce((s, r) => s + r.gained, 0);
      const weekLost = weekRows.reduce((s, r) => s + r.lost, 0);
      weeks.push({
        weekStart: weekRows[0].date,
        weekEnd: weekRows[weekRows.length - 1].date,
        gained: weekGained,
        lost: weekLost,
        net: weekGained - weekLost,
        retentionRate: weekGained > 0 ? round((1 - weekLost / weekGained) * 100, 1) : 100,
      });
    }

    // Trend: daily gained vs lost for chart
    const trend = rows.map(r => ({
      date: r.date,
      gained: r.gained,
      lost: r.lost,
      net: r.net,
    }));

    res.json({
      qualityScore,
      avgChurnRate: round(avgChurnRate, 2),
      avgDailyGained: round(rows.reduce((s, r) => s + r.gained, 0) / rows.length, 1),
      avgDailyLost: round(rows.reduce((s, r) => s + r.lost, 0) / rows.length, 1),
      churnSpikes,
      weeklyCohorts: weeks,
      trend,
    });
  } catch (err) {
    console.error('Subscriber quality error:', err.message);
    res.status(500).json({ error: 'Failed to compute subscriber quality' });
  }
});

// ============================================================================
// ENDPOINT: /insights/growth-benchmark — Growth Comparison Benchmarks
// ============================================================================
router.get('/insights/growth-benchmark', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT snapshot_date, views, subscribers_gained, estimated_minutes_watched
      FROM channel_snapshots
      WHERE snapshot_date >= CURRENT_DATE - INTERVAL '120 days'
      ORDER BY snapshot_date
    `);

    const rows = result.rows.map(r => ({
      date: new Date(r.snapshot_date),
      views: parseInt(r.views) || 0,
      subs: parseInt(r.subscribers_gained) || 0,
      watchTime: parseFloat(r.estimated_minutes_watched) || 0,
    }));

    if (rows.length < 7) {
      return res.json({ periods: [], monthlyTrend: [], acceleration: null });
    }

    const now = new Date(rows[rows.length - 1].date);

    // Compare 30d windows
    const periods = [];
    for (const offset of [0, 30, 60, 90]) {
      const end = new Date(now - offset * 24 * 60 * 60 * 1000);
      const start = new Date(end - 30 * 24 * 60 * 60 * 1000);
      const windowRows = rows.filter(r => r.date >= start && r.date <= end);
      if (windowRows.length < 7) continue;

      const totalViews = windowRows.reduce((s, r) => s + r.views, 0);
      const totalSubs = windowRows.reduce((s, r) => s + r.subs, 0);
      const totalWatchTime = windowRows.reduce((s, r) => s + r.watchTime, 0);

      periods.push({
        label: offset === 0 ? 'Current 30d' : `${offset}d ago`,
        offset,
        totalViews,
        totalSubs,
        totalWatchTime: Math.round(totalWatchTime),
        avgDailyViews: Math.round(totalViews / windowRows.length),
        avgDailySubs: round(totalSubs / windowRows.length, 1),
        days: windowRows.length,
      });
    }

    // Compute change vs previous period for each
    for (let i = 0; i < periods.length - 1; i++) {
      const cur = periods[i];
      const prev = periods[i + 1];
      cur.viewsChange = round(pctChange(cur.totalViews, prev.totalViews), 1);
      cur.subsChange = round(pctChange(cur.totalSubs, prev.totalSubs), 1);
    }

    // Monthly trend for chart
    const monthlyTrend = [];
    for (let i = 0; i < rows.length; i += 7) {
      const week = rows.slice(i, i + 7);
      if (week.length < 3) continue;
      monthlyTrend.push({
        date: week[0].date.toISOString().split('T')[0],
        views: week.reduce((s, r) => s + r.views, 0),
        subs: week.reduce((s, r) => s + r.subs, 0),
      });
    }

    // Acceleration: linear slope of monthly view totals
    const viewTotals = periods.map(p => p.totalViews).reverse();
    const slope = linearSlope(viewTotals);
    let accelerationMessage = 'Stable growth — no significant acceleration or deceleration';
    if (slope > 0 && viewTotals.length > 1) {
      const pctAccel = round(safeDivide(slope, viewTotals[0]) * 100, 1);
      accelerationMessage = `Accelerating: views growing ~${pctAccel}% per 30d window`;
    } else if (slope < 0 && viewTotals.length > 1) {
      const pctDecel = round(Math.abs(safeDivide(slope, viewTotals[0])) * 100, 1);
      accelerationMessage = `Decelerating: views declining ~${pctDecel}% per 30d window`;
    }

    res.json({
      periods,
      monthlyTrend,
      acceleration: {
        slope: round(slope, 0),
        direction: slope > 0 ? 'accelerating' : slope < 0 ? 'decelerating' : 'stable',
        message: accelerationMessage,
      },
    });
  } catch (err) {
    console.error('Growth benchmark error:', err.message);
    res.status(500).json({ error: 'Failed to compute growth benchmarks' });
  }
});

// ============================================================================
// ENDPOINT: /insights/subscriber-engagement — Subscriber Feed Analysis
// ============================================================================
router.get('/insights/subscriber-engagement', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);

    // Subscriber traffic vs total
    const subTrafficRes = await pool.query(`
      SELECT snapshot_date, source_type, views, estimated_minutes_watched
      FROM traffic_sources
      WHERE snapshot_date BETWEEN $1 AND $2
      ORDER BY snapshot_date
    `, [from, to]);

    const dailyMap = {};
    for (const r of subTrafficRes.rows) {
      const d = r.snapshot_date.toISOString?.().split('T')[0] || r.snapshot_date;
      if (!dailyMap[d]) dailyMap[d] = { date: d, subViews: 0, subWatchTime: 0, totalViews: 0, totalWatchTime: 0 };
      const views = parseInt(r.views) || 0;
      const wt = parseFloat(r.estimated_minutes_watched) || 0;
      dailyMap[d].totalViews += views;
      dailyMap[d].totalWatchTime += wt;
      const src = (r.source_type || '').toUpperCase();
      if (src === 'SUBSCRIBER' || src === 'NOTIFICATION' || src.includes('SUBSCRI')) {
        dailyMap[d].subViews += views;
        dailyMap[d].subWatchTime += wt;
      }
    }
    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Totals
    const totalSubViews = daily.reduce((s, d) => s + d.subViews, 0);
    const totalViews = daily.reduce((s, d) => s + d.totalViews, 0);
    const totalSubWT = daily.reduce((s, d) => s + d.subWatchTime, 0);
    const totalWT = daily.reduce((s, d) => s + d.totalWatchTime, 0);

    const subViewShare = round(safeDivide(totalSubViews, totalViews) * 100, 1);
    const subWTPerView = round(safeDivide(totalSubWT, totalSubViews), 2);
    const nonSubWTPerView = round(safeDivide(totalWT - totalSubWT, totalViews - totalSubViews), 2);
    const loyaltyMultiplier = round(safeDivide(subWTPerView, nonSubWTPerView), 2);

    // Loyalty trend: daily sub view share
    const loyaltyTrend = daily.map(d => ({
      date: d.date,
      subViewShare: d.totalViews > 0 ? round((d.subViews / d.totalViews) * 100, 1) : 0,
      subViews: d.subViews,
      totalViews: d.totalViews,
    }));

    // Correlation: subscriber views vs net subscribers
    const channelRes = await pool.query(`
      SELECT snapshot_date,
             (COALESCE(subscribers_gained, 0) - COALESCE(subscribers_lost, 0)) AS net_subs
      FROM channel_snapshots
      WHERE snapshot_date BETWEEN $1 AND $2
      ORDER BY snapshot_date
    `, [from, to]);

    const subsByDate = {};
    for (const r of channelRes.rows) {
      const d = r.snapshot_date.toISOString?.().split('T')[0] || r.snapshot_date;
      subsByDate[d] = parseInt(r.net_subs) || 0;
    }

    const correlationDates = daily.filter(d => subsByDate[d.date] !== undefined);
    const viewsArr = correlationDates.map(d => d.totalViews);
    const subsArr = correlationDates.map(d => subsByDate[d.date]);
    const correlation = round(pearsonCorrelation(viewsArr, subsArr), 3);

    res.json({
      subViewShare,
      subscriberWatchTimePerView: subWTPerView,
      nonSubscriberWatchTimePerView: nonSubWTPerView,
      loyaltyMultiplier,
      totalSubscriberViews: totalSubViews,
      totalViews,
      correlation,
      correlationLabel: correlation > 0.7 ? 'Strong positive' : correlation > 0.3 ? 'Moderate positive' : correlation > -0.3 ? 'Weak / none' : 'Negative',
      loyaltyTrend,
    });
  } catch (err) {
    console.error('Subscriber engagement error:', err.message);
    res.status(500).json({ error: 'Failed to analyze subscriber engagement' });
  }
});

module.exports = router;
