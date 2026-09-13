export interface UpdateProfileInput {
  displayName?: string;
  phone?: string;
  address?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | string;
  dateOfBirth?: string;
  expectedVersion?: number;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export type ProfileFileKind = 'AVATAR' | 'CCCD_FRONT' | 'CCCD_BACK' | 'CV';

export interface UserProfileResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    phone?: string | null;
    role: string;
    status: string;
    version: number;
    mustChangePassword?: boolean;
    ctvCode?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    address?: string | null;
    joinedAt?: string | null;
    lastLoginAt?: string | null;
    createdAt?: string | null;
    files?: Array<{
      category: string;
      fileId: string;
      createdAt?: string;
      file?: {
        id: string;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
      } | null;
    }>;
  };
}
