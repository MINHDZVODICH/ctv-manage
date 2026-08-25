import { useCallback, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { messageFor } from '../accounts/useAccounts';

export interface NotificationItem { id: string; type: string; title: string; message: string; read: boolean; createdAt: string }

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]); const [total, setTotal] = useState(0); const [unreadTotal, setUnreadTotal] = useState(0); const [isLoading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (read = false) => { setLoading(true); setError(null); try { const response = await apiClient.getPage<NotificationItem>(`/notifications?read=${read}&page=1&pageSize=20`); setItems(response.data); setTotal(response.meta.total); if (!read) setUnreadTotal(response.meta.total); } catch (reason) { setError(messageFor(reason)); } finally { setLoading(false); } }, []);
  const setRead = useCallback(async (notification: NotificationItem) => { setError(null); try { const saved = await apiClient.patch<NotificationItem>(`/notifications/${notification.id}`, { read: !notification.read }); setItems((current) => current.filter((item) => item.id !== saved.id)); setTotal((current) => Math.max(0, current - 1)); setUnreadTotal((current) => saved.read ? Math.max(0, current - 1) : current + 1); } catch (reason) { setError(messageFor(reason)); } }, []);
  return { items, total, unreadTotal, isLoading, error, load, setRead };
}
