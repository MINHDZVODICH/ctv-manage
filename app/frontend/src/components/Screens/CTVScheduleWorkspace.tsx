import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShiftSlot, UserAccount } from "../../types";
import * as api from "../../shared/api";
import {
  ApiHistoryEntry,
  ApiSummaryCell,
  historyEntriesToSlots,
  summaryToSlots,
  scheduleToPattern,
} from "../../shared/mappers";
import { formatRoomLabel, ROOM_OPTIONS, roomLabelToCode } from "../../utils/rooms";
import { getMsUntilPostCutoffRefresh } from "../../utils/scheduleSelectors";
import { useSystemSettings } from "../../context/SystemSettingsContext";

interface CTVScheduleWorkspaceProps {
  currentUser: UserAccount;
  onShowToast: (message: string) => void;
  onReload?: () => void | Promise<void>;
}

type CalendarView = "week" | "month";
type ShiftType = "morning" | "afternoon";
type WeeklyPattern = Record<number, ShiftType[]>;

const APP_TIME_ZONE = "Asia/Bangkok";

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

const createEmptyWeeklyPattern = (): WeeklyPattern => ({
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
});

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getCurrentCalendarDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Number(values.year), Number(values.month) - 1, Number(values.day));
};

const getRegistrationStartDate = (today: Date) => {
  const start = addDays(today, (8 - today.getDay()) % 7);
  return toISODate(start);
};

const addDays = (date: Date, amount: number) => {
  const result = startOfDay(date);
  result.setDate(result.getDate() + amount);
  return result;
};

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

const formatCalendarDate = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`;

interface ShiftBadgeProps {
  shiftType: ShiftType;
  ariaLabel?: string;
  language?: string;
}

const ShiftBadge: React.FC<ShiftBadgeProps> = ({ shiftType, ariaLabel, language }) => {
  const isMorning = shiftType === "morning";
  return (
    <div
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold shadow-2xs select-none ${
        isMorning
          ? "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-purple-200/90 bg-purple-50 text-purple-900 dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-200"
      }`}
      aria-label={ariaLabel}
    >
      <span
        className={`material-symbols-outlined text-[18px] ${
          isMorning ? "text-amber-700 dark:text-amber-400" : "text-purple-700 dark:text-purple-400"
        }`}
        aria-hidden="true"
      >
        {isMorning ? "wb_sunny" : "wb_twilight"}
      </span>
      <span className={isMorning ? "text-amber-900 dark:text-amber-100" : "text-purple-900 dark:text-purple-100"}>
        {language === "Tiếng Anh"
          ? (isMorning ? "Morning" : "Afternoon")
          : (isMorning ? "Ca Sáng" : "Ca Chiều")}
      </span>
    </div>
  );
};

const getDayIndex = (date: Date) => (date.getDay() + 6) % 7;

