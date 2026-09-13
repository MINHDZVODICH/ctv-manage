import { useCallback } from 'react';
import type { UserAccount } from '../../../shared/types';
import { useAccountList, type PaginatedQueryState } from './useAccountList';
import { useAccountDetail } from './useAccountDetail';
import { useAccountMutations } from './useAccountMutations';

export type { PaginatedQueryState };

const DEFAULT_PAGE_SIZE = 5;

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

/**
 * Account administration facade hook.
 * Composes focused sub-hooks: `useAccountList`, `useAccountDetail`, and `useAccountMutations`.
 */
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

  const list = useAccountList({ isAdmin, pageSize, translate });
  const detail = useAccountDetail({ onToast, translate });
  const mutations = useAccountMutations({
    accounts: list.accounts,
    selectedAccountDetail: detail.selectedAccountDetail,
    loadAccounts: list.loadAccounts,
    openAccountDetail: detail.openAccountDetail,
    closeAccountDetail: detail.closeAccountDetail,
    setSelectedAccountDetail: detail.setSelectedAccountDetail,
    onToast,
    translate,
  });

  const { clearAccounts: clearAccountList } = list;
  const { closeAccountDetail } = detail;

  const clearAccounts = useCallback(() => {
    clearAccountList();
    closeAccountDetail();
  }, [clearAccountList, closeAccountDetail]);

  return {
    accounts: list.accounts,
    accountQuery: list.accountQuery,
    accountSearchInput: list.accountSearchInput,
    selectedAccountDetail: detail.selectedAccountDetail,
    setAccountSearchInput: list.setAccountSearchInput,
    setPage: list.setPage,
    resetFilters: list.resetFilters,
    loadAccounts: list.loadAccounts,
    openAccountDetail: detail.openAccountDetail,
    openAccountDetailById: detail.openAccountDetailById,
    closeAccountDetail: detail.closeAccountDetail,
    toggleAccountStatus: mutations.toggleAccountStatus,
    deleteAccount: mutations.deleteAccount,
    resetPassword: mutations.resetPassword,
    saveAccountNotes: mutations.saveAccountNotes,
    setSelectedAccountDetail: detail.setSelectedAccountDetail,
    clearAccounts,
  };
}
