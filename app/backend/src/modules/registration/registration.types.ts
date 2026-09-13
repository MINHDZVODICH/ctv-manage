import type {
  RegistrationRequest,
  FileAsset,
  RegistrationRequestFile,
  RegistrationStatus,
  FileCategory,
} from '@prisma/client';

export const FILE_CATEGORY_BY_FIELD = {
  cccdFront: 'CCCD_FRONT',
  cccdBack: 'CCCD_BACK',
  cv: 'CV',
} as const satisfies Record<string, FileCategory>;

export type RegistrationFileField = keyof typeof FILE_CATEGORY_BY_FIELD;

export interface CreateRegistrationInput {
  emailRaw: string;
  displayName: string;
  phone?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  address?: string | null;
  password: string;
}

export interface RegistrationFilesInput {
  cccdFront?: Express.Multer.File;
  cccdBack?: Express.Multer.File;
  cv?: Express.Multer.File;
}

export interface RegistrationFileDto {
  category: FileCategory;
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RegistrationRequestDto {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  status: RegistrationStatus;
  rejectionReason: string | null;
  reviewedById: string | null;
  approvedAccountId: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  files: RegistrationFileDto[];
}

export interface RegistrationDecisionResultDto extends RegistrationRequestDto {
  approvedAccount?: {
    id: string;
    email: string;
    ctvCode: string | null;
  };
}

export interface ListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  status?: RegistrationStatus;
}

export type RegistrationRequestWithFiles = RegistrationRequest & {
  files: Array<RegistrationRequestFile & { fileAsset: FileAsset }>;
};
