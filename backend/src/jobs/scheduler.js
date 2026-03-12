const cron = require('node-cron');
const runFullCollection = require('./masterCollector');
const collectRealtimeStats = require('../collectors/realtimeStats');

function startScheduler() {
  // Full collection daily at 6:00 AM UTC
  cron.schedule('0 6 * * *', async () => {
    console.log('[Scheduler] Running daily full collection...');
    try {
      await runFullCollection();
    } catch (err) {
      console.error('[Scheduler] Daily collection failed:', err.message);
    }
  });

  // Realtime stats every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Collecting realtime stats...');
    try {
      await collectRealtimeStats();
    } catch (err) {
      console.error('[Scheduler] Realtime collection failed:', err.message);
    }
  });

  console.log('Cron jobs scheduled: daily@06:00, realtime@every30min');
}

module.exports = startScheduler;
