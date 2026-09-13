import { useState, useCallback, useRef, useEffect } from 'react';
import type { UserAccount } from '../../../shared/types';
import { accountsApi } from '../api/accountsApi';
import { accountDtoToDomain } from '../mappers/account.mapper';
import { isAbortError } from '../../../shared/api/errors';

export interface UseAccountDetailOptions {
  onToast?: (message: string) => void;
  translate: (key: string, params?: Record<string, string | number>) => string;
}

export function useAccountDetail(options: UseAccountDetailOptions) {
  const { onToast, translate } = options;
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<UserAccount | null>(null);

  const accountDetailController = useRef<AbortController | null>(null);
  const accountDetailSequence = useRef(0);

  useEffect(() => {
    return () => {
      accountDetailController.current?.abort();
      accountDetailSequence.current += 1;
    };
  }, []);

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
      console.error('[useAccountDetail] Failed to load account detail:', err);
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
        console.error('[useAccountDetail] Failed to load account detail by id:', error);
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

  return {
    selectedAccountDetail,
    setSelectedAccountDetail,
    openAccountDetail,
    openAccountDetailById,
    closeAccountDetail,
  };
}
