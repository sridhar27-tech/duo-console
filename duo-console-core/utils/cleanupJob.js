// jobs/cleanupJob.js
const cron = require('node-cron');
const { purgeExpiredMedia } = require('./cloudinaryService');

/**
 * Initializes the background cleanup job.
 * Runs at minute 0 of every hour ('0 * * * *').
 */
const initCleanupCron = () => {
  console.log('[Scheduler] Initializing 24h Cloudinary auto-purge cron job...');

  // Run every hour
  cron.schedule('0 * * * *', async () => {
    await purgeExpiredMedia();
  });
};

module.exports = { initCleanupCron };