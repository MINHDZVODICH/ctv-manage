import { apiGet, apiPatch, apiPost, apiDelete, apiUpload } from '../../../shared/api/client';
import { UpdateProfileInput, ChangePasswordInput, ProfileFileKind } from '../types';

export const getMyProfile = async (): Promise<any> => {
  return apiGet('/api/v1/users/me');
};

export const updateMyProfile = async (payload: UpdateProfileInput): Promise<any> => {
  return apiPatch('/api/v1/users/me', payload);
};

export const changePassword = async (payload: ChangePasswordInput): Promise<any> => {
  return apiPost('/api/v1/users/me/password-changes', payload);
};

export const uploadMyFile = async (kind: ProfileFileKind, file: Blob, fileName: string): Promise<any> => {
  const form = new FormData();
  form.append('file', file, fileName);
  return apiUpload(`/api/v1/users/me/files/${kind}`, form, 'PUT');
};

export const deleteMyFile = async (kind: ProfileFileKind): Promise<any> => {
  return apiDelete(`/api/v1/users/me/files/${kind}`);
};
