import type { ShiftStatus } from './common';
import type { AssignedCTV } from './accounts';

export type ShiftPeriod = 'MORNING' | 'AFTERNOON';
export type ShiftType = 'morning' | 'afternoon';
export type WeeklyPattern = { [dayIndex: number]: ShiftType[] };

export interface ShiftSlot {
  id: string;
  dayIndex: number; // 0 for Mon to 6 for Sun
  dayName: string; // "Thứ 2", "Thứ 3", etc.
  dateStr: string; // "06/07", "07/07", etc.
  shiftType: 'morning' | 'afternoon' | 'evening';
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

export interface ApiScheduleSlot {
  weekday: number; // 1 = Monday .. 5 = Friday
  period: 'MORNING' | 'AFTERNOON' | string;
}

export interface ApiScheduleData {
  id?: string;
  accountId?: string;
  roomCode: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  shifts: ApiScheduleSlot[];
  patternSlots?: ApiScheduleSlot[];
}

export interface ScheduleResponse {
  data: ApiScheduleData;
}

export interface WeeklyShiftDto {
  weekday: number;
  period: 'MORNING' | 'AFTERNOON';
}

export interface WeeklyScheduleDto {
  id?: string;
  accountId: string;
  roomCode: string;
  version: number;
  shifts: WeeklyShiftDto[];
}

export interface WorkHistoryDto {
  id: string;
  accountId: string;
  workDate: string;
  period: 'MORNING' | 'AFTERNOON';
  roomCode: string;
  status: string;
  recordedAt?: string;
}

export interface ApiShiftAssignment {
  id: string;
  accountId: string;
  displayName: string;
  phone?: string | null;
  roomCode?: string | null;
  status: string;
}

export interface ApiWeeklySummaryCell {
  shiftId?: string;
  weekday: number;
  period: 'MORNING' | 'AFTERNOON' | string;
  count: number;
  shiftAssignments: ApiShiftAssignment[];
}

export type ApiSummaryCell = ApiWeeklySummaryCell;

export interface WeeklySummaryResponse {
  cells: ApiWeeklySummaryCell[];
  data?: { cells: ApiWeeklySummaryCell[] };
}

export interface ApiHistoryCell {
  shiftId: string;
  workDate: string;
  period: 'MORNING' | 'AFTERNOON' | string;
  count: number;
  shiftAssignments: ApiShiftAssignment[];
}

export interface HistoryResponse {
  month: string;
  cells: ApiHistoryCell[];
  data?: { month: string; cells: ApiHistoryCell[] };
}
