import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './shared/logger.js';
import { initializePrisma } from './shared/prisma.js';

async function start(): Promise<void> {
  await initializePrisma();
  const app = createApp();
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'Backend listening');
  });
}

start().catch((error: unknown) => {
  logger.fatal(error, 'Backend startup failed');
  process.exitCode = 1;
});
