import dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app.js';
import { syncWorkHistory } from './modules/schedule/schedule.service.js';

const PORT = Number(process.env.PORT ?? 4000);
createApp().listen(PORT);

const syncCompletedWork = () => {
  void syncWorkHistory().catch((error) => {
    console.error('Failed to sync daily work history', error);
  });
};

syncCompletedWork();
const workHistoryTimer = setInterval(syncCompletedWork, 60 * 60 * 1000);
workHistoryTimer.unref();
