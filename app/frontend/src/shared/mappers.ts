import type {
  UserAccount,
  RegistrationRequest,
  ShiftSlot,
  AssignedCTV,
  UserRole,
  AccountStatus,
  RequestStatus,
  ShiftType,
  WeeklyPattern,
  ApiScheduleSlot,
  ApiScheduleData,
  ScheduleResponse,
  ApiShiftAssignment,
  ApiSummaryCell,
  ApiWeeklySummaryCell,
  WeeklySummaryResponse,
  ApiHistoryCell,
  HistoryResponse,
} from '../types';
import { formatRoomLabel } from '../utils/rooms';

export type {
  ShiftType,
  WeeklyPattern,
  ApiScheduleSlot,
  ApiScheduleData,
  ScheduleResponse,
  ApiShiftAssignment,
  ApiSummaryCell,
  ApiWeeklySummaryCell,
  WeeklySummaryResponse,
  ApiHistoryCell,
  HistoryResponse,
};

// ---------------------------------------------------------------------------
// Backend DTO shapes (mirrors backend controllers)
// ---------------------------------------------------------------------------

export interface ApiAccountRow {
  id: string;
  email: string;
  displayName: string;
  phone?: string | null;
  ctvCode?: string | null;
  role: string;
  status: string;
  version: number;
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  joinedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  mustChangePassword?: boolean;
  adminNotes?: string | null;
  passwordChangedAt?: string | null;
  files?: ApiAccountFile[];
}

export interface ApiAccountFile {
  category: string;
  fileId: string;
  createdAt?: string;
  file?: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  } | null;
}

export interface ApiRegistrationRequest {
  id: string;
  email: string;
  displayName: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  status: string;
  rejectionReason?: string | null;
  reviewedById?: string | null;
  approvedAccountId?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  files?: { category: string; fileId: string; originalName: string; mimeType: string; sizeBytes: number }[];
}

export interface ApiMyShift {
  id: string;
  shiftId: string;
  registrationId?: string | null;
  roomCode?: string | null;
  status: string;
  weekday?: number;
  workDate?: string; // YYYY-MM-DD
  period: string; // MORNING | AFTERNOON
  shift?: { id: string; workDate?: string; period: string };
}

export interface ApiShiftDetail {
  shift: { id: string; workDate: string; period: string };
  assignments: { id: string; accountId: string; displayName: string; phone?: string | null; roomCode?: string | null; status: string }[];
}

export interface ApiScheduleRegistration {
  id: string;
  accountId: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  roomCode: string;
  version: number;
  status: string;
  patternSlots: { registrationId: string; weekday: number; period: string }[];
}

// ---------------------------------------------------------------------------
// Enum mapping helpers
// ---------------------------------------------------------------------------

export function mapRole(role: string): UserRole {
  return role === 'ADMIN' ? 'Admin' : 'Cộng tác viên';
}
export function mapAccountStatus(status: string): AccountStatus {
  return status === 'ACTIVE' ? 'Kích hoạt' : 'Vô hiệu hóa';
}
export function mapRequestStatus(status: string): RequestStatus {
  if (status === 'APPROVED') return 'Đã duyệt';
  if (status === 'REJECTED') return 'Từ chối';
  return 'Chờ duyệt';
}
export function mapPeriodToShiftType(period: string): 'morning' | 'afternoon' {
  return period === 'AFTERNOON' ? 'afternoon' : 'morning';
}

