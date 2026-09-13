import { useState, useCallback } from 'react';
import { scheduleApi, type UpsertSchedulePayload } from '../api/scheduleApi';
import type { ApiScheduleSlot } from '../types';
import { normalizeErrorMessage } from '../../../shared/api/errors';

export function useSchedule() {
  const [shifts, setShifts] = useState<ApiScheduleSlot[]>([]);
  const [roomCode, setRoomCode] = useState<string>('ROOM_1');
  const [version, setVersion] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMySchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scheduleApi.getMySchedule();
      const raw = res.data ?? res;
      if (raw) {
        setShifts(raw.shifts ?? raw.patternSlots ?? []);
        setRoomCode(raw.roomCode ?? 'ROOM_1');
        setVersion(raw.version ?? 0);
      }
      return raw;
    } catch (err: unknown) {
      setError(normalizeErrorMessage(err, 'Failed to load schedule'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSchedule = useCallback(async (payload: UpsertSchedulePayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await scheduleApi.upsertMySchedule(payload);
      const raw = res.data ?? res;
      if (raw) {
        setShifts(raw.shifts ?? raw.patternSlots ?? []);
        setRoomCode(raw.roomCode ?? payload.roomCode);
        setVersion(raw.version ?? 0);
      }
      return raw;
    } catch (err: unknown) {
      setError(normalizeErrorMessage(err, 'Failed to update schedule'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    shifts,
    roomCode,
    version,
    loading,
    error,
    loadMySchedule,
    updateSchedule,
  };
}
