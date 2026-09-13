import { apiGet, apiPatch, apiPost, apiDelete, apiUpload } from '../../../shared/api/client';
import type {
  UpdateProfileInput,
  ChangePasswordInput,
  ProfileFileKind,
  UserProfileResponse,
} from '../types';

export const getMyProfile = async (): Promise<UserProfileResponse> => {
  return apiGet<UserProfileResponse>('/api/v1/users/me');
};

export const updateMyProfile = async (
  payload: UpdateProfileInput,
): Promise<UserProfileResponse> => {
  return apiPatch<UserProfileResponse>('/api/v1/users/me', payload);
};

export const changePassword = async (
  payload: ChangePasswordInput,
): Promise<UserProfileResponse> => {
  return apiPost<UserProfileResponse>('/api/v1/users/me/password-changes', payload);
};

export const uploadMyFile = async (
  kind: ProfileFileKind,
  file: Blob,
  fileName: string,
): Promise<{ data: { category: string; fileId: string } }> => {
  const form = new FormData();
  form.append('file', file, fileName);
  return apiUpload<{ data: { category: string; fileId: string } }>(
    `/api/v1/users/me/files/${kind}`,
    form,
    'PUT',
  );
};

export const deleteMyFile = async (kind: ProfileFileKind): Promise<void> => {
  return apiDelete<void>(`/api/v1/users/me/files/${kind}`);
};
