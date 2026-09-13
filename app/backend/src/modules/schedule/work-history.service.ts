import { SnapshotCoordinatorService } from './snapshot-coordinator.service.js';
import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import { formatUtcDateToYmd, todayInBangkok } from '../../shared/timezone.js';
import { monthRangeToUtcDates } from './schedule.types.js';

// ---------------------------------------------------------------------------
// DTOs & Interfaces
// ---------------------------------------------------------------------------

export interface SnapshotTodayWorkHistoryResult {
  processedCount: number;
  skipped?: boolean;
  reason?: string;
}

export interface MyWorkHistoryEntryDto {
  id: string;
  workDate: string;
  period: string;
  roomCode: string;
}

export interface MyWorkHistoryDto {
  month: string;
  entries: MyWorkHistoryEntryDto[];
}

export interface WorkHistoryEntryDto {
  id: string;
  accountId: string;
  workDate: string;
  period: string;
  roomCode: string;
  status: string;
}

export interface WorkHistoryAssignmentDto {
  id: string;
  accountId: string;
  displayName: string;
  phone: string | null;
  roomCode: string;
  status: string;
}

export interface WorkHistoryCellDto {
  shiftId: string;
  workDate: string;
  period: string;
  count: number;
  shiftAssignments: WorkHistoryAssignmentDto[];
}

export interface WorkHistoryResponseDto {
  month: string;
  entries: WorkHistoryEntryDto[];
  cells: WorkHistoryCellDto[];
}

// ---------------------------------------------------------------------------
// snapshotTodayWorkHistory (17:30 Asia/Bangkok snapshot cutoff)
// ---------------------------------------------------------------------------

/** Compatibility entry point: all writers use the same persisted cursor. */
export async function snapshotTodayWorkHistory(
  now = new Date(),
): Promise<SnapshotTodayWorkHistoryResult> {
  const processedCount = await new SnapshotCoordinatorService().reconcilePass(now);
  const today = todayInBangkok(now);
  if (processedCount === 0 && now < new Date(today + 'T10:30:00.000Z')) {
    return { processedCount, skipped: true, reason: 'BEFORE_CUTOFF' };
  }
  if (processedCount === 0 && [0, 6].includes(new Date(today).getUTCDay())) {
    return { processedCount, skipped: true, reason: 'WEEKEND' };
  }
  return { processedCount };
}

// ---------------------------------------------------------------------------
// getWorkHistory & getMyWorkHistory
// ---------------------------------------------------------------------------

export async function getMyWorkHistory(
  accountId: string,
  month: string,
): Promise<MyWorkHistoryDto> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw Errors.badRequest('INVALID_MONTH', 'month must be YYYY-MM');
  }

  const range = monthRangeToUtcDates(month);
  const rows = await prisma.history.findMany({
    where: {
      accountId,
      workDate: { gte: range.from, lte: range.to },
    },
    orderBy: [{ workDate: 'asc' }, { period: 'asc' }],
  });

  const entries = rows.map((row) => ({
    id: row.id,
    workDate: formatUtcDateToYmd(row.workDate),
    period: row.period,
    roomCode: row.roomCode,
  }));

  return { month, entries };
}

export async function getWorkHistory(params: {
  month: string;
  accountId?: string;
}): Promise<WorkHistoryResponseDto> {
  if (!/^\d{4}-\d{2}$/.test(params.month)) {
    throw Errors.badRequest('INVALID_MONTH', 'month must be YYYY-MM');
  }

  const range = monthRangeToUtcDates(params.month);
  const rows = await prisma.history.findMany({
    where: {
      workDate: { gte: range.from, lte: range.to },
      ...(params.accountId ? { accountId: params.accountId } : {}),
    },
    include: { account: true },
    orderBy: [{ workDate: 'asc' }, { period: 'asc' }, { accountId: 'asc' }],
  });

  const entries = rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    workDate: formatUtcDateToYmd(row.workDate),
    period: row.period,
    roomCode: row.roomCode,
    status: row.status,
  }));

  const grouped = new Map<string, WorkHistoryCellDto>();

  for (const row of rows) {
    const workDate = formatUtcDateToYmd(row.workDate);
    const key = `${workDate}:${row.period}`;
    let cell = grouped.get(key);
    if (!cell) {
      cell = {
        shiftId: `history-${workDate}-${row.period}`,
        workDate,
        period: row.period,
        count: 0,
        shiftAssignments: [],
      };
      grouped.set(key, cell);
    }

    cell.shiftAssignments.push({
      id: row.id,
      accountId: row.accountId,
      displayName: row.account.displayName,
      phone: row.account.phone ?? null,
      roomCode: row.roomCode,
      status: row.status,
    });
    cell.count = cell.shiftAssignments.length;
  }

  return { month: params.month, entries, cells: [...grouped.values()] };
}
