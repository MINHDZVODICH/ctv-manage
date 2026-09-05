import { Errors } from '../../shared/errors.js';
import { formatUtcDateToYmd, parseYmdToUtcDate } from '../../shared/timezone.js';

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------

export const ROOM_CODES = ['ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4'] as const;
export type RoomCode = (typeof ROOM_CODES)[number];

export const PERIODS = ['MORNING', 'AFTERNOON'] as const;
export type Period = (typeof PERIODS)[number];

export interface UpsertScheduleInput {
  roomCode: string;
  slots: { weekday: number; period: string }[];
  expectedVersion?: number;
}

export type UpsertRegistrationInput = UpsertScheduleInput;

// ---------------------------------------------------------------------------
// Pure Helpers & Validation
// ---------------------------------------------------------------------------

export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00.000Z');
  return !isNaN(d.getTime()) && formatUtcDateToYmd(d) === s;
}

export function startOfMonthYmd(month: string): string {
  return `${month}-01`;
}

export function endOfMonthYmd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)); // day 0 of next month
  return formatUtcDateToYmd(last);
}

export function monthRangeToUtcDates(month: string): { from: Date; to: Date } {
  const fromYmd = startOfMonthYmd(month);
  const toYmd = endOfMonthYmd(month);
  return { from: parseYmdToUtcDate(fromYmd), to: parseYmdToUtcDate(toYmd) };
}

export function validateScheduleInput(input: UpsertScheduleInput): void {
  if (!ROOM_CODES.includes(input.roomCode as RoomCode)) {
    throw Errors.badRequest('INVALID_ROOM_CODE', `roomCode must be one of ${ROOM_CODES.join(', ')}`);
  }
  if (!Array.isArray(input.slots)) {
    throw Errors.badRequest('INVALID_SLOTS', 'slots must be an array');
  }
  for (const s of input.slots) {
    if (!Number.isInteger(s.weekday) || s.weekday < 1 || s.weekday > 5) {
      throw Errors.badRequest('INVALID_WEEKDAY', 'weekday must be integer 1-5 (Mon-Fri)');
    }
    if (!PERIODS.includes(s.period as Period)) {
      throw Errors.badRequest('INVALID_PERIOD', `period must be one of ${PERIODS.join(', ')}`);
    }
  }
}

export function dedupeSlots(
  slots: { weekday: number; period: string }[],
): { weekday: number; period: string }[] {
  const map = new Map<string, { weekday: number; period: string }>();
  for (const s of slots) {
    const k = `${s.weekday}:${s.period}`;
    if (!map.has(k)) map.set(k, { weekday: s.weekday, period: s.period });
  }
  return [...map.values()].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.period.localeCompare(b.period);
  });
}
