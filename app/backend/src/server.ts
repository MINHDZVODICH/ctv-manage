import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './shared/logger.js';
import { initializePrisma, prisma } from './shared/prisma.js';
import { FileStorage } from './shared/file-storage.js';
import { RegistrationRequestsService } from './modules/registration-requests/registration-requests.service.js';

async function start(): Promise<void> {
  await initializePrisma();
  const fileStorage = new FileStorage();
  await new RegistrationRequestsService(prisma, fileStorage).reconcileIncomplete();
  const app = createApp({ fileStorage });
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'Backend listening');
  });
}

start().catch((error: unknown) => {
  logger.fatal(error, 'Backend startup failed');
  process.exitCode = 1;
});
