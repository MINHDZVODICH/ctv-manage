import { parseYmd } from './scheduleSelectors';

export function formatShortDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function formatDayMonth(value: string): string {
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(parseYmd(value));
}

export function formatMonth(value: string): string {
  const [year, month] = value.split('-');
  return `Tháng ${Number(month)}, ${year}`;
}
