import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.resolve(backendRoot, '../..');
const defaultTestDatabaseUrl =
  'postgresql://ctv_manage:ctv_manage@localhost:5432/ctv_manage_test?schema=public';
const databaseUrl = process.env.DATABASE_TEST_URL ?? defaultTestDatabaseUrl;

function assertSafeTestDatabase(urlString) {
  const url = new URL(urlString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('Integration tests require a PostgreSQL DATABASE_TEST_URL.');
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!/(^|[_-])test($|[_-])/.test(databaseName)) {
    throw new Error(
      `Refusing to reset PostgreSQL database "${databaseName}" because its name is not marked as a test database.`,
    );
  }
}

function runNodeCli(entrypoint, args, env) {
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: backendRoot,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function resolveDependencyFile(packageName, relativePath) {
  const candidates = [
    path.join(backendRoot, 'node_modules', packageName, relativePath),
    path.join(workspaceRoot, 'node_modules', packageName, relativePath),
  ];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) {
    throw new Error(`Cannot find ${packageName}/${relativePath} in workspace dependencies.`);
  }
  return resolved;
}

assertSafeTestDatabase(databaseUrl);

const testEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DATABASE_TEST_URL: databaseUrl,
  FILE_STORAGE_ROOT: process.env.FILE_STORAGE_ROOT ?? '.acceptance-uploads',
  NODE_ENV: 'test',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'acceptance-test-secret-not-for-production',
};

runNodeCli(
  resolveDependencyFile('prisma', 'build/index.js'),
  [
    'migrate',
    'reset',
    '--force',
    '--skip-seed',
    '--skip-generate',
    '--schema',
    'prisma/schema.prisma',
  ],
  testEnv,
);

if (!process.argv.includes('--prepare-only')) {
  const forwardedArgs = process.argv
    .slice(2)
    .filter((arg) => arg !== '--prepare-only')
    .map((arg) => arg.replace(/^app[/\\]backend[/\\]/, ''));
  runNodeCli(
    resolveDependencyFile('vitest', 'vitest.mjs'),
    ['run', '--no-file-parallelism', ...forwardedArgs],
    testEnv,
  );
}
