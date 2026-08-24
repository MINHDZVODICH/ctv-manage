import type { FileAsset, RegistrationRequest, RegistrationRequestFile } from '@prisma/client';

type RequestWithFiles = RegistrationRequest & {
  files: Array<RegistrationRequestFile & { file: FileAsset }>;
};

export function toRegistrationSummaryDto(request: RegistrationRequest) {
  return {
    id: request.id,
    displayName: request.displayName,
    email: request.email,
    phone: request.phone,
    dateOfBirth: request.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    status: request.status,
    submittedAt: request.submittedAt.toISOString(),
  };
}

export function toRegistrationDetailDto(request: RequestWithFiles) {
  return {
    ...toRegistrationSummaryDto(request),
    gender: request.gender,
    address: request.address,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    rejectionReason: request.rejectionReason,
    files: request.files.map(({ category, file }) => ({
      id: file.id,
      category,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    })),
  };
}

export function toRegistrationCreatedDto(request: RegistrationRequest) {
  return {
    id: request.id,
    status: request.status,
    submittedAt: request.submittedAt.toISOString(),
  };
}

export function toRegistrationDecisionDto(request: RegistrationRequest) {
  return {
    id: request.id,
    status: request.status,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    approvedAccountId: request.approvedAccountId,
  };
}
