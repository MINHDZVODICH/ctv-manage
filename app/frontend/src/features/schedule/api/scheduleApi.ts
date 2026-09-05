import { apiGet, apiPut } from '../../../shared/api/client';
import type { ScheduleResponse, WeeklySummaryResponse } from '../types';

export interface UpsertSchedulePayload {
  roomCode: string;
  slots: Array<{ weekday: number; period: 'MORNING' | 'AFTERNOON' }>;
  expectedVersion?: number;
}

export const scheduleApi = {
  getMySchedule: async (): Promise<ScheduleResponse> => {
    return apiGet<ScheduleResponse>('/api/v1/users/me/schedule');
  },

  upsertMySchedule: async (payload: UpsertSchedulePayload): Promise<ScheduleResponse> => {
    return apiPut<ScheduleResponse>('/api/v1/users/me/schedule', payload);
  },

  getWeeklySummary: async (): Promise<WeeklySummaryResponse> => {
    return apiGet<WeeklySummaryResponse>('/api/v1/schedule/weekly-summary');
  },

  getAccountSchedule: async (accountId: string): Promise<ScheduleResponse> => {
    return apiGet<ScheduleResponse>(`/api/v1/accounts/${accountId}/schedule`);
  },
};
