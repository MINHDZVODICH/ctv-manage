import type { AccountStatus, RequestStatus, UserRole } from './common';

export interface UserAccount {
  id: string;
  stt: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  avatar?: string;
  initials?: string;
  registerDate: string;
  dob?: string;
  gender?: string;
  cccd?: string;
  cccdFront?: string;
  cccdBack?: string;
  cvFile?: string;
  cvFileName?: string;
  cvFileSize?: string;
  address?: string;
  cctvCode?: string;
  joinDate?: string;
  region?: string;
  shiftsCompleted?: number;
  rating?: number;
  skills?: string[];
  room?: string;
  workRoom?: string;
  notes?: string;
}

export interface RegistrationRequest {
  id: string;
  stt: number;
  name: string;
  email: string;
  phone: string;
  submittedAt: string;
  status: RequestStatus;
  initials?: string;
  notes?: string;
  dob?: string;
  cccd?: string;
  address?: string;
  experience?: string;
  room?: string;
  workRoom?: string;
  cccdFront?: string;
  cccdBack?: string;
  cvFile?: string;
  cvFileName?: string;
  cvFileSize?: string;
}

export interface AssignedCTV {
  id: string;
  name: string;
  avatar?: string;
  initials?: string;
  phone?: string;
  cctvCode?: string;
  status: "Đã duyệt" | "Chờ duyệt";
  room?: string;
  taskContent?: string;
}
