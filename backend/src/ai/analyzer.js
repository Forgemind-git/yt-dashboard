const OpenAI = require('openai');
const pool = require('../db/pool');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory cache: analysis type → { data, timestamp }
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// DATA GATHERER — collects all channel metrics into a structured snapshot
// ============================================================================
async function gatherChannelData() {
  const [
    channelRes,
    videoRes,
    trafficRes,
    geoRes,
    deviceRes,
    realtimeRes,
  ] = await Promise.all([
    pool.query(`
      SELECT snapshot_date, views, estimated_minutes_watched, subscribers_gained,
             subscribers_lost, net_subscribers, average_view_duration,
             total_subscribers, total_views, total_videos
      FROM channel_snapshots ORDER BY snapshot_date DESC LIMIT 90
    `),
    pool.query(`
      SELECT video_id, title, published_at, views, likes, comments, shares,
             average_view_duration, estimated_minutes_watched,
             snapshot_date
      FROM video_stats
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM video_stats WHERE video_id = video_stats.video_id)
      ORDER BY views DESC LIMIT 50
    `),
    pool.query(`
      SELECT source_type, SUM(views) AS views, SUM(estimated_minutes_watched) AS watch_time
      FROM traffic_sources
      WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY source_type ORDER BY views DESC
    `),
    pool.query(`SELECT country_code, views FROM geography_stats ORDER BY views DESC LIMIT 20`),
    pool.query(`
      SELECT device_type, SUM(views) AS views
      FROM device_stats
      WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY device_type ORDER BY views DESC
    `),
    pool.query(`SELECT * FROM realtime_stats ORDER BY collected_at DESC LIMIT 10`),
  ]);

  const channel = channelRes.rows;
  const latest = channel[0] || {};
  const videos = videoRes.rows;
  const traffic = trafficRes.rows;
  const geo = geoRes.rows;
  const devices = deviceRes.rows;

  // Compute key metrics
  const totalViewsLast30 = channel.slice(0, 30).reduce((s, r) => s + (parseInt(r.views) || 0), 0);
  const totalSubsLast30 = channel.slice(0, 30).reduce((s, r) => s + (parseInt(r.net_subscribers) || 0), 0);
  const totalWatchTimeLast30 = channel.slice(0, 30).reduce((s, r) => s + (parseInt(r.estimated_minutes_watched) || 0), 0);
  const avgDailyViews = Math.round(totalViewsLast30 / Math.min(channel.length, 30));
  const avgDailySubs = (totalSubsLast30 / Math.min(channel.length, 30)).toFixed(1);

  // Top 10 videos summary
  const topVideos = videos.slice(0, 15).map(v => ({
    title: v.title,
    views: parseInt(v.views) || 0,
    likes: parseInt(v.likes) || 0,
    comments: parseInt(v.comments) || 0,
    avgDuration: parseFloat(v.average_view_duration) || 0,
    publishedAt: v.published_at,
  }));

  // Traffic breakdown
  const trafficBreakdown = traffic.map(t => ({
    source: t.source_type,
    views: parseInt(t.views) || 0,
    watchTime: parseInt(t.watch_time) || 0,
  }));

  // Audience geo
  const geoBreakdown = geo.map(g => ({
    country: g.country_code,
    views: parseInt(g.views) || 0,
  }));

  // Device breakdown
  const deviceBreakdown = devices.map(d => ({
    device: d.device_type,
    views: parseInt(d.views) || 0,
  }));

  // Upload frequency
  const publishDates = videos
    .filter(v => v.publishedAt)
    .map(v => new Date(v.publishedAt))
    .sort((a, b) => b - a);
  const uploadGaps = [];
  for (let i = 0; i < publishDates.length - 1 && i < 10; i++) {
    uploadGaps.push(Math.round((publishDates[i] - publishDates[i + 1]) / (1000 * 60 * 60 * 24)));
  }

  return {
    channelName: 'Forgemind AI',
    niche: 'AI tutorials, automation tools (N8N, Make), tech tutorials in English and Tamil',
    totalSubscribers: parseInt(latest.total_subscribers) || 0,
    totalViews: parseInt(latest.total_views) || 0,
    totalVideos: parseInt(latest.total_videos) || 0,
    last30Days: {
      views: totalViewsLast30,
      subscribers: totalSubsLast30,
      watchTimeMinutes: totalWatchTimeLast30,
      avgDailyViews,
      avgDailySubs: parseFloat(avgDailySubs),
      daysOfData: Math.min(channel.length, 30),
    },
    topVideos,
    trafficBreakdown,
    geoBreakdown,
    deviceBreakdown,
    uploadGapDays: uploadGaps,
    avgUploadGap: uploadGaps.length > 0 ? Math.round(uploadGaps.reduce((a, b) => a + b, 0) / uploadGaps.length) : null,
    dailySnapshots: channel.slice(0, 14).map(r => ({
      date: r.snapshot_date,
      views: parseInt(r.views) || 0,
      subs: parseInt(r.net_subscribers) || 0,
      watchTime: parseInt(r.estimated_minutes_watched) || 0,
    })),
  };
}

