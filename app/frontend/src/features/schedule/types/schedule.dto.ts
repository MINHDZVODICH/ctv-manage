import type {
  ApiScheduleSlot,
  ApiScheduleData,
  ScheduleResponse,
  WeeklyShiftDto,
  WeeklyScheduleDto,
  WorkHistoryDto,
  ApiShiftAssignment,
  ApiWeeklySummaryCell,
  WeeklySummaryResponse,
  ApiHistoryCell,
  HistoryResponse,
} from '../../../shared/types/schedule';

export type {
  ApiScheduleSlot,
  ApiScheduleData,
  ScheduleResponse,
  WeeklyShiftDto,
  WeeklyScheduleDto,
  WorkHistoryDto,
  ApiShiftAssignment,
  ApiWeeklySummaryCell,
  WeeklySummaryResponse,
  ApiHistoryCell,
  HistoryResponse,
};

export interface UpsertSchedulePayload {
  roomCode: string;
  slots: Array<{ weekday: number; period: 'MORNING' | 'AFTERNOON' }>;
  expectedVersion?: number;
}
