import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error' as never, (e: any) => {
  logger.error(e, 'Prisma Error');
});

export const connectPrisma = async () => {
  try {
    await prisma.$connect();
    // Use queryRawUnsafe for pragmas that return results like journal_mode
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 10000;');
    logger.info('Connected to SQLite with WAL mode and foreign keys enabled.');
  } catch (error) {
    logger.error(error, 'Failed to initialize SQLite Pragmas');
  }
};
