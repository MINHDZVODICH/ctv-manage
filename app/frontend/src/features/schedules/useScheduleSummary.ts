import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { messageFor } from '../accounts/useAccounts';
import type { RoomCode, SchedulePeriod } from '../../shared/utils/scheduleSelectors';

export interface SummarySlot { shiftId: string; period: SchedulePeriod; count: number }
export interface SummaryDay { date: string; slots: SummarySlot[] }
export interface SummaryData { month: string; today: Array<{ shiftId: string; accountId: string; displayName: string; period: SchedulePeriod; roomCode: RoomCode }>; days: SummaryDay[] }
export interface RosterMember { accountId: string; displayName: string; roomCode: RoomCode; workContent: string; status: 'ACTIVE' | 'CANCELLED' }
export interface ShiftRoster { shiftId: string; workDate: string; period: SchedulePeriod; status: string; coWorkers: RosterMember[] }

export function useScheduleSummary(month: string) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roster, setRoster] = useState<ShiftRoster | null>(null);
  const [isRosterLoading, setRosterLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiClient.get<SummaryData>(`/schedule-summary?month=${month}`)); }
    catch (reason) { setError(messageFor(reason)); }
    finally { setLoading(false); }
  }, [month]);
  useEffect(() => { void load(); }, [load]);
  const openRoster = useCallback(async (shiftId: string) => {
    setRosterLoading(true); setError(null);
    try { setRoster(await apiClient.get<ShiftRoster>(`/shifts/${shiftId}`)); }
    catch (reason) { setError(messageFor(reason)); }
    finally { setRosterLoading(false); }
  }, []);
  return { data, isLoading, error, reload: load, roster, isRosterLoading, openRoster, closeRoster: () => setRoster(null) };
}
