import type { AssignedCTV, ShiftSlot } from "../types";
import { formatRoomLabel } from "./rooms";

export function getAssignedCTVsForDate(
  shifts: ShiftSlot[],
  workDate: string,
  shiftType: "morning" | "afternoon",
): AssignedCTV[] {
  const uniqueCTVs = new Map<string, AssignedCTV>();

  shifts
    .filter((shift) => shift.workDate === workDate && shift.shiftType === shiftType)
    .forEach((shift) => {
      (shift.assignedCTVs || []).forEach((ctv) => {
        const key = ctv.id || ctv.name.trim().toLowerCase();
        if (!uniqueCTVs.has(key)) {
          uniqueCTVs.set(key, {
            ...ctv,
            room: formatRoomLabel(ctv.room || shift.room),
            taskContent: ctv.taskContent || shift.workContent,
          });
        }
      });
    });

  return Array.from(uniqueCTVs.values());
}

/**
 * Calculates milliseconds until 17:30:01 Asia/Bangkok (10:30:01 UTC) on today's calendar date in Bangkok.
 * If 17:30 has already passed today in Asia/Bangkok, returns null.
 */
export function getMsUntilPostCutoffRefresh(now = new Date()): number | null {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const y = Number(values.year);
  const m = Number(values.month) - 1;
  const d = Number(values.day);

  // 17:30:01 Asia/Bangkok is 10:30:01 UTC on the same calendar day
  const targetUtc = new Date(Date.UTC(y, m, d, 10, 30, 1, 0));
  const diff = targetUtc.getTime() - now.getTime();
  return diff > 0 ? diff : null;
}
