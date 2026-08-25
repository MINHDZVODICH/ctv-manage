import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { ApiClientError } from '../../shared/api/errors';
import type { RoomCode, SchedulePeriod } from '../../shared/utils/scheduleSelectors';

export interface PatternSlot { weekday: number; period: SchedulePeriod }

export interface ScheduleRegistration {
  id: string;
  startDate: string;
  endDate: string;
  timeZone: 'Asia/Bangkok';
  roomCode: RoomCode;
  workContent: string;
  slots: PatternSlot[];
  version: number;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  updatedAt: string;
}

export interface MyShift {
  assignmentId: string;
  shiftId: string;
  registrationId: string;
  workDate: string;
  weekday: number;
  period: SchedulePeriod;
  roomCode: RoomCode;
  workContent: string;
  status: 'ACTIVE' | 'CANCELLED';
  canCancel: boolean;
}

export interface ShiftDetail {
  shiftId: string;
  workDate: string;
  weekday: number;
  period: SchedulePeriod;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  assignment: null | {
    assignmentId: string;
    registrationId: string;
    roomCode: RoomCode;
    workContent: string;
    status: 'ACTIVE' | 'CANCELLED';
  };
  canCancel: boolean;
  cancelScopes: Array<'ONE' | 'SERIES'>;
  coWorkers: Array<{ accountId: string; displayName: string; roomCode: RoomCode }>;
}

export interface RegistrationPayload {
  startDate: string;
  endDate: string;
  timeZone: 'Asia/Bangkok';
  roomCode: RoomCode;
  workContent: string;
  slots: PatternSlot[];
  version: number | null;
}

interface ShiftFilter { from?: string; to?: string; month?: string }

export function useMySchedule(filter: ShiftFilter) {
  const [registration, setRegistration] = useState<ScheduleRegistration | null>(null);
  const [shifts, setShifts] = useState<MyShift[]>([]);
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isDetailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRegistration = useCallback(async () => {
    const result = await apiClient.get<ScheduleRegistration | null>('/users/me/schedule-registration');
    setRegistration(result);
    return result;
  }, []);

  const loadShifts = useCallback(async () => {
    const query = filter.month
      ? `month=${encodeURIComponent(filter.month)}`
      : `from=${encodeURIComponent(filter.from ?? '')}&to=${encodeURIComponent(filter.to ?? '')}`;
    const result = await apiClient.get<MyShift[]>(`/users/me/shifts?${query}`);
    setShifts(result);
    return result;
  }, [filter.from, filter.month, filter.to]);

  useEffect(() => {
    void loadRegistration().catch((caught) => setError(messageOf(caught)));
  }, [loadRegistration]);

  useEffect(() => {
    setLoading(true);
    void loadShifts()
      .catch((caught) => setError(messageOf(caught)))
      .finally(() => setLoading(false));
  }, [loadShifts]);

  const saveRegistration = useCallback(async (payload: RegistrationPayload): Promise<boolean> => {
    setSaving(true); setError(''); setNotice('');
    try {
      const saved = await apiClient.put<ScheduleRegistration>('/users/me/schedule-registration', payload);
      setRegistration(saved);
      await loadShifts();
      setNotice('Đã lưu lịch làm việc và cập nhật lịch cá nhân.');
      return true;
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'VERSION_CONFLICT') {
        await loadRegistration();
        setNotice('Dữ liệu đã được cập nhật ở nơi khác. Biểu mẫu đã tải lại phiên bản mới nhất.');
        return false;
      }
      setError(messageOf(caught));
      return false;
    } finally { setSaving(false); }
  }, [loadRegistration, loadShifts]);

  const openDetail = useCallback(async (shiftId: string) => {
    setDetailLoading(true); setError('');
    try { setDetail(await apiClient.get<ShiftDetail>(`/shifts/${encodeURIComponent(shiftId)}`)); }
    catch (caught) { setError(messageOf(caught)); }
    finally { setDetailLoading(false); }
  }, []);

  const cancelOne = useCallback(async (assignmentId: string) => {
    setSaving(true); setError('');
    try {
      const result = await apiClient.delete<{ scope: 'ONE'; fromDate: string; affectedCount: number }>(
        `/users/me/shift-assignments/${encodeURIComponent(assignmentId)}`,
      );
      await loadShifts(); setDetail(null);
      setNotice(`Đã hủy ${result.affectedCount} ca làm việc.`);
    } catch (caught) { setError(messageOf(caught)); }
    finally { setSaving(false); }
  }, [loadShifts]);

  const cancelSeries = useCallback(async (value: ShiftDetail) => {
    if (!value.assignment) return;
    setSaving(true); setError('');
    const query = new URLSearchParams({
      weekday: String(value.weekday), period: value.period, fromDate: value.workDate,
    });
    try {
      const result = await apiClient.delete<{ scope: 'SERIES'; fromDate: string; affectedCount: number }>(
        `/users/me/schedule-registrations/${encodeURIComponent(value.assignment.registrationId)}/assignments?${query}`,
      );
      await loadShifts(); setDetail(null);
      setNotice(`Đã hủy ${result.affectedCount} ca trong chuỗi định kỳ.`);
    } catch (caught) { setError(messageOf(caught)); }
    finally { setSaving(false); }
  }, [loadShifts]);

  return {
    registration, shifts, detail, isLoading, isSaving, isDetailLoading, error, notice,
    clearDetail: () => setDetail(null), clearNotice: () => setNotice(''),
    saveRegistration, openDetail, cancelOne, cancelSeries,
  };
}

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
}
