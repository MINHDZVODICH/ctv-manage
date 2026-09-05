import { useState, useCallback, useEffect } from 'react';
import { workHistoryApi } from '../api/workHistoryApi';

export function useWorkHistory(initialMonth?: string, accountId?: string) {
  const currentMonth = initialMonth ?? new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()).slice(0, 7);

  const [month, setMonth] = useState(currentMonth);
  const [entries, setEntries] = useState<any[]>([]);
  const [cells, setCells] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (targetMonth = month) => {
    setLoading(true);
    setError(null);
    try {
      let res: any;
      if (accountId) {
        res = await workHistoryApi.getWorkHistory(targetMonth, accountId);
      } else {
        res = await workHistoryApi.getMyWorkHistory(targetMonth);
      }
      const rawEntries = res.data?.entries ?? res.entries ?? [];
      const rawCells = res.data?.cells ?? res.cells ?? [];
      setEntries(rawEntries);
      setCells(rawCells);
      return { entries: rawEntries, cells: rawCells };
    } catch (err: any) {
      setError(err?.message || 'Không thể tải lịch sử làm việc');
      setEntries([]);
      setCells([]);
      return { entries: [], cells: [] };
    } finally {
      setLoading(false);
    }
  }, [month, accountId]);

  useEffect(() => {
    const handleRefresh = () => {
      if (document.visibilityState === 'visible') {
        void loadHistory();
      }
    };
    window.addEventListener('visibilitychange', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('visibilitychange', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [loadHistory]);

  return {
    month,
    setMonth,
    entries,
    cells,
    loading,
    error,
    loadHistory,
  };
}
