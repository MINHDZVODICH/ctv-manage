import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AssignedCTV, ShiftSlot, UserAccount } from "../../types";
import * as api from "../../shared/api";
import { ApiSummaryCell, summaryToSlots } from "../../shared/mappers";
import { formatRoomLabel, ROOM_OPTIONS, roomLabelToCode } from "../../utils/rooms";

interface CTVScheduleWorkspaceProps {
  shifts: ShiftSlot[];
  currentUser: UserAccount;
  onUpdateShifts: (updatedShifts: ShiftSlot[]) => void;
  onShowToast: (message: string) => void;
  onReload?: () => void | Promise<void>;
}

type CalendarView = "week" | "month";
type ShiftType = "morning" | "afternoon";
type WeeklyPattern = Record<number, ShiftType[]>;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REGISTRATION_DAYS = 60;

const WEEKDAYS = [
  { index: 0, short: "T2", label: "Thứ 2" },
  { index: 1, short: "T3", label: "Thứ 3" },
  { index: 2, short: "T4", label: "Thứ 4" },
  { index: 3, short: "T5", label: "Thứ 5" },
  { index: 4, short: "T6", label: "Thứ 6" },
] as const;

const SHIFT_OPTIONS: Array<{
  type: ShiftType;
  label: string;
  icon: string;
  surface: string;
}> = [
  {
    type: "morning",
    label: "Ca sáng",
    icon: "light_mode",
    surface:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/35 dark:text-amber-300 dark:border-amber-800",
  },
  {
    type: "afternoon",
    label: "Ca chiều",
    icon: "wb_twilight",
    surface:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/35 dark:text-purple-300 dark:border-purple-800",
  },
];

const DEFAULT_PATTERN: WeeklyPattern = {
  0: ["morning"],
  1: [],
  2: ["afternoon"],
  3: [],
  4: ["morning"],
};

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const addDays = (date: Date, amount: number) =>
  new Date(startOfDay(date).getTime() + amount * DAY_MS);