export const CTVScheduleWorkspace: React.FC<CTVScheduleWorkspaceProps> = ({
  currentUser,
  onShowToast,
  onReload,
}) => {
  const { t, language } = useSystemSettings();
  const today = useMemo(() => startOfDay(getCurrentCalendarDate()), []);
  const todayISO = toISODate(today);
  const legacyWeekStart = useMemo(() => startOfWeek(today), [today]);
  const registrationStartDate = useMemo(() => getRegistrationStartDate(today), [today]);
  const registrationTriggerRef = useRef<HTMLButtonElement>(null);
  const registrationDialogRef = useRef<HTMLDivElement>(null);
  const registrationRoomRef = useRef<HTMLSelectElement>(null);

  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [calendarDate, setCalendarDate] = useState(today);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentRegistrationVersion, setCurrentRegistrationVersion] = useState<number | undefined>(undefined);

  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyPattern>(createEmptyWeeklyPattern);
  const [registrationPattern, setRegistrationPattern] =
    useState<WeeklyPattern>(createEmptyWeeklyPattern);
  const [room, setRoom] = useState<string>(ROOM_OPTIONS[0]);
  const [modalRoom, setModalRoom] = useState<string>(ROOM_OPTIONS[0]);
  const [historyShifts, setHistoryShifts] = useState<ShiftSlot[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRetryKey, setHistoryRetryKey] = useState(0);

  const hasWeeklyShifts = useMemo(() => {
    return Object.values(weeklyPattern).some((shifts) => Boolean(shifts && shifts.length > 0));
  }, [weeklyPattern]);

  const applyRegistration = useCallback((registration: any) => {
    if (!registration || (!registration.id && !registration.shifts && !registration.patternSlots)) {
      setWeeklyPattern(createEmptyWeeklyPattern());
      setRoom(ROOM_OPTIONS[0]);
      setModalRoom(ROOM_OPTIONS[0]);
      setCurrentRegistrationVersion(undefined);
      return;
    }

    const nextPattern = scheduleToPattern(registration.shifts || registration.patternSlots);
    const nextRoom = formatRoomLabel(registration.roomCode) || ROOM_OPTIONS[0];
    setWeeklyPattern(nextPattern);
    setRoom(nextRoom);
    setModalRoom(nextRoom);
    setCurrentRegistrationVersion(registration.version);
  }, []);

  const loadCurrentRegistration = useCallback(async () => {
    const response: any = await api.apiGet("/api/v1/users/me/schedule");
    applyRegistration(response?.data ?? response);
  }, [applyRegistration]);

  const closeRegistration = useCallback((force = false) => {
    if (isSubmitting && !force) return;
    setIsRegistrationOpen(false);
    window.requestAnimationFrame(() => registrationTriggerRef.current?.focus());
  }, [isSubmitting]);

  useEffect(() => {
    void loadCurrentRegistration().catch(() => {
      // Keep the current controls usable if the registration lookup is unavailable.
    });
  }, [currentUser.id, loadCurrentRegistration]);

  const historyRequestController = useRef<AbortController | null>(null);
  const historyRequestSequence = useRef(0);

  const fetchWorkHistory = useCallback(async () => {
    const month = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}`;
    historyRequestController.current?.abort();
    const controller = new AbortController();
    const sequence = ++historyRequestSequence.current;
    historyRequestController.current = controller;

    setIsHistoryLoading(true);
    setHistoryError("");

    try {
      const response: any = await api.apiGet(
        `/api/v1/users/me/work-history?month=${month}`,
        { signal: controller.signal },
      );
      if (sequence !== historyRequestSequence.current) return;
      const entries: ApiHistoryEntry[] | undefined = response.data?.entries ?? response.entries;
      if (Array.isArray(entries)) {
        setHistoryShifts(historyEntriesToSlots(entries));
      } else {
        const cells: ApiSummaryCell[] = response.data?.cells ?? response.cells ?? [];
        setHistoryShifts(summaryToSlots(cells));
      }
    } catch (error) {
      if (!api.isRequestAborted(error)) {
        if (sequence === historyRequestSequence.current) {
          setHistoryError("Không thể tải lịch sử làm việc.");
        }
      }
    } finally {
      if (sequence === historyRequestSequence.current) {
        setIsHistoryLoading(false);
      }
    }
  }, [calendarDate]);

  useEffect(() => {
    if (calendarView === "month") {
      void fetchWorkHistory();
    }
    return () => historyRequestController.current?.abort();
  }, [calendarDate, calendarView, fetchWorkHistory, historyRetryKey]);

  useEffect(() => {
    if (calendarView !== "month") return;

    const handleFocus = () => {
      void fetchWorkHistory();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchWorkHistory();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [calendarView, fetchWorkHistory]);

  useEffect(() => {
    if (calendarView !== "month") return;
    const delay = getMsUntilPostCutoffRefresh();
    if (delay === null) return;

    const timer = window.setTimeout(() => {
      void fetchWorkHistory();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [calendarDate, calendarView, fetchWorkHistory]);

  useEffect(() => {
    if (!isRegistrationOpen) return;
    registrationRoomRef.current?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRegistration();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        registrationDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => window.removeEventListener("keydown", handleDialogKeyDown);
  }, [closeRegistration, isRegistrationOpen]);

  const hasVisibleShift = (dayIndex: number, shiftType: ShiftType) =>
    (weeklyPattern[dayIndex] || []).includes(shiftType);

  const getHistoryShift = (date: Date, shiftType: ShiftType) => {
    const dateISO = toISODate(date);
    return historyShifts.find(
      (shift) => shift.workDate === dateISO && shift.shiftType === shiftType,
    );
  };

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

  const openRegistration = () => {
    setRegistrationPattern({
      0: [...(weeklyPattern[0] || [])],
      1: [...(weeklyPattern[1] || [])],
      2: [...(weeklyPattern[2] || [])],
      3: [...(weeklyPattern[3] || [])],
      4: [...(weeklyPattern[4] || [])],
    });
    setModalRoom(room);
    setIsRegistrationOpen(true);
  };

  const changeMonth = (amount: number) => {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const togglePattern = (dayIndex: number, shiftType: ShiftType) => {
    setRegistrationPattern((current) => {
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
    const rangeStart = parseISODate(registrationStartDate);
    const offset = (dayIndex - getDayIndex(rangeStart) + 7) % 7;
    return addDays(rangeStart, offset);
  };

  const handleRegisterSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const slots: { weekday: number; period: string }[] = [];
    for (let d = 0; d < 5; d++) {
      for (const p of registrationPattern[d] || []) {
        slots.push({ weekday: d + 1, period: p === "morning" ? "MORNING" : "AFTERNOON" });
      }
    }

    const roomCode = roomLabelToCode(modalRoom);
    if (!roomCode) {
      onShowToast("Vui lòng chọn buồng làm việc.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response: any = await api.apiPut("/api/v1/users/me/schedule", {
        roomCode,
        slots,
        expectedVersion: currentRegistrationVersion,
      });
      const savedRegistration = response?.data ?? response;
      applyRegistration(savedRegistration);
      setCalendarView("week");
      closeRegistration(true);
      if (onReload) {
        try {
          await onReload();
        } catch {
          onShowToast("Đã lưu lịch nhưng không thể tải lại Lịch tuần. Vui lòng thử làm mới trang.");
          return;
        }
      }
      onShowToast(currentRegistrationVersion !== undefined ? "Cập nhật lịch làm việc thành công" : "Đăng ký thành công");
    } catch (err: any) {
      if (err.code === "VERSION_CONFLICT") {
        await loadCurrentRegistration().catch(() => undefined);
        onShowToast("Lịch đã thay đổi ở phiên khác. Dữ liệu mới nhất đã được tải; vui lòng kiểm tra và đăng ký lại.");
        return;
      }
      onShowToast(err.message || "Đăng ký lịch thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/70 p-4 shadow-sm dark:border-slate-700 dark:from-[#25262b] dark:via-[#25262b] dark:to-blue-950/25">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              calendar_month
            </span>
            {t("nav_schedule")}
          </div>
          <button
            ref={registrationTriggerRef}
            type="button"
            onClick={openRegistration}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent-hover px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto dark:focus-visible:ring-offset-slate-900 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              edit_calendar
            </span>
            {currentRegistrationVersion !== undefined || hasWeeklyShifts
              ? (language === "Tiếng Anh" ? "Update" : "Cập nhật")
              : (language === "Tiếng Anh" ? "Register Shift Schedule" : "Đăng ký lịch làm việc")}
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
                className={`min-h-11 rounded-lg px-4 text-xs font-bold transition-colors duration-200 cursor-pointer ${
                  calendarView === view
                    ? "bg-accent text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {view === "week" ? (language === "Tiếng Anh" ? "Weekly Schedule" : "Lịch tuần") : (language === "Tiếng Anh" ? "Work History" : "Lịch sử làm việc")}
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
          <div className="space-y-4 p-4 sm:p-5" data-testid="weekly-schedule">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <span
                className="material-symbols-outlined text-[22px] text-accent"
                aria-hidden="true"
              >
                calendar_view_week
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{language === "Tiếng Anh" ? "Weekly Schedule" : "Lịch tuần"}</h3>
              </div>
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
                      <span>{language === "Tiếng Anh" ? ["Mon", "Tue", "Wed", "Thu", "Fri"][weekday.index] : weekday.label}</span>
                    </div>
                  ))}
                </div>

                {/* Day Cards */}
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((weekday) => {
                    const morningShift = hasVisibleShift(weekday.index, "morning");
                    const afternoonShift = hasVisibleShift(weekday.index, "afternoon");

                    return (
                      <div
                        key={weekday.index}
                        className="min-h-[110px] rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="space-y-2">
                          {morningShift ? (
                            <ShiftBadge
                              shiftType="morning"
                              ariaLabel={`${language === "Tiếng Anh" ? "Morning Shift" : "Ca Sáng"}, ${weekday.label}`}
                              language={language}
                            />
                          ) : afternoonShift ? (
                            <div className="h-[38px]" aria-hidden="true" />
                          ) : null}

                          {afternoonShift ? (
                            <ShiftBadge
                              shiftType="afternoon"
                              ariaLabel={`${language === "Tiếng Anh" ? "Afternoon Shift" : "Ca Chiều"}, ${weekday.label}`}
                              language={language}
                            />
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
                  {language === "Tiếng Anh" ? "Work History" : "Lịch sử làm việc"}
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
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
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
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Xem tháng sau"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            {historyError && (
              <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <span>{historyError}</span>
                <button
                  type="button"
                  onClick={() => setHistoryRetryKey((current) => current + 1)}
                  className="min-h-11 rounded-xl border border-rose-300 bg-white px-4 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900 cursor-pointer"
                >
                  Thử lại
                </button>
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
                        const morningShift = getHistoryShift(date, "morning");
                        const afternoonShift = getHistoryShift(date, "afternoon");

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
                                <ShiftBadge
                                  key={`${dateISO}-morning`}
                                  shiftType="morning"
                                  ariaLabel={`${language === "Tiếng Anh" ? "Morning Shift" : "Ca Sáng"}, ${formatShortDate(date)}`}
                                  language={language}
                                />
                              ) : afternoonShift ? (
                                <div className="h-[38px]" aria-hidden="true" />
                              ) : null}

                              {afternoonShift ? (
                                <ShiftBadge
                                  key={`${dateISO}-afternoon`}
                                  shiftType="afternoon"
                                  ariaLabel={`${language === "Tiếng Anh" ? "Afternoon Shift" : "Ca Chiều"}, ${formatShortDate(date)}`}
                                  language={language}
                                />
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
            event.target === event.currentTarget && closeRegistration()
          }
        >
          <div
            ref={registrationDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-title"
            className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#25262b]"
          >
            <form onSubmit={handleRegisterSchedule} aria-busy={isSubmitting}>
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur dark:border-slate-700 dark:bg-[#25262b]/95">
                <div>
                  <h3
                    id="registration-title"
                    className="text-xl font-bold text-slate-950 dark:text-white"
                  >
                    {currentRegistrationVersion !== undefined || hasWeeklyShifts
                      ? (language === "Tiếng Anh" ? "Update Shift Schedule" : "Cập nhật lịch làm việc")
                      : (language === "Tiếng Anh" ? "Register Shift Schedule" : "Đăng ký lịch làm việc")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => closeRegistration()}
                  disabled={isSubmitting}
                  aria-label="Đóng cửa sổ đăng ký"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
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
                      ref={registrationRoomRef}
                      id="modal-room-select"
                      value={modalRoom}
                      disabled={isSubmitting}
                      onChange={(e) => setModalRoom(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-blue-600 focus:bg-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 cursor-pointer"
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
                            const selected = (registrationPattern[day.index] || []).includes(shiftOption.type);
                            return (
                              <div
                                key={day.index}
                                className="flex items-center justify-center border-r border-slate-200 p-1.5 last:border-r-0 dark:border-slate-700"
                              >
                                <button
                                  type="button"
                                  onClick={() => togglePattern(day.index, shiftOption.type)}
                                  disabled={isSubmitting}
                                  aria-pressed={selected}
                                  aria-label={`${selected ? "Bỏ chọn" : "Chọn"} ${shiftOption.label} ${day.label}${firstDate ? `, ngày đầu tiên ${formatCalendarDate(firstDate)}` : ""}`}
                                  className={[
                                    "flex h-11 w-11 items-center justify-center rounded-lg border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer",
                                    "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-600",
                                    selected
                                      ? "border-blue-700 bg-blue-700 text-white shadow-xs"
                                      : "border-slate-200 bg-white text-slate-400 hover:border-blue-300 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500 dark:hover:text-blue-300",
                                  ].join(" ")}
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

              <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-end dark:border-slate-700 dark:bg-[#25262b]/95">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 dark:focus-visible:ring-offset-slate-900 cursor-pointer"
                >
                    {isSubmitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[19px]" aria-hidden="true">
                          progress_activity
                        </span>
                        {currentRegistrationVersion !== undefined || hasWeeklyShifts
                          ? (language === "Tiếng Anh" ? "Saving..." : "Đang lưu...")
                          : (language === "Tiếng Anh" ? "Registering..." : "Đang đăng ký...")}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
                          event_available
                        </span>
                        {currentRegistrationVersion !== undefined || hasWeeklyShifts
                          ? (language === "Tiếng Anh" ? "Save Changes" : "Lưu thay đổi")
                          : (language === "Tiếng Anh" ? "Register" : "Đăng ký")}
                      </>
                    )}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

