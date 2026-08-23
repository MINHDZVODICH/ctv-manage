import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

// Route modules
import authRoutes from './modules/auth/auth.routes.js';
import accountsRoutes from './modules/accounts/accounts.routes.js';
import usersRoutes from './modules/accounts/users.routes.js';
import registrationRequestsRoutes from './modules/registration-requests/registration-requests.routes.js';
import schedulesRoutes from './modules/schedules/schedule.routes.js';
import filesRoutes from './modules/files/files.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';

export const createApp = () => {
  const app = express();

  // Basic security & parsing middlewares
  app.use(
    cors({
      origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        process.env.FRONTEND_URL || 'http://localhost:3000',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    }),
  );

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API v1 Routes
  const apiRouter = express.Router();
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/accounts', accountsRoutes);
  apiRouter.use('/users', usersRoutes);
  apiRouter.use('/registration-requests', registrationRequestsRoutes);
  apiRouter.use('/files', filesRoutes);
  apiRouter.use('/notifications', notificationsRoutes);
  apiRouter.use('/', schedulesRoutes);

  app.use('/api/v1', apiRouter);

  // Central Error Handler
  app.use(errorHandler);

  return app;
};
