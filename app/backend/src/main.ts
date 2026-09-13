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
let activeCleanupPromise: Promise<void> | null = null;

const runRateLimitCleanup = async () => {
  if (activeCleanupPromise) return activeCleanupPromise;
  const task = (async () => {
    try {
      const count = await cleanupExpiredRateLimits(new Date());
      if (count > 0) {
        logger.info({ count }, 'Cleaned up expired rate limits');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired rate limits');
    }
  })();
  activeCleanupPromise = task;
  try {
    await task;
  } finally {
    if (activeCleanupPromise === task) {
      activeCleanupPromise = null;
    }
  }
};

const rateLimitCleanupTimer = setInterval(() => {
  void runRateLimitCleanup();
}, rateLimitCleanupIntervalMs);
rateLimitCleanupTimer.unref?.();

// Run initial rate limit cleanup on startup
void runRateLimitCleanup();

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Set readiness probe to 503
  setShuttingDown(true);

  // Stop reconciliation and rate limit cleanup background timers
  const stopSnapshotPromise = snapshotJob.stop();
  clearInterval(rateLimitCleanupTimer);

  // Allow up to 30s for active requests and background tasks
  const forceExitTimer = setTimeout(() => {
    logger.warn('Active tasks/requests did not complete within 30s, forcing shutdown');
    process.exit(1);
  }, 30_000);

  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }

  const closeServerPromise = new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  try {
    // Wait for HTTP server, ongoing snapshot execution, and rate-limit cleanup to complete
    await Promise.all([
      closeServerPromise,
      stopSnapshotPromise,
      activeCleanupPromise ?? Promise.resolve(),
    ]);

    await prisma.$disconnect();
    clearTimeout(forceExitTimer);
    logger.info('Database disconnected cleanly');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    try {
      await prisma.$disconnect();
    } catch (disconnectErr) {
      logger.error(
        { err: disconnectErr },
        'Failed to disconnect database during shutdown error handling',
      );
    }
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
