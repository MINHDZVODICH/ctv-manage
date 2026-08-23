import type { ShiftSlot } from "../types";

const VALID_SHIFT_TYPES = new Set(["morning", "afternoon", "evening"]);

export function parseStoredShifts(serialized: string | null): ShiftSlot[] | null {
  if (serialized === null) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return null;

    const isValid = parsed.every((item) => {
      if (!item || typeof item !== "object") return false;
      const shift = item as Partial<ShiftSlot>;
      return (
        typeof shift.id === "string" &&
        typeof shift.dayIndex === "number" &&
        typeof shift.shiftType === "string" &&
        VALID_SHIFT_TYPES.has(shift.shiftType) &&
        Array.isArray(shift.assignedCTVs)
      );
    });

    return isValid ? (parsed as ShiftSlot[]) : null;
  } catch {
    return null;
  }
}
