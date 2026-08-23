import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../shared/prisma.js';
import { ApiError } from '../../shared/api-error.js';
import { hashPassword } from '../../shared/session.js';
import { formatRequestDto } from './registration-requests.dto.js';
import { logAudit } from '../audit/audit.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { getFilePath } from '../../shared/file-storage.js';

export interface SubmitRegistrationParams {
  name: string;
  email: string;
  phone: string;
  dob?: string;
  citizenId?: string;
  address?: string;
  experience?: string;
  password?: string;
  files?: {
    cccdFront?: Express.Multer.File;
    cccdBack?: Express.Multer.File;
    cvFile?: Express.Multer.File;
    // or base64 fallbacks
    cccdFrontBase64?: string;
    cccdBackBase64?: string;
    cvFileBase64?: string;
    cvFileName?: string;
  };
}

// Helper to save base64 data to FileAsset
const saveBase64File = async (base64Str: string, defaultName: string, defaultMime: string) => {
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let mimeType = defaultMime;
  let buffer: Buffer;

  if (matches && matches.length === 3) {
    mimeType = matches[1];
    buffer = Buffer.from(matches[2], 'base64');
  } else {
    buffer = Buffer.from(base64Str, 'base64');
  }

  const storageKey = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${defaultName}`;
  const uploadPath = getFilePath(storageKey);
  fs.writeFileSync(uploadPath, buffer);

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  return prisma.fileAsset.create({
    data: {
      storageKey,
      originalName: defaultName,
      mimeType,
      sizeBytes: buffer.length,
      sha256,
    },
  });
};

export const submitRegistration = async (params: SubmitRegistrationParams, requestId?: string) => {
  const normalizedEmail = params.email.toLowerCase().trim();

  // 1. Check if email already exists in active Accounts
  const existingAccount = await prisma.account.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
  });
  if (existingAccount) {
    throw ApiError.conflict('Email đã có người sử dụng. Vui lòng chọn email khác!');
  }

  // 2. Check if a PENDING registration request already exists
  const existingPending = await prisma.registrationRequest.findFirst({
    where: { email: normalizedEmail, status: 'PENDING' },
  });
  if (existingPending) {
    throw ApiError.conflict('Hồ sơ đăng ký của bạn đang trong trạng thái chờ duyệt');
  }

  return prisma.$transaction(async (tx) => {
    const reg = await tx.registrationRequest.create({
      data: {
        displayName: params.name,
        email: normalizedEmail,
        phone: params.phone,
        dateOfBirth: params.dob,
        citizenId: params.citizenId,
        address: params.address,
        experience: params.experience,
        status: 'PENDING',
      },
    });

    // Handle files
    const fileLinks: Array<{ fileId: string; category: string }> = [];

    if (params.files?.cccdFront) {
      const asset = await tx.fileAsset.create({
        data: {
          storageKey: params.files.cccdFront.filename,
          originalName: params.files.cccdFront.originalname,
          mimeType: params.files.cccdFront.mimetype,
          sizeBytes: params.files.cccdFront.size,
        },
      });
      fileLinks.push({ fileId: asset.id, category: 'CCCD_FRONT' });
    } else if (params.files?.cccdFrontBase64) {
      const asset = await saveBase64File(params.files.cccdFrontBase64, 'cccd_front.jpg', 'image/jpeg');
      fileLinks.push({ fileId: asset.id, category: 'CCCD_FRONT' });
    }

    if (params.files?.cccdBack) {
      const asset = await tx.fileAsset.create({
        data: {
          storageKey: params.files.cccdBack.filename,
          originalName: params.files.cccdBack.originalname,
          mimeType: params.files.cccdBack.mimetype,
          sizeBytes: params.files.cccdBack.size,
        },
      });
      fileLinks.push({ fileId: asset.id, category: 'CCCD_BACK' });
    } else if (params.files?.cccdBackBase64) {
      const asset = await saveBase64File(params.files.cccdBackBase64, 'cccd_back.jpg', 'image/jpeg');
      fileLinks.push({ fileId: asset.id, category: 'CCCD_BACK' });
    }

    if (params.files?.cvFile) {
      const asset = await tx.fileAsset.create({
        data: {
          storageKey: params.files.cvFile.filename,
          originalName: params.files.cvFile.originalname,
          mimeType: params.files.cvFile.mimetype,
          sizeBytes: params.files.cvFile.size,
        },
      });
      fileLinks.push({ fileId: asset.id, category: 'CV' });
    } else if (params.files?.cvFileBase64) {
      const fileName = params.files.cvFileName || 'cv_document.pdf';
      const asset = await saveBase64File(params.files.cvFileBase64, fileName, 'application/pdf');
      fileLinks.push({ fileId: asset.id, category: 'CV' });
    }

    for (const link of fileLinks) {
      await tx.registrationRequestFile.create({
        data: {
          requestId: reg.id,
          fileId: link.fileId,
          category: link.category,
        },
      });
    }

    // Notify all admin accounts
    const admins = await tx.account.findMany({
      where: { role: 'Admin', deletedAt: null },
    });
    for (const admin of admins) {
      await tx.notification.create({
        data: {
          accountId: admin.id,
          type: 'info',
          title: 'Yêu cầu đăng ký mới',
          message: `${params.name} vừa gửi hồ sơ ứng tuyển CTV (có đính kèm CCCD & CV).`,
          sourceType: 'REGISTRATION_REQUEST',
          sourceId: reg.id,
        },
      });
    }

    return reg;
  });
};

export const listRegistrationRequests = async (status?: string) => {
  const where: any = {};
  if (status && status !== 'ALL') {
    where.status = status;
  }

  const requests = await prisma.registrationRequest.findMany({
    where,
    include: {
      files: { include: { file: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });

  return requests.map((req, idx) => formatRequestDto(req, idx + 1));
};

export const getRegistrationRequestById = async (id: string) => {
  const req = await prisma.registrationRequest.findUnique({
    where: { id },
    include: {
      files: { include: { file: true } },
      reviewedBy: true,
      approvedAccount: true,
    },
  });

  if (!req) {
    throw ApiError.notFound('Hồ sơ đăng ký không tồn tại');
  }

  return formatRequestDto(req);
};

export const approveRegistrationRequest = async (
  id: string,
  reviewerAccountId: string,
  requestId?: string,
) => {
  const defaultPasswordHash = await hashPassword('12345678');

  const newAccount = await prisma.$transaction(
    async (tx) => {
      const reg = await tx.registrationRequest.findUnique({
        where: { id },
        include: {
          files: { include: { file: true } },
        },
      });

      if (!reg) {
        throw ApiError.notFound('Hồ sơ đăng ký không tồn tại');
      }

      if (reg.status !== 'PENDING') {
        throw ApiError.conflict(`Hồ sơ đã được xử lý trước đó (${reg.status})`);
      }

      // Check if account already exists
      const existing = await tx.account.findFirst({
        where: { email: reg.email, deletedAt: null },
      });
      if (existing) {
        throw ApiError.conflict('Tài khoản với email này đã tồn tại trong hệ thống');
      }

      const currentYear = new Date().getFullYear();
      const count = (await tx.account.count()) + 1;
      const ctvCode = `CTV-${currentYear}-${String(count).padStart(3, '0')}`;

      // Create Account
      const newAccount = await tx.account.create({
        data: {
          email: reg.email,
          displayName: reg.displayName,
          phone: reg.phone,
          dateOfBirth: reg.dateOfBirth,
          citizenId: reg.citizenId,
          address: reg.address,
          role: 'Cộng tác viên',
          status: 'Kích hoạt',
          ctvCode,
          passwordHash: defaultPasswordHash,
          mustChangePassword: true,
        },
      });

    // Transfer file links to AccountFile
    for (const rf of reg.files) {
      await tx.accountFile.create({
        data: {
          accountId: newAccount.id,
          fileId: rf.fileId,
          category: rf.category,
        },
      });
    }

    // Update Registration Request
    await tx.registrationRequest.update({
      where: { id: reg.id },
      data: {
        status: 'APPROVED',
        reviewedById: reviewerAccountId,
        approvedAccountId: newAccount.id,
        reviewedAt: new Date(),
      },
    });

    // Create notification for new user
    await tx.notification.create({
      data: {
        accountId: newAccount.id,
        type: 'success',
        title: 'Hồ sơ đã được duyệt',
        message: 'Chúc mừng bạn! Hồ sơ cộng tác viên của bạn đã được phê duyệt thành công.',
        sourceType: 'ACCOUNT',
        sourceId: newAccount.id,
      },
    });

    return newAccount;
  }, { timeout: 15000 });

  await logAudit({
    actorAccountId: reviewerAccountId,
    action: 'APPROVE_REGISTRATION',
    targetType: 'REGISTRATION_REQUEST',
    targetId: id,
    requestId,
    metadata: { newAccountId: newAccount.id, email: newAccount.email },
  });

  return newAccount;
};

export const rejectRegistrationRequest = async (
  id: string,
  reason: string,
  reviewerAccountId: string,
  requestId?: string,
) => {
  const reg = await prisma.registrationRequest.findUnique({
    where: { id },
  });

  if (!reg) {
    throw ApiError.notFound('Hồ sơ đăng ký không tồn tại');
  }

  if (reg.status !== 'PENDING') {
    throw ApiError.conflict(`Hồ sơ đã được xử lý trước đó (${reg.status})`);
  }

  const updated = await prisma.registrationRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason: reason || 'Hồ sơ chưa đáp ứng đủ điều kiện yêu cầu.',
      reviewedById: reviewerAccountId,
      reviewedAt: new Date(),
    },
  });

  await logAudit({
    actorAccountId: reviewerAccountId,
    action: 'REJECT_REGISTRATION',
    targetType: 'REGISTRATION_REQUEST',
    targetId: id,
    requestId,
    metadata: { reason },
  });

  return updated;
};
