import { useState, useCallback, useRef, useEffect } from 'react';
import type { UserAccount } from '../../../shared/types';
import { accountsApi } from '../api/accountsApi';
import type { AccountStatusType } from '../types/account.dto';
import { accountDtoToDomain, accountDtosToDomain } from '../mappers/account.mapper';
import { isAbortError, normalizeErrorMessage } from '../../../shared/api/errors';

const DEFAULT_PAGE_SIZE = 5;

export interface PaginatedQueryState {
  page: number;
  pageSize: number;
  q: string;
  total: number;
  loading: boolean;
  error: string | null;
}

export interface UseAccountsAdminOptions {
  isAdmin: boolean;
  pageSize?: number;
  onToast?: (message: string) => void;
  t?: (key: string, params?: Record<string, string | number>) => string;
}

export interface UseAccountsAdminResult {
  accounts: UserAccount[];
  accountQuery: PaginatedQueryState;
  accountSearchInput: string;
  selectedAccountDetail: UserAccount | null;
  setAccountSearchInput: (term: string) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
  loadAccounts: () => Promise<void>;
  openAccountDetail: (account: UserAccount) => Promise<void>;
  openAccountDetailById: (id: string) => Promise<void>;
  closeAccountDetail: () => void;
  toggleAccountStatus: (id: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  resetPassword: (id: string, newPassword: string, requireChangeOnLogin: boolean) => Promise<void>;
  saveAccountNotes: (id: string, notes: string) => Promise<void>;
  setSelectedAccountDetail: React.Dispatch<React.SetStateAction<UserAccount | null>>;
  clearAccounts: () => void;
}

export function useAccountsAdmin(options: UseAccountsAdminOptions): UseAccountsAdminResult {
  const { isAdmin, pageSize = DEFAULT_PAGE_SIZE, onToast, t } = options;

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      if (t) return t(key, params);
      if (params?.name) return `${key}: ${params.name}`;
      return key;
    },
    [t],
  );

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
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<UserAccount | null>(null);

  const accountRequestController = useRef<AbortController | null>(null);
  const accountRequestSequence = useRef(0);
  const accountDetailController = useRef<AbortController | null>(null);
  const accountDetailSequence = useRef(0);

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
      accountDetailController.current?.abort();
      accountDetailSequence.current += 1;
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

    accountDetailController.current?.abort();
    accountDetailController.current = null;
    accountDetailSequence.current += 1;

    setAccounts([]);
    setSelectedAccountDetail(null);
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
      console.error('[useAccountsAdmin] Failed to load accounts:', error);
      setAccountQuery((current) => ({
        ...current,
        loading: false,
        error: translate('app.account_list_failed'),
      }));
    }
  }, [isAdmin, queryPage, queryPageSize, queryQ, translate]);

  const openAccountDetail = useCallback(async (acc: UserAccount) => {
    accountDetailController.current?.abort();
    const controller = new AbortController();
    const sequence = ++accountDetailSequence.current;
    accountDetailController.current = controller;

    setSelectedAccountDetail(acc);
    try {
      const detailRes = await accountsApi.getAccount(acc.id, { signal: controller.signal });
      if (sequence !== accountDetailSequence.current) return;
      if (detailRes.data?.id) {
        const mapped = accountDtoToDomain(detailRes.data, acc.stt);
        setSelectedAccountDetail(mapped);
      }
    } catch (err: unknown) {
      if (isAbortError(err) || sequence !== accountDetailSequence.current) return;
      console.error('[useAccountsAdmin] Failed to load account detail:', err);
    }
  }, []);

  const openAccountDetailById = useCallback(
    async (id: string) => {
      accountDetailController.current?.abort();
      const controller = new AbortController();
      const sequence = ++accountDetailSequence.current;
      accountDetailController.current = controller;

      try {
        const detailRes = await accountsApi.getAccount(id, { signal: controller.signal });
        if (sequence !== accountDetailSequence.current) return;
        if (detailRes.data?.id) {
          setSelectedAccountDetail(accountDtoToDomain(detailRes.data, 0));
        }
      } catch (error) {
        if (isAbortError(error) || sequence !== accountDetailSequence.current) return;
        console.error('[useAccountsAdmin] Failed to load account detail by id:', error);
        if (onToast) {
          onToast(translate('app.account_info_failed'));
        }
      }
    },
    [onToast, translate],
  );

  const closeAccountDetail = useCallback(() => {
    accountDetailController.current?.abort();
    accountDetailController.current = null;
    accountDetailSequence.current += 1;
    setSelectedAccountDetail(null);
  }, []);

  const toggleAccountStatus = useCallback(
    async (id: string) => {
      const acc = accounts.find((a) => a.id === id);
      if (!acc) return;
      const targetStatus: AccountStatusType = acc.status === 'Kích hoạt' ? 'DISABLED' : 'ACTIVE';
      try {
        const detailRes = await accountsApi.getAccount(id);
        const version = detailRes.data?.version;
        await accountsApi.changeStatus(id, targetStatus, version);
        if (onToast) {
          onToast(
            targetStatus === 'DISABLED'
              ? translate('app.account_disabled', { name: acc.name })
              : translate('app.account_enabled', { name: acc.name }),
          );
        }
        await loadAccounts();
        if (selectedAccountDetail?.id === id) {
          await openAccountDetail({
            ...acc,
            status: targetStatus === 'DISABLED' ? 'Vô hiệu hóa' : 'Kích hoạt',
          });
        }
      } catch (e: unknown) {
        console.error('[useAccountsAdmin] Failed to toggle account status:', e);
        if (onToast) {
          onToast(normalizeErrorMessage(e, translate('app.status_update_failed')));
        }
      }
    },
    [accounts, loadAccounts, onToast, openAccountDetail, selectedAccountDetail?.id, translate],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      const target = accounts.find((a) => a.id === id);
      if (!target) return;
      const confirmed = window.confirm(
        translate('app.delete_account_confirm', { name: target.name }),
      );
      if (!confirmed) return;

      try {
        await accountsApi.deleteAccount(id);
        if (onToast) {
          onToast(translate('app.account_deleted', { name: target.name }));
        }
        if (selectedAccountDetail?.id === id) {
          closeAccountDetail();
        }
        await loadAccounts();
      } catch (e: unknown) {
        console.error('[useAccountsAdmin] Failed to delete account:', e);
        if (onToast) {
          onToast(normalizeErrorMessage(e, translate('app.delete_failed')));
        }
      }
    },
    [accounts, closeAccountDetail, loadAccounts, onToast, selectedAccountDetail?.id, translate],
  );

  const resetPassword = useCallback(
    async (id: string, newPassword: string, requireChangeOnLogin: boolean) => {
      const target =
        accounts.find((a) => a.id === id) ??
        (selectedAccountDetail?.id === id ? selectedAccountDetail : null);
      const accountName = target?.name ?? translate('app.default_account_name');
      try {
        await accountsApi.resetPassword(id, newPassword, requireChangeOnLogin);
        if (onToast) {
          onToast(translate('app.password_reset_for_account_success', { name: accountName }));
        }
      } catch (e: unknown) {
        console.error('[useAccountsAdmin] Failed to reset password:', e);
        if (onToast) {
          onToast(normalizeErrorMessage(e, translate('app.password_reset_failed')));
        }
      }
    },
    [accounts, onToast, selectedAccountDetail, translate],
  );

  const saveAccountNotes = useCallback(
    async (id: string, notes: string) => {
      try {
        const detailRes = await accountsApi.getAccount(id);
        const version = detailRes.data?.version;
        await accountsApi.updateNotes(id, notes, version);
        setSelectedAccountDetail((prev) => (prev && prev.id === id ? { ...prev, notes } : prev));
        if (onToast) {
          onToast(translate('app.save_admin_notes_success'));
        }
        await loadAccounts();
      } catch (e: unknown) {
        console.error('[useAccountsAdmin] Failed to save account notes:', e);
        if (onToast) {
          onToast(normalizeErrorMessage(e, translate('app.save_notes_failed')));
        }
      }
    },
    [loadAccounts, onToast, translate],
  );

  return {
    accounts,
    accountQuery,
    accountSearchInput,
    selectedAccountDetail,
    setAccountSearchInput,
    setPage,
    resetFilters,
    loadAccounts,
    openAccountDetail,
    openAccountDetailById,
    closeAccountDetail,
    toggleAccountStatus,
    deleteAccount,
    resetPassword,
    saveAccountNotes,
    setSelectedAccountDetail,
    clearAccounts,
  };
}
