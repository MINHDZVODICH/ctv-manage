import { useState, useCallback } from 'react';
import type { ShiftSlot, UserAccount } from '../../../shared/types';
import type { AuthUser } from '../../../shared/auth/AuthContext';
import { apiGet } from '../../../shared/api';
import { mapRole } from '../../../shared/mappers';
import { weeklyScheduleToSlots, summaryToSlots } from '../mappers/schedule.mapper';
import type { ScheduleResponse, WeeklySummaryResponse } from '../types/schedule.dto';

export interface UseScheduleDashboardOptions {
  authUser: AuthUser | null;
  isAdmin: boolean;
  currentUser: UserAccount | null;
  onToast?: (message: string) => void;
  t?: (key: string, params?: Record<string, string | number>) => string;
}

export interface UseScheduleDashboardResult {
  shifts: ShiftSlot[];
  setShifts: React.Dispatch<React.SetStateAction<ShiftSlot[]>>;
  loading: boolean;
  error: string | null;
  loadShifts: () => Promise<void>;
  clearShifts: () => void;
}

export function useScheduleDashboard(
  options: UseScheduleDashboardOptions,
): UseScheduleDashboardResult {
  const { authUser, isAdmin, currentUser } = options;
  const [shifts, setShifts] = useState<ShiftSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearShifts = useCallback(() => {
    setShifts([]);
    setError(null);
  }, []);

  const loadShifts = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    setError(null);

    if (!isAdmin) {
      try {
        const registrationResult = await apiGet<ScheduleResponse>(
          '/api/v1/users/me/schedule-registration',
        );
        const reg = registrationResult.data;
        const effectiveUser: UserAccount =
          currentUser ??
          ({
            id: authUser.id,
            stt: 1,
            name: authUser.displayName,
            email: authUser.email,
            phone: '',
            role: mapRole(authUser.role),
            status: 'Kích hoạt',
            registerDate: '',
          } as UserAccount);

        setShifts(weeklyScheduleToSlots(reg, effectiveUser));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Schedule registration load failed';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    } else {
      // Admin: load weekly schedule summary
      try {
        const res = await apiGet<WeeklySummaryResponse>('/api/v1/schedule/weekly-summary').catch(
          () =>
            apiGet<WeeklySummaryResponse>('/api/v1/schedule-summary').catch(() => ({
              cells: [],
              data: { cells: [] },
            })),
        );
        const cells = res.data?.cells ?? res.cells ?? [];
        setShifts(summaryToSlots(cells));
      } catch (err: unknown) {
        setShifts([]);
        const msg = err instanceof Error ? err.message : 'Weekly summary load failed';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
  }, [authUser, isAdmin, currentUser]);

  return {
    shifts,
    setShifts,
    loading,
    error,
    loadShifts,
    clearShifts,
  };
}
