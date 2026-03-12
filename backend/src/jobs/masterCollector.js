const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const pool = require('../db/pool');
const collectChannelStats = require('../collectors/channelStats');
const collectVideoStats = require('../collectors/videoStats');
const collectTrafficSources = require('../collectors/trafficSources');
const collectGeography = require('../collectors/geography');
const collectDeviceStats = require('../collectors/deviceStats');
const collectDemographics = require('../collectors/demographics');
const collectRealtimeStats = require('../collectors/realtimeStats');

const COLLECTORS = [
  { name: 'channelStats', fn: collectChannelStats, needsDates: true },
  { name: 'videoStats', fn: collectVideoStats, needsDates: true },
  { name: 'trafficSources', fn: collectTrafficSources, needsDates: true },
  { name: 'geography', fn: collectGeography, needsDates: true },
  { name: 'deviceStats', fn: collectDeviceStats, needsDates: true },
  { name: 'demographics', fn: collectDemographics, needsDates: true },
  { name: 'realtimeStats', fn: collectRealtimeStats, needsDates: false },
];

async function runFullCollection() {
  const runId = uuidv4();
  const endDate = dayjs().subtract(1, 'day');
  const startDate = endDate.subtract(28, 'day');

  console.log(`[Collection ${runId}] Starting full collection...`);

  for (const collector of COLLECTORS) {
    const startedAt = new Date();
    await pool.query(
      `INSERT INTO collection_logs (run_id, collector_name, status, started_at)
       VALUES ($1, $2, 'running', $3)`,
      [runId, collector.name, startedAt]
    );

    try {
      const rows = collector.needsDates
        ? await collector.fn(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'))
        : await collector.fn();

      await pool.query(
        `UPDATE collection_logs SET status='success', rows_affected=$1, finished_at=NOW()
         WHERE run_id=$2 AND collector_name=$3`,
        [rows || 0, runId, collector.name]
      );
      console.log(`[Collection ${runId}] ${collector.name}: ${rows} rows`);
    } catch (err) {
      await pool.query(
        `UPDATE collection_logs SET status='error', error_message=$1, finished_at=NOW()
         WHERE run_id=$2 AND collector_name=$3`,
        [err.message, runId, collector.name]
      );
      console.error(`[Collection ${runId}] ${collector.name} failed:`, err.message);
    }
  }

  console.log(`[Collection ${runId}] Complete`);
  return runId;
}

module.exports = runFullCollection;