export function fileUrl(fileId: string): string {
  return `/api/v1/files/${fileId}/content`;
}

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function formatDateVN(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickFile(files: ApiAccountFile[] | undefined, category: string) {
  return (files ?? []).find((f) => f.category === category && f.file);
}

// ---------------------------------------------------------------------------
// Account -> UserAccount
// ---------------------------------------------------------------------------

export function accountToUserAccount(a: ApiAccountRow, index = 0): UserAccount {
  const files = a.files ?? [];
  const avatar = pickFile(files, 'AVATAR');
  const cccdFront = pickFile(files, 'CCCD_FRONT');
  const cccdBack = pickFile(files, 'CCCD_BACK');
  const cv = pickFile(files, 'CV');

  return {
    id: a.id,
    stt: index + 1,
    name: a.displayName,
    email: a.email,
    phone: a.phone ?? '',
    role: mapRole(a.role),
    status: mapAccountStatus(a.status),
    avatar: avatar ? fileUrl(avatar.fileId) : undefined,
    initials: initialsOf(a.displayName),
    registerDate: formatDateVN(a.createdAt ?? a.joinedAt),
    dob: a.dateOfBirth ? formatDateVN(a.dateOfBirth) : undefined,
    gender: a.gender ?? undefined,
    cccdFront: cccdFront ? fileUrl(cccdFront.fileId) : undefined,
    cccdBack: cccdBack ? fileUrl(cccdBack.fileId) : undefined,
    cvFile: cv ? fileUrl(cv.fileId) : undefined,
    cvFileName: cv?.file?.originalName,
    cvFileSize: cv?.file ? formatSize(cv.file.sizeBytes) : undefined,
    address: a.address ?? undefined,
    cctvCode: a.ctvCode ?? undefined,
    joinDate: formatDateVN(a.joinedAt),
    notes: a.adminNotes ?? undefined,
  };
}

export function accountsToUserAccounts(rows: ApiAccountRow[]): UserAccount[] {
  return rows.map((a, i) => accountToUserAccount(a, i));
}

// ---------------------------------------------------------------------------
// Registration request -> RegistrationRequest
// ---------------------------------------------------------------------------

export function requestToRegistrationRequest(r: ApiRegistrationRequest, index = 0): RegistrationRequest {
  const files = r.files ?? [];
  const front = files.find((f) => f.category === 'CCCD_FRONT');
  const back = files.find((f) => f.category === 'CCCD_BACK');
  const cv = files.find((f) => f.category === 'CV');

  return {
    id: r.id,
    stt: index + 1,
    name: r.displayName,
    email: r.email,
    phone: r.phone ?? '',
    submittedAt: r.submittedAt ? formatDateVN(r.submittedAt) : '',
    status: mapRequestStatus(r.status),
    initials: initialsOf(r.displayName),
    dob: r.dateOfBirth ? formatDateVN(r.dateOfBirth) : undefined,
    address: r.address ?? undefined,
    cccdFront: front ? fileUrl(front.fileId) : undefined,
    cccdBack: back ? fileUrl(back.fileId) : undefined,
    cvFile: cv ? fileUrl(cv.fileId) : undefined,
    cvFileName: cv?.originalName,
    cvFileSize: cv ? formatSize(cv.sizeBytes) : undefined,
    notes: cv ? `Đã đính kèm hồ sơ CV: ${cv.originalName}` : undefined,
  };
}

export function requestsToRegistrationRequests(rows: ApiRegistrationRequest[]): RegistrationRequest[] {
  return rows.map((r, i) => requestToRegistrationRequest(r, i));
}

// ---------------------------------------------------------------------------
// Shifts -> ShiftSlot[]
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export function dayIndexFromYmd(ymd: string): number {
  // Monday=0 .. Sunday=6
  const d = new Date(ymd + 'T00:00:00Z');
  const js = d.getUTCDay(); // 0 Sun .. 6 Sat
  return js === 0 ? 6 : js - 1;
}

export function dateStrFromYmd(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}`;
}

export function shiftTimeLabel(period: string): string {
  return period === 'AFTERNOON' ? '13:30 - 17:30' : '08:00 - 12:00';
}

export function weeklyScheduleToSlots(
  schedule: ApiScheduleData | null | undefined,
  currentUser: UserAccount,
): ShiftSlot[] {
  if (!schedule || !Array.isArray(schedule.shifts)) return [];
  return schedule.shifts.map((s) => {
    const dayIndex = (s.weekday >= 1 && s.weekday <= 5) ? s.weekday - 1 : 0;
    const shiftType = mapPeriodToShiftType(s.period);
    const me: AssignedCTV = {
      id: currentUser.id,
      name: currentUser.name,
      avatar: currentUser.avatar,
      initials: currentUser.initials || initialsOf(currentUser.name),
      phone: currentUser.phone,
      cctvCode: currentUser.cctvCode,
      status: 'Đã duyệt',
      room: formatRoomLabel(schedule.roomCode),
    };

    return {
      id: `weekly-${s.weekday}-${s.period}`,
      dayIndex,
      dayName: DAY_NAMES[dayIndex] ?? '',
      dateStr: '',
      shiftType,
      shiftTimeLabel: shiftTimeLabel(s.period),
      status: 'Đã đăng ký',
      allowRegister: true,
      assignedCTVs: [me],
      room: formatRoomLabel(schedule.roomCode),
      registrationId: schedule.id,
    };
  });
}

export function myShiftsToSlots(
  shifts: ApiMyShift[],
  currentUser: UserAccount,
  registration?: ApiScheduleRegistration | null,
): ShiftSlot[] {
  const slots: ShiftSlot[] = [];
  const seen = new Set<string>();
  for (const s of shifts) {
    const weekday = s.weekday ?? (s.workDate ? dayIndexFromYmd(s.workDate) + 1 : 1);
    const dayIndex = (weekday >= 1 && weekday <= 5) ? weekday - 1 : 0;
    const period = s.period ?? s.shift?.period ?? 'MORNING';
    const key = `${dayIndex}:${period}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const shiftType = mapPeriodToShiftType(period);
    const me: AssignedCTV = {
      id: currentUser.id,
      name: currentUser.name,
      avatar: currentUser.avatar,
      initials: currentUser.initials,
      phone: currentUser.phone,
      cctvCode: currentUser.cctvCode,
      status: 'Đã duyệt',
      room: formatRoomLabel(s.roomCode),
    };

    slots.push({
      id: s.shiftId || `weekly-${weekday}-${period}`,
      dayIndex,
      dayName: DAY_NAMES[dayIndex] ?? '',
      dateStr: s.workDate ? dateStrFromYmd(s.workDate) : '',
      shiftType,
      shiftTimeLabel: shiftTimeLabel(period),
      status: 'Đã đăng ký',
      allowRegister: true,
      assignedCTVs: [me],
      workDate: s.workDate,
      room: formatRoomLabel(s.roomCode),
      registrationId: s.registrationId ?? registration?.id,
      registrationStartDate: registration?.startDate,
      registrationEndDate: registration?.endDate,
    });
  }
  return slots.sort((a, b) => a.dayIndex - b.dayIndex);
}

