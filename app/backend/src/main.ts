import { config } from './config.js';
import { createApp } from './app.js';
import { startScheduleSnapshotJob } from './jobs/schedule-snapshot.job.js';
import { prisma } from './shared/prisma.js';
import { logger } from './shared/logger.js';
import { setShuttingDown } from './modules/health/health.controller.js';
import { cleanupExpiredRateLimits } from './shared/rateLimitStore.js';

const PORT = config.PORT;
const HOST = config.HOST;

const app = createApp();
const server = app.listen(PORT, HOST, () => {
  logger.info(`Backend server listening on http://${HOST}:${PORT}`);
});

const snapshotJob = startScheduleSnapshotJob();

const rateLimitCleanupIntervalMs = 60 * 60 * 1000;
const rateLimitCleanupTimer = setInterval(async () => {
  try {
    const count = await cleanupExpiredRateLimits(new Date());
    if (count > 0) {
      logger.info({ count }, 'Cleaned up expired rate limits');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup expired rate limits');
  }
}, rateLimitCleanupIntervalMs);
rateLimitCleanupTimer.unref?.();

// Run initial rate limit cleanup on startup
void cleanupExpiredRateLimits(new Date()).catch((error) => {
  logger.error({ error }, 'Initial rate limit cleanup error');
});

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Set readiness probe to 503
  setShuttingDown(true);

  // Stop reconciliation and rate limit cleanup background timers
  snapshotJob.stop();
  clearInterval(rateLimitCleanupTimer);

  // Allow up to 30s for active requests
  const forceExitTimer = setTimeout(async () => {
    logger.warn('Active requests did not complete within 30s, forcing shutdown');
    try {
      await prisma.$disconnect();
    } catch (err) {
      logger.error({ err }, 'Error during forced database disconnect');
    }
    process.exit(1);
  }, 30_000);
  forceExitTimer.unref?.();

  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }

  server.close(async () => {
    clearTimeout(forceExitTimer);
    try {
      await prisma.$disconnect();
      logger.info('Database disconnected cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during database disconnect');
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
