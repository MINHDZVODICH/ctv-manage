import dotenv from 'dotenv';
import { createApp } from './app.js';
import { connectPrisma } from './shared/prisma.js';
import { logger } from './shared/logger.js';

dotenv.config();

const port = Number(process.env.PORT) || 5000;

async function startServer() {
  await connectPrisma();

  const app = createApp();

  app.listen(port, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`API Base URL: http://localhost:${port}/api/v1`);
  });
}

startServer().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
