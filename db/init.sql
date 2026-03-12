-- YouTube Analytics Dashboard — Standalone Database Init Script
-- Usage: psql -h <host> -U <user> -f db/init.sql
-- This script is idempotent and safe to run multiple times.

-- Create database (run as superuser against 'postgres' database)
-- Note: CREATE DATABASE cannot run inside a transaction block.
-- If running via psql, connect to 'postgres' db first:
--   psql -h host -U user -d postgres -c "CREATE DATABASE yt_analytics;"
-- Then run the rest against yt_analytics:
--   psql -h host -U user -d yt_analytics -f db/init.sql

-- Channel-level daily snapshots (subscriber counts, views, revenue, etc.)
CREATE TABLE IF NOT EXISTS channel_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  views BIGINT DEFAULT 0,
  estimated_minutes_watched BIGINT DEFAULT 0,
  subscribers_gained INT DEFAULT 0,
  subscribers_lost INT DEFAULT 0,
  net_subscribers INT DEFAULT 0,
  average_view_duration NUMERIC(10,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  impressions_ctr NUMERIC(6,4) DEFAULT 0,
  estimated_revenue NUMERIC(12,4) DEFAULT 0,
  total_subscribers BIGINT DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  total_videos INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date)
);

-- Per-video daily statistics
CREATE TABLE IF NOT EXISTS video_stats (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(20) NOT NULL,
  snapshot_date DATE NOT NULL,
  title TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  views BIGINT DEFAULT 0,
  estimated_minutes_watched BIGINT DEFAULT 0,
  likes INT DEFAULT 0,
  dislikes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  average_view_duration NUMERIC(10,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  impressions_ctr NUMERIC(6,4) DEFAULT 0,
  estimated_revenue NUMERIC(12,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, snapshot_date)
);

-- Traffic source breakdown per day
CREATE TABLE IF NOT EXISTS traffic_sources (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  source_type VARCHAR(100) NOT NULL,
  views BIGINT DEFAULT 0,
  estimated_minutes_watched BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, source_type)
);

-- Geographic distribution per day
CREATE TABLE IF NOT EXISTS geography_stats (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  views BIGINT DEFAULT 0,
  estimated_minutes_watched BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, country_code)
);

-- Device type and OS breakdown per day
CREATE TABLE IF NOT EXISTS device_stats (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  device_type VARCHAR(50) NOT NULL,
  operating_system VARCHAR(100) NOT NULL DEFAULT 'UNKNOWN',
  views BIGINT DEFAULT 0,
  estimated_minutes_watched BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, device_type, operating_system)
);

-- Audience age and gender demographics
CREATE TABLE IF NOT EXISTS audience_demographics (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  age_group VARCHAR(20) NOT NULL,
  gender VARCHAR(20) NOT NULL,
  viewer_percentage NUMERIC(6,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, age_group, gender)
);

-- Real-time viewer stats (append-only, no upsert)
CREATE TABLE IF NOT EXISTS realtime_stats (
  id SERIAL PRIMARY KEY,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  concurrent_viewers INT DEFAULT 0,
  views_last_60_min INT DEFAULT 0,
  views_last_48_hours INT DEFAULT 0
);

-- Collection run logs for monitoring
CREATE TABLE IF NOT EXISTS collection_logs (
  id SERIAL PRIMARY KEY,
  run_id UUID NOT NULL,
  collector_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  rows_affected INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_channel_snapshots_date ON channel_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_video_stats_date ON video_stats(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_video_stats_video ON video_stats(video_id);
CREATE INDEX IF NOT EXISTS idx_traffic_sources_date ON traffic_sources(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_geography_stats_date ON geography_stats(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_device_stats_date ON device_stats(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_demographics_date ON audience_demographics(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_realtime_collected ON realtime_stats(collected_at);
CREATE INDEX IF NOT EXISTS idx_collection_logs_run ON collection_logs(run_id);
