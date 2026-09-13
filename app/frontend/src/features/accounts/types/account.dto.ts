export interface AccountFileDto {
  category: string;
  fileId: string;
  createdAt?: string;
  file?: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  } | null;
}

export interface AccountDto {
  id: string;
  email: string;
  displayName: string;
  phone?: string | null;
  ctvCode?: string | null;
  role: string;
  status: string;
  version: number;
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  joinedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  mustChangePassword?: boolean;
  adminNotes?: string | null;
  passwordChangedAt?: string | null;
  files?: AccountFileDto[];
}

export interface AccountListResponse {
  data: AccountDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AccountDetailResponse {
  data: AccountDto;
}

export type AccountStatusType = 'ACTIVE' | 'DISABLED';

export interface AccountMutationResponse {
  data: AccountDto;
}

export interface AccountDeleteResponse {
  data: AccountDto;
}

export interface PasswordResetResponse {
  data: AccountDto;
}

export interface CurrentUserResponse {
  user: AccountDto;
}
