import type { ShiftSlot, UserAccount } from '../../../shared/types';
import type {
  ApiScheduleData,
  ApiWeeklySummaryCell,
  ApiSummaryCell,
  ApiMyShift,
} from '../../../shared/mappers';
import {
  weeklyScheduleToSlots as sharedWeeklyScheduleToSlots,
  summaryToSlots as sharedSummaryToSlots,
  myShiftsToSlots as sharedMyShiftsToSlots,
  scheduleToPattern as sharedScheduleToPattern,
  historyToSlots as sharedHistoryToSlots,
} from '../../../shared/mappers';

export function weeklyScheduleDtoToSlots(data: ApiScheduleData, user: UserAccount): ShiftSlot[] {
  return sharedWeeklyScheduleToSlots(data, user);
}

export function summaryCellsToSlots(cells: ApiWeeklySummaryCell[]): ShiftSlot[] {
  return sharedSummaryToSlots(cells);
}

export {
  sharedWeeklyScheduleToSlots as weeklyScheduleToSlots,
  sharedSummaryToSlots as summaryToSlots,
  sharedMyShiftsToSlots as myShiftsToSlots,
  sharedScheduleToPattern as scheduleToPattern,
  sharedHistoryToSlots as historyToSlots,
};
