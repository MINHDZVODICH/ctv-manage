export const BANGKOK_TZ = 'Asia/Bangkok';

/**
 * Returns the current date in Asia/Bangkok as YYYY-MM-DD.
 */
export function todayInBangkok(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
}

/**
 * Returns the current month in Asia/Bangkok as YYYY-MM.
 */
export function currentMonthInBangkok(now: Date = new Date()): string {
  return todayInBangkok(now).slice(0, 7);
}

/**
 * Stored as UTC midnight so comparisons are stable regardless of server tz.
 */
export function parseYmdToUtcDate(ymd: string): Date {
  return new Date(ymd + 'T00:00:00.000Z');
}

export function formatUtcDateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(ymd: string, days: number): string {
  const d = parseYmdToUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcDateToYmd(d);
}

/**
 * Returns ISO weekday (Monday=1 .. Sunday=7).
 */
export function weekdayUtc(d: Date): number {
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}
