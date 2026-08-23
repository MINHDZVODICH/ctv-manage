import assert from "node:assert/strict";
import test from "node:test";
import type { ShiftSlot, UserAccount } from "../src/types";
import { getAssignedCTVsForDate } from "../src/utils/scheduleSelectors";

const accounts: UserAccount[] = [
  {
    id: "ctv-1",
    stt: 1,
    name: "CTV Một",
    email: "ctv1@example.com",
    phone: "0900000001",
    role: "Cộng tác viên",
    status: "Kích hoạt",
    registerDate: "17/08/2026",
  },
  {
    id: "admin-1",
    stt: 2,
    name: "Quản trị viên",
    email: "admin@example.com",
    phone: "0900000002",
    role: "Admin",
    status: "Kích hoạt",
    registerDate: "17/08/2026",
  },
];

const createShift = (overrides: Partial<ShiftSlot>): ShiftSlot => ({
  id: "shift-1",
  dayIndex: 1,
  dayName: "Thứ 3",
  dateStr: "18/08",
  workDate: "2026-08-18",
  shiftType: "morning",
  shiftTimeLabel: "08:00 - 12:00",
  status: "Đã đăng ký",
  allowRegister: false,
  assignedCTVs: [],
  ...overrides,
});

test("returns only real assignments for the exact date and shift", () => {
  const shifts = [
    createShift({
      room: "Buồng 2",
      workContent: "Tiếp nhận hồ sơ",
      assignedCTVs: [
        { id: "ctv-1", name: "CTV Một", status: "Đã duyệt" },
        { id: "admin-1", name: "Quản trị viên", status: "Đã duyệt" },
      ],
    }),
    createShift({ id: "shift-other-date", workDate: "2026-08-25" }),
  ];

  assert.deepEqual(
    getAssignedCTVsForDate(shifts, accounts, "2026-08-18", "morning"),
    [
      {
        id: "ctv-1",
        name: "CTV Một",
        status: "Đã duyệt",
        room: "Buồng 2",
        taskContent: "Tiếp nhận hồ sơ",
      },
    ],
  );
});

test("does not fabricate assignments for empty dates or special weekdays", () => {
  assert.deepEqual(getAssignedCTVsForDate([], accounts, "2026-08-18", "morning"), []);

  const fridayAfternoon = createShift({
    id: "friday-afternoon",
    dayIndex: 4,
    dayName: "Thứ 6",
    dateStr: "21/08",
    workDate: "2026-08-21",
    shiftType: "afternoon",
    assignedCTVs: [{ id: "ctv-1", name: "CTV Một", status: "Đã duyệt" }],
  });

  assert.equal(
    getAssignedCTVsForDate([fridayAfternoon], accounts, "2026-08-21", "afternoon").length,
    1,
  );
});
