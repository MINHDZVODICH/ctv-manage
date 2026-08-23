import { UserAccount, RegistrationRequest, ShiftSlot, NotificationItem, ViewTab, UserRole, AccountStatus, RequestStatus, ShiftStatus } from '../types';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
    requestId?: string;
  };
}

export interface AuthSessionResponse {
  token: string;
  user: UserAccount;
}

export interface ScheduleRegistrationData {
  id?: string;
  roomCode?: string;
  room?: string;
  startDate: string;
  endDate: string;
  timeZone?: string;
  workContent?: string;
  version?: number;
  slots: Array<{
    weekday: number;
    period: 'MORNING' | 'AFTERNOON' | 'EVENING';
    enabled: boolean;
  }>;
}

export interface ScheduleSummaryData {
  month: string;
  today: Array<{
    id: string;
    assignmentId: string;
    name: string;
    avatar?: string;
    initials?: string;
    phone?: string;
    cctvCode?: string;
    room: string;
    roomDisplay: string;
    shiftPeriod: string;
    shiftTimeLabel: string;
    taskContent: string;
    taskDisplay: string;
    status: string;
  }>;
  shifts: ShiftSlot[];
}
