import { apiGet, apiPatch, apiUpload } from '../../../shared/api/client';
import type {
  RequestFilters,
  RegistrationListResponse,
  RegistrationDecisionResponse,
  SubmitRegistrationResponse,
} from '../types/registration-request.dto';

export const registrationApi = {
  submitRegistration: async (formData: FormData): Promise<SubmitRegistrationResponse> => {
    return apiUpload<SubmitRegistrationResponse>('/api/v1/registration-requests', formData, 'POST');
  },

  listRequests: async (
    filters: RequestFilters = {},
    options: RequestInit = {},
  ): Promise<RegistrationListResponse> => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status) params.set('status', filters.status);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiGet<RegistrationListResponse>(`/api/v1/registration-requests${qs}`, options);
  },

  decideRequest: async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
  ): Promise<RegistrationDecisionResponse> => {
    return apiPatch<RegistrationDecisionResponse>(`/api/v1/registration-requests/${requestId}`, {
      decision,
      expectedStatus: 'PENDING',
      rejectionReason: rejectionReason || undefined,
    });
  },
};
