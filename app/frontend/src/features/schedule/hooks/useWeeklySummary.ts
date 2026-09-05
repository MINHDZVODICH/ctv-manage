import { useState, useCallback } from 'react';
import { scheduleApi } from '../api/scheduleApi';
import type { ApiSummaryCell } from '../types';

export function useWeeklySummary() {
  const [cells, setCells] = useState<ApiSummaryCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWeeklySummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scheduleApi.getWeeklySummary();
      const summaryCells = res.data?.cells ?? res.cells ?? [];
      setCells(summaryCells);
      return summaryCells;
    } catch (err: any) {
      setError(err?.message || 'Không thể tải lịch tuần tổng hợp');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    cells,
    loading,
    error,
    loadWeeklySummary,
  };
}
