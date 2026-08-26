import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRouter from './modules/auth/auth.routes.js';
import usersRouter from './modules/users/users.routes.js';
import accountsRouter from './modules/accounts/accounts.routes.js';
import registrationRouter from './modules/registration/registration.routes.js';
import { fileRouter, myFileRouter, accountFileRouter } from './modules/files/files.routes.js';
import {
  myScheduleRouter,
  shiftRouter,
  summaryRouter,
  workHistoryRouter,
} from './modules/schedule/schedule.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  (app as any).use(
    (cors as any)({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS not allowed for origin: ${origin}`));
        }
      },
      credentials: true,
    }),
  );
  (app as any).use((express as any).json());
  (app as any).use((cookieParser as any)());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/v1/auth/sessions', authRouter);
  app.use('/api/v1/users/me', usersRouter);
  app.use('/api/v1/users/me/files', myFileRouter);
  app.use('/api/v1/users/me', myScheduleRouter);
  app.use('/api/v1/accounts', accountsRouter);
  app.use('/api/v1/accounts/:accountId/files', accountFileRouter);
  app.use('/api/v1/registration-requests', registrationRouter);
  app.use('/api/v1/files', fileRouter);
  app.use('/api/v1/shifts', shiftRouter);
  app.use('/api/v1/schedule-summary', summaryRouter);
  app.use('/api/v1/work-history', workHistoryRouter);

  app.use(errorHandler);
  return app;
}
