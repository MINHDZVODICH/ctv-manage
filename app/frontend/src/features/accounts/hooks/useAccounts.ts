import { useState, useCallback, useRef } from 'react';
import type { UserAccount, AccountFilters } from '../types';
import { accountsApi } from '../api/accountsApi';
import { accountsToUserAccounts, mapAccountStatus } from '../../../shared/mappers';
import { isRequestAborted } from '../../../shared/api/client';

export interface UseAccountsOptions {
  pageSize?: number;
  initialQuery?: string;
}

export function useAccounts(options: UseAccountsOptions = {}) {
  const pageSize = options.pageSize ?? 5;
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(options.initialQuery ?? '');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const loadAccounts = useCallback(
    async (override?: { page?: number; q?: string }) => {
      const targetPage = override?.page ?? page;
      const targetQ = override?.q !== undefined ? override.q : searchTerm;

      abortControllerRef.current?.abort();
      const ac = new AbortController();
      abortControllerRef.current = ac;
      const seq = ++requestSeqRef.current;

      setLoading(true);
      setError(null);

      try {
        const filters: AccountFilters = {
          page: targetPage,
          pageSize,
          q: targetQ.trim() || undefined,
        };
        const res: any = await accountsApi.listAccounts(filters);
        if (seq !== requestSeqRef.current) return;

        const rows = res.data ?? [];
        const totalCount = res.total ?? rows.length;
        setAccounts(accountsToUserAccounts(rows));
        setTotal(totalCount);
        setPage(targetPage);
      } catch (err: any) {
        if (isRequestAborted(err) || seq !== requestSeqRef.current) return;
        setError(err?.message || 'Không thể tải danh sách tài khoản');
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [page, pageSize, searchTerm],
  );

  const toggleAccountStatus = useCallback(
    async (id: string, currentStatus: string) => {
      const targetStatus = currentStatus === 'Kích hoạt' ? 'DISABLED' : 'ACTIVE';
      await accountsApi.changeStatus(id, targetStatus);
      await loadAccounts();
    },
    [loadAccounts],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      await accountsApi.deleteAccount(id);
      await loadAccounts();
    },
    [loadAccounts],
  );

  const resetPassword = useCallback(
    async (id: string, newPassword: string, requireChangeOnLogin: boolean) => {
      const res = await accountsApi.resetPassword(id, newPassword, requireChangeOnLogin);
      return res;
    },
    [],
  );

  return {
    accounts,
    setAccounts,
    page,
    setPage,
    pageSize,
    total,
    searchTerm,
    setSearchTerm,
    loading,
    error,
    loadAccounts,
    toggleAccountStatus,
    deleteAccount,
    resetPassword,
  };
}
