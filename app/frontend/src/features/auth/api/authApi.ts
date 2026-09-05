import { apiGet, apiPost, apiDelete, apiUpload } from '../../../shared/api/client';
import type { AuthUser, LoginCredentials } from '../types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ user: AuthUser }> => {
    const res: any = await apiPost('/api/v1/auth/sessions', credentials);
    return { user: res.user ?? res.data ?? res };
  },

  logout: async (): Promise<void> => {
    await apiDelete('/api/v1/auth/sessions/current');
  },

  getMe: async (): Promise<{ user: AuthUser }> => {
    const res: any = await apiGet('/api/v1/auth/sessions/me');
    return { user: res.user ?? res.data ?? res };
  },

  register: async (form: FormData): Promise<void> => {
    await apiUpload('/api/v1/registration-requests', form, 'POST');
  },
};
