import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { prisma } from '../../shared/prisma.js';
import { getFilePath } from '../../shared/file-storage.js';
import { ApiError } from '../../shared/api-error.js';

const router = Router();

router.get('/:id/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileId = req.params.id;
    const fileAsset = await prisma.fileAsset.findUnique({
      where: { id: fileId },
    });

    if (!fileAsset || fileAsset.deletedAt) {
      throw ApiError.notFound('Tệp không tồn tại');
    }

    const fullPath = getFilePath(fileAsset.storageKey);
    if (!fs.existsSync(fullPath)) {
      throw ApiError.notFound('Không tìm thấy tệp trên hệ thống lưu trữ');
    }

    res.setHeader('Content-Type', fileAsset.mimeType);
    res.setHeader('Content-Length', fileAsset.sizeBytes);
    // Inline display for images/PDFs
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileAsset.originalName)}"`,
    );

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

export default router;