const startOfWeek = (date: Date) => {
  const normalized = startOfDay(date);
  const mondayOffset = (normalized.getDay() + 6) % 7;
  return addDays(normalized, -mondayOffset);
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseISODate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatShortDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatDateWithYear = (date: Date) => `${formatShortDate(date)}/${date.getFullYear()}`;

const formatCalendarDate = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`;

const formatFullDate = (date: Date) =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

const getShiftMeta = (type: ShiftType) =>
  SHIFT_OPTIONS.find((option) => option.type === type) || SHIFT_OPTIONS[0];

const getDayIndex = (date: Date) => (date.getDay() + 6) % 7;

export const CTVScheduleWorkspace: React.FC<CTVScheduleWorkspaceProps> = ({
  shifts,
  currentUser,
  onUpdateShifts,
  onShowToast,
  onReload,
}) => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayISO = toISODate(today);
  const legacyWeekStart = useMemo(() => startOfWeek(today), [today]);

  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [calendarDate, setCalendarDate] = useState(today);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftSlot | null>(null);

  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(toISODate(addDays(today, DEFAULT_REGISTRATION_DAYS)));
  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyPattern>(DEFAULT_PATTERN);
  const [room, setRoom] = useState<string>(ROOM_OPTIONS[0]);
  const [historyShifts, setHistoryShifts] = useState<ShiftSlot[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [workContent, setWorkContent] = useState(
    "Hỗ trợ điều phối lịch, kiểm tra dữ liệu và cập nhật tiến độ công việc trong ca.",
  );

  const applyRegistration = useCallback((registration: any) => {
    if (!registration?.id) {
      setStartDate(todayISO);
      setEndDate(toISODate(addDays(today, DEFAULT_REGISTRATION_DAYS)));
      setWeeklyPattern(DEFAULT_PATTERN);
      setRoom(ROOM_OPTIONS[0]);
      return;
    }

    const nextPattern: WeeklyPattern = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    for (const slot of registration.patternSlots ?? []) {
      const dayIndex = Number(slot.weekday) - 1;
      const shiftType: ShiftType = slot.period === "AFTERNOON" ? "afternoon" : "morning";
      if (dayIndex >= 0 && dayIndex <= 4 && !nextPattern[dayIndex].includes(shiftType)) {
        nextPattern[dayIndex].push(shiftType);
      }
    }

    setStartDate(registration.startDate || todayISO);
    setEndDate(
      registration.endDate || toISODate(addDays(today, DEFAULT_REGISTRATION_DAYS)),
    );
    setWeeklyPattern(nextPattern);
    setRoom(formatRoomLabel(registration.roomCode) || ROOM_OPTIONS[0]);
  }, [today, todayISO]);

  const loadCurrentRegistration = useCallback(async () => {
    const response: any = await api.apiGet("/api/v1/users/me/schedule-registration");
    applyRegistration(response.data ?? response);
  }, [applyRegistration]);

  useEffect(() => {
    void loadCurrentRegistration().catch(() => {
      // Keep the current controls usable if the registration lookup is unavailable.
    });
  }, [currentUser.id, loadCurrentRegistration]);

  useEffect(() => {
    if (calendarView !== "month") return;
    const month = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}`;
    let cancelled = false;
    setIsHistoryLoading(true);
    setHistoryError("");

    void api
      .apiGet(`/api/v1/users/me/work-history?month=${month}`)
      .then((response: any) => {
        if (cancelled) return;
        const cells: ApiSummaryCell[] = response.data?.cells ?? response.cells ?? [];
        setHistoryShifts(summaryToSlots(cells));
      })
      .catch(() => {
        if (!cancelled) setHistoryError("Không thể tải lịch sử làm việc.");
      })
      .finally(() => {
        if (!cancelled) setIsHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [calendarDate, calendarView]);

  useEffect(() => {
    if (!isRegistrationOpen && !selectedShift) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsRegistrationOpen(false);
      setSelectedShift(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isRegistrationOpen, selectedShift]);

  const resolveShiftDate = (shift: ShiftSlot) =>
    shift.workDate || toISODate(addDays(legacyWeekStart, shift.dayIndex));

  const isAssignedToCurrentUser = (shift: ShiftSlot) =>
    (shift.assignedCTVs || []).some(
      (ctv) => ctv.id === currentUser.id || ctv.name === currentUser.name,
    );

  const myShifts = useMemo(
    () =>
      shifts
        .filter(
          (shift) =>
            shift.dayIndex >= 0 &&
            shift.dayIndex <= 4 &&
            (shift.shiftType === "morning" || shift.shiftType === "afternoon") &&
            isAssignedToCurrentUser(shift),
        )
        .sort((a, b) => resolveShiftDate(a).localeCompare(resolveShiftDate(b))),
    [shifts, currentUser.id, currentUser.name, legacyWeekStart],
  );

  const getMyShift = (date: Date, shiftType: ShiftType) => {
    const dateISO = toISODate(date);
    return myShifts.find((shift) => shift.workDate === dateISO && shift.shiftType === shiftType);
  };

  const getVisibleShift = (date: Date, shiftType: ShiftType) => {
    const dayIndex = getDayIndex(date);
    if (!(weeklyPattern[dayIndex] || []).includes(shiftType)) return null;

    return (
      getMyShift(date, shiftType) || {
        id: `weekly-pattern-${dayIndex}-${shiftType}`,
        workDate: toISODate(date),
        dayIndex,
        dayName: WEEKDAYS[dayIndex]?.label || "Thứ",
        dateStr: formatShortDate(date),
        shiftType,
        shiftTimeLabel: shiftType === "morning" ? "Ca sáng" : "Ca chiều",
        status: "Đã đăng ký",
        allowRegister: true,
        room,
        assignedCTVs: [
          {
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            initials: currentUser.initials || currentUser.name.slice(0, 2).toUpperCase(),
            phone: currentUser.phone,
            cctvCode: currentUser.cctvCode,
            status: "Đã duyệt",
            room,
          },
        ],
      }
    );
  };

  const getHistoryShift = (date: Date, shiftType: ShiftType) => {
    const dateISO = toISODate(date);
    return historyShifts.find(
      (shift) =>
        shift.workDate === dateISO &&
        shift.shiftType === shiftType &&
        isAssignedToCurrentUser(shift),
    );
  };

  const weekStart = startOfWeek(calendarDate);
  const weekDays = Array.from({ length: 5 }, (_, index) => addDays(weekStart, index));
  const weekRangeLabel = `${formatShortDate(weekDays[0])} - ${formatDateWithYear(weekDays[4])}`;

  const monthStart = startOfMonth(calendarDate);
  const monthWeeks: Array<Array<Date | null>> = [];
  let currentMonthWeek: Array<Date | null> = [null, null, null, null, null];
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const weekDay = date.getDay();
    if (weekDay < 1 || weekDay > 5) continue;

    currentMonthWeek[weekDay - 1] = date;
    if (weekDay === 5) {
      monthWeeks.push(currentMonthWeek);
      currentMonthWeek = [null, null, null, null, null];
    }
  }

  if (currentMonthWeek.some(Boolean)) monthWeeks.push(currentMonthWeek);

  const todayShifts = myShifts.filter((shift) => shift.workDate === todayISO);

  const openRegistration = () => {
    setIsRegistrationOpen(true);
    void loadCurrentRegistration().catch(() => {
      // The already loaded weekly pattern remains available in the modal.
    });
  };

  const changeMonth = (amount: number) => {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const changeWeek = (amount: number) => {
    setCalendarDate((current) => addDays(current, amount * 7));
  };

  const togglePattern = (dayIndex: number, shiftType: ShiftType) => {
    setWeeklyPattern((current) => {
      const selectedShifts = current[dayIndex] || [];
      return {
        ...current,
        [dayIndex]: selectedShifts.includes(shiftType)
          ? selectedShifts.filter((selected) => selected !== shiftType)
          : [...selectedShifts, shiftType],
      };
    });
  };

  const getFirstRegistrationDate = (dayIndex: number) => {
    if (!startDate || !endDate) return undefined;
    const rangeStart = parseISODate(startDate);
    const rangeEnd = parseISODate(endDate);
    if (rangeEnd < rangeStart) return undefined;

    const offset = (dayIndex - getDayIndex(rangeStart) + 7) % 7;
    const firstDate = addDays(rangeStart, offset);
    return firstDate <= rangeEnd ? firstDate : undefined;
  };

  const createCTVRecord = (): AssignedCTV => ({
    id: currentUser.id,
    name: currentUser.name,
    avatar: currentUser.avatar,
    initials: currentUser.initials || currentUser.name.slice(0, 2).toUpperCase(),
    phone: currentUser.phone,
    cctvCode: currentUser.cctvCode,
    status: "Đã duyệt",
  });

  const handleRegisterSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    const rangeStart = parseISODate(startDate);
    const rangeEnd = parseISODate(endDate);

    if (rangeEnd < rangeStart) {
      onShowToast("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
      return;
    }

    const slots: { weekday: number; period: string }[] = [];
    for (let d = 0; d < 5; d++) {
      for (const p of weeklyPattern[d] || []) {
        slots.push({ weekday: d + 1, period: p === "morning" ? "MORNING" : "AFTERNOON" });
      }
    }

    if (slots.length === 0) {
      onShowToast("Vui lòng chọn ít nhất một ca trong tuần.");
      return;
    }

    const roomCode = roomLabelToCode(room);
    if (!roomCode) {
      onShowToast("Vui lòng chọn buồng làm việc.");
      return;
    }

    try {
      // fetch current registration version if exists
      let expectedVersion: number | undefined;
      try {
        const regRes: any = await api.apiGet("/api/v1/users/me/schedule-registration");
        const reg = regRes.data ?? regRes;
        if (reg?.id) expectedVersion = reg.version;
      } catch {}

      const response: any = await api.apiPut("/api/v1/users/me/schedule-registration", {
        roomCode,
        slots,
        expectedVersion,
      });
      applyRegistration(response.data ?? response);
      setCalendarDate(today);
      setCalendarView("week");
      setIsRegistrationOpen(false);
      onShowToast("Đăng ký thành công");
      if (onReload) await onReload();
    } catch (err: any) {
      onShowToast(err.message || "Đăng ký lịch thất bại");
    }
  };

  const removeCurrentUserFromShift = (shift: ShiftSlot) => {
    const assignedCTVs = (shift.assignedCTVs || []).filter(
      (ctv) => ctv.id !== currentUser.id && ctv.name !== currentUser.name,
    );

    return {
      ...shift,
      assignedCTVs,
      status: assignedCTVs.length > 0 ? shift.status : ("Chưa đăng ký" as const),
    };
  };

  const handleCancelShift = async () => {
    if (!selectedShift) return;
    const selectedShiftDate = resolveShiftDate(selectedShift);
    if (selectedShiftDate < todayISO) {
      onShowToast("Ca làm việc đã qua nên không thể hủy.");
      return;
    }
    // Find assignmentId for this shift: need to fetch from backend
    try {
      const myShiftsRes: any = await api.apiGet("/api/v1/users/me/shifts");
      const list: any[] = myShiftsRes.data ?? [];
      const match = list.find((a: any) => (a.shiftId === selectedShift.id) || (a.shift?.id === selectedShift.id) || (a.workDate === selectedShiftDate && a.period === (selectedShift.shiftType === "afternoon" ? "AFTERNOON" : "MORNING")));
      if (!match) {
        onShowToast("Không tìm thấy ca cần hủy.");
        return;
      }
      await api.apiDelete(`/api/v1/users/me/shift-assignments/${match.id}`);
      onShowToast(`Đã hủy ${getShiftMeta(selectedShift.shiftType as ShiftType).label.toLowerCase()} ngày ${formatShortDate(parseISODate(selectedShiftDate))}.`);
      setSelectedShift(null);
      if (onReload) onReload();
      else window.location.reload();
    } catch (err: any) {
      onShowToast(err.message || "Hủy ca thất bại");
    }
  };

  const handleCancelRecurringShift = async () => {
    if (!selectedShift) return;
    const selectedShiftDate = resolveShiftDate(selectedShift);
    if (selectedShiftDate < todayISO) {
      onShowToast("Ca làm việc đã qua nên không thể hủy.");
      return;
    }
    try {
      const regRes: any = await api.apiGet("/api/v1/users/me/schedule-registration");
      const reg = regRes.data ?? regRes;
      if (!reg?.id) {
        onShowToast("Không tìm thấy lịch đăng ký định kỳ.");
        return;
      }
      const weekday = selectedShift.dayIndex + 1; // 1..5
      const period = selectedShift.shiftType === "afternoon" ? "AFTERNOON" : "MORNING";
      await api.apiDelete(`/api/v1/users/me/schedule-registrations/${reg.id}/assignments?weekday=${weekday}&period=${period}&fromDate=${selectedShiftDate}`);
      onShowToast(`Đã hủy ca ${getShiftMeta(selectedShift.shiftType as ShiftType).label.toLowerCase()} định kỳ từ ngày ${formatShortDate(parseISODate(selectedShiftDate))} trở đi.`);
      setSelectedShift(null);
      if (onReload) onReload();
      else window.location.reload();
    } catch (err: any) {
      onShowToast(err.message || "Hủy ca định kỳ thất bại");
    }
  };

  const handleRoomChange = (nextRoom: string) => {
    const normalizedRoom = formatRoomLabel(nextRoom);
    if (
      !selectedShift ||
      !normalizedRoom ||
      normalizedRoom === formatRoomLabel(selectedShift.room)
    ) {
      return;
    }

    const selectedShiftDate = resolveShiftDate(selectedShift);
    if (selectedShiftDate < todayISO) {
      onShowToast("Không thể thay đổi buồng làm việc của ca trong quá khứ.");
      return;
    }

    const updatedShifts = [...shifts];

    const isMatchingPattern = (shift: ShiftSlot) => {
      if (selectedShift.registrationId) {
        return (
          shift.registrationId === selectedShift.registrationId &&
          shift.dayIndex === selectedShift.dayIndex &&
          shift.shiftType === selectedShift.shiftType
        );
      }
      return (
        shift.id === selectedShift.id ||
        (!shift.registrationId &&
          shift.dayIndex === selectedShift.dayIndex &&
          shift.shiftType === selectedShift.shiftType)
      );
    };

    const templateShifts = updatedShifts.filter(
      (s) => isMatchingPattern(s) && !s.workDate && isAssignedToCurrentUser(s),
    );

    if (templateShifts.length > 0) {
      const startDateToCheck = addDays(parseISODate(selectedShiftDate), -90);
      const cutoffDate = parseISODate(selectedShiftDate);

      for (let cur = startDateToCheck; cur < cutoffDate; cur = addDays(cur, 1)) {
        if (getDayIndex(cur) === selectedShift.dayIndex) {
          const pastDateISO = toISODate(cur);
          const existingShift = updatedShifts.find(
            (s) => resolveShiftDate(s) === pastDateISO && s.shiftType === selectedShift.shiftType,
          );

          if (!existingShift) {
            templateShifts.forEach((tmpl) => {
              updatedShifts.push({
                ...tmpl,
                id: `past-${tmpl.id}-${pastDateISO}`,
                workDate: pastDateISO,
                dateStr: formatShortDate(cur),
              });
            });
          }
        }
      }
    }

    let updatedCount = 0;

    const resultShifts = updatedShifts.map((shift) => {
      const matched = isMatchingPattern(shift);
      if (!matched || !isAssignedToCurrentUser(shift)) {
        return shift;
      }

      if (shift.workDate) {
        if (shift.workDate >= selectedShiftDate) {
          updatedCount += 1;
          return { ...shift, room: normalizedRoom };
        }
        return shift;
      }

      updatedCount += 1;
      return { ...shift, room: normalizedRoom };
    });

    onUpdateShifts(resultShifts);
    setSelectedShift({ ...selectedShift, room: normalizedRoom });
    onShowToast(
      updatedCount > 0
        ? `Đã đổi sang ${normalizedRoom} cho ca từ ngày ${formatShortDate(parseISODate(selectedShiftDate))} trở đi.`
        : "Không có ca phù hợp để đổi buồng.",
    );
  };

  const selectedShiftDate = selectedShift ? resolveShiftDate(selectedShift) : "";
  const canCancelSelectedShift = Boolean(selectedShift) && selectedShiftDate >= todayISO;

  const renderShiftCard = (shift: ShiftSlot, _compact = false, _showShiftLabel = false) => {
    const meta = getShiftMeta(shift.shiftType as ShiftType);

    return (
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs mx-auto select-none pointer-events-none"
        aria-label={meta.label}
      >
        <span className="material-symbols-outlined text-[20px] font-bold">check</span>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/70 p-4 shadow-sm dark:border-slate-700 dark:from-[#25262b] dark:via-[#25262b] dark:to-blue-950/25">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              calendar_month
            </span>
            Lịch làm việc
          </div>
          <button
            type="button"
            onClick={openRegistration}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent-hover px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto dark:focus-visible:ring-offset-slate-900"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              edit_calendar
            </span>
            Đăng ký lịch làm việc
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#25262b]">
        <div className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/35">
          <div
            className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            role="group"
            aria-label="Chế độ xem lịch"
          >
            {(["week", "month"] as CalendarView[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setCalendarView(view)}
                aria-pressed={calendarView === view}
                className={`min-h-11 rounded-lg px-4 text-xs font-bold transition-colors duration-200 ${
                  calendarView === view
                    ? "bg-accent text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {view === "week" ? "Lịch tuần" : "Lịch sử làm việc"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <span
                className="material-symbols-outlined text-[18px] text-accent"
                aria-hidden="true"
              >
                door_front
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{room}</span>
            </div>
          </div>
        </div>

        {calendarView === "week" ? (
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <span
                className="material-symbols-outlined text-[22px] text-accent"
                aria-hidden="true"
              >
                calendar_view_week
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Lịch tuần</h3>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[700px] space-y-3">
                {/* Header: THỨ 2, THỨ 3, THỨ 4, THỨ 5, THỨ 6 */}
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((weekday) => (
                    <div
                      key={weekday.index}
                      className="rounded-xl bg-slate-100/90 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <span>{weekday.label}</span>
                    </div>
                  ))}
                </div>

                {/* Day Cards */}
                <div className="grid grid-cols-5 gap-3">
                  {weekDays.map((date) => {
                    const dateISO = toISODate(date);
                    const isToday = dateISO === todayISO;
                    const morningShift = getVisibleShift(date, "morning");
                    const afternoonShift = getVisibleShift(date, "afternoon");

                    return (
                      <div
                        key={dateISO}
                        className={`rounded-2xl border-2 p-3 min-h-[110px] shadow-2xs transition-colors ${
                          isToday
                            ? "border-accent bg-blue-50/30 dark:border-accent dark:bg-blue-950/25"
                            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <div className="space-y-2">
                          {morningShift ? (
                            <div className="flex w-full items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 shadow-xs select-none pointer-events-none transition-colors dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
                              <span
                                className="material-symbols-outlined text-[18px] text-amber-700 dark:text-amber-400"
                                aria-hidden="true"
                              >
                                wb_sunny
                              </span>
                              <span className="text-amber-900 dark:text-amber-100">Ca Sáng</span>
                            </div>
                          ) : afternoonShift ? (
                            <div className="h-[38px]" aria-hidden="true" />
                          ) : null}

                          {afternoonShift ? (
                            <div className="flex w-full items-center gap-2 rounded-xl border border-purple-200/90 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-900 shadow-xs select-none pointer-events-none transition-colors dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-200">
                              <span
                                className="material-symbols-outlined text-[18px] text-purple-700 dark:text-purple-400"
                                aria-hidden="true"
                              >
                                wb_twilight
                              </span>
                              <span className="text-purple-900 dark:text-purple-100">Ca Chiều</span>
                            </div>
                          ) : morningShift ? (
                            <div className="h-[38px]" aria-hidden="true" />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-[22px] text-accent"
                  aria-hidden="true"
                >
                  calendar_month
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Lịch sử làm việc
                </h3>
              </div>
              {isHistoryLoading && (
                <div
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-accent animate-pulse"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="material-symbols-outlined text-[16px] animate-spin"
                    aria-hidden="true"
                  >
                    progress_activity
                  </span>
                  <span>Đang tải...</span>
                </div>
              )}
              <div
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                role="group"
                aria-label="Chuyển tháng"
              >
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Xem tháng trước"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    chevron_left
                  </span>
                </button>
                <span
                  className="min-w-[112px] px-2 text-center text-xs font-bold text-slate-900 dark:text-slate-100"
                  aria-live="polite"
                >
                  Tháng {monthStart.getMonth() + 1}, {monthStart.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Xem tháng sau"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            {historyError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                {historyError}
              </div>
            )}

            <div className="overflow-x-auto">
              <div className="min-w-[700px] space-y-3">
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day.index}
                      className="rounded-xl bg-slate-100/90 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {day.label}
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {monthWeeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-5 gap-3">
                      {week.map((date, dayIndex) => {
                        if (!date) {
                          return (
                            <div
                              key={dayIndex}
                              className="min-h-[110px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 opacity-40 dark:border-slate-800/60 dark:bg-[#1f2023]/30"
                              aria-hidden="true"
                            />
                          );
                        }

                        const dateISO = toISODate(date);
                        const isToday = dateISO === todayISO;
                        const isPast = dateISO < todayISO;
                        const morningShift = isPast ? getHistoryShift(date, "morning") : null;
                        const afternoonShift = isPast ? getHistoryShift(date, "afternoon") : null;

                        return (
                          <div
                            key={dateISO}
                            className={`flex min-h-[110px] flex-col rounded-2xl border-2 p-3 shadow-2xs transition-colors ${
                              isToday
                                ? "border-accent bg-blue-50/30 dark:border-accent dark:bg-blue-950/25"
                                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                            }`}
                          >
                            <div className="flex items-center justify-center border-b border-slate-100 dark:border-slate-800/80 pb-1.5 mb-2">
                              <span className="flex items-center justify-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <span>{formatShortDate(date)}</span>
                                {isToday && (
                                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    Hôm nay
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {morningShift ? (
                                <div
                                  key={`${dateISO}-morning`}
                                  className="flex w-full items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 shadow-xs select-none pointer-events-none transition-colors dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
                                  aria-label={`Ca Sáng, ${formatShortDate(date)}`}
                                >
                                  <span
                                    className="material-symbols-outlined text-[18px] text-amber-700 dark:text-amber-400"
                                    aria-hidden="true"
                                  >
                                    wb_sunny
                                  </span>
                                  <span className="text-amber-900 dark:text-amber-100">
                                    Ca Sáng
                                  </span>
                                </div>
                              ) : afternoonShift ? (
                                <div className="h-[38px]" aria-hidden="true" />
                              ) : null}

                              {afternoonShift ? (
                                <div
                                  key={`${dateISO}-afternoon`}
                                  className="flex w-full items-center gap-2 rounded-xl border border-purple-200/90 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-900 shadow-xs select-none pointer-events-none transition-colors dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-200"
                                  aria-label={`Ca Chiều, ${formatShortDate(date)}`}
                                >
                                  <span
                                    className="material-symbols-outlined text-[18px] text-purple-700 dark:text-purple-400"
                                    aria-hidden="true"
                                  >
                                    wb_twilight
                                  </span>
                                  <span className="text-purple-900 dark:text-purple-100">
                                    Ca Chiều
                                  </span>
                                </div>
                              ) : morningShift ? (
                                <div className="h-[38px]" aria-hidden="true" />
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {isRegistrationOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setIsRegistrationOpen(false)
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-title"
            className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#25262b]"
          >
            <form onSubmit={handleRegisterSchedule}>
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur dark:border-slate-700 dark:bg-[#25262b]/95">
                <div>
                  <h3
                    id="registration-title"
                    className="text-xl font-bold text-slate-950 dark:text-white"
                  >
                    Đăng ký lịch làm việc
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegistrationOpen(false)}
                  aria-label="Đóng cửa sổ đăng ký"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <label
                    htmlFor="modal-room-select"
                    className="block text-sm font-bold text-slate-900 dark:text-white mb-1.5"
                  >
                    Buồng làm việc
                  </label>
                  <div className="relative">
                    <select
                      id="modal-room-select"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 cursor-pointer"
                    >
                      {ROOM_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <fieldset>
                  <legend className="text-sm font-bold text-slate-900 dark:text-white">
                    Mẫu ca làm việc theo tuần
                  </legend>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="min-w-[500px]">
                      <div className="grid grid-cols-[120px_repeat(5,1fr)] bg-slate-50 dark:bg-slate-900/40">
                        <div className="border-r border-slate-200 p-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 flex items-center justify-center">
                          Ca / Thứ
                        </div>
                        {WEEKDAYS.map((day) => (
                          <div
                            key={day.index}
                            className="border-r border-slate-200 p-2 text-center last:border-r-0 dark:border-slate-700 flex items-center justify-center"
                          >
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {day.short}
                            </p>
                          </div>
                        ))}
                      </div>
                      {SHIFT_OPTIONS.map((shiftOption) => (
                        <div
                          key={shiftOption.type}
                          className="grid grid-cols-[120px_repeat(5,1fr)] border-t border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-center justify-center gap-2 border-r border-slate-200 p-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                            <span
                              className="material-symbols-outlined text-[16px]"
                              aria-hidden="true"
                            >
                              {shiftOption.icon}
                            </span>
                            {shiftOption.label}
                          </div>
                          {WEEKDAYS.map((day) => {
                            const firstDate = getFirstRegistrationDate(day.index);
                            const selected =
                              Boolean(firstDate) &&
                              (weeklyPattern[day.index] || []).includes(shiftOption.type);
                            return (
                              <div
                                key={day.index}
                                className="flex items-center justify-center border-r border-slate-200 p-1.5 last:border-r-0 dark:border-slate-700"
                              >
                                <button
                                  type="button"
                                  onClick={() => togglePattern(day.index, shiftOption.type)}
                                  disabled={!firstDate}
                                  aria-pressed={selected}
                                  aria-label={`${selected ? "Bỏ chọn" : "Chọn"} ${shiftOption.label} ${day.label}${firstDate ? `, ngày đầu tiên ${formatCalendarDate(firstDate)}` : ", ngoài khoảng đăng ký"}`}
                                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 ${selected ? "border-blue-700 bg-blue-700 text-white shadow-xs" : "border-slate-200 bg-white text-slate-400 hover:border-blue-300 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500 dark:hover:text-blue-300"}`}
                                >
                                  <span
                                    className="material-symbols-outlined text-[18px]"
                                    aria-hidden="true"
                                  >
                                    {selected ? "check" : "add"}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </fieldset>
              </div>

              <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end dark:border-slate-700 dark:bg-[#25262b]/95">
                <button
                  type="button"
                  onClick={() => setIsRegistrationOpen(false)}
                  className="min-h-11 rounded-xl px-5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                  <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
                    event_available
                  </span>
                  Đăng ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
