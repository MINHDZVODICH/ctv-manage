import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';
import { originMiddleware } from './middleware/origin.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { config } from './config.js';
import { logger } from './shared/logger.js';
import { createAuthRouter } from './modules/auth/index.js';
import { createRegistrationRequestsRouter } from './modules/registration-requests/index.js';
import { FileStorage } from './shared/file-storage.js';
import { AccountsService, createAccountsRouter, createUsersRouter } from './modules/accounts/index.js';
import { createFilesRouter } from './modules/files/index.js';
import { createScheduleRouter, ScheduleService } from './modules/schedules/index.js';
import { createNotificationsRouter, NotificationsService } from './modules/notifications/index.js';

export interface AppDependencies {
  logger?: Logger;
  now?: () => Date;
  fileStorage?: FileStorage;
  scheduleService?: ScheduleService;
  notificationsService?: NotificationsService;
}

export function createApp(deps: AppDependencies = {}): Express {
  const app = express();
  const fileStorage = deps.fileStorage ?? new FileStorage();
  const accountsService = new AccountsService(undefined, fileStorage, deps.now);
  const scheduleService = deps.scheduleService ?? new ScheduleService(undefined, deps.now);
  const notificationsService = deps.notificationsService ?? new NotificationsService(undefined, deps.now);

  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cors({
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-CSRF-Token', 'Idempotency-Key'],
    optionsSuccessStatus: 204,
  }));
  app.use(pinoHttp<Request, Response>({
    logger: deps.logger ?? logger,
    customProps: (_request, response) => ({ requestId: response.locals.requestId }),
  }));
  app.use(originMiddleware);
  app.get('/api/v1/health', (_request, response) => {
    response.status(200).json({ data: { status: 'ok' } });
  });
  app.use('/api/v1/auth', createAuthRouter());
  app.use('/api/v1/registration-requests', createRegistrationRequestsRouter(fileStorage));
  app.use('/api/v1/accounts', createAccountsRouter(accountsService));
  app.use('/api/v1/users', createUsersRouter(accountsService));
  app.use('/api/v1/files', createFilesRouter(accountsService));
  app.use('/api/v1', createScheduleRouter(scheduleService));
  app.use('/api/v1', createNotificationsRouter(notificationsService));
  app.use('/api/v1', notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
