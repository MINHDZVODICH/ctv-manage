import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { ApiClientError } from '../../shared/api/errors';

export type AccountStatus = 'ACTIVE' | 'DISABLED';
export type FileCategory = 'AVATAR' | 'CCCD_FRONT' | 'CCCD_BACK' | 'CV';

export interface AccountFile {
  id: string;
  category: FileCategory;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AccountSummary {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  ctvCode: string | null;
  status: AccountStatus;
  version: number;
  joinedAt: string | null;
  avatarFileId: string | null;
}

export interface AccountDetail extends AccountSummary {
  role: 'ADMIN' | 'CTV';
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  adminNotes: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  files: AccountFile[];
}

export interface AccountQuery {
  q: string;
  status?: AccountStatus;
  page: number;
  pageSize: number;
}

interface AccountPage { items: AccountSummary[]; query: AccountQuery; total: number }

export function useAccounts() {
  const [state, setState] = useState<AccountPage>({
    items: [], query: { q: '', page: 1, pageSize: 5 }, total: 0,
  });
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: AccountQuery) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(query.page), pageSize: String(query.pageSize),
      });
      if (query.q.trim()) params.set('q', query.q.trim());
      if (query.status) params.set('status', query.status);
      const response = await apiClient.getPage<AccountSummary>(`/accounts?${params}`);
      setState({ items: response.data, query, total: response.meta.total });
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load({ q: '', page: 1, pageSize: 5 }); }, [load]);

  const changeStatus = useCallback(async (account: AccountSummary) => {
    await apiClient.patch(`/accounts/${account.id}/status`, {
      status: account.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE', version: account.version,
    });
    await load(state.query);
  }, [load, state.query]);

  const remove = useCallback(async (accountId: string) => {
    await apiClient.delete(`/accounts/${accountId}`);
    await load(state.query);
  }, [load, state.query]);

  return {
    ...state, isLoading, error, load, changeStatus, remove,
    detail: (accountId: string) => apiClient.get<AccountDetail>(`/accounts/${accountId}`),
    update: (account: AccountDetail, input: { displayName?: string; phone?: string | null; dateOfBirth?: string | null; gender?: string | null; address?: string | null }) => (
      apiClient.patch<AccountDetail>(`/accounts/${account.id}`, { ...input, version: account.version })
    ),
    saveNotes: (account: AccountDetail, notes: string) => apiClient.patch<AccountDetail>(`/accounts/${account.id}/notes`, { notes, version: account.version }),
    resetPassword: (accountId: string, newPassword: string, requireChangeOnLogin: boolean, key: string) => (
      apiClient.postIdempotent(`/accounts/${accountId}/password-resets`, { newPassword, requireChangeOnLogin }, key)
    ),
  };
}

export function isVersionConflict(reason: unknown): boolean {
  return reason instanceof ApiClientError && reason.status === 409 && reason.code === 'VERSION_CONFLICT';
}

export function messageFor(reason: unknown): string {
  return reason instanceof ApiClientError ? reason.message : 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
}
