import type { PrismaClient } from '@prisma/client';

export async function resetTestDatabase(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe('DROP TABLE IF EXISTS "Shift"');
  await client.$executeRawUnsafe(`
    CREATE TABLE "Shift" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "workDate" DATETIME NOT NULL,
      "period" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Shift_workDate_period_key" UNIQUE ("workDate", "period")
    )
  `);
}
