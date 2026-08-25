import { createContext, createElement, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { messageFor } from '../accounts/useAccounts';

export interface NotificationItem { id: string; type: string; title: string; message: string; read: boolean; createdAt: string }
interface NotificationQuery { read: boolean; page: number; pageSize: number }

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
  setRead: (notification: NotificationItem) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ accountId, children }: PropsWithChildren<{ accountId: string }>) {
  const notifications = useNotificationController();
  const bootstrappedAccount = useRef<string | null>(null);
  const activeAccount = useRef(accountId);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) notifications.invalidate();
      });
    };
  }, [notifications.invalidate]);

  useEffect(() => {
    if (activeAccount.current !== accountId) notifications.invalidate();
    activeAccount.current = accountId;
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
  const listGeneration = useRef(0); const unreadGeneration = useRef(0); const lifecycleEpoch = useRef(0);
  const latestQuery = useRef<NotificationQuery>({ read: false, page: 1, pageSize });
  const invalidate = useCallback(() => { lifecycleEpoch.current += 1; listGeneration.current += 1; unreadGeneration.current += 1; }, []);
  const load = useCallback(async (read: boolean, requestedPage = 1) => {
    const lifecycle = lifecycleEpoch.current;
    const generation = ++listGeneration.current;
    const unreadRequest = read ? undefined : ++unreadGeneration.current;
    latestQuery.current = { read, page: requestedPage, pageSize };
    setLoading(true); setError(null);
    try {
      let response = await apiClient.getPage<NotificationItem>(`/notifications?read=${read}&page=${requestedPage}&pageSize=${pageSize}`);
      const lastPage = Math.max(1, Math.ceil(response.meta.total / pageSize));
      if (requestedPage > lastPage) response = await apiClient.getPage<NotificationItem>(`/notifications?read=${read}&page=${lastPage}&pageSize=${pageSize}`);
      if (lifecycleEpoch.current !== lifecycle || listGeneration.current !== generation) return;
      setItems(response.data); setTotal(response.meta.total); setPage(response.meta.page);
      latestQuery.current = { read, page: response.meta.page, pageSize };
      if (unreadRequest === unreadGeneration.current) setUnreadTotal(response.meta.total);
    } catch (reason) {
      if (lifecycleEpoch.current === lifecycle && listGeneration.current === generation) setError(messageFor(reason));
    } finally {
      if (lifecycleEpoch.current === lifecycle && listGeneration.current === generation) setLoading(false);
    }
  }, []);
  const loadUnreadCount = useCallback(async () => {
    const lifecycle = lifecycleEpoch.current;
    const generation = ++unreadGeneration.current;
    try {
      const response = await apiClient.getPage<NotificationItem>('/notifications?read=false&page=1&pageSize=1');
      if (lifecycleEpoch.current === lifecycle && unreadGeneration.current === generation) setUnreadTotal(response.meta.total);
    } catch { /* the popover shows the detailed error when opened */ }
  }, []);
  const selectReadFilter = useCallback(async (read: boolean) => { setReadFilter(read); await load(read, 1); }, [load]);
  const setRead = useCallback(async (notification: NotificationItem) => {
    const lifecycle = lifecycleEpoch.current;
    setError(null);
    try {
      await apiClient.patch<NotificationItem>(`/notifications/${notification.id}`, { read: !notification.read });
      if (lifecycleEpoch.current !== lifecycle) return;
      const query = latestQuery.current;
      await Promise.all([load(query.read, query.page), loadUnreadCount()]);
    } catch (reason) {
      if (lifecycleEpoch.current === lifecycle) setError(messageFor(reason));
    }
  }, [load, loadUnreadCount]);
  return { items, total, unreadTotal, readFilter, page, pageSize, isLoading, error, load, loadUnreadCount, selectReadFilter, setRead, invalidate };
}
