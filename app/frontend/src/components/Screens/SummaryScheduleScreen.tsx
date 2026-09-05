import React, { useCallback, useEffect, useRef, useState } from "react";
import { ShiftSlot, UserAccount, AssignedCTV } from "../../types";
import {
  getAssignedCTVsForDate,
  getMsUntilPostCutoffRefresh,
} from "../../utils/scheduleSelectors";
import { formatRoomLabel } from "../../utils/rooms";
import { summaryToSlots, ApiSummaryCell } from "../../shared/mappers";
import * as api from "../../shared/api";
import { useSystemSettings } from "../../context/SystemSettingsContext";

interface SummaryScheduleScreenProps {
  shifts: ShiftSlot[];
  onViewAccountDetail?: (accountId: string) => void;
  onShowToast?: (msg: string) => void;
  currentUser?: UserAccount;
  userRole?: "Admin" | "Cộng tác viên";
}

type SummaryView = "week" | "history";

const APP_TIME_ZONE = "Asia/Bangkok";

const WEEKDAYS = [
  { index: 0, label: "Thứ 2" },
  { index: 1, label: "Thứ 3" },
  { index: 2, label: "Thứ 4" },
  { index: 3, label: "Thứ 5" },
  { index: 4, label: "Thứ 6" },
] as const;

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

const formatShortDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