// ============================================================================
// ANALYSIS DEFINITIONS — 12 distinct AI analysis types
// ============================================================================
const ANALYSES = {
  'channel-health-diagnosis': {
    title: 'Channel Health Diagnosis',
    icon: 'pulse',
    prompt: (data) => `You are a YouTube growth strategist. Analyze this channel's health:
${JSON.stringify(data, null, 2)}

Provide a comprehensive health diagnosis covering:
1. Overall channel health rating (1-10) with justification
2. Growth trajectory (accelerating, stable, or declining)
3. Content-audience fit assessment
4. Algorithm favorability signals
5. Critical issues that need immediate attention

Be specific with numbers. Be honest — don't sugarcoat problems.`,
  },

  'growth-strategy': {
    title: 'Growth Strategy & Roadmap',
    icon: 'rocket',
    prompt: (data) => `You are a YouTube growth strategist specializing in tech/AI channels. Given this channel data:
${JSON.stringify(data, null, 2)}

Create a detailed 90-day growth roadmap:
1. **Immediate actions (Week 1-2):** Quick wins to implement now
2. **Short-term (Month 1):** Content and strategy adjustments
3. **Medium-term (Month 2-3):** Scaling tactics and new initiatives
4. **Target metrics:** Specific subscriber and view targets for each phase
5. **Content pillars:** What content types to double down on vs. stop

Be specific — mention exact video topics, formats, and tactical steps.`,
  },

  'content-gap-analysis': {
    title: 'Content Gap Analysis',
    icon: 'search',
    prompt: (data) => `You are a YouTube content strategist for AI/tech channels. Analyze:
${JSON.stringify(data, null, 2)}

Identify content gaps and opportunities:
1. **Missing topics:** What's trending in AI/automation that this channel hasn't covered?
2. **Format gaps:** Are there content formats (shorts, tutorials, reviews, live streams) being underutilized?
3. **Competitor blind spots:** What topics are AI tutorial channels covering that this channel isn't?
4. **Seasonal opportunities:** Upcoming trends, product launches, or events to capitalize on
5. **10 specific video ideas** with estimated view potential (based on search demand)

Focus on actionable, specific suggestions — not generic advice.`,
  },

  'audience-deep-dive': {
    title: 'Audience Analysis & Persona',
    icon: 'users',
    prompt: (data) => `You are an audience intelligence analyst. Given this YouTube channel data:
${JSON.stringify(data, null, 2)}

Provide deep audience analysis:
1. **Primary viewer persona:** Demographics, interests, skill level, goals
2. **Viewing behavior patterns:** When they watch, how long, what devices
3. **Traffic source insights:** What the traffic mix reveals about discovery
4. **Geographic opportunity:** Which regions are underserved? Language strategy
5. **Subscriber loyalty assessment:** Are subscribers engaged or passive?
6. **Audience expansion opportunities:** Adjacent audiences to target

Use the geographic, device, and traffic data to build real insights.`,
  },

  'thumbnail-title-strategy': {
    title: 'Thumbnail & Title Optimization',
    icon: 'eye',
    prompt: (data) => `You are a YouTube CTR optimization specialist. Analyze these video titles and their performance:
${JSON.stringify(data.topVideos, null, 2)}

Channel niche: ${data.niche}
Total subscribers: ${data.totalSubscribers}

Provide:
1. **Title pattern analysis:** Which title styles perform best? (numbers, how-to, listicles, etc.)
2. **Title length sweet spot:** Optimal character count based on performance data
3. **Keyword effectiveness:** Which words/phrases correlate with higher views?
4. **5 title formulas** that would work for this channel with examples
5. **Thumbnail strategy:** Based on the niche, recommend thumbnail styles, colors, text overlay approaches
6. **A/B testing plan:** Specific experiments to run on upcoming videos
7. **Common mistakes** in current titles that are limiting CTR`,
  },

  'monetization-readiness': {
    title: 'Monetization & Revenue Strategy',
    icon: 'dollar',
    prompt: (data) => `You are a YouTube monetization strategist. Analyze:
${JSON.stringify(data, null, 2)}

Provide monetization analysis:
1. **Partner Program progress:** How close to 1000 subs / 4000 watch hours? Timeline estimate
2. **Watch time optimization:** How to increase watch hours faster
3. **Alternative revenue streams:** Sponsorships, affiliate marketing, courses, consulting — what's realistic now
4. **CPM potential:** Expected CPM range for this niche and audience geography
5. **Revenue projections:** Estimated monthly revenue at 5K, 10K, 50K subscribers
6. **Sponsorship readiness:** When to start outreach, expected rates, how to pitch

Be realistic about timelines and amounts.`,
  },

  'algorithm-optimization': {
    title: 'YouTube Algorithm Optimization',
    icon: 'cpu',
    prompt: (data) => `You are a YouTube algorithm expert. Analyze this channel's algorithm signals:
${JSON.stringify(data, null, 2)}

Provide algorithm optimization strategy:
1. **Session time signals:** Is the channel keeping viewers on YouTube? How to improve
2. **Click-through optimization:** Based on traffic sources, where are impressions being wasted?
3. **Watch time patterns:** What the average view duration tells us about content structure
4. **Upload timing optimization:** Best times/days based on audience behavior
5. **Playlist strategy:** How to create binge-worthy playlists that boost session time
6. **Shorts strategy:** How to use Shorts to feed the long-form funnel
7. **Engagement hooks:** Specific techniques to boost likes, comments, and shares

Include specific YouTube algorithm mechanics (2024-2025 updates).`,
  },

  'competitive-positioning': {
    title: 'Competitive Positioning',
    icon: 'target',
    prompt: (data) => `You are a competitive intelligence analyst for YouTube channels. Given:
Channel: ${data.channelName}
Niche: ${data.niche}
Subscribers: ${data.totalSubscribers}
Top content: ${data.topVideos.slice(0, 5).map(v => v.title).join(', ')}

Analyze competitive positioning:
1. **Market position:** Where does this channel sit in the AI tutorial space? (early mover, follower, niche player)
2. **Key competitors:** Name 5-8 channels in the same space, their strategies, and subscriber counts
3. **Unique differentiators:** What makes Forgemind AI unique (Tamil content, specific tools)?
4. **Vulnerability analysis:** Where could competitors overtake this channel?
5. **Blue ocean opportunities:** Untapped niches at the intersection of AI + regional languages
6. **Positioning statement:** A clear brand positioning recommendation

Be specific about named competitors and their strategies.`,
  },

  'retention-improvement': {
    title: 'Viewer Retention Improvement Plan',
    icon: 'clock',
    prompt: (data) => `You are a YouTube retention optimization specialist. Analyze:
${JSON.stringify(data, null, 2)}

The average view duration data shows how well videos hold attention. Provide:
1. **Retention diagnosis:** Are viewers dropping off early? What the numbers suggest
2. **Hook strategy:** First 30-second hook templates for AI tutorial videos
3. **Content pacing:** How to structure 10-min, 20-min, and 60-min tutorials for maximum retention
4. **Pattern interrupt techniques:** Specific tactics for tech tutorial channels
5. **End screen strategy:** How to keep viewers on the channel after each video
6. **Re-engagement tactics:** How to bring back viewers who watched but didn't subscribe
7. **5 specific scripts** for opening hooks based on this channel's best-performing content`,
  },

  'upload-schedule-optimizer': {
    title: 'Upload Schedule & Consistency Plan',
    icon: 'calendar',
    prompt: (data) => `You are a YouTube publishing strategist. Analyze upload patterns:
${JSON.stringify(data, null, 2)}

Upload gaps between recent videos (days): ${JSON.stringify(data.uploadGapDays)}
Average gap: ${data.avgUploadGap} days

Provide:
1. **Current consistency grade:** Rate A-F based on upload regularity
2. **Optimal upload frequency:** Based on niche, channel size, and growth goals
3. **Content calendar:** A 4-week content plan with specific video topics for AI/automation niche
4. **Batch production strategy:** How to create content efficiently given the gaps
5. **Buffer content:** Evergreen video ideas that can fill gaps during busy periods
6. **Impact analysis:** Projected growth at current vs. optimal upload frequency
7. **Burnout prevention:** Realistic schedule that's sustainable long-term`,
  },

  'seo-keyword-strategy': {
    title: 'YouTube SEO & Keyword Strategy',
    icon: 'search',
    prompt: (data) => `You are a YouTube SEO specialist. Analyze:
Channel: ${data.channelName}
Niche: ${data.niche}
Top videos: ${JSON.stringify(data.topVideos.slice(0, 10).map(v => ({ title: v.title, views: v.views })))}
Traffic sources: ${JSON.stringify(data.trafficBreakdown)}

Provide comprehensive SEO strategy:
1. **Search traffic assessment:** What % of views come from search? Is it healthy?
2. **20 high-potential keywords** for AI/automation tutorials with estimated search volume
3. **Title SEO formulas:** How to balance SEO with CTR in titles
4. **Description template:** Optimal video description structure for this niche
5. **Tag strategy:** Top tags to use consistently
6. **Tamil SEO opportunity:** Keywords and topics where Tamil tech content has low competition
7. **Hashtag strategy:** Which hashtags drive discoverability
8. **Playlist SEO:** How to structure playlists for search ranking`,
  },

  'weekly-performance-digest': {
    title: 'Weekly Performance Digest',
    icon: 'chart',
    prompt: (data) => `You are a YouTube analytics narrator. Write a weekly performance digest for Forgemind AI channel:

Recent 14-day performance:
${JSON.stringify(data.dailySnapshots, null, 2)}

Channel overview: ${data.totalSubscribers} subscribers, ${data.totalVideos} videos
Last 30 days: ${data.last30Days.views} views, ${data.last30Days.subscribers} net subs, ${data.last30Days.watchTimeMinutes} watch minutes
Top recent videos: ${JSON.stringify(data.topVideos.slice(0, 5).map(v => ({ title: v.title, views: v.views, likes: v.likes })))}
Traffic: ${JSON.stringify(data.trafficBreakdown)}

Write a concise but insightful weekly digest:
1. **This Week's Highlights:** 2-3 key metrics movements with context
2. **What's Working:** Specific things driving growth
3. **What Needs Attention:** Areas of concern with actionable fixes
4. **Video Spotlight:** Analysis of the best-performing recent video
5. **Quick Wins:** 3 things to do this week for immediate impact
6. **Metric Forecast:** Where key metrics are heading next week

Write in a professional but conversational tone. Use actual numbers.`,
  },
};

