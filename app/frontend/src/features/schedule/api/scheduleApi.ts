import { apiGet, apiPut } from '../../../shared/api/client';
import type {
  ScheduleResponse,
  WeeklySummaryResponse,
  UpsertSchedulePayload,
} from '../types/schedule.dto';

export type { UpsertSchedulePayload };

export const scheduleApi = {
  getMySchedule: async (options: RequestInit = {}): Promise<ScheduleResponse> => {
    return apiGet<ScheduleResponse>('/api/v1/users/me/schedule', options);
  },

  getMyRegistration: async (options: RequestInit = {}): Promise<ScheduleResponse> => {
    return apiGet<ScheduleResponse>('/api/v1/users/me/schedule-registration', options);
  },

  upsertMySchedule: async (
    payload: UpsertSchedulePayload,
    options: RequestInit = {},
  ): Promise<ScheduleResponse> => {
    return apiPut<ScheduleResponse>('/api/v1/users/me/schedule', payload, options);
  },

  getWeeklySummary: async (options: RequestInit = {}): Promise<WeeklySummaryResponse> => {
    return apiGet<WeeklySummaryResponse>('/api/v1/schedule/weekly-summary', options);
  },

  getAccountSchedule: async (
    accountId: string,
    options: RequestInit = {},
  ): Promise<ScheduleResponse> => {
    return apiGet<ScheduleResponse>(`/api/v1/accounts/${accountId}/schedule`, options);
  },
};
