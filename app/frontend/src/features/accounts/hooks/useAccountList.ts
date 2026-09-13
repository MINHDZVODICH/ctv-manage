import { useState, useCallback, useRef, useEffect } from 'react';
import type { UserAccount } from '../../../shared/types';
import { accountsApi } from '../api/accountsApi';
import { accountDtosToDomain } from '../mappers/account.mapper';
import { isAbortError } from '../../../shared/api/errors';

export interface PaginatedQueryState {
  page: number;
  pageSize: number;
  q: string;
  total: number;
  loading: boolean;
  error: string | null;
}

export interface UseAccountListOptions {
  isAdmin: boolean;
  pageSize?: number;
  translate: (key: string, params?: Record<string, string | number>) => string;
}

export function useAccountList(options: UseAccountListOptions) {
  const { isAdmin, pageSize = 5, translate } = options;

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [accountQuery, setAccountQuery] = useState<PaginatedQueryState>({
    page: 1,
    pageSize,
    q: '',
    total: 0,
    loading: false,
    error: null,
  });
  const [accountSearchInput, setAccountSearchInput] = useState('');

  const accountRequestController = useRef<AbortController | null>(null);
  const accountRequestSequence = useRef(0);

  // Debounce search input
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAccountQuery((current) => ({ ...current, q: accountSearchInput, page: 1 }));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [accountSearchInput]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      accountRequestController.current?.abort();
      accountRequestSequence.current += 1;
    };
  }, []);

  const setPage = useCallback((page: number) => {
    setAccountQuery((current) => ({ ...current, page }));
  }, []);

  const resetFilters = useCallback(() => {
    setAccountSearchInput('');
    setAccountQuery((current) => ({ ...current, q: '', page: 1 }));
  }, []);

  const clearAccounts = useCallback(() => {
    accountRequestController.current?.abort();
    accountRequestController.current = null;
    accountRequestSequence.current += 1;
    setAccounts([]);
  }, []);

  const { page: queryPage, pageSize: queryPageSize, q: queryQ } = accountQuery;

  const loadAccounts = useCallback(async () => {
    if (!isAdmin) return;
    accountRequestController.current?.abort();
    const controller = new AbortController();
    const sequence = ++accountRequestSequence.current;
    accountRequestController.current = controller;

    setAccountQuery((current) => ({ ...current, loading: true, error: null }));

    try {
      const res = await accountsApi.listAccounts(
        { page: queryPage, pageSize: queryPageSize, q: queryQ.trim() || undefined },
        { signal: controller.signal },
      );
      if (sequence !== accountRequestSequence.current) return;

      const rows = res.data ?? [];
      const total = res.total ?? rows.length;
      const lastPage = Math.max(1, Math.ceil(total / queryPageSize));

      if (total > 0 && rows.length === 0 && queryPage > lastPage) {
        setAccountQuery((current) => ({ ...current, page: lastPage, total, loading: false }));
        return;
      }

      setAccounts(accountDtosToDomain(rows));
      setAccountQuery((current) => ({ ...current, total, loading: false, error: null }));
    } catch (error) {
      if (isAbortError(error) || sequence !== accountRequestSequence.current) return;
      console.error('[useAccountList] Failed to load accounts:', error);
      setAccountQuery((current) => ({
        ...current,
        loading: false,
        error: translate('app.account_list_failed'),
      }));
    }
  }, [isAdmin, queryPage, queryPageSize, queryQ, translate]);

  return {
    accounts,
    setAccounts,
    accountQuery,
    setAccountQuery,
    accountSearchInput,
    setAccountSearchInput,
    setPage,
    resetFilters,
    loadAccounts,
    clearAccounts,
  };
}
