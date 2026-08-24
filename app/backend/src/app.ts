import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';
import { originMiddleware } from './middleware/origin.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { config } from './config.js';
import { logger } from './shared/logger.js';

export interface AppDependencies {
  logger?: Logger;
  now?: () => Date;
}

export function createApp(deps: AppDependencies = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cors({
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
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
  app.use('/api/v1', notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
