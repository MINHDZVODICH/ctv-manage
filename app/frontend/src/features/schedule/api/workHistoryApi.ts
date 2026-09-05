import { apiGet } from '../../../shared/api/client';
import type { HistoryResponse } from '../types';

export const workHistoryApi = {
  getMyWorkHistory: async (month: string): Promise<HistoryResponse> => {
    return apiGet<HistoryResponse>(`/api/v1/users/me/work-history?month=${encodeURIComponent(month)}`);
  },

  getWorkHistory: async (month: string, accountId?: string): Promise<HistoryResponse> => {
    const params = new URLSearchParams({ month });
    if (accountId) params.set('accountId', accountId);
    return apiGet<HistoryResponse>(`/api/v1/work-history?${params.toString()}`);
  },
};
