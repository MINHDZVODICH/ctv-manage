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
