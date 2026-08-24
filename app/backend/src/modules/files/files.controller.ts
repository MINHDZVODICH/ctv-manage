import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuthLocals } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../shared/api-error.js';
import { fileIdParamsSchema } from '../accounts/accounts.schemas.js';
import { AccountsService } from '../accounts/accounts.service.js';

export class FilesController {
  constructor(private readonly service: AccountsService) {}

  content = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { fileId } = fileIdParamsSchema.parse(request.params);
      const auth = (response.locals as AuthLocals).auth;
      if (!auth) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid session is required.');
      const opened = await this.service.openFile(fileId, { id: auth.account.id, role: auth.account.role });
      response.setHeader('Content-Type', opened.file.mimeType);
      response.setHeader('Content-Length', String(opened.file.sizeBytes));
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('Content-Disposition', contentDisposition(opened.file.originalName, opened.file.mimeType));
      response.sendFile(opened.path, (error) => { if (error) next(error); });
    } catch (error) {
      next(error instanceof ZodError
        ? new ApiError(422, 'VALIDATION_FAILED', 'Request validation failed.', error.flatten())
        : error);
    }
  };
}

function contentDisposition(originalName: string, mimeType: string): string {
  const mode = mimeType.startsWith('image/') || mimeType === 'application/pdf' ? 'inline' : 'attachment';
  const fallback = originalName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'download';
  const encoded = encodeURIComponent(originalName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
