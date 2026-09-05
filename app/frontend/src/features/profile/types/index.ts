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
