import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../../shared/prisma.js';
import { ApiError } from '../../shared/api-error.js';
import { hashPassword } from '../../shared/session.js';
import { formatAccountDto } from './account.dto.js';
import { logAudit } from '../audit/audit.service.js';
import { getFilePath } from '../../shared/file-storage.js';

export interface ListAccountsParams {
  search?: string;
  role?: string;
  status?: string;
}

const saveBase64File = async (base64Str: string, defaultName: string, defaultMime: string, tx?: any) => {
  const db = tx || prisma;
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

  return db.fileAsset.create({
    data: {
      storageKey,
      originalName: defaultName,
      mimeType,
      sizeBytes: buffer.length,
      sha256,
    },
  });
};

export const listAccounts = async (params: ListAccountsParams) => {
  const where: any = {
    deletedAt: null,
  };

  if (params.role) {
    where.role = params.role;
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.search) {
    const s = params.search.trim();
    where.OR = [
      { displayName: { contains: s } },
      { email: { contains: s } },
      { phone: { contains: s } },
      { ctvCode: { contains: s } },
    ];
  }

  const accounts = await prisma.account.findMany({
    where,
    include: {
      skills: { include: { skill: true } },
      files: { include: { file: true } },
      _count: { select: { shiftAssignments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return accounts.map((acc, idx) => formatAccountDto(acc, idx + 1));
};

export const getAccountById = async (id: string) => {
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      skills: { include: { skill: true } },
      files: { include: { file: true } },
      _count: { select: { shiftAssignments: true } },
    },
  });

  if (!account || account.deletedAt) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  return formatAccountDto(account);
};

export const createAccount = async (
  data: {
    name: string;
    email: string;
    phone: string;
    role: string;
    address?: string;
    password?: string;
  },
  adminAccountId: string,
  requestId?: string,
) => {
  const normalizedEmail = data.email.toLowerCase().trim();

  const existing = await prisma.account.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
  });
  if (existing) {
    throw ApiError.conflict('Email đã có người sử dụng trong hệ thống');
  }

  const currentYear = new Date().getFullYear();
  const count = (await prisma.account.count()) + 1;
  const ctvCode = `CTV-${currentYear}-${String(count).padStart(3, '0')}`;
  const passwordHash = await hashPassword(data.password || '12345678');

  const newAccount = await prisma.account.create({
    data: {
      email: normalizedEmail,
      displayName: data.name,
      phone: data.phone,
      role: data.role,
      status: 'Kích hoạt',
      address: data.address,
      ctvCode,
      passwordHash,
      mustChangePassword: true,
    },
    include: {
      skills: { include: { skill: true } },
      files: { include: { file: true } },
    },
  });

  await logAudit({
    actorAccountId: adminAccountId,
    action: 'CREATE_ACCOUNT',
    targetType: 'ACCOUNT',
    targetId: newAccount.id,
    requestId,
    metadata: { email: newAccount.email, role: newAccount.role },
  });

  return formatAccountDto(newAccount);
};

export const toggleAccountStatus = async (
  id: string,
  newStatus?: string,
  adminAccountId?: string,
  requestId?: string,
) => {
  const account = await prisma.account.findUnique({
    where: { id },
  });

  if (!account || account.deletedAt) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  const targetStatus = newStatus || (account.status === 'Kích hoạt' ? 'Vô hiệu hóa' : 'Kích hoạt');

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.account.update({
      where: { id },
      data: { status: targetStatus },
      include: {
        skills: { include: { skill: true } },
        files: { include: { file: true } },
        _count: { select: { shiftAssignments: true } },
      },
    });

    if (targetStatus === 'Vô hiệu hóa') {
      // Revoke sessions
      await tx.session.updateMany({
        where: { accountId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Automatically cancel future shift assignments (workDate >= today)
      const todayISO = new Date().toISOString().split('T')[0];
      await tx.shiftAssignment.updateMany({
        where: {
          accountId: id,
          status: { not: 'CANCELLED' },
          shift: {
            workDate: { gte: todayISO },
          },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: 'Tài khoản bị khóa bởi Quản trị viên',
        },
      });
    }

    return res;
  }, { timeout: 15000 });

  await logAudit({
    actorAccountId: adminAccountId,
    action: targetStatus === 'Vô hiệu hóa' ? 'DEACTIVATE_ACCOUNT' : 'ACTIVATE_ACCOUNT',
    targetType: 'ACCOUNT',
    targetId: id,
    requestId,
    metadata: { previousStatus: account.status, newStatus: targetStatus },
  });

  return formatAccountDto(updated);
};

export const deleteAccount = async (id: string, adminAccountId?: string, requestId?: string) => {
  const account = await prisma.account.findUnique({
    where: { id },
  });

  if (!account || account.deletedAt) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const res = await tx.account.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'Vô hiệu hóa',
      },
    });

    // Revoke sessions
    await tx.session.updateMany({
      where: { accountId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Cancel future shift assignments
    const todayISO = new Date().toISOString().split('T')[0];
    await tx.shiftAssignment.updateMany({
      where: {
        accountId: id,
        status: { not: 'CANCELLED' },
        shift: {
          workDate: { gte: todayISO },
        },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Tài khoản đã bị xóa',
      },
    });

    return res;
  }, { timeout: 15000 });

  await logAudit({
    actorAccountId: adminAccountId,
    action: 'DELETE_ACCOUNT',
    targetType: 'ACCOUNT',
    targetId: id,
    requestId,
    metadata: { email: account.email },
  });

  return deleted;
};

