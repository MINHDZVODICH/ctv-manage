import dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app.js';
import { snapshotTodayWorkHistory } from './modules/schedule/schedule.service.js';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
createApp().listen(PORT, HOST, () => {
  console.log(`Backend server listening on http://${HOST}:${PORT}`);
});

const syncCompletedWork = () => {
  void snapshotTodayWorkHistory().catch((error: unknown) => {
    console.error('Failed to snapshot today work history', error);
  });
};

// Run snapshot once on startup (e.g. if server restarts after 17:30 Bangkok)
syncCompletedWork();

// Schedule daily snapshot at exact 17:30 Asia/Bangkok (UTC+7 -> 10:30 UTC)
function scheduleNextSnapshot() {
  const now = new Date();
  const targetUtc = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      10,
      30,
      0,
      0,
    ),
  );

  if (now.getTime() >= targetUtc.getTime()) {
    targetUtc.setUTCDate(targetUtc.getUTCDate() + 1);
  }

  const delayMs = targetUtc.getTime() - now.getTime();
  const timer = setTimeout(() => {
    syncCompletedWork();
    scheduleNextSnapshot();
  }, delayMs);
  timer.unref();
}

scheduleNextSnapshot();
