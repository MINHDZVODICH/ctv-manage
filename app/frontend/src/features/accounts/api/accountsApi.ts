import { apiGet, apiPatch, apiPost, apiDelete } from '../../../shared/api/client';
import type { AccountFilters } from '../types';
import type {
  AccountListResponse,
  AccountDetailResponse,
  AccountMutationResponse,
  AccountDeleteResponse,
  PasswordResetResponse,
  AccountStatusType,
} from '../types/account.dto';

export const accountsApi = {
  listAccounts: async (
    filters: AccountFilters = {},
    options: RequestInit = {},
  ): Promise<AccountListResponse> => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status) params.set('status', filters.status);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiGet<AccountListResponse>(`/api/v1/accounts${qs}`, options);
  },

  getAccount: async (id: string, options: RequestInit = {}): Promise<AccountDetailResponse> => {
    return apiGet<AccountDetailResponse>(`/api/v1/accounts/${id}`, options);
  },

  updateAccount: async (
    id: string,
    data: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<AccountMutationResponse> => {
    return apiPatch<AccountMutationResponse>(`/api/v1/accounts/${id}`, data, options);
  },

  updateNotes: async (
    id: string,
    adminNotes: string | null,
    expectedVersion?: number,
  ): Promise<AccountMutationResponse> => {
    return apiPatch<AccountMutationResponse>(`/api/v1/accounts/${id}/notes`, {
      adminNotes,
      expectedVersion,
    });
  },

  changeStatus: async (
    id: string,
    status: AccountStatusType,
    expectedVersion?: number,
  ): Promise<AccountMutationResponse> => {
    return apiPatch<AccountMutationResponse>(`/api/v1/accounts/${id}/status`, {
      status,
      expectedVersion,
    });
  },

  resetPassword: async (
    id: string,
    newPassword: string,
    mustChangePassword?: boolean,
  ): Promise<PasswordResetResponse> => {
    return apiPost<PasswordResetResponse>(`/api/v1/accounts/${id}/password-resets`, {
      newPassword,
      mustChangePassword,
    });
  },

  deleteAccount: async (id: string): Promise<AccountDeleteResponse> => {
    return apiDelete<AccountDeleteResponse>(`/api/v1/accounts/${id}`);
  },
};
