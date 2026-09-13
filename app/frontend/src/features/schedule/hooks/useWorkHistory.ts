import { useState, useCallback, useEffect } from 'react';
import { workHistoryApi } from '../api/workHistoryApi';
import type { ApiHistoryCell } from '../types';
import type { ApiHistoryEntry } from '../../../shared/mappers';
import { normalizeErrorMessage } from '../../../shared/api/errors';

export function useWorkHistory(initialMonth?: string, accountId?: string) {
  const currentMonth =
    initialMonth ??
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
    })
      .format(new Date())
      .slice(0, 7);

  const [month, setMonth] = useState(currentMonth);
  const [entries, setEntries] = useState<ApiHistoryEntry[]>([]);
  const [cells, setCells] = useState<ApiHistoryCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(
    async (targetMonth = month) => {
      setLoading(true);
      setError(null);
      try {
        const res = accountId
          ? await workHistoryApi.getWorkHistory(targetMonth, accountId)
          : await workHistoryApi.getMyWorkHistory(targetMonth);
        const resData = res as unknown as {
          entries?: ApiHistoryEntry[];
          cells?: ApiHistoryCell[];
          data?: { entries?: ApiHistoryEntry[]; cells?: ApiHistoryCell[] };
        };
        const rawEntries = resData.data?.entries ?? resData.entries ?? [];
        const rawCells = res.data?.cells ?? res.cells ?? [];
        setEntries(rawEntries);
        setCells(rawCells);
        return { entries: rawEntries, cells: rawCells };
      } catch (err: unknown) {
        setError(normalizeErrorMessage(err, 'Failed to load work history'));
        setEntries([]);
        setCells([]);
        return { entries: [], cells: [] };
      } finally {
        setLoading(false);
      }
    },
    [month, accountId],
  );

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
