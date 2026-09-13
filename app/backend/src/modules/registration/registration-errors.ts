import { Prisma } from '@prisma/client';
import { Errors } from '../../shared/errors.js';

/**
 * Accurately translates Prisma database errors into domain-specific AppErrors.
 * Specifically distinguishes between CTV code collisions, account email uniqueness,
 * and pending registration uniqueness.
 */
export function translateRegistrationPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const meta = error.meta as { target?: string[] | string; modelName?: string } | undefined;
    const target = Array.isArray(meta?.target)
      ? meta.target.join(',')
      : typeof meta?.target === 'string'
        ? meta.target
        : '';

    if (target.includes('ctvCode') || target.includes('Account_ctvCode_key')) {
      throw Errors.conflict('CTV_CODE_ALREADY_EXISTS', 'Mã CTV đã tồn tại trong hệ thống');
    }

    if (
      target.includes('RegistrationRequest_pending_email_key') ||
      (meta?.modelName === 'RegistrationRequest' && target.includes('email'))
    ) {
      throw Errors.conflict('EMAIL_ALREADY_EXISTS', 'Email đã tồn tại hoặc đang chờ duyệt');
    }

    if (target.includes('email') || target.includes('Account_email_key')) {
      throw Errors.conflict('EMAIL_ALREADY_EXISTS', 'Email đã tồn tại trong hệ thống');
    }

    throw Errors.conflict('UNIQUE_CONSTRAINT_VIOLATION', 'Dữ liệu bị trùng lặp trong hệ thống');
  }

  throw error;
}
