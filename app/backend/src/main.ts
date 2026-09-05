import { config } from './config.js';
import { createApp } from './app.js';
import { startScheduleSnapshotJob } from './jobs/schedule-snapshot.job.js';
import { prisma } from './shared/prisma.js';
import { logger } from './shared/logger.js';

const PORT = config.PORT;
const HOST = config.HOST;

const app = createApp();
const server = app.listen(PORT, HOST, () => {
  logger.info(`Backend server listening on http://${HOST}:${PORT}`);
});

const snapshotJob = startScheduleSnapshotJob();

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  snapshotJob.stop();
  server.close(async () => {
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
