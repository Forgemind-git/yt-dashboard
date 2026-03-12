-- Add missing index on video_stats(published_at) for lifecycle and timing queries
CREATE INDEX IF NOT EXISTS idx_video_stats_published_at ON video_stats (published_at);
