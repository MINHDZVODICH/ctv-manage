import type { FileCategory } from '@prisma/client';
import type {
  RegistrationRequestWithFiles,
  RegistrationRequestDto,
  RegistrationFileDto,
} from './registration.types.js';

export function toFileDto(rf: {
  category: FileCategory;
  fileId: string;
  fileAsset: { originalName: string; mimeType: string; sizeBytes: number };
}): RegistrationFileDto {
  return {
    category: rf.category,
    fileId: rf.fileId,
    originalName: rf.fileAsset.originalName,
    mimeType: rf.fileAsset.mimeType,
    sizeBytes: rf.fileAsset.sizeBytes,
  };
}

export function toRequestDto(r: RegistrationRequestWithFiles): RegistrationRequestDto {
  return {
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    phone: r.phone,
    dateOfBirth: r.dateOfBirth,
    gender: r.gender,
    address: r.address,
    status: r.status,
    rejectionReason: r.rejectionReason,
    reviewedById: r.reviewedById,
    approvedAccountId: r.approvedAccountId,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    files: (r.files ?? []).map(toFileDto),
  };
}