// ============================================================================
// ANALYSIS RUNNER
// ============================================================================
async function runAnalysis(analysisType) {
  // Check cache
  const cached = cache.get(analysisType);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const analysis = ANALYSES[analysisType];
  if (!analysis) throw new Error(`Unknown analysis type: ${analysisType}`);

  const channelData = await gatherChannelData();
  const prompt = analysis.prompt(channelData);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a world-class YouTube growth strategist and analytics expert. Provide specific, actionable, data-backed insights. Use markdown formatting with headers, bullet points, and bold text. Keep responses focused and practical — no fluff. When you give numbers, reference the actual data provided. Every recommendation should be tied to specific evidence from the data.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const result = {
    type: analysisType,
    title: analysis.title,
    icon: analysis.icon,
    content: response.choices[0]?.message?.content || 'Analysis could not be generated.',
    generatedAt: new Date().toISOString(),
    model: 'gpt-4o-mini',
    tokensUsed: response.usage?.total_tokens || 0,
  };

  cache.set(analysisType, { data: result, timestamp: Date.now() });
  return result;
}

async function runAllAnalyses() {
  const types = Object.keys(ANALYSES);
  const results = [];

  // Run in batches of 3 to avoid rate limits
  for (let i = 0; i < types.length; i += 3) {
    const batch = types.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map(t => runAnalysis(t).catch(err => ({
      type: t,
      title: ANALYSES[t].title,
      icon: ANALYSES[t].icon,
      content: `Analysis failed: ${err.message}`,
      error: true,
      generatedAt: new Date().toISOString(),
    }))));
    results.push(...batchResults);
  }

  return results;
}

