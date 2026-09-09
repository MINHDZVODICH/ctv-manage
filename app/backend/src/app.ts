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
  scheduleRouter,
  shiftRouter,
  summaryRouter,
  workHistoryRouter,
} from './modules/schedule/schedule.routes.js';
import operationsRouter from './modules/operations/operations.routes.js';
import healthRouter from './modules/health/health.routes.js';
import { requestLogger, routeLogContext } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config.js';

export function createApp() {
  const app = express();
  const mountRouter = (path: string, router: express.Router) => {
    app.use(path, routeLogContext(path), router);
  };
  const allowedOrigins = config.CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const trustedIps = config.TRUSTED_PROXY_IPS
    ? config.TRUSTED_PROXY_IPS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  app.set('trust proxy', trustedIps.length > 0 ? trustedIps : false);

  app.use(
    cors({
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
  app.use(cookieParser());
  app.use(requestLogger);

  mountRouter('/api/v1/health', healthRouter);

  mountRouter('/api/v1/auth/sessions', authRouter);
  app.use(express.json());
  mountRouter('/api/v1/users/me', usersRouter);
  mountRouter('/api/v1/users/me/files', myFileRouter);
  mountRouter('/api/v1/users/me', myScheduleRouter);
  mountRouter('/api/v1/accounts', accountsRouter);
  mountRouter('/api/v1/accounts/:accountId/files', accountFileRouter);
  mountRouter('/api/v1/registration-requests', registrationRouter);
  mountRouter('/api/v1/files', fileRouter);
  mountRouter('/api/v1/shifts', shiftRouter);
  mountRouter('/api/v1/schedule', scheduleRouter);
  mountRouter('/api/v1/schedule-summary', summaryRouter);
  mountRouter('/api/v1/work-history', workHistoryRouter);
  mountRouter('/api/v1/operations', operationsRouter);

  app.use(errorHandler);
  return app;
}