export const changeAccountRole = async (
  id: string,
  newRole: string,
  adminAccountId?: string,
  requestId?: string,
) => {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.deletedAt) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  const updated = await prisma.account.update({
    where: { id },
    data: { role: newRole },
    include: {
      skills: { include: { skill: true } },
      files: { include: { file: true } },
      _count: { select: { shiftAssignments: true } },
    },
  });

  await logAudit({
    actorAccountId: adminAccountId,
    action: 'CHANGE_ROLE',
    targetType: 'ACCOUNT',
    targetId: id,
    requestId,
    metadata: { oldRole: account.role, newRole },
  });

  return formatAccountDto(updated);
};

export const adminResetPassword = async (
  id: string,
  newPass: string,
  mustChange: boolean,
  adminAccountId?: string,
  requestId?: string,
) => {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.deletedAt) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  const newHash = await hashPassword(newPass);
  const logEntry = `[${new Date().toLocaleDateString('vi-VN')}] Đặt lại mật khẩu mặc định mới (Yêu cầu đổi MK: ${mustChange ? 'Có' : 'Không'})`;
  const newNotes = account.adminNotes ? `${account.adminNotes}\n${logEntry}` : logEntry;

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id },
      data: {
        passwordHash: newHash,
        mustChangePassword: mustChange,
        adminNotes: newNotes,
        passwordChangedAt: new Date(),
      },
    });

    await tx.session.updateMany({
      where: { accountId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }, { timeout: 15000 });

  await logAudit({
    actorAccountId: adminAccountId,
    action: 'ADMIN_RESET_PASSWORD',
    targetType: 'ACCOUNT',
    targetId: id,
    requestId,
  });

  return { success: true, message: 'Đã đặt lại mật khẩu thành công' };
};

export const saveAccountNotes = async (
  id: string,
  notes: string,
  adminAccountId?: string,
  requestId?: string,
) => {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.deletedAt) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  const updated = await prisma.account.update({
    where: { id },
    data: { adminNotes: notes },
    include: {
      skills: { include: { skill: true } },
      files: { include: { file: true } },
      _count: { select: { shiftAssignments: true } },
    },
  });

  await logAudit({
    actorAccountId: adminAccountId,
    action: 'UPDATE_ACCOUNT_NOTES',
    targetType: 'ACCOUNT',
    targetId: id,
    requestId,
  });

  return formatAccountDto(updated);
};

export const endAccountSchedule = async (
  id: string,
  startDate: string,
  endDate: string,
  reason: string = '',
  adminAccountId?: string,
  requestId?: string,
) => {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.deletedAt) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  const logEntry = `[Kết thúc lịch: ${startDate} - ${endDate} | Lý do: ${reason.trim() || 'Không có lý do ghi chú'}]`;
  const newNotes = account.adminNotes ? `${account.adminNotes}\n${logEntry}` : logEntry;

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Cancel future shift assignments where workDate > endDate
    await tx.shiftAssignment.updateMany({
      where: {
        accountId: id,
        status: { not: 'CANCELLED' },
        shift: {
          workDate: { gt: endDate },
        },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: `Kết thúc lịch làm việc: ${reason}`,
      },
    });

    // 2. Mark active schedule registrations as CANCELLED or EXPIRED
    await tx.scheduleRegistration.updateMany({
      where: {
        accountId: id,
        status: 'ACTIVE',
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // 3. Update account notes
    const res = await tx.account.update({
      where: { id },
      data: { adminNotes: newNotes },
      include: {
        skills: { include: { skill: true } },
        files: { include: { file: true } },
        _count: { select: { shiftAssignments: true } },
      },
    });

    return res;
  }, { timeout: 15000 });

  await logAudit({
    actorAccountId: adminAccountId,
    action: 'END_SCHEDULE',
    targetType: 'ACCOUNT',
    targetId: id,
    requestId,
    metadata: { startDate, endDate, reason },
  });

  return formatAccountDto(updated);
};