function getAnalysisTypes() {
  return Object.entries(ANALYSES).map(([key, val]) => ({
    type: key,
    title: val.title,
    icon: val.icon,
  }));
}

function clearCache(type) {
  if (type) cache.delete(type);
  else cache.clear();
}

// ============================================================================
// AI CHAT — Ask anything about your channel
// ============================================================================
async function chatWithData(question, history = []) {
  const channelData = await gatherChannelData();

  const messages = [
    {
      role: 'system',
      content: `You are an AI assistant for the YouTube channel "Forgemind AI" (${channelData.totalSubscribers} subscribers, ${channelData.totalVideos} videos). You have access to the channel's analytics data and should answer questions using real data.

Channel data:
${JSON.stringify(channelData, null, 2)}

Rules:
- Always reference actual numbers from the data
- Be concise but thorough
- Use markdown formatting
- If you don't have enough data to answer, say so honestly
- Provide actionable suggestions when relevant`,
    },
    ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: question },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 1500,
  });

  return {
    answer: response.choices[0]?.message?.content || 'Could not generate an answer.',
    tokensUsed: response.usage?.total_tokens || 0,
  };
}

// ============================================================================
// VIDEO TITLE GENERATOR
// ============================================================================
async function generateVideoTitles(topic) {
  const channelData = await gatherChannelData();

  const topTitles = channelData.topVideos.slice(0, 10).map(v => `"${v.title}" (${v.views} views)`).join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a YouTube title optimization specialist for the channel "Forgemind AI" (AI tutorials, automation tools, tech content in English and Tamil).

The channel's best-performing titles:
${topTitles}

Channel stats: ${channelData.totalSubscribers} subscribers, avg ${channelData.last30Days.avgDailyViews} views/day.
Traffic: ${channelData.trafficBreakdown.map(t => `${t.source}: ${t.views}`).join(', ')}`,
      },
      {
        role: 'user',
        content: topic
          ? `Generate 10 optimized YouTube video titles for this topic: "${topic}". For each title, include: the title, why it works, estimated CTR potential (low/medium/high), and a thumbnail concept in 1 sentence.`
          : `Based on the channel's data and current AI/tech trends, suggest 10 video ideas with optimized titles. For each: the title, why this topic would work for this channel, estimated view potential, and a thumbnail concept.`,
      },
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });

  return {
    titles: response.choices[0]?.message?.content || 'Could not generate titles.',
    topic: topic || 'auto-suggested',
    tokensUsed: response.usage?.total_tokens || 0,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// SMART NOTIFICATIONS — Auto-detect critical alerts
// ============================================================================
async function getSmartNotifications() {
  const cached = cache.get('__notifications__');
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) return cached.data;

  const channelData = await gatherChannelData();
  const notifications = [];

  // 1. Upload gap alert
  if (channelData.uploadGapDays.length > 0 && channelData.uploadGapDays[0] > 7) {
    notifications.push({
      type: 'warning',
      title: 'Upload gap detected',
      message: `It's been ${channelData.uploadGapDays[0]} days since your last upload. Channels that upload regularly get 2-3x more algorithm promotion.`,
      action: 'Plan your next video',
    });
  }

  // 2. Subscriber milestone approaching
  const subs = channelData.totalSubscribers;
  const milestones = [1000, 5000, 10000, 25000, 50000, 100000];
  for (const m of milestones) {
    if (subs < m && subs >= m * 0.85) {
      const remaining = m - subs;
      const dailyRate = channelData.last30Days.avgDailySubs;
      const daysToGo = dailyRate > 0 ? Math.ceil(remaining / dailyRate) : null;
      notifications.push({
        type: 'milestone',
        title: `${(m / 1000)}K subscribers within reach!`,
        message: `You're ${remaining} subs away from ${(m / 1000)}K${daysToGo ? `. At current rate (~${dailyRate}/day), you'll hit it in ~${daysToGo} days.` : '.'}`,
        action: 'Push for it',
      });
      break;
    }
  }

  // 3. Views declining
  const snapshots = channelData.dailySnapshots;
  if (snapshots.length >= 14) {
    const recent7 = snapshots.slice(0, 7).reduce((s, r) => s + r.views, 0);
    const prev7 = snapshots.slice(7, 14).reduce((s, r) => s + r.views, 0);
    if (prev7 > 0) {
      const change = ((recent7 - prev7) / prev7) * 100;
      if (change < -20) {
        notifications.push({
          type: 'danger',
          title: 'Views dropping significantly',
          message: `Views are down ${Math.abs(Math.round(change))}% compared to last week (${recent7.toLocaleString()} vs ${prev7.toLocaleString()}). Check if upload frequency or content changes are the cause.`,
          action: 'Analyze in AI Strategy',
        });
      } else if (change > 30) {
        notifications.push({
          type: 'success',
          title: 'Views are surging!',
          message: `Views are up ${Math.round(change)}% compared to last week (${recent7.toLocaleString()} vs ${prev7.toLocaleString()}). Keep momentum going.`,
          action: 'Capitalize on this',
        });
      }
    }
  }

  // 4. High churn day
  if (snapshots.length > 0) {
    const latestDay = snapshots[0];
    const avgGained = channelData.last30Days.avgDailySubs;
    if (latestDay.subs < 0 && Math.abs(latestDay.subs) > avgGained * 2) {
      notifications.push({
        type: 'danger',
        title: 'Unusual subscriber loss',
        message: `Net subscriber loss of ${Math.abs(latestDay.subs)} on ${latestDay.date}, which is ${Math.round(Math.abs(latestDay.subs) / avgGained)}x your daily average gain.`,
        action: 'Check Subscriber Quality',
      });
    }
  }

  // 5. Shorts vs long-form insight
  const shortsTraffic = channelData.trafficBreakdown.find(t => t.source === 'SHORTS');
  const searchTraffic = channelData.trafficBreakdown.find(t => t.source === 'YT_SEARCH');
  if (shortsTraffic && searchTraffic) {
    if (shortsTraffic.views > searchTraffic.views * 1.5) {
      notifications.push({
        type: 'info',
        title: 'Shorts outperforming search',
        message: `Shorts are driving ${shortsTraffic.views.toLocaleString()} views vs ${searchTraffic.views.toLocaleString()} from search. Consider doubling down on Shorts while optimizing SEO.`,
        action: 'See Content Patterns',
      });
    }
  }

  // 6. Watch time partner program tracker
  const totalWatchHours = Math.round(channelData.last30Days.watchTimeMinutes / 60);
  if (subs < 1000) {
    notifications.push({
      type: 'info',
      title: 'Partner Program progress',
      message: `${subs}/1,000 subscribers (${Math.round(subs / 10)}%). ${totalWatchHours} watch hours this month. Keep growing!`,
      action: 'See Monetization Strategy',
    });
  }

  cache.set('__notifications__', { data: notifications, timestamp: Date.now() });
  return notifications;
}

module.exports = { runAnalysis, runAllAnalyses, getAnalysisTypes, clearCache, chatWithData, generateVideoTitles, getSmartNotifications, gatherChannelData };
