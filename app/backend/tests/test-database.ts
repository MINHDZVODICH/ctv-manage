import { execFileSync } from 'node:child_process';
import type { PrismaClient } from '@prisma/client';

function schemaSql(): string {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx.cmd prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script']
    : ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'];

  return execFileSync(command, args, {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}

export async function resetTestDatabase(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe('PRAGMA foreign_keys=OFF');
  const tables = await client.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );

  for (const { name } of tables) {
    await client.$executeRawUnsafe(`DROP TABLE IF EXISTS "${name.replaceAll('"', '""')}"`);
  }

  for (const statement of schemaSql().split(/;\s*(?:\r?\n|$)/)) {
    if (statement.trim()) {
      await client.$executeRawUnsafe(statement);
    }
  }

  // Prisma's datamodel cannot express SQLite partial indexes. Keep isolated
  // test databases aligned with the checked-in deployment migration.
  await client.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleRegistration_one_active_per_account" ON "ScheduleRegistration"("accountId") WHERE "status" = \'ACTIVE\'',
  );

  await client.$executeRawUnsafe('PRAGMA foreign_keys=ON');
}