export const SummaryScheduleScreen: React.FC<SummaryScheduleScreenProps> = ({
  shifts: initialShifts,
  onViewAccountDetail,
}) => {
  const { t, language } = useSystemSettings();
  const today = startOfDay(getCurrentCalendarDate());
  const todayISO = toISODate(today);

  const [view, setView] = useState<SummaryView>("week");
  const [calendarDate, setCalendarDate] = useState(today);
  const [weeklySummaryCells, setWeeklySummaryCells] = useState<ApiSummaryCell[]>([]);
  const [historyShifts, setHistoryShifts] = useState<ShiftSlot[]>([]);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);

  const weeklyRequestController = useRef<AbortController | null>(null);
  const monthRequestController = useRef<AbortController | null>(null);
  const monthRequestSequence = useRef(0);
  const isFirstRender = useRef(true);

  const fetchWeeklySummary = useCallback(async () => {
    weeklyRequestController.current?.abort();
    const controller = new AbortController();
    weeklyRequestController.current = controller;
    setIsLoadingWeekly(true);
    try {
      const res: any = await api.apiGet("/api/v1/schedule/weekly-summary", {
        signal: controller.signal,
      });
      const cells: ApiSummaryCell[] = res.data?.cells ?? res.cells ?? [];
      setWeeklySummaryCells(cells);
    } catch (error) {
      if (!api.isRequestAborted(error)) {
        // Keep prior cells
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingWeekly(false);
      }
    }
  }, []);

  // Fetch weekly summary initially on mount
  useEffect(() => {
    void fetchWeeklySummary();
    return () => weeklyRequestController.current?.abort();
  }, [fetchWeeklySummary]);

  // When switching to weekly view, refresh weekly summary
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (view === "week") {
      void fetchWeeklySummary();
    }
  }, [view, fetchWeeklySummary]);

  // Fetch history when view is history or calendarDate changes
  const fetchHistoryMonth = useCallback(async (date: Date) => {
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthRequestController.current?.abort();
    const controller = new AbortController();
    const sequence = ++monthRequestSequence.current;
    monthRequestController.current = controller;
    setIsLoadingMonth(true);
    try {
      const res: any = await api.apiGet(`/api/v1/work-history?month=${month}`, {
        signal: controller.signal,
      });
      if (sequence !== monthRequestSequence.current) return;
      const cells: ApiSummaryCell[] = res.data?.cells ?? res.cells ?? [];
      const slots = summaryToSlots(cells);
      setHistoryShifts(slots);
    } catch (error) {
      if (!api.isRequestAborted(error)) {
        // Keep prior month
      }
    } finally {
      if (sequence === monthRequestSequence.current) setIsLoadingMonth(false);
    }
  }, []);

  useEffect(() => {
    if (view === "history") {
      void fetchHistoryMonth(calendarDate);
    }
    return () => monthRequestController.current?.abort();
  }, [calendarDate, fetchHistoryMonth, view]);

  useEffect(() => {
    if (view !== "history") return;

    const handleFocus = () => {
      void fetchHistoryMonth(calendarDate);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchHistoryMonth(calendarDate);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [calendarDate, fetchHistoryMonth, view]);

  useEffect(() => {
    if (view !== "history") return;
    const delay = getMsUntilPostCutoffRefresh();
    if (delay === null) return;

    const timer = window.setTimeout(() => {
      void fetchHistoryMonth(calendarDate);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [calendarDate, fetchHistoryMonth, view]);

  const [selectedShiftDetail, setSelectedShiftDetail] = useState<{
    dayName: string;
    dateFormatted: string;
    shiftName: "Ca Sáng" | "Ca Chiều";
    shiftTimeLabel: string;
    ctvList: Array<AssignedCTV & { roomDisplay: string; taskDisplay: string }>;
  } | null>(null);

  const currentWeekStart = startOfWeek(calendarDate);
  const currentWeekDates = WEEKDAYS.map((day) => addDays(currentWeekStart, day.index));
  const getAssignedCTVs = (workDate: string, type: "morning" | "afternoon") =>
    getAssignedCTVsForDate(historyShifts, workDate, type);

  // Aggregate weekly schedule across all CTVs for Monday-Friday (dayIndex 0..4)
  const getWeeklySummaryCTVs = (
    dayIndex: number,
    type: "morning" | "afternoon",
  ): Array<AssignedCTV & { roomDisplay: string; taskDisplay: string }> => {
    const targetWeekday = dayIndex + 1;
    const targetPeriod = type === "morning" ? "MORNING" : "AFTERNOON";
    const cell = weeklySummaryCells.find(
      (c) => c.weekday === targetWeekday && c.period === targetPeriod,
    );
    if (!cell || !cell.shiftAssignments) return [];
    return cell.shiftAssignments.map((a) => {
      const roomFormatted = formatRoomLabel(a.roomCode) || "Chưa cập nhật";
      return {
        id: a.accountId,
        name: a.displayName,
        initials: a.displayName.slice(0, 2).toUpperCase(),
        phone: a.phone ?? undefined,
        room: roomFormatted,
        roomDisplay: roomFormatted,
        taskDisplay: "Chưa cập nhật",
        status: "Đã duyệt" as const,
      };
    });
  };

  // ---- month derived (for history) ----
  const monthStart = startOfMonth(calendarDate);
  const monthWeeks: Array<Array<Date | null>> = [];
  let curWeek: Array<Date | null> = [null, null, null, null, null];
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const wd = date.getDay();
    if (wd < 1 || wd > 5) continue;
    curWeek[wd - 1] = date;
    if (wd === 5) {
      monthWeeks.push(curWeek);
      curWeek = [null, null, null, null, null];
    }
  }
  if (curWeek.some(Boolean)) monthWeeks.push(curWeek);

  const changeMonth = (amount: number) => {
    setCalendarDate((c) => new Date(c.getFullYear(), c.getMonth() + amount, 1));
  };

  // ---- today CTV list (shared card) ----
  const getTodayCTVList = () => {
    const dow = (today.getDay() + 6) % 7;
    const dayNamesList = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
    const dayNameStr = dayNamesList[dow] || "Thứ 2";
    const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const dayLabel = `${dayNameStr} - ${dateStr}`;
    const isWeekday = dow >= 0 && dow <= 4;
    const morningList = isWeekday ? getWeeklySummaryCTVs(dow, "morning") : [];
    const afternoonList = isWeekday ? getWeeklySummaryCTVs(dow, "afternoon") : [];
    type Item = { ctv: AssignedCTV; shifts: ("Ca Sáng" | "Ca Chiều")[] };
    const map = new Map<string, Item>();
    morningList.forEach((ctv) => map.set(ctv.id, { ctv, shifts: ["Ca Sáng"] }));
    afternoonList.forEach((ctv) => {
      if (map.has(ctv.id)) map.get(ctv.id)!.shifts.push("Ca Chiều");
      else map.set(ctv.id, { ctv, shifts: ["Ca Chiều"] });
    });
    return { dayLabel, list: Array.from(map.values()) };
  };
  const todayData = getTodayCTVList();

  const handleCTVClick = (ctv: AssignedCTV) => {
    if (ctv.id) onViewAccountDetail?.(ctv.id);
  };

  const handleOpenWeekdayShiftDetail = (
    dayName: string,
    shiftName: "Ca Sáng" | "Ca Chiều",
    ctvList: Array<AssignedCTV & { roomDisplay: string; taskDisplay: string }>,
  ) => {
    setSelectedShiftDetail({
      dayName,
      dateFormatted: "Lịch tuần",
      shiftName,
      shiftTimeLabel: shiftName === "Ca Sáng" ? "08:00 - 12:00" : "13:30 - 17:30",
      ctvList,
    });
  };

  const handleOpenShiftDetail = (
    dayName: string,
    dateFormatted: string,
    shiftName: "Ca Sáng" | "Ca Chiều",
    workDate: string,
  ) => {
    const raw = getAssignedCTVs(workDate, shiftName === "Ca Sáng" ? "morning" : "afternoon");
    const enriched = raw.map((ctv) => ({
      ...ctv,
      roomDisplay: formatRoomLabel(ctv.room) || "Chưa cập nhật",
      taskDisplay: ctv.taskContent || "Chưa cập nhật",
    }));
    setSelectedShiftDetail({
      dayName,
      dateFormatted,
      shiftName,
      shiftTimeLabel: shiftName === "Ca Sáng" ? "08:00 - 12:00" : "13:30 - 17:30",
      ctvList: enriched,
    });
  };

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-200">
      <h2 className="text-2xl font-bold text-[#1a1b1e] dark:text-slate-100 tracking-tight">
        {t("summary_schedule_title")}
      </h2>

      {/* Card: Danh sách CTV đăng ký hôm nay */}
      <div className="bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">badge</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                <span>{t("today_ctv_list")}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent/10 text-accent dark:bg-accent/20 dark:text-blue-200 font-bold">
                  {todayData.dayLabel}
                </span>
              </h3>
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {t("total_label")} <strong className="text-slate-800 dark:text-slate-200">{todayData.list.length}</strong> {t("ctv_unit")}
          </span>
        </div>

        {todayData.list.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <span className="material-symbols-outlined text-[32px] block mb-1 opacity-50">person_off</span>
            <p className="text-sm font-medium">{t("no_ctv_today")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayData.list.map(({ ctv, shifts: sfs }) => (
              <div
                key={ctv.id}
                onClick={() => handleCTVClick(ctv)}
                className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#1f2023] border border-slate-200/80 dark:border-slate-800 hover:border-accent hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {ctv.avatar ? (
                    <img src={ctv.avatar} alt={ctv.name} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-accent transition-all" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#1b365d] text-white font-bold text-sm flex items-center justify-center shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-accent transition-all">
                      {ctv.initials || ctv.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-accent transition-colors truncate">{ctv.name}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 ${sfs.length > 1 ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300" : sfs[0] === "Ca Sáng" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300" : "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300"}`}>
                        <span className="whitespace-nowrap">{sfs.map((s) => (language === "Tiếng Anh" ? (s === "Ca Sáng" ? "Morning" : "Afternoon") : s.replace("Ca ", ""))).join(", ")}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main card: tabs + week/history - mirrors CTVScheduleWorkspace outer section */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#25262b]">
        {/* Tabs bar - same layout as CTV */}
        <div className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/35">
          <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" role="group" aria-label={t("nav_summary")}>
            {(["week", "history"] as SummaryView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`min-h-11 rounded-lg px-4 text-xs font-bold transition-colors duration-200 ${view === v ? "bg-accent text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                {v === "week" ? t("tab_weekly_summary") : t("tab_history_summary")}
              </button>
            ))}
          </div>
        </div>

        {view === "week" ? (
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-accent" aria-hidden="true">calendar_view_week</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t("tab_weekly_summary")}</h3>
              </div>
              {isLoadingWeekly && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-accent animate-pulse" role="status" aria-live="polite">
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>{t("updating")}</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[700px] space-y-3">
                {/* Header Mon-Fri */}
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((wd) => {
                    const isToday = ((today.getDay() + 6) % 7) === wd.index;
                    const dayLabel = language === "Tiếng Anh" ? ["Mon", "Tue", "Wed", "Thu", "Fri"][wd.index] : wd.label;
                    return (
                      <div
                        key={wd.index}
                        className="rounded-xl bg-slate-100/90 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5"
                      >
                        <span>{dayLabel}</span>
                        {isToday && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white normal-case tracking-normal leading-tight">
                            {t("today")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Day cards - aggregated from weekly schedule of all CTVs */}
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((wd) => {
                    const isToday = ((today.getDay() + 6) % 7) === wd.index;
                    const morningCTVs = getWeeklySummaryCTVs(wd.index, "morning");
                    const afternoonCTVs = getWeeklySummaryCTVs(wd.index, "afternoon");

                    return (
                      <div
                        key={wd.index}
                        className={`rounded-2xl border-2 p-3 min-h-[110px] shadow-2xs transition-colors ${
                          isToday
                            ? "border-accent bg-blue-50/30 dark:border-accent dark:bg-blue-950/25"
                            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <div className="space-y-2 flex flex-col justify-start">
                          {morningCTVs.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenWeekdayShiftDetail(wd.label, "Ca Sáng", morningCTVs)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/80 border border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between text-left transition-all cursor-pointer group"
                              title="Bấm xem danh sách CTV ca sáng"
                            >
                              <span className="flex items-center text-amber-800 dark:text-amber-300">
                                <span className="material-symbols-outlined text-[18px]">wb_sunny</span>
                              </span>
                              <span className="text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded group-hover:scale-105 transition-transform">
                                {morningCTVs.length} CTV
                              </span>
                            </button>
                          ) : afternoonCTVs.length > 0 ? (
                            <div className="h-[32px]" aria-hidden="true" />
                          ) : null}

                          {afternoonCTVs.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenWeekdayShiftDetail(wd.label, "Ca Chiều", afternoonCTVs)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-950/80 border border-purple-200/80 dark:border-purple-900/40 flex items-center justify-between text-left transition-all cursor-pointer group"
                              title="Bấm xem danh sách CTV ca chiều"
                            >
                              <span className="flex items-center text-purple-800 dark:text-purple-300">
                                <span className="material-symbols-outlined text-[18px]">wb_twilight</span>
                              </span>
                              <span className="text-[10px] font-bold bg-purple-200/80 dark:bg-purple-900/70 text-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded group-hover:scale-105 transition-transform">
                                {afternoonCTVs.length} CTV
                              </span>
                            </button>
                          ) : morningCTVs.length > 0 ? (
                            <div className="h-[32px]" aria-hidden="true" />
                          ) : null}

                          {morningCTVs.length === 0 && afternoonCTVs.length === 0 && (
                            <div className="flex-1 flex items-center justify-center py-5">
                              <span className="text-[11px] text-slate-400 font-medium">—</span>
                            </div>
                          )}
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
                <span className="material-symbols-outlined text-[22px] text-accent" aria-hidden="true">calendar_month</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t("tab_history_summary")}</h3>
              </div>
              {isLoadingMonth && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-accent animate-pulse" role="status" aria-live="polite">
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>{t("updating")}</span>
                </div>
              )}
              <div className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900" role="group" aria-label="Chuyển tháng">
                <button type="button" onClick={() => changeMonth(-1)} className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Xem tháng trước">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_left</span>
                </button>
                <span className="min-w-[112px] px-2 text-center text-xs font-bold text-slate-900 dark:text-slate-100" aria-live="polite">{t("month")} {monthStart.getMonth() + 1}, {monthStart.getFullYear()}</span>
                <button type="button" onClick={() => changeMonth(1)} className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Xem tháng sau">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_right</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[700px] space-y-3">
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((d) => (
                    <div key={d.index} className="rounded-xl bg-slate-100/90 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {language === "Tiếng Anh" ? ["Mon", "Tue", "Wed", "Thu", "Fri"][d.index] : d.label}
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {monthWeeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-5 gap-3">
                      {week.map((date, di) => {
                        if (!date) return <div key={di} className="min-h-[110px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 opacity-40 dark:border-slate-800/60 dark:bg-[#1f2023]/30" aria-hidden="true" />;
                        const dateISO = toISODate(date);
                        const isToday = dateISO === todayISO;
                        const dateFormatted = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
                        const dayName = WEEKDAYS[di]?.label ?? `Thứ ${di + 2}`;
                        const morningCTVs = getAssignedCTVs(dateISO, "morning");
                        const afternoonCTVs = getAssignedCTVs(dateISO, "afternoon");

                        return (
                          <div key={dateISO} className={`flex min-h-[110px] flex-col rounded-2xl border-2 p-3 shadow-2xs transition-colors ${isToday ? "border-accent bg-blue-50/30 dark:border-accent dark:bg-blue-950/25" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
                            <div className="flex items-center justify-center border-b border-slate-100 dark:border-slate-800/80 pb-1.5 mb-2">
                              <span className="flex items-center justify-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <span>{formatShortDate(date)}</span>
                                {isToday && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">{t("today")}</span>}
                              </span>
                            </div>
                            <div className="space-y-1.5 min-h-[58px] flex flex-col justify-start">
                              {morningCTVs.length > 0 ? (
                                <button type="button" onClick={() => handleOpenShiftDetail(dayName, dateFormatted, "Ca Sáng", dateISO)} className="w-full px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/80 border border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between text-left transition-all cursor-pointer group" title="Bấm xem danh sách CTV ca sáng">
                                  <span className="flex items-center text-amber-800 dark:text-amber-300"><span className="material-symbols-outlined text-[16px]">wb_sunny</span></span>
                                  <span className="text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded group-hover:scale-105 transition-transform">{morningCTVs.length} CTV</span>
                                </button>
                              ) : afternoonCTVs.length > 0 ? <div className="h-[32px]" aria-hidden="true" /> : null}
                              {afternoonCTVs.length > 0 ? (
                                <button type="button" onClick={() => handleOpenShiftDetail(dayName, dateFormatted, "Ca Chiều", dateISO)} className="w-full px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-950/80 border border-purple-200/80 dark:border-purple-900/40 flex items-center justify-between text-left transition-all cursor-pointer group" title="Bấm xem danh sách CTV ca chiều">
                                  <span className="flex items-center text-purple-800 dark:text-purple-300"><span className="material-symbols-outlined text-[16px]">wb_twilight</span></span>
                                  <span className="text-[10px] font-bold bg-purple-200/80 dark:bg-purple-900/70 text-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded group-hover:scale-105 transition-transform">{afternoonCTVs.length} CTV</span>
                                </button>
                              ) : morningCTVs.length > 0 ? <div className="h-[32px]" aria-hidden="true" /> : null}
                              {morningCTVs.length === 0 && afternoonCTVs.length === 0 && <div className="flex-1 flex items-center justify-center py-2"><span className="text-[11px] text-slate-400">—</span></div>}
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

      {/* Modal Chi tiết ca */}
      {selectedShiftDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#25262b] rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#1f2023] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-accent mb-1">
                  <span className="material-symbols-outlined text-[18px]">event_note</span>
                  <span>CHI TIẾT CA LÀM VIỆC</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedShiftDetail.shiftName} - {selectedShiftDetail.dayName} ({selectedShiftDetail.dateFormatted})
                </h3>
              </div>
              <button type="button" onClick={() => setSelectedShiftDetail(null)} className="w-9 h-9 rounded-full bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between bg-blue-50/80 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-100 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 font-medium">
                <span>Danh sách CTV đã được phê duyệt phân công ca</span>
                <span className="font-bold bg-blue-100 dark:bg-blue-900 text-accent dark:text-blue-200 px-2.5 py-0.5 rounded-lg">Tổng số: {selectedShiftDetail.ctvList.length} CTV</span>
              </div>
              {selectedShiftDetail.ctvList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <span className="material-symbols-outlined text-[44px] block opacity-40">group_off</span>
                  <p className="text-sm font-semibold">Chưa có CTV nào đăng ký ca làm việc này</p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-[#1f2023] border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="py-3.5 px-4">Họ tên CTV</th>
                          <th className="py-3.5 px-4">Số điện thoại</th>
                          <th className="py-3.5 px-4">Buồng làm việc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {selectedShiftDetail.ctvList.map((ctv, idx) => (
                          <tr key={ctv.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#1f2023]/60 transition-colors">
                            <td className="py-3.5 px-4">
                              <div onClick={() => { handleCTVClick(ctv); setSelectedShiftDetail(null); }} className="inline-flex items-center gap-3 cursor-pointer group" title="Bấm xem chi tiết thông tin CTV">
                                {ctv.avatar ? <img src={ctv.avatar} alt={ctv.name} className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-accent transition-all" /> : <div className="w-9 h-9 rounded-full bg-[#1b365d] text-white font-bold text-xs flex items-center justify-center shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-accent transition-all">{ctv.initials || ctv.name.substring(0, 2).toUpperCase()}</div>}
                                <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-accent transition-colors">{ctv.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                                <span className="material-symbols-outlined text-[15px] text-slate-400">call</span>
                                <span>{ctv.phone || "—"}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4"><span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-semibold rounded-lg border border-blue-100 dark:border-blue-900/60 inline-block text-[11px]">{ctv.roomDisplay}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-[#1f2023] border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button type="button" onClick={() => setSelectedShiftDetail(null)} className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
