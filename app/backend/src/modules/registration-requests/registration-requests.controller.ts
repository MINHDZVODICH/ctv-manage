import type { FileCategory } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuthLocals } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../shared/api-error.js';
import { type FileStorage, type StagedFile } from '../../shared/file-storage.js';
import {
  registrationDecisionSchema,
  registrationListQuerySchema,
  registrationProfileSchema,
  registrationRequestParamsSchema,
} from './registration-requests.schemas.js';
import { RegistrationRequestsService } from './registration-requests.service.js';

const categoryByField: Record<string, FileCategory> = {
  cccdFront: 'CCCD_FRONT',
  cccdBack: 'CCCD_BACK',
  cv: 'CV',
};

export class RegistrationRequestsController {
  constructor(
    private readonly service: RegistrationRequestsService,
    private readonly fileStorage: FileStorage,
  ) {}

  create = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const staged: StagedFile[] = [];
    try {
      const key = request.get('idempotency-key') ?? '';
      const rawProfile = request.body?.profile;
      if (typeof rawProfile !== 'string') {
        throw new ApiError(422, 'VALIDATION_FAILED', 'The multipart profile field is required.');
      }
      let parsedProfile: unknown;
      try {
        parsedProfile = JSON.parse(rawProfile);
      } catch {
        throw new ApiError(422, 'VALIDATION_FAILED', 'The multipart profile field must contain valid JSON.');
      }
      const profile = registrationProfileSchema.parse(parsedProfile);
      const files = Object.values(request.files ?? {}).flat() as Express.Multer.File[];
      for (const file of files) {
        staged.push(await this.fileStorage.stage({
          category: categoryByField[file.fieldname],
          originalName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
        }));
      }
      const result = await this.service.create(key, profile, staged);
      response.status(result.statusCode).json(result.body);
    } catch (error) {
      await Promise.allSettled(staged.map((file) => this.fileStorage.discard(file)));
      next(normalizeValidationError(error));
    }
  };

  list = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(200).json({ data: await this.service.list(registrationListQuerySchema.parse(request.query)) });
    } catch (error) {
      next(normalizeValidationError(error));
    }
  };

  detail = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { requestId } = registrationRequestParamsSchema.parse(request.params);
      response.status(200).json({ data: await this.service.detail(requestId) });
    } catch (error) {
      next(normalizeValidationError(error));
    }
  };

  decide = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { requestId } = registrationRequestParamsSchema.parse(request.params);
      const input = registrationDecisionSchema.parse(request.body);
      const auth = (response.locals as AuthLocals).auth!;
      response.status(200).json({ data: await this.service.decide(requestId, auth.account.id, input) });
    } catch (error) {
      next(normalizeValidationError(error));
    }
  };
}

function normalizeValidationError(error: unknown): unknown {
  if (!(error instanceof ZodError)) return error;
  return new ApiError(422, 'VALIDATION_FAILED', 'Request validation failed.', error.flatten());
}
