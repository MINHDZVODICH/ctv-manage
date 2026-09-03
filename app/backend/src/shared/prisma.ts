import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Configure SQLite WAL mode and busy timeout for concurrent read/write stability
async function configureSqlite() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
  } catch {
    // Non-sqlite or initialized
  }
}

void configureSqlite();
