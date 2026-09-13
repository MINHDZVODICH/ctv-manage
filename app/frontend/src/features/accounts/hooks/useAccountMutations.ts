import { useCallback } from 'react';
import type { UserAccount } from '../../../shared/types';
import { accountsApi } from '../api/accountsApi';
import type { AccountStatusType } from '../types/account.dto';
import { normalizeErrorMessage } from '../../../shared/api/errors';

export interface UseAccountMutationsOptions {
  accounts: UserAccount[];
  selectedAccountDetail: UserAccount | null;
  loadAccounts: () => Promise<void>;
  openAccountDetail: (account: UserAccount) => Promise<void>;
  closeAccountDetail: () => void;
  setSelectedAccountDetail: React.Dispatch<React.SetStateAction<UserAccount | null>>;
  onToast?: (message: string) => void;
  translate: (key: string, params?: Record<string, string | number>) => string;
}

export function useAccountMutations(options: UseAccountMutationsOptions) {
  const {
    accounts,
    selectedAccountDetail,
    loadAccounts,
    openAccountDetail,
    closeAccountDetail,
    setSelectedAccountDetail,
    onToast,
    translate,
  } = options;

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
        console.error('[useAccountMutations] Failed to toggle account status:', e);
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
        console.error('[useAccountMutations] Failed to delete account:', e);
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
        console.error('[useAccountMutations] Failed to reset password:', e);
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
        console.error('[useAccountMutations] Failed to save account notes:', e);
        if (onToast) {
          onToast(normalizeErrorMessage(e, translate('app.save_notes_failed')));
        }
      }
    },
    [loadAccounts, onToast, setSelectedAccountDetail, translate],
  );

  return {
    toggleAccountStatus,
    deleteAccount,
    resetPassword,
    saveAccountNotes,
  };
}
