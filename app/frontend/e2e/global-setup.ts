import fs from 'node:fs';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendUrl = 'http://127.0.0.1:3100';
const backendUrl = 'http://127.0.0.1:4101';

async function waitForServer(url: string, process: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`Máy chủ kiểm thử đã dừng trước khi sẵn sàng: ${url}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Quá thời gian chờ máy chủ kiểm thử: ${url}`);
}

function stopProcess(process: ChildProcess) {
  if (process.exitCode === null && !process.killed) process.kill();
}

export default async function globalSetup() {
  console.log('[globalSetup] starting...');
  const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const workspaceRoot = path.resolve(frontendDir, '../..');
  const backendDir = path.join(workspaceRoot, 'app/backend');
  const env = {
    ...process.env,
    DATABASE_URL: 'file:./acceptance.db',
    FILE_STORAGE_ROOT: '.acceptance-uploads',
    NODE_ENV: 'test',
  };

  console.log('[globalSetup] cleaning db files...');
  const dbFiles = ['acceptance.db', 'acceptance.db-shm', 'acceptance.db-wal'];
  for (const f of dbFiles) {
    try {
      fs.rmSync(path.join(backendDir, 'prisma', f), { force: true });
    } catch {}
  }

  console.log('[globalSetup] running prisma db push...');
  execFileSync(
    process.execPath,
    [
      path.join(backendDir, 'node_modules/prisma/build/index.js'),
      'db',
      'push',
      '--skip-generate',
      '--accept-data-loss',
      '--schema',
      path.join(backendDir, 'prisma/schema.prisma'),
    ],
    { cwd: backendDir, env, stdio: ['ignore', 'inherit', 'inherit'] },
  );

  console.log('[globalSetup] running acceptance-seed...');
  execFileSync(
    process.execPath,
    [path.join(backendDir, 'node_modules/tsx/dist/cli.mjs'), 'scripts/acceptance-seed.ts'],
    { cwd: backendDir, env, stdio: ['ignore', 'inherit', 'inherit'] },
  );

  console.log('[globalSetup] spawning backend and frontend...');
  const backend = spawn(
    process.execPath,
    [path.join(backendDir, 'node_modules/tsx/dist/cli.mjs'), 'src/main.ts'],
    {
      cwd: backendDir,
      env: {
        ...env,
        PORT: '4101',
        CORS_ORIGIN: frontendUrl,
        SESSION_SECRET: 'acceptance-only-session-secret',
      },
      stdio: 'pipe',
      windowsHide: true,
    },
  );
  backend.stdout?.on('data', (d) => process.stdout.write(`[backend] ${d}`));
  backend.stderr?.on('data', (d) => process.stderr.write(`[backend-err] ${d}`));

  const frontend = spawn(
    process.execPath,
    [
      path.join(frontendDir, 'node_modules/vite/bin/vite.js'),
      '--port',
      '3100',
      '--host',
      '127.0.0.1',
    ],
    {
      cwd: frontendDir,
      env: { ...process.env, VITE_API_PROXY_TARGET: backendUrl },
      stdio: 'pipe',
      windowsHide: true,
    },
  );
  frontend.stdout?.on('data', (d) => process.stdout.write(`[frontend] ${d}`));
  frontend.stderr?.on('data', (d) => process.stderr.write(`[frontend-err] ${d}`));

  console.log('[globalSetup] waiting for servers...');
  try {
    await Promise.all([
      waitForServer(`${backendUrl}/api/v1/health`, backend),
      waitForServer(frontendUrl, frontend),
    ]);
  } catch (error) {
    console.error('[globalSetup] error waiting for servers:', error);
    stopProcess(frontend);
    stopProcess(backend);
    throw error;
  }

  console.log('[globalSetup] servers ready!');
  return async () => {
    console.log('[globalSetup] stopping servers...');
    stopProcess(frontend);
    stopProcess(backend);
  };
}
