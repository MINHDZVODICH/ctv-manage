import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceArgIndex = process.argv.indexOf('--source');
const dryRun = process.argv.includes('--dry-run');
const sourcePath = path.resolve(
  process.cwd(),
  sourceArgIndex >= 0 && process.argv[sourceArgIndex + 1]
    ? process.argv[sourceArgIndex + 1]
    : path.join(backendRoot, 'prisma/dev.db'),
);

if (!dryRun && !process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL to the target PostgreSQL database before migrating data.');
}

if (!dryRun) {
  const targetUrl = new URL(process.env.DATABASE_URL);
  if (!['postgresql:', 'postgres:'].includes(targetUrl.protocol)) {
    throw new Error('DATABASE_URL must point to the target PostgreSQL database.');
  }
}
if (!existsSync(sourcePath)) {
  throw new Error(`SQLite source database does not exist: ${sourcePath}`);
}

const tables = [
  {
    table: 'Account',
    delegate: 'account',
    booleans: ['mustChangePassword'],
    dates: [
      'dateOfBirth',
      'joinedAt',
      'lastLoginAt',
      'passwordChangedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ],
  },
  { table: 'Session', delegate: 'session', dates: ['expiresAt', 'revokedAt', 'createdAt'] },
  {
    table: 'RegistrationRequest',
    delegate: 'registrationRequest',
    dates: ['dateOfBirth', 'submittedAt', 'reviewedAt', 'updatedAt'],
  },
  { table: 'FileAsset', delegate: 'fileAsset', dates: ['createdAt', 'deletedAt'] },
  {
    table: 'RegistrationRequestFile',
    delegate: 'registrationRequestFile',
    dates: [],
  },
  { table: 'AccountFile', delegate: 'accountFile', dates: ['createdAt', 'deletedAt'] },
  {
    table: 'ScheduleRegistration',
    delegate: 'scheduleRegistration',
    dates: ['startDate', 'endDate', 'createdAt', 'updatedAt', 'cancelledAt'],
  },
  { table: 'SchedulePatternSlot', delegate: 'schedulePatternSlot', dates: [] },
  { table: 'Shift', delegate: 'shift', dates: ['workDate', 'createdAt', 'updatedAt'] },
  {
    table: 'ShiftAssignment',
    delegate: 'shiftAssignment',
    dates: ['assignedAt', 'cancelledAt', 'updatedAt'],
  },
  { table: 'WorkHistory', delegate: 'workHistory', dates: ['workDate', 'recordedAt'] },
];

function sqliteDateToDate(value) {
  if (value === null || value === undefined) return null;
  const date =
    typeof value === 'number' || typeof value === 'bigint'
      ? new Date(Number(value))
      : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid SQLite date value: ${value}`);
  return date;
}

function convertRow(row, table) {
  const converted = { ...row };
  for (const field of table.dates) converted[field] = sqliteDateToDate(converted[field]);
  for (const field of table.booleans ?? []) {
    converted[field] = converted[field] === true || converted[field] === 1 || converted[field] === '1';
  }
  return converted;
}

const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
const sourceRows = tables.map((table) => ({
  ...table,
  rows: sqlite.prepare(`SELECT * FROM "${table.table}"`).all().map((row) => convertRow(row, table)),
}));

if (dryRun) {
  for (const { table, rows } of sourceRows) console.log(`${table}: ${rows.length} row(s)`);
  console.log(
    `Dry run complete: ${sourceRows.reduce((total, table) => total + table.rows.length, 0)} row(s) ready to migrate.`,
  );
  sqlite.close();
  process.exit(0);
}

const prisma = new PrismaClient();
try {
  const existingCounts = await Promise.all(
    tables.map(async ({ delegate, table }) => [table, await prisma[delegate].count()]),
  );
  const populatedTargets = existingCounts.filter(([, count]) => count > 0);
  if (populatedTargets.length > 0) {
    throw new Error(
      `Target PostgreSQL database is not empty (${populatedTargets
        .map(([table, count]) => `${table}=${count}`)
        .join(', ')}). Reset or use an empty target before importing.`,
    );
  }

  await prisma.$transaction(
    async (transaction) => {
      for (const { table, delegate, rows } of sourceRows) {
        if (rows.length === 0) continue;
        await transaction[delegate].createMany({ data: rows });
        console.log(`Migrated ${rows.length} row(s) from ${table}.`);
      }
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  const migrated = sourceRows.reduce((total, table) => total + table.rows.length, 0);
  console.log(`SQLite to PostgreSQL migration complete: ${migrated} total row(s).`);
} finally {
  sqlite.close();
  await prisma.$disconnect();
}
