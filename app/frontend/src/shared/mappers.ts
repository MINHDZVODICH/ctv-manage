import type {
  UserAccount,
  RegistrationRequest,
  ShiftSlot,
  AssignedCTV,
  UserRole,
  AccountStatus,
  RequestStatus,
} from '../types';
import { formatRoomLabel } from '../utils/rooms';

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
  workDate: string; // YYYY-MM-DD
  period: string; // MORNING | AFTERNOON
  shift?: { id: string; workDate: string; period: string };
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

export function myShiftsToSlots(
  shifts: ApiMyShift[],
  currentUser: UserAccount,
  registration?: ApiScheduleRegistration | null,
): ShiftSlot[] {
  const slots: ShiftSlot[] = [];
  const seen = new Set<string>();
  for (const s of shifts) {
    const workDate = s.workDate ?? s.shift?.workDate ?? '';
    const period = s.period ?? s.shift?.period ?? 'MORNING';
    if (!workDate) continue;
    const key = `${workDate}:${period}`;
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
      id: s.shiftId,
      dayIndex: dayIndexFromYmd(workDate),
      dayName: DAY_NAMES[dayIndexFromYmd(workDate)] ?? '',
      dateStr: dateStrFromYmd(workDate),
      shiftType,
      shiftTimeLabel: shiftTimeLabel(period),
      status: 'Đã đăng ký',
      allowRegister: true,
      assignedCTVs: [me],
      workDate,
      room: formatRoomLabel(s.roomCode),
      registrationId: s.registrationId ?? registration?.id,
      registrationStartDate: registration?.startDate,
      registrationEndDate: registration?.endDate,
    });
  }
  return slots.sort((a, b) => (a.workDate ?? '').localeCompare(b.workDate ?? ''));
}

// ---------------------------------------------------------------------------
// Schedule summary (admin) -> ShiftSlot[]
// ---------------------------------------------------------------------------

export interface ApiSummaryCell {
  shiftId: string;
  workDate: string;
  period: string;
  count: number;
  shiftAssignments: { id: string; accountId: string; displayName: string; phone?: string | null; roomCode?: string | null; status: string }[];
}

export function summaryToSlots(cells: ApiSummaryCell[]): ShiftSlot[] {
  return cells.map((cell) => {
    const shiftType = mapPeriodToShiftType(cell.period);
    return {
      id: cell.shiftId,
      dayIndex: dayIndexFromYmd(cell.workDate),
      dayName: DAY_NAMES[dayIndexFromYmd(cell.workDate)] ?? '',
      dateStr: dateStrFromYmd(cell.workDate),
      shiftType,
      shiftTimeLabel: shiftTimeLabel(cell.period),
      status: cell.count > 0 ? ('Đã đăng ký' as const) : ('Chưa đăng ký' as const),
      allowRegister: false,
      assignedCTVs: cell.shiftAssignments.map((a) => ({
        id: a.accountId,
        name: a.displayName,
        phone: a.phone ?? undefined,
        status: 'Đã duyệt' as const,
        room: formatRoomLabel(a.roomCode),
      })),
      workDate: cell.workDate,
    };
  });
}
