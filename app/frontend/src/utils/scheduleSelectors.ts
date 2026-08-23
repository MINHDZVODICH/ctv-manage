import type { AssignedCTV, ShiftSlot, UserAccount } from "../types";

export function getAssignedCTVsForDate(
  shifts: ShiftSlot[],
  accounts: UserAccount[],
  workDate: string,
  shiftType: "morning" | "afternoon",
): AssignedCTV[] {
  const uniqueCTVs = new Map<string, AssignedCTV>();

  shifts
    .filter((shift) => shift.workDate === workDate && shift.shiftType === shiftType)
    .forEach((shift) => {
      (shift.assignedCTVs || []).forEach((ctv) => {
        const account = accounts.find(
          (candidate) =>
            candidate.id === ctv.id ||
            candidate.name.trim().toLowerCase() === ctv.name.trim().toLowerCase(),
        );
        if (account?.role === "Admin") return;

        const key = ctv.id || ctv.name.trim().toLowerCase();
        if (!uniqueCTVs.has(key)) {
          uniqueCTVs.set(key, {
            ...ctv,
            room: ctv.room || shift.room,
            taskContent: ctv.taskContent || shift.workContent,
          });
        }
      });
    });

  return Array.from(uniqueCTVs.values());
}
