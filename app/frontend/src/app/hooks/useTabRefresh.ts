import { useEffect } from 'react';
import type { ViewTab } from '../../shared/types';
import type { AuthUser } from '../../shared/auth/AuthContext';

export interface UseTabRefreshOptions {
  authUser: AuthUser | null;
  currentTab: ViewTab;
  isAdmin: boolean;
  loadAccounts: () => Promise<void>;
  loadRequests: () => Promise<void>;
  loadShifts: () => Promise<void>;
  refreshCurrentUser: () => Promise<unknown>;
  onToast: (message: string) => void;
  reloadFailedMessage: string;
  scheduleFailedMessage: string;
}

export function useTabRefresh(options: UseTabRefreshOptions): void {
  const {
    authUser,
    currentTab,
    isAdmin,
    loadAccounts,
    loadRequests,
    loadShifts,
    refreshCurrentUser,
    onToast,
    reloadFailedMessage,
    scheduleFailedMessage,
  } = options;

  useEffect(() => {
    if (!authUser) return;
    if (isAdmin && currentTab === 'accounts') void loadAccounts();
    if (isAdmin && currentTab === 'requests') void loadRequests();
    if (!isAdmin && currentTab === 'schedule') {
      void loadShifts().catch(() => onToast(scheduleFailedMessage));
    }
  }, [
    authUser,
    currentTab,
    isAdmin,
    loadAccounts,
    loadRequests,
    loadShifts,
    onToast,
    scheduleFailedMessage,
  ]);

  useEffect(() => {
    let timer: number | null = null;
    const refreshVisible = () => {
      if (document.visibilityState !== 'visible' || !authUser || timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        if (currentTab === 'profile') void refreshCurrentUser();
        else if (isAdmin && currentTab === 'accounts') void loadAccounts();
        else if (isAdmin && currentTab === 'requests') void loadRequests();
        else if (!isAdmin && currentTab === 'schedule') {
          void loadShifts().catch(() => onToast(reloadFailedMessage));
        }
      }, 0);
    };

    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [
    authUser,
    currentTab,
    isAdmin,
    loadAccounts,
    loadRequests,
    loadShifts,
    refreshCurrentUser,
    onToast,
    reloadFailedMessage,
  ]);
}
