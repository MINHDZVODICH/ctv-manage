import { useState, useCallback } from 'react';
import { scheduleApi } from '../api/scheduleApi';
import type { ApiSummaryCell } from '../types';
import { normalizeErrorMessage } from '../../../shared/api/errors';

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
    } catch (err: unknown) {
      setError(normalizeErrorMessage(err, 'Failed to load weekly summary'));
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
