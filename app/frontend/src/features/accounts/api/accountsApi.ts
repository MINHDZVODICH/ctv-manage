import { apiGet, apiPatch, apiPost, apiDelete } from '../../../shared/api/client';
import type { AccountFilters } from '../types';

export const accountsApi = {
  listAccounts: async (filters: AccountFilters = {}): Promise<any> => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status) params.set('status', filters.status);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiGet(`/api/v1/accounts${qs}`);
  },

  getAccount: async (id: string): Promise<any> => {
    return apiGet(`/api/v1/accounts/${id}`);
  },

  updateAccount: async (id: string, data: any): Promise<any> => {
    return apiPatch(`/api/v1/accounts/${id}`, data);
  },

  updateNotes: async (id: string, adminNotes: string | null, expectedVersion?: number): Promise<any> => {
    return apiPatch(`/api/v1/accounts/${id}/notes`, { adminNotes, expectedVersion });
  },

  changeStatus: async (id: string, status: string, expectedVersion?: number): Promise<any> => {
    return apiPatch(`/api/v1/accounts/${id}/status`, { status, expectedVersion });
  },

  resetPassword: async (id: string, newPassword: string, mustChangePassword?: boolean): Promise<any> => {
    return apiPost(`/api/v1/accounts/${id}/password-resets`, { newPassword, mustChangePassword });
  },

  deleteAccount: async (id: string): Promise<any> => {
    return apiDelete(`/api/v1/accounts/${id}`);
  },
};
