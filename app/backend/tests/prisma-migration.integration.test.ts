import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, test } from 'vitest';
import { RegistrationRequestsService } from '../src/modules/registration-requests/registration-requests.service.js';
import { ScheduleService } from '../src/modules/schedules/schedule.service.js';
import { FileStorage } from '../src/shared/file-storage.js';

const baseline = '20260825000000_parent_schema_baseline';
const roots: string[] = [];

describe.sequential('Prisma deployment migrations', () => {
  afterAll(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  });

  test('upgrades the 5172cf0 schema without losing business rows or replaying legacy idempotency', async () => {
    const { client, dates, root } = await deployLegacyDatabaseAtStableBusinessDate();
    try {
      const accounts = await client.$queryRawUnsafe<Array<{ email: string }>>(
        'SELECT "email" FROM "Account" WHERE "id" = ?',
        'account-business-row',
      );
      assert.deepEqual(accounts, [{ email: 'preserved@example.vn' }]);
      const registrations = await client.$queryRawUnsafe<Array<{ id: string; status: string }>>(
        'SELECT "id", "status" FROM "ScheduleRegistration" WHERE "accountId" = ? ORDER BY "id"',
        'account-business-row',
      );
      assert.deepEqual(registrations, [
        { id: 'schedule-legacy-new', status: 'ACTIVE' },
        { id: 'schedule-legacy-old', status: 'CANCELLED' },
      ]);
      const assignments = await client.$queryRawUnsafe<Array<{ id: string; registrationId: string; status: string; cancellationReason: string | null }>>(
        'SELECT "id", "registrationId", "status", "cancellationReason" FROM "ShiftAssignment" WHERE "accountId" = ? ORDER BY "id"',
        'account-business-row',
      );
      assert.deepEqual(assignments, [
        { id: 'assignment-legacy-new', registrationId: 'schedule-legacy-new', status: 'ACTIVE', cancellationReason: null },
        { id: 'assignment-legacy-old-already-cancelled', registrationId: 'schedule-legacy-old', status: 'CANCELLED', cancellationReason: 'CTV_CANCELLED_ONE' },
        { id: 'assignment-legacy-old-future', registrationId: 'schedule-legacy-old', status: 'CANCELLED', cancellationReason: 'REGISTRATION_DEDUPLICATED' },
        { id: 'assignment-legacy-old-past', registrationId: 'schedule-legacy-old', status: 'ACTIVE', cancellationReason: null },
        { id: 'assignment-legacy-old-today', registrationId: 'schedule-legacy-old', status: 'CANCELLED', cancellationReason: 'REGISTRATION_DEDUPLICATED' },
      ]);
      const alreadyCancelled = await client.shiftAssignment.findUniqueOrThrow({
        where: { id: 'assignment-legacy-old-already-cancelled' },
      });
      assert.equal(alreadyCancelled.cancelledAt?.getTime(), dates.alreadyCancelledAt.getTime());
      const visibleAssignments = await new ScheduleService(client, () => dates.now).listMyShifts(
        'account-business-row', { from: dates.past, to: dates.future },
      );
      assert.deepEqual(visibleAssignments.map((assignment) => assignment.registrationId), ['schedule-legacy-old', 'schedule-legacy-new']);
      assert.equal(await client.idempotencyRecord.count(), 0);
      await client.idempotencyRecord.create({
        data: {
          scope: 'registration:create',
          fingerprintHash: 'f'.repeat(64),
          keyHash: 'a'.repeat(64),
          requestHash: 'b'.repeat(64),
          expiresAt: new Date(`${dates.future}T00:00:00.000Z`),
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
      const indexes = await client.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA index_list("ScheduleRegistration")');
      assert.ok(indexes.some(({ name }) => name === 'ScheduleRegistration_one_active_per_account'));
    } finally {
      await client.$disconnect();
    }
  });
});

async function createLegacyDatabase(client: PrismaClient, dates: BusinessDates): Promise<void> {
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
  await client.$executeRawUnsafe(
    'INSERT INTO "ScheduleRegistration" ("id", "accountId", "startDate", "endDate", "timeZone", "roomCode", "workContent", "version", "status", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    'schedule-legacy-old', 'account-business-row', dateEpoch(dates.past), dateEpoch(dates.future), 'Asia/Bangkok', 'ROOM_1', 'Old schedule', 1, 'ACTIVE', dateEpoch(dates.past), dateEpoch(dates.past),
    'schedule-legacy-new', 'account-business-row', dateEpoch(dates.past), dateEpoch(dates.future), 'Asia/Bangkok', 'ROOM_2', 'New schedule', 2, 'ACTIVE', dateEpoch(dates.today), dateEpoch(dates.today),
  );
  await client.$executeRawUnsafe(
    'INSERT INTO "Shift" ("id", "workDate", "period", "status", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)',
    'shift-legacy-old-past', dateEpoch(dates.past), 'MORNING', 'OPEN', dateEpoch(dates.past), dateEpoch(dates.past),
    'shift-legacy-old-today', dateEpoch(dates.today), 'MORNING', 'OPEN', dateEpoch(dates.past), dateEpoch(dates.past),
    'shift-legacy-old-future', dateEpoch(dates.future), 'MORNING', 'OPEN', dateEpoch(dates.past), dateEpoch(dates.past),
    'shift-legacy-old-already-cancelled', dateEpoch(dates.future), 'AFTERNOON', 'OPEN', dateEpoch(dates.past), dateEpoch(dates.past),
    'shift-legacy-new', dateEpoch(dates.today), 'AFTERNOON', 'OPEN', dateEpoch(dates.today), dateEpoch(dates.today),
  );
  await client.$executeRawUnsafe(
    'INSERT INTO "ShiftAssignment" ("id", "shiftId", "accountId", "registrationId", "roomCode", "workContent", "status", "assignedAt", "cancelledAt", "cancellationReason", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    'assignment-legacy-old-past', 'shift-legacy-old-past', 'account-business-row', 'schedule-legacy-old', 'ROOM_1', 'Old past assignment', 'ACTIVE', dateEpoch(dates.past), null, null, dateEpoch(dates.past),
    'assignment-legacy-old-today', 'shift-legacy-old-today', 'account-business-row', 'schedule-legacy-old', 'ROOM_1', 'Old today assignment', 'ACTIVE', dateEpoch(dates.past), null, null, dateEpoch(dates.past),
    'assignment-legacy-old-future', 'shift-legacy-old-future', 'account-business-row', 'schedule-legacy-old', 'ROOM_1', 'Old future assignment', 'ACTIVE', dateEpoch(dates.past), null, null, dateEpoch(dates.past),
    'assignment-legacy-old-already-cancelled', 'shift-legacy-old-already-cancelled', 'account-business-row', 'schedule-legacy-old', 'ROOM_1', 'Already cancelled assignment', 'CANCELLED', dateEpoch(dates.past), dates.alreadyCancelledAt.getTime(), 'CTV_CANCELLED_ONE', dateEpoch(dates.past),
    'assignment-legacy-new', 'shift-legacy-new', 'account-business-row', 'schedule-legacy-new', 'ROOM_2', 'New assignment', 'ACTIVE', dateEpoch(dates.today), null, null, dateEpoch(dates.today),
  );
}

type BusinessDates = {
  past: string;
  today: string;
  future: string;
  now: Date;
  alreadyCancelledAt: Date;
};

async function deployLegacyDatabaseAtStableBusinessDate(): Promise<{ client: PrismaClient; dates: BusinessDates; root: string }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const root = await temporaryRoot();
    const databaseUrl = sqliteUrl(join(root, 'legacy.db'));
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const today = await sqliteBangkokBusinessDate(client);
      const dates = businessDates(today);
      await createLegacyDatabase(client, dates);

      runPrisma(['migrate', 'resolve', '--applied', baseline], databaseUrl);
      runPrisma(['migrate', 'deploy'], databaseUrl);

      if (await sqliteBangkokBusinessDate(client) === today) return { client, dates, root };
    } catch (error) {
      await client.$disconnect();
      throw error;
    }
    await client.$disconnect();
  }
  throw new Error('Bangkok business date rolled over during migration deployment; retry the migration test.');
}

async function sqliteBangkokBusinessDate(client: PrismaClient): Promise<string> {
  const rows = await client.$queryRawUnsafe<Array<{ businessDate: string }>>("SELECT date('now', '+7 hours') AS businessDate");
  return rows[0]!.businessDate;
}

function businessDates(today: string): BusinessDates {
  const past = addDays(today, -1);
  return {
    past,
    today,
    future: addDays(today, 1),
    now: new Date(`${today}T03:00:00.000Z`),
    alreadyCancelledAt: new Date(`${past}T01:02:03.000Z`),
  };
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateEpoch(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
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
