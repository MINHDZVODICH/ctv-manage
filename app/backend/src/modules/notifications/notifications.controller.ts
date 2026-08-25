import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuthLocals } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../shared/api-error.js';
import { notificationIdParamsSchema, notificationListQuerySchema, notificationReadSchema } from './notifications.schemas.js';
import { NotificationsService } from './notifications.service.js';

export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  list = async (request: Request, response: Response, next: NextFunction) => {
    try { const value = await this.service.list(actor(response).id, notificationListQuerySchema.parse(request.query)); response.status(200).json({ data: value.items, meta: { page: value.page, pageSize: value.pageSize, total: value.total } }); }
    catch (error) { next(validationError(error)); }
  };
  updateRead = async (request: Request, response: Response, next: NextFunction) => {
    try { const { notificationId } = notificationIdParamsSchema.parse(request.params); const { read } = notificationReadSchema.parse(request.body); response.status(200).json({ data: await this.service.setRead(actor(response).id, notificationId, read) }); }
    catch (error) { next(validationError(error)); }
  };
}
function actor(response: Response) { const account = (response.locals as AuthLocals).auth?.account; if (!account) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid session is required.'); return account; }
function validationError(error: unknown): unknown { return error instanceof ZodError ? new ApiError(422, 'VALIDATION_FAILED', 'Request validation failed.', error.flatten()) : error; }
