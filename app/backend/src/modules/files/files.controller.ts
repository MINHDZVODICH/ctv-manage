import type { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import * as filesService from './files.service.js';
import { Errors } from '../../shared/errors.js';
import { fileExists, downloadFile } from '../../shared/fileStorage.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

function parseCategory(raw: string): filesService.FileCategory {
  if (!filesService.isFileCategory(raw)) {
    throw Errors.badRequest('INVALID_CATEGORY', 'Danh mục tệp không hợp lệ');
  }
  return raw as filesService.FileCategory;
}

function requireUser(req: Request) {
  const user = req.user;
  if (!user) throw Errors.unauthorized();
  return user;
}

// GET /files/:fileId/content — authorize then send buffer with Content-Type/Disposition
export async function getContent(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const { fileId } = req.params;
    if (!fileId) throw Errors.badRequest('INVALID_FILE_ID', 'Thiếu fileId');
    const info = await filesService.authorizeFile(user.id, user.role, fileId);
    if (!(await fileExists(info.storageKey))) {
      throw Errors.notFound('Tệp không tồn tại trên hệ thống lưu trữ');
    }
    const buffer = await downloadFile(info.storageKey);
    res.setHeader('Content-Type', info.mimeType);
    res.setHeader('Content-Length', String(info.sizeBytes));
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(info.originalName)}`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
}

// PUT /users/me/files/:category — upload for own account
const putMyFileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const category = parseCategory(req.params.category as string);
    if (!req.file) throw Errors.badRequest('MISSING_FILE', 'Vui lòng gửi tệp (trường "file")');
    const dto = await filesService.uploadFileForAccount(user.id, category, req.file);
    res.status(201).json({ file: dto });
  } catch (e) {
    next(e);
  }
};
export const putMyFile: RequestHandler[] = [
  upload.single('file') as unknown as RequestHandler,
  putMyFileHandler,
];

// DELETE /users/me/files/:category
export async function deleteMyFile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const category = parseCategory(req.params.category as string);
    await filesService.deleteFileForAccount(user.id, category);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

// PUT /accounts/:accountId/files/:category — ADMIN
const putAccountFileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireUser(req); // role enforced in routes
    const category = parseCategory(req.params.category as string);
    const accountId = req.params.accountId as string;
    if (!accountId) throw Errors.badRequest('INVALID_ACCOUNT_ID', 'Thiếu accountId');
    if (!req.file) throw Errors.badRequest('MISSING_FILE', 'Vui lòng gửi tệp (trường "file")');
    const dto = await filesService.uploadFileForAccount(accountId, category, req.file);
    res.status(201).json({ file: dto });
  } catch (e) {
    next(e);
  }
};
export const putAccountFile: RequestHandler[] = [
  upload.single('file') as unknown as RequestHandler,
  putAccountFileHandler,
];

// DELETE /accounts/:accountId/files/:category — ADMIN
export async function deleteAccountFile(req: Request, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const category = parseCategory(req.params.category as string);
    const accountId = req.params.accountId as string;
    if (!accountId) throw Errors.badRequest('INVALID_ACCOUNT_ID', 'Thiếu accountId');
    await filesService.deleteFileForAccount(accountId, category);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
