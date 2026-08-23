import {
  ApiResponse,
  AuthSessionResponse,
  ScheduleRegistrationData,
  ScheduleSummaryData,
} from './contracts';
import {
  UserAccount,
  RegistrationRequest,
  ShiftSlot,
  NotificationItem,
  UserRole,
} from '../types';

const BASE_URL = '/api/v1';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    let json: ApiResponse<T>;
    try {
      json = await response.json();
    } catch {
      throw new Error(`Lỗi kết nối máy chủ (${response.status})`);
    }

    if (!response.ok || json.error) {
      const errorMsg = json.error?.message || `Lỗi yêu cầu: ${response.statusText}`;
      const err = new Error(errorMsg);
      (err as any).code = json.error?.code;
      (err as any).details = json.error?.details;
      throw err;
    }

    return json.data;
  }

  // Authentication
  auth = {
    login: async (email: string, pass: string): Promise<AuthSessionResponse> => {
      const data = await this.request<AuthSessionResponse>('/auth/sessions', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });
      if (data.token) {
        this.setToken(data.token);
      }
      return data;
    },

    getCurrentSession: async (): Promise<{ user: UserAccount }> => {
      return this.request<{ user: UserAccount }>('/auth/sessions/current');
    },

    logout: async (): Promise<void> => {
      try {
        await this.request('/auth/sessions/current', { method: 'DELETE' });
      } finally {
        this.setToken(null);
      }
    },

    forgotPassword: async (email: string): Promise<{ success: boolean; message: string; otp?: string }> => {
      return this.request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    verifyOtp: async (email: string, otp: string): Promise<AuthSessionResponse> => {
      const data = await this.request<AuthSessionResponse>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });
      if (data.token) {
        this.setToken(data.token);
      }
      return data;
    },
  };

  // Accounts Management
  accounts = {
    list: async (params?: { search?: string; role?: string; status?: string }): Promise<UserAccount[]> => {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.role) query.set('role', params.role);
      if (params?.status) query.set('status', params.status);
      const qs = query.toString() ? `?${query.toString()}` : '';
      return this.request<UserAccount[]>(`/accounts${qs}`);
    },

    get: async (id: string): Promise<UserAccount> => {
      return this.request<UserAccount>(`/accounts/${id}`);
    },

    create: async (accountData: {
      name: string;
      email: string;
      phone: string;
      role: UserRole;
      address?: string;
      password?: string;
    }): Promise<UserAccount> => {
      return this.request<UserAccount>('/accounts', {
        method: 'POST',
        body: JSON.stringify(accountData),
      });
    },

    toggleStatus: async (id: string, status?: string): Promise<UserAccount> => {
      return this.request<UserAccount>(`/accounts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    delete: async (id: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`/accounts/${id}`, {
        method: 'DELETE',
      });
    },

    changeRole: async (id: string, role: UserRole): Promise<UserAccount> => {
      return this.request<UserAccount>(`/accounts/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
    },

    resetPassword: async (
      id: string,
      newPassword: string,
      mustChangePassword = false,
    ): Promise<{ success: boolean; message: string }> => {
      return this.request(`/accounts/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword, mustChangePassword }),
      });
    },

    saveNotes: async (id: string, notes: string): Promise<UserAccount> => {
      return this.request<UserAccount>(`/accounts/${id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
    },

    endSchedule: async (
      id: string,
      startDate: string,
      endDate: string,
      reason?: string,
    ): Promise<UserAccount> => {
      return this.request<UserAccount>(`/accounts/${id}/end-schedule`, {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate, reason }),
      });
    },
  };

  // User Profile
  users = {
    getMyProfile: async (): Promise<UserAccount> => {
      return this.request<UserAccount>('/users/me');
    },

    updateMyProfile: async (data: Partial<UserAccount> & {
      cccdFrontBase64?: string;
      cccdBackBase64?: string;
      cvFileBase64?: string;
      cvFileName?: string;
      avatarBase64?: string;
    }): Promise<UserAccount> => {
      return this.request<UserAccount>('/users/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean }> => {
      return this.request('/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },

    uploadAvatar: async (file: File): Promise<UserAccount> => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<UserAccount>('/users/me/avatar', {
        method: 'POST',
        body: formData,
      });
    },

    uploadCccdFront: async (file: File): Promise<UserAccount> => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<UserAccount>('/users/me/cccd-front', {
        method: 'POST',
        body: formData,
      });
    },

    uploadCccdBack: async (file: File): Promise<UserAccount> => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<UserAccount>('/users/me/cccd-back', {
        method: 'POST',
        body: formData,
      });
    },

    uploadCv: async (file: File): Promise<UserAccount> => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<UserAccount>('/users/me/cv', {
        method: 'POST',
        body: formData,
      });
    },
  };

  // Registration Requests
  registrationRequests = {
    create: async (data: {
      name: string;
      email: string;
      phone: string;
      dob?: string;
      citizenId?: string;
      address?: string;
      experience?: string;
      password?: string;
      cccdFront?: File;
      cccdBack?: File;
      cvFile?: File;
      cccdFrontBase64?: string;
      cccdBackBase64?: string;
      cvFileBase64?: string;
      cvFileName?: string;
    }): Promise<{ id: string; message: string }> => {
      if (data.cccdFront || data.cccdBack || data.cvFile) {
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('email', data.email);
        formData.append('phone', data.phone);
        if (data.dob) formData.append('dob', data.dob);
        if (data.citizenId) formData.append('citizenId', data.citizenId);
        if (data.address) formData.append('address', data.address);
        if (data.experience) formData.append('experience', data.experience);
        if (data.password) formData.append('password', data.password);
        if (data.cccdFront) formData.append('cccdFront', data.cccdFront);
        if (data.cccdBack) formData.append('cccdBack', data.cccdBack);
        if (data.cvFile) formData.append('cvFile', data.cvFile);

        return this.request<{ id: string; message: string }>('/registration-requests', {
          method: 'POST',
          body: formData,
        });
      }

      return this.request<{ id: string; message: string }>('/registration-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    list: async (status?: string): Promise<RegistrationRequest[]> => {
      const qs = status ? `?status=${status}` : '';
      return this.request<RegistrationRequest[]>(`/registration-requests${qs}`);
    },

    get: async (id: string): Promise<RegistrationRequest> => {
      return this.request<RegistrationRequest>(`/registration-requests/${id}`);
    },

    review: async (
      id: string,
      action: 'APPROVE' | 'REJECT',
      rejectionReason?: string,
    ): Promise<{ message: string; accountId?: string }> => {
      return this.request(`/registration-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, rejectionReason }),
      });
    },
  };

  // Schedules
  schedules = {
    getMyRegistration: async (): Promise<ScheduleRegistrationData | null> => {
      return this.request<ScheduleRegistrationData | null>('/users/me/schedule-registration');
    },

    saveMyRegistration: async (data: ScheduleRegistrationData): Promise<any> => {
      return this.request('/users/me/schedule-registration', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    getMyShifts: async (params?: { startDate?: string; endDate?: string; month?: string }): Promise<ShiftSlot[]> => {
      const query = new URLSearchParams();
      if (params?.startDate) query.set('startDate', params.startDate);
      if (params?.endDate) query.set('endDate', params.endDate);
      if (params?.month) query.set('month', params.month);
      const qs = query.toString() ? `?${query.toString()}` : '';
      return this.request<ShiftSlot[]>(`/users/me/shifts${qs}`);
    },

    cancelShift: async (
      id: string,
      scope: 'single' | 'series' = 'single',
      fromDate?: string,
      reason?: string,
    ): Promise<{ success: boolean; message: string }> => {
      const query = new URLSearchParams({ scope });
      if (fromDate) query.set('fromDate', fromDate);
      if (reason) query.set('reason', reason);
      return this.request(`/shift-registrations/${id}?${query.toString()}`, {
        method: 'DELETE',
      });
    },

    getSummary: async (month?: string): Promise<ScheduleSummaryData> => {
      const qs = month ? `?month=${month}` : '';
      return this.request<ScheduleSummaryData>(`/schedule-summary${qs}`);
    },

    getShiftDetail: async (id: string): Promise<ShiftSlot> => {
      return this.request<ShiftSlot>(`/shifts/${id}`);
    },
  };

  // Notifications
  notifications = {
    list: async (): Promise<NotificationItem[]> => {
      return this.request<NotificationItem[]>('/notifications');
    },

    markAllRead: async (): Promise<{ success: boolean }> => {
      return this.request('/notifications/read-all', { method: 'PATCH' });
    },

    clearAll: async (): Promise<{ success: boolean }> => {
      return this.request('/notifications', { method: 'DELETE' });
    },
  };
}

export const api = new ApiClient();
