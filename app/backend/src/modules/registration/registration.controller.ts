import type { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import * as registrationService from './registration.service.js';
import { Errors } from '../../shared/errors.js';
import { assertFileMagic } from '../../shared/fileStorage.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const CV_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional() as any);

const createBodySchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  displayName: z.string().trim().min(1, 'displayName là bắt buộc').max(100),
  phone: z.string().trim().min(6, 'Số điện thoại không hợp lệ').max(20),
  dateOfBirth: emptyToUndefined(z.coerce.date()),
  gender: emptyToUndefined(z.string().trim().max(20)),
  address: emptyToUndefined(z.string().trim().max(255)),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

const createHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
    }

    const uploaded = (req.files ?? {}) as Partial<Record<'cccdFront' | 'cccdBack' | 'cv', Express.Multer.File[]>>;
    const cccdFront = uploaded.cccdFront?.[0];
    const cccdBack = uploaded.cccdBack?.[0];
    const cv = uploaded.cv?.[0];

    // CCCD front/back and CV are optional per use case 1.3
    if (cccdFront) {
      if (!IMAGE_MIMES.includes(cccdFront.mimetype)) {
        throw Errors.badRequest('INVALID_FILE_TYPE', 'File CCCD mặt trước phải là ảnh JPEG, PNG hoặc WebP');
      }
      assertFileMagic(cccdFront.buffer, IMAGE_MIMES);
    }
    if (cccdBack) {
      if (!IMAGE_MIMES.includes(cccdBack.mimetype)) {
        throw Errors.badRequest('INVALID_FILE_TYPE', 'File CCCD mặt sau phải là ảnh JPEG, PNG hoặc WebP');
      }
      assertFileMagic(cccdBack.buffer, IMAGE_MIMES);
    }
    if (cv) {
      if (!CV_MIMES.includes(cv.mimetype)) {
        throw Errors.badRequest('INVALID_FILE_TYPE', 'CV phải là PDF, DOC hoặc DOCX');
      }
      assertFileMagic(cv.buffer, CV_MIMES);
    }

    const dto = await registrationService.createRequest(
      {
        emailRaw: parsed.data.email,
        displayName: parsed.data.displayName,
        phone: parsed.data.phone ?? null,
        dateOfBirth: (parsed.data.dateOfBirth as Date | undefined) ?? null,
        gender: parsed.data.gender ?? null,
        address: parsed.data.address ?? null,
        password: parsed.data.password,
      },
      { cccdFront, cccdBack, cv },
    );

    res.status(201).json({ request: dto });
  } catch (e) {
    next(e);
  }
};

export const create: RequestHandler[] = [
  upload.fields([
    { name: 'cccdFront', maxCount: 1 },
    { name: 'cccdBack', maxCount: 1 },
    { name: 'cv', maxCount: 1 },
  ]) as unknown as RequestHandler,
  createHandler,
];

// GET / — list pending requests (ADMIN)
const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw Errors.badRequest('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Tham số truy vấn không hợp lệ');
    }
    const result = await registrationService.listPending(parsed.data as any);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

// PATCH /:requestId — decide
const decideBodySchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  expectedStatus: z.literal('PENDING'),
  rejectionReason: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().max(500).optional() as any) as any,
});

export async function decide(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = decideBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Dữ liệu quyết định không hợp lệ');
    }
    const { requestId } = req.params;
    if (!requestId) throw Errors.badRequest('INVALID_REQUEST_ID', 'Thiếu requestId');
    const user = (req as any).user as { id: string } | undefined;
    if (!user?.id) throw Errors.unauthorized();
    const result = await registrationService.decide(
      requestId,
      parsed.data.decision as 'APPROVED' | 'REJECTED',
      user.id,
      parsed.data.rejectionReason,
    );
    res.json({ request: result });
  } catch (e) {
    next(e);
  }
}
