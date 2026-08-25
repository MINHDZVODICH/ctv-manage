import { createContext, createElement, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { messageFor } from '../accounts/useAccounts';

export interface NotificationItem { id: string; type: string; title: string; message: string; read: boolean; createdAt: string }

interface NotificationsContextValue {
  items: NotificationItem[];
  total: number;
  unreadTotal: number;
  readFilter: boolean;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  load: (read: boolean, requestedPage?: number) => Promise<void>;
  selectReadFilter: (read: boolean) => Promise<void>;
  setRead: (notification: NotificationItem, read: boolean, currentPage: number) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ accountId, children }: PropsWithChildren<{ accountId: string }>) {
  const notifications = useNotificationController();
  const bootstrappedAccount = useRef<string | null>(null);

  useEffect(() => {
    if (bootstrappedAccount.current === accountId) return;
    bootstrappedAccount.current = accountId;
    void notifications.loadUnreadCount();
  }, [accountId, notifications.loadUnreadCount]);

  const value = useMemo<NotificationsContextValue>(() => ({
    items: notifications.items,
    total: notifications.total,
    unreadTotal: notifications.unreadTotal,
    readFilter: notifications.readFilter,
    page: notifications.page,
    pageSize: notifications.pageSize,
    isLoading: notifications.isLoading,
    error: notifications.error,
    load: notifications.load,
    selectReadFilter: notifications.selectReadFilter,
    setRead: notifications.setRead,
  }), [notifications]);

  return createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications(): NotificationsContextValue {
  const notifications = useContext(NotificationsContext);
  if (!notifications) throw new Error('useNotifications must be used within NotificationsProvider.');
  return notifications;
}

function useNotificationController() {
  const [items, setItems] = useState<NotificationItem[]>([]); const [total, setTotal] = useState(0); const [unreadTotal, setUnreadTotal] = useState(0); const [isLoading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1); const [readFilter, setReadFilter] = useState(false); const pageSize = 20;
  const load = useCallback(async (read: boolean, requestedPage = 1) => { setLoading(true); setError(null); try { let response = await apiClient.getPage<NotificationItem>(`/notifications?read=${read}&page=${requestedPage}&pageSize=${pageSize}`); const lastPage = Math.max(1, Math.ceil(response.meta.total / pageSize)); if (requestedPage > lastPage) response = await apiClient.getPage<NotificationItem>(`/notifications?read=${read}&page=${lastPage}&pageSize=${pageSize}`); setItems(response.data); setTotal(response.meta.total); setPage(response.meta.page); if (!read) setUnreadTotal(response.meta.total); } catch (reason) { setError(messageFor(reason)); } finally { setLoading(false); } }, []);
  const loadUnreadCount = useCallback(async () => { try { const response = await apiClient.getPage<NotificationItem>('/notifications?read=false&page=1&pageSize=1'); setUnreadTotal(response.meta.total); } catch { /* the popover shows the detailed error when opened */ } }, []);
  const selectReadFilter = useCallback(async (read: boolean) => { setReadFilter(read); await load(read, 1); }, [load]);
  const setRead = useCallback(async (notification: NotificationItem, read: boolean, currentPage: number) => { setError(null); try { await apiClient.patch<NotificationItem>(`/notifications/${notification.id}`, { read: !notification.read }); await Promise.all([load(read, currentPage), loadUnreadCount()]); } catch (reason) { setError(messageFor(reason)); } }, [load, loadUnreadCount]);
  return { items, total, unreadTotal, readFilter, page, pageSize, isLoading, error, load, loadUnreadCount, selectReadFilter, setRead };
}
