import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

export const prisma = new PrismaClient({
  datasources: { db: { url: config.DATABASE_URL } },
});

export async function initializePrisma(): Promise<void> {
  await prisma.$connect();
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys=ON');
  // SQLite returns the selected journal mode; Prisma 6.19 rejects result-producing
  // statements through $executeRawUnsafe, so use the query channel deliberately.
  await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000');
}
