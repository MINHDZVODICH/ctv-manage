export type UserRole = "Admin" | "Cộng tác viên";

export type AccountStatus = "Kích hoạt" | "Vô hiệu hóa";

export type RequestStatus = "Chờ duyệt" | "Đã duyệt" | "Từ chối";

export type ShiftStatus = "Đã đăng ký" | "Chưa đăng ký" | "Chờ duyệt" | "Nghỉ";

export type MeetingStatus = "Sắp diễn ra" | "Đang diễn ra" | "Đã kết thúc" | "Đã hủy";

export type ParticipantStatus = "confirmed" | "pending" | "declined";

export type ViewTab = "accounts" | "requests" | "schedule" | "meetings" | "profile";

export type ContrastOption = "Thấp" | "Trung bình" | "Cao";
export type AccentColorOption = "Xám" | "Lục" | "Lam" | "Vàng" | "Đỏ" | "Cam" | "Tím";
export type LanguageOption = "Tiếng Việt" | "Tiếng Anh";

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
  dateDisplay: string;
  dateKey: string;
  dayIndex: number;
  startTime: string;
  timeRange?: string;
  location: string;
  subLocation?: string;
  organizer: string;
  status: MeetingStatus;
  statusColor: "info" | "warning" | "success" | "danger";
  description: string[];
  participants: Participant[];
  isOnline?: boolean;
}