// ---------------------------------------------------------------------------
// Schedule -> WeeklyPattern
// ---------------------------------------------------------------------------

export function scheduleToPattern(
  slotsOrData?:
    | ApiScheduleSlot[]
    | ApiScheduleData
    | ScheduleResponse
    | { shifts?: ApiScheduleSlot[]; patternSlots?: ApiScheduleSlot[] }
    | null,
): WeeklyPattern {
  const pattern: WeeklyPattern = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  if (!slotsOrData) return pattern;

  let slots: ApiScheduleSlot[] = [];
  if (Array.isArray(slotsOrData)) {
    slots = slotsOrData;
  } else if ('data' in slotsOrData && slotsOrData.data && Array.isArray((slotsOrData.data as ApiScheduleData).shifts)) {
    slots = (slotsOrData.data as ApiScheduleData).shifts;
  } else if ('shifts' in slotsOrData && Array.isArray(slotsOrData.shifts)) {
    slots = slotsOrData.shifts;
  } else if ('patternSlots' in slotsOrData && Array.isArray(slotsOrData.patternSlots)) {
    slots = slotsOrData.patternSlots;
  }

  for (const slot of slots) {
    if (!slot || typeof slot.weekday !== 'number') continue;
    // Backend weekday is 1 (Monday) .. 5 (Friday).
    // UI dayIndex is 0 (Monday) .. 4 (Friday).
    let dayIndex = slot.weekday;
    if (dayIndex >= 1 && dayIndex <= 5) {
      dayIndex = dayIndex - 1;
    } else if (dayIndex < 0 || dayIndex > 4) {
      continue;
    }

    const shiftType: ShiftType = mapPeriodToShiftType(slot.period);
    if (!pattern[dayIndex].includes(shiftType)) {
      pattern[dayIndex].push(shiftType);
    }
  }

  return pattern;
}

