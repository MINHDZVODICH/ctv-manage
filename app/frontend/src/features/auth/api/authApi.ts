import { apiGet, apiPost, apiDelete, apiUpload } from '../../../shared/api/client';
import type { AuthUser, LoginCredentials } from '../types';
import type { AuthSessionResponse } from '../../../shared/api/types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ user: AuthUser }> => {
    const res = await apiPost<AuthSessionResponse>('/api/v1/auth/sessions', credentials);
    return { user: res.user };
  },

  logout: async (): Promise<void> => {
    await apiDelete<void>('/api/v1/auth/sessions/current');
  },

  getMe: async (): Promise<{ user: AuthUser }> => {
    const res = await apiGet<AuthSessionResponse>('/api/v1/auth/sessions/me');
    return { user: res.user };
  },

  register: async (form: FormData): Promise<void> => {
    await apiUpload('/api/v1/registration-requests', form, 'POST');
  },
};
