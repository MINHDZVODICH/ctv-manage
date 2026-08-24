import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuthLocals } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../shared/api-error.js';
import type { StageFileInput } from '../../shared/file-storage.js';
import {
  accountFileParamsSchema,
  accountIdParamsSchema,
  accountListQuerySchema,
  accountNotesSchema,
  accountStatusSchema,
  accountUpdateSchema,
  passwordChangeSchema,
  passwordResetSchema,
  selfFileParamsSchema,
} from './accounts.schemas.js';
import { AccountsService, fileCategoryFromSlug } from './accounts.service.js';

export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  list = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.list(accountListQuerySchema.parse(request.query));
      response.status(200).json({
        data: result.items,
        meta: { page: result.page, pageSize: result.pageSize, total: result.total },
      });
    } catch (error) { next(validationError(error)); }
  };

  detail = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = accountIdParamsSchema.parse(request.params);
      response.status(200).json({ data: await this.service.detail(accountId) });
    } catch (error) { next(validationError(error)); }
  };

  me = async (_request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(200).json({ data: await this.service.me(actor(response).id) });
    } catch (error) { next(error); }
  };

  update = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = accountIdParamsSchema.parse(request.params);
      response.status(200).json({ data: await this.service.update(accountId, accountUpdateSchema.parse(request.body)) });
    } catch (error) { next(validationError(error)); }
  };

  updateMe = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(200).json({ data: await this.service.update(
        actor(response).id,
        accountUpdateSchema.parse(request.body),
        true,
      ) });
    } catch (error) { next(validationError(error)); }
  };

  updateStatus = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = accountIdParamsSchema.parse(request.params);
      response.status(200).json({ data: await this.service.updateStatus(accountId, accountStatusSchema.parse(request.body)) });
    } catch (error) { next(validationError(error)); }
  };

  updateNotes = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = accountIdParamsSchema.parse(request.params);
      response.status(200).json({ data: await this.service.updateNotes(accountId, accountNotesSchema.parse(request.body)) });
    } catch (error) { next(validationError(error)); }
  };

  delete = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = accountIdParamsSchema.parse(request.params);
      await this.service.softDelete(accountId);
      response.status(204).end();
    } catch (error) { next(validationError(error)); }
  };

  changePassword = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(200).json({ data: await this.service.changePassword(
        actor(response).id,
        passwordChangeSchema.parse(request.body),
      ) });
    } catch (error) { next(validationError(error)); }
  };

  resetPassword = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = accountIdParamsSchema.parse(request.params);
      const result = await this.service.resetPassword(
        accountId,
        actor(response).id,
        request.get('idempotency-key') ?? '',
        passwordResetSchema.parse(request.body),
      );
      response.status(result.statusCode).json(result.body);
    } catch (error) { next(validationError(error)); }
  };

  replaceMyFile = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { category } = selfFileParamsSchema.parse(request.params);
      response.status(200).json({ data: await this.service.replaceFile(
        actor(response).id,
        uploadInput(request, fileCategoryFromSlug(category)),
      ) });
    } catch (error) { next(validationError(error)); }
  };

  replaceAccountFile = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId, category } = accountFileParamsSchema.parse(request.params);
      response.status(200).json({ data: await this.service.replaceFile(
        accountId,
        uploadInput(request, fileCategoryFromSlug(category)),
        true,
      ) });
    } catch (error) { next(validationError(error)); }
  };

  deleteMyFile = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { category } = selfFileParamsSchema.parse(request.params);
      await this.service.deleteFile(actor(response).id, fileCategoryFromSlug(category));
      response.status(204).end();
    } catch (error) { next(validationError(error)); }
  };

  deleteAccountFile = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId, category } = accountFileParamsSchema.parse(request.params);
      await this.service.deleteFile(accountId, fileCategoryFromSlug(category), true);
      response.status(204).end();
    } catch (error) { next(validationError(error)); }
  };
}

function actor(response: Response) {
  const account = (response.locals as AuthLocals).auth?.account;
  if (!account) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid session is required.');
  return account;
}

function uploadInput(request: Request, category: StageFileInput['category']): StageFileInput {
  if (!request.file) throw new ApiError(422, 'VALIDATION_FAILED', 'The multipart file part is required.');
  return {
    category,
    originalName: request.file.originalname,
    mimeType: request.file.mimetype,
    buffer: request.file.buffer,
  };
}

function validationError(error: unknown): unknown {
  if (!(error instanceof ZodError)) return error;
  return new ApiError(422, 'VALIDATION_FAILED', 'Request validation failed.', error.flatten());
}
