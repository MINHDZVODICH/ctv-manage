import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

export const prisma = new PrismaClient({
  datasources: { db: { url: config.DATABASE_URL } },
});

export async function initializePrisma(): Promise<void> {
  await prisma.$connect();
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys=ON');
  await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL');
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout=5000');
}
