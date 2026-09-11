import type { WeeklyShiftDto, WorkHistoryDto } from './types';

// Verify WeeklyShiftDto has weekday and period, and no workDate
type AssertHasNoWorkDate<T> = 'workDate' extends keyof T ? never : true;
export const _testWeeklyNoWorkDate: AssertHasNoWorkDate<WeeklyShiftDto> = true;

// Verify WorkHistoryDto has workDate
type AssertHasWorkDate<T> = 'workDate' extends keyof T ? true : never;
export const _testHistoryHasWorkDate: AssertHasWorkDate<WorkHistoryDto> = true;

export function takesWorkHistory(item: WorkHistoryDto): string {
  return item.workDate;
}

const weeklyShift: WeeklyShiftDto = { weekday: 1, period: 'MORNING' };

// @ts-expect-error TypeScript prevents passing WeeklyShift where WorkHistory is required
takesWorkHistory(weeklyShift);

// @ts-expect-error TypeScript prevents reading workDate from WeeklyShift
export const _date = weeklyShift.workDate;
