import { apiGet, apiPatch, apiUpload } from '../../../shared/api/client';
import type { RequestFilters } from '../types';

export const registrationApi = {
  submitRegistration: async (formData: FormData): Promise<any> => {
    return apiUpload('/api/v1/registration-requests', formData, 'POST');
  },

  listRequests: async (filters: RequestFilters = {}): Promise<any> => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status) params.set('status', filters.status);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiGet(`/api/v1/registration-requests${qs}`);
  },

  decideRequest: async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
  ): Promise<any> => {
    return apiPatch(`/api/v1/registration-requests/${requestId}`, {
      decision,
      expectedStatus: 'PENDING',
      rejectionReason: rejectionReason || undefined,
    });
  },
};
