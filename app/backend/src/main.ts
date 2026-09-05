import dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app.js';
import { syncDailyHistory } from './modules/schedule/schedule.service.js';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
createApp().listen(PORT, HOST, () => {
  console.log(`Backend server listening on http://${HOST}:${PORT}`);
});

const syncCompletedWork = () => {
  void syncDailyHistory().catch((error: unknown) => {
    console.error('Failed to sync daily work history', error);
  });
};

syncCompletedWork();
const workHistoryTimer = setInterval(syncCompletedWork, 60 * 60 * 1000);
workHistoryTimer.unref();
