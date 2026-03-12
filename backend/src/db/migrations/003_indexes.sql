-- Add missing index on video_stats(published_at) for lifecycle and timing queries
CREATE INDEX IF NOT EXISTS idx_video_stats_published_at ON video_stats (published_at);
CREATE INDEX IF NOT EXISTS idx_collection_logs_started ON collection_logs (started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_stats_video_date ON video_stats (video_id, snapshot_date);
