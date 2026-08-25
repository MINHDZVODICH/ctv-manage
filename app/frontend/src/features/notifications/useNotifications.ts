import { useCallback, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { messageFor } from '../accounts/useAccounts';

export interface NotificationItem { id: string; type: string; title: string; message: string; read: boolean; createdAt: string }

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]); const [total, setTotal] = useState(0); const [unreadTotal, setUnreadTotal] = useState(0); const [isLoading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1); const pageSize = 20;
  const load = useCallback(async (read: boolean, requestedPage = 1) => { setLoading(true); setError(null); try { let response = await apiClient.getPage<NotificationItem>(`/notifications?read=${read}&page=${requestedPage}&pageSize=${pageSize}`); const lastPage = Math.max(1, Math.ceil(response.meta.total / pageSize)); if (requestedPage > lastPage) response = await apiClient.getPage<NotificationItem>(`/notifications?read=${read}&page=${lastPage}&pageSize=${pageSize}`); setItems(response.data); setTotal(response.meta.total); setPage(response.meta.page); if (!read) setUnreadTotal(response.meta.total); } catch (reason) { setError(messageFor(reason)); } finally { setLoading(false); } }, []);
  const loadUnreadCount = useCallback(async () => { try { const response = await apiClient.getPage<NotificationItem>('/notifications?read=false&page=1&pageSize=1'); setUnreadTotal(response.meta.total); } catch { /* the popover shows the detailed error when opened */ } }, []);
  const setRead = useCallback(async (notification: NotificationItem, read: boolean, currentPage: number) => { setError(null); try { await apiClient.patch<NotificationItem>(`/notifications/${notification.id}`, { read: !notification.read }); await Promise.all([load(read, currentPage), loadUnreadCount()]); } catch (reason) { setError(messageFor(reason)); } }, [load, loadUnreadCount]);
  return { items, total, unreadTotal, page, pageSize, isLoading, error, load, loadUnreadCount, setRead };
}
