import assert from "node:assert/strict";
import test from "node:test";
import { parseStoredShifts } from "../src/utils/shiftStorage";

test("accepts valid persisted shifts without requiring fixture IDs", () => {
  const stored = JSON.stringify([
    {
      id: "user-created-shift",
      dayIndex: 0,
      dayName: "Thứ 2",
      dateStr: "17/08",
      workDate: "2026-08-17",
      shiftType: "morning",
      shiftTimeLabel: "08:00 - 12:00",
      status: "Đã đăng ký",
      allowRegister: false,
      assignedCTVs: [],
    },
  ]);

  assert.equal(parseStoredShifts(stored)?.[0].id, "user-created-shift");
  assert.deepEqual(parseStoredShifts("[]"), []);
});

test("rejects malformed or unsupported persisted shift data", () => {
  assert.equal(parseStoredShifts(null), null);
  assert.equal(parseStoredShifts("not-json"), null);
  assert.equal(parseStoredShifts(JSON.stringify([{ id: "broken" }])), null);
  assert.equal(
    parseStoredShifts(
      JSON.stringify([
        { id: "broken", dayIndex: 0, shiftType: "overnight", assignedCTVs: [] },
      ]),
    ),
    null,
  );
});