export const scheduleToWeeklyPattern = scheduleToPattern;

// ---------------------------------------------------------------------------
// Schedule summary & Work history -> ShiftSlot[]
// ---------------------------------------------------------------------------

export function summaryToSlots(cells: ApiWeeklySummaryCell[]): ShiftSlot[] {
  return (cells ?? []).map((cell) => {
    const shiftType = mapPeriodToShiftType(cell.period);
    const dayIndex = typeof cell.weekday === 'number' && cell.weekday >= 1 && cell.weekday <= 5
      ? cell.weekday - 1
      : 0;
    const dayName = DAY_NAMES[dayIndex] ?? '';

    return {
      id: cell.shiftId || `weekly-${cell.weekday}-${cell.period}`,
      dayIndex,
      dayName,
      dateStr: '',
      shiftType,
      shiftTimeLabel: shiftTimeLabel(cell.period),
      status: cell.count > 0 ? ('Đã đăng ký' as const) : ('Chưa đăng ký' as const),
      allowRegister: false,
      assignedCTVs: (cell.shiftAssignments || []).map((a) => ({
        id: a.accountId,
        name: a.displayName,
        initials: initialsOf(a.displayName),
        phone: a.phone ?? undefined,
        status: 'Đã duyệt' as const,
        room: formatRoomLabel(a.roomCode),
      })),
    };
  });
}

export const weeklySummaryToSlots = summaryToSlots;

export function historyToSlots(cells: ApiHistoryCell[]): ShiftSlot[] {
  return (cells ?? []).map((cell) => {
    const shiftType = mapPeriodToShiftType(cell.period);
    const dayIndex = dayIndexFromYmd(cell.workDate);
    const dayName = DAY_NAMES[dayIndex] ?? '';
    const dateStr = dateStrFromYmd(cell.workDate);

    return {
      id: cell.shiftId || `history-${cell.workDate}-${cell.period}`,
      dayIndex,
      dayName,
      dateStr,
      shiftType,
      shiftTimeLabel: shiftTimeLabel(cell.period),
      status: cell.count > 0 ? ('Đã đăng ký' as const) : ('Chưa đăng ký' as const),
      allowRegister: false,
      assignedCTVs: (cell.shiftAssignments || []).map((a) => ({
        id: a.accountId,
        name: a.displayName,
        initials: initialsOf(a.displayName),
        phone: a.phone ?? undefined,
        status: 'Đã duyệt' as const,
        room: formatRoomLabel(a.roomCode),
      })),
      workDate: cell.workDate,
    };
  });
}

export const historyCellsToSlots = historyToSlots;

export interface ApiHistoryEntry {
  id: string;
  workDate: string;
  period: 'MORNING' | 'AFTERNOON' | string;
  roomCode: string;
}

export function historyEntriesToSlots(entries: ApiHistoryEntry[]): ShiftSlot[] {
  return (entries ?? []).map((entry) => {
    const shiftType = mapPeriodToShiftType(entry.period);
    const dayIndex = dayIndexFromYmd(entry.workDate);
    return {
      id: entry.id,
      dayIndex,
      dayName: DAY_NAMES[dayIndex] ?? '',
      dateStr: dateStrFromYmd(entry.workDate),
      shiftType,
      shiftTimeLabel: shiftTimeLabel(entry.period),
      status: 'Đã đăng ký',
      allowRegister: false,
      assignedCTVs: [],
      workDate: entry.workDate,
    };
  });
}
