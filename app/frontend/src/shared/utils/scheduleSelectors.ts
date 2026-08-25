export type SchedulePeriod = 'MORNING' | 'AFTERNOON';
export type RoomCode = 'ROOM_1' | 'ROOM_2' | 'ROOM_3' | 'ROOM_4';

export const WEEKDAYS = [
  { weekday: 1, label: 'Thứ 2', short: 'T2' },
  { weekday: 2, label: 'Thứ 3', short: 'T3' },
  { weekday: 3, label: 'Thứ 4', short: 'T4' },
  { weekday: 4, label: 'Thứ 5', short: 'T5' },
  { weekday: 5, label: 'Thứ 6', short: 'T6' },
] as const;

export const PERIODS = [
  { period: 'MORNING' as const, label: 'Ca sáng' },
  { period: 'AFTERNOON' as const, label: 'Ca chiều' },
];

export const ROOMS: Array<{ code: RoomCode; label: string }> = [
  { code: 'ROOM_1', label: 'Buồng 1' },
  { code: 'ROOM_2', label: 'Buồng 2' },
  { code: 'ROOM_3', label: 'Buồng 3' },
  { code: 'ROOM_4', label: 'Buồng 4' },
];

export function parseYmd(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, amount: number): string {
  return toYmd(new Date(parseYmd(value).getTime() + amount * 86_400_000));
}

export function addMonths(value: string, amount: number): string {
  const [year, month] = value.split('-').map(Number);
  return toYmd(new Date(Date.UTC(year, month - 1 + amount, 1)));
}

export function startOfWeek(value: string): string {
  const date = parseYmd(value);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(value, -offset);
}

export function weekRange(value: string): { from: string; to: string; days: string[] } {
  const from = startOfWeek(value);
  return { from, to: addDays(from, 4), days: Array.from({ length: 5 }, (_, index) => addDays(from, index)) };
}

export function monthOf(value: string): string {
  return value.slice(0, 7);
}

export function shiftKey(workDate: string, period: SchedulePeriod): string {
  return `${workDate}:${period}`;
}

export function todayInBangkok(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const find = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${find('year')}-${find('month')}-${find('day')}`;
}

export function roomLabel(code: RoomCode | null | undefined): string {
  return ROOMS.find((room) => room.code === code)?.label ?? 'Chưa chọn buồng';
}

export function periodLabel(period: SchedulePeriod): string {
  return period === 'MORNING' ? 'Ca sáng' : 'Ca chiều';
}
