import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, channel: 'chrome' } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 390, height: 844 }, channel: 'chrome' } },
  ],
  webServer: [
    { command: 'cmd /d /s /c "set E2E_TEST=1&& set NODE_ENV=test&& set DATABASE_URL=file:./e2e.db&& set FILE_STORAGE_ROOT=.e2e-private-storage&& set PORT=3001&& cd app\\backend&& npx.cmd tsx scripts/e2e-seed.ts&& npx.cmd tsx src/server.ts"', cwd: '../..', url: 'http://127.0.0.1:3001/api/v1/health', reuseExistingServer: !process.env.CI, timeout: 30_000 },
    { command: 'npm.cmd run dev --workspace=app/frontend -- --host 127.0.0.1', cwd: '../..', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 30_000 },
  ],
});