export const updateProfile = async (
  accountId: string,
  data: {
    name?: string;
    phone?: string;
    dob?: string;
    gender?: string;
    cccd?: string;
    address?: string;
    skills?: string[];
    notes?: string;
    cccdFrontBase64?: string;
    cccdBackBase64?: string;
    cvFileBase64?: string;
    cvFileName?: string;
    avatarBase64?: string;
  },
  requestId?: string,
) => {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.deletedAt) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updateData: any = {};
    if (data.name) updateData.displayName = data.name;
    if (data.phone) updateData.phone = data.phone;
    if (data.dob !== undefined) updateData.dateOfBirth = data.dob;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.cccd !== undefined) updateData.citizenId = data.cccd;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.notes !== undefined) updateData.adminNotes = data.notes;

    // Handle skills if provided
    if (data.skills) {
      await tx.accountSkill.deleteMany({ where: { accountId } });
      for (const skillName of data.skills) {
        if (!skillName.trim()) continue;
        const skill = await tx.skill.upsert({
          where: { name: skillName.trim() },
          create: { name: skillName.trim() },
          update: {},
        });
        await tx.accountSkill.create({
          data: { accountId, skillId: skill.id },
        });
      }
    }

    // Handle base64 uploads if present
    if (data.avatarBase64) {
      const asset = await saveBase64File(data.avatarBase64, 'avatar.jpg', 'image/jpeg', tx);
      await tx.accountFile.deleteMany({ where: { accountId, category: 'AVATAR' } });
      await tx.accountFile.create({
        data: { accountId, fileId: asset.id, category: 'AVATAR' },
      });
    }

    if (data.cccdFrontBase64) {
      const asset = await saveBase64File(data.cccdFrontBase64, 'cccd_front.jpg', 'image/jpeg', tx);
      await tx.accountFile.deleteMany({ where: { accountId, category: 'CCCD_FRONT' } });
      await tx.accountFile.create({
        data: { accountId, fileId: asset.id, category: 'CCCD_FRONT' },
      });
    }

    if (data.cccdBackBase64) {
      const asset = await saveBase64File(data.cccdBackBase64, 'cccd_back.jpg', 'image/jpeg', tx);
      await tx.accountFile.deleteMany({ where: { accountId, category: 'CCCD_BACK' } });
      await tx.accountFile.create({
        data: { accountId, fileId: asset.id, category: 'CCCD_BACK' },
      });
    }

    if (data.cvFileBase64) {
      const fileName = data.cvFileName || 'cv_document.pdf';
      const asset = await saveBase64File(data.cvFileBase64, fileName, 'application/pdf', tx);
      await tx.accountFile.deleteMany({ where: { accountId, category: 'CV' } });
      await tx.accountFile.create({
        data: { accountId, fileId: asset.id, category: 'CV' },
      });
    }

    const res = await tx.account.update({
      where: { id: accountId },
      data: updateData,
      include: {
        skills: { include: { skill: true } },
        files: { include: { file: true } },
        _count: { select: { shiftAssignments: true } },
      },
    });

    return res;
  }, { timeout: 15000 });

  await logAudit({
    actorAccountId: accountId,
    action: 'UPDATE_PROFILE',
    targetType: 'ACCOUNT',
    targetId: accountId,
    requestId,
  });

  return formatAccountDto(updated);
};

export const updateAccountFile = async (
  accountId: string,
  category: 'AVATAR' | 'CCCD_FRONT' | 'CCCD_BACK' | 'CV',
  file?: Express.Multer.File,
) => {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.accountFile.deleteMany({
      where: { accountId, category },
    });

    if (file) {
      const asset = await tx.fileAsset.create({
        data: {
          storageKey: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });

      await tx.accountFile.create({
        data: {
          accountId,
          fileId: asset.id,
          category,
        },
      });
    }

    const res = await tx.account.findUnique({
      where: { id: accountId },
      include: {
        skills: { include: { skill: true } },
        files: { include: { file: true } },
        _count: { select: { shiftAssignments: true } },
      },
    });

    return res;
  }, { timeout: 15000 });

  return formatAccountDto(updated!);
};
