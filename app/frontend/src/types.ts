export type UserRole = "Admin" | "Cộng tác viên";

export type AccountStatus = "Kích hoạt" | "Vô hiệu hóa";

export type RequestStatus = "Chờ duyệt" | "Đã duyệt" | "Từ chối";

export type ShiftStatus = "Đã đăng ký" | "Chưa đăng ký" | "Chờ duyệt" | "Nghỉ";

export type MeetingStatus = "Sắp diễn ra" | "Đang diễn ra" | "Đã kết thúc" | "Đã hủy";

export type ParticipantStatus = "confirmed" | "pending" | "declined";

export type ViewTab = "accounts" | "requests" | "schedule" | "meetings" | "profile";

export type ContrastOption = "Thấp" | "Trung bình" | "Cao";
export type AccentColorOption = "Trắng" | "Lục" | "Lam" | "Vàng" | "Đỏ" | "Cam" | "Tím";
export type LanguageOption = "Tiếng Việt" | "Tiếng Anh";

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

export interface ShiftSlot {
  id: string;
  dayIndex: number; // 0 for Mon to 6 for Sun
  dayName: string; // "Thứ 2", "Thứ 3", etc.
  dateStr: string; // "06/07", "07/07", etc.
  shiftType: "morning" | "afternoon" | "evening";
  shiftTimeLabel: string; // "08:00 - 12:00", "13:30 - 17:30", "18:00 - 21:00"
  title?: string;
  status: ShiftStatus;
  allowRegister: boolean;
  assignedCTVs?: AssignedCTV[];
  targetCapacity?: number;
  notes?: string;
  workDate?: string; // ISO date (YYYY-MM-DD) for calendar navigation
  room?: string;
  workContent?: string;
  registrationId?: string;
  registrationStartDate?: string;
  registrationEndDate?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "success" | "warning" | "danger";
}

export interface Participant {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  initials?: string;
  status: ParticipantStatus;
}

export interface MeetingItem {
  id: string;
  title: string;
  dateDisplay: string; // e.g. "Thứ Hai, 16/10/2023"
  dateKey: string; // "2023-10-16"
  dayIndex: number; // 0 to 6 (Thứ 2 đến Chủ Nhật)
  startTime: string; // e.g. "08:30" or "14:00"
  timeRange?: string; // e.g. "08:30 - 10:30"
  location: string;
  subLocation?: string;
  organizer: string;
  status: MeetingStatus;
  statusColor: "info" | "warning" | "success" | "danger";
  description: string[];
  participants: Participant[];
  isOnline?: boolean;
}

export * from "./utils/formatters";
