import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, test } from 'vitest';
import { RegistrationRequestsService } from '../src/modules/registration-requests/registration-requests.service.js';
import { FileStorage } from '../src/shared/file-storage.js';

const baseline = '20260825000000_parent_schema_baseline';
const roots: string[] = [];

describe.sequential('Prisma deployment migrations', () => {
  afterAll(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  });

  test('upgrades the 5172cf0 schema without losing business rows or replaying legacy idempotency', async () => {
    const root = await temporaryRoot();
    const databaseUrl = sqliteUrl(join(root, 'legacy.db'));
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await createLegacyDatabase(client);

      runPrisma(['migrate', 'resolve', '--applied', baseline], databaseUrl);
      runPrisma(['migrate', 'deploy'], databaseUrl);

      const accounts = await client.$queryRawUnsafe<Array<{ email: string }>>(
        'SELECT "email" FROM "Account" WHERE "id" = ?',
        'account-business-row',
      );
      assert.deepEqual(accounts, [{ email: 'preserved@example.vn' }]);
      assert.equal(await client.idempotencyRecord.count(), 0);
      await client.idempotencyRecord.create({
        data: {
          scope: 'registration:create',
          fingerprintHash: 'f'.repeat(64),
          keyHash: 'a'.repeat(64),
          requestHash: 'b'.repeat(64),
          expiresAt: new Date('2026-08-26T00:00:00Z'),
        },
      });
      await new RegistrationRequestsService(client, new FileStorage(join(root, 'files'))).reconcileIncomplete();
      assert.equal(await client.idempotencyRecord.count(), 0);
    } finally {
      await client.$disconnect();
    }
  });

  test('deploys the complete schema into an empty fresh-rebuild database', async () => {
    const root = await temporaryRoot();
    const databasePath = join(root, 'fresh.db');
    const databaseUrl = sqliteUrl(databasePath);
    await (await open(databasePath, 'a')).close();

    runPrisma(['migrate', 'deploy'], databaseUrl);

    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const tables = await client.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Account', 'RegistrationRequest', 'FileAsset', 'IdempotencyRecord') ORDER BY name",
      );
      assert.deepEqual(tables.map(({ name }) => name), ['Account', 'FileAsset', 'IdempotencyRecord', 'RegistrationRequest']);
    } finally {
      await client.$disconnect();
    }
  });
});

async function createLegacyDatabase(client: PrismaClient): Promise<void> {
  const baselineSql = await readFile(
    new URL('../prisma/migrations/20260825000000_parent_schema_baseline/migration.sql', import.meta.url),
    'utf8',
  );
  for (const statement of baselineSql.split(/;\s*(?:\r?\n|$)/)) {
    if (statement.trim()) await client.$executeRawUnsafe(statement);
  }
  await client.$executeRawUnsafe(
    'INSERT INTO "Account" ("id", "email", "passwordHash", "role", "displayName", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
    'account-business-row', 'preserved@example.vn', 'hash', 'ADMIN', 'Preserved Admin', Date.now(),
  );
  await client.$executeRawUnsafe(
    'INSERT INTO "IdempotencyRecord" ("id", "key", "requestHash", "responseStatus", "responseBody", "expiresAt") VALUES (?, ?, ?, ?, ?, ?)',
    'legacy-idempotency', 'legacy-key-hash', 'legacy-request-hash', 201, '{"data":{"id":"unsafe-replay"}}', Date.now() - 1,
  );
}

function runPrisma(args: string[], databaseUrl: string): void {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const commandArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx.cmd prisma', ...args, '--schema', 'prisma/schema.prisma']
    : ['prisma', ...args, '--schema', 'prisma/schema.prisma'];
  execFileSync(command, commandArgs, {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ctv-prisma-migration-'));
  roots.push(root);
  return root;
}

function sqliteUrl(path: string): string {
  return `file:${path.replaceAll('\\', '/')}`;
}
