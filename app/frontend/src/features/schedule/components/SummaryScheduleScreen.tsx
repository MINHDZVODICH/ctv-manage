import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShiftSlot, UserAccount, AssignedCTV } from '../../../shared/types';
import {
  getAssignedCTVsForDate,
  getMsUntilPostCutoffRefresh,
} from '../../../shared/utils/scheduleSelectors';
import {
  formatRoomDisplay as formatRoomDisplayUtil,
  formatRoomLabel,
} from '../../../shared/utils/rooms';
import type { ApiSummaryCell, ApiHistoryCell } from '../../../shared/mappers';
import { summaryToSlots, historyToSlots } from '../../../shared/mappers';
import * as api from '../../../shared/api';
import { useSystemSettings } from '../../../shared/context/SystemSettingsContext';
import { formatDateLocale } from '../../../shared/i18n';

interface SummaryScheduleScreenProps {
  shifts: ShiftSlot[];
  onViewAccountDetail?: (accountId: string) => void;
  onShowToast?: (msg: string) => void;
  currentUser?: UserAccount;
  userRole?: 'Admin' | 'Cộng tác viên';
}

type SummaryView = 'week' | 'history';

const APP_TIME_ZONE = 'Asia/Bangkok';

const WEEKDAY_KEYS = [
  'schedule.monday',
  'schedule.tuesday',
  'schedule.wednesday',
  'schedule.thursday',
  'schedule.friday',
  'schedule.saturday',
  'schedule.sunday',
] as const;

const WEEKDAYS = [
  { index: 0, i18nKey: 'schedule.monday' },
  { index: 1, i18nKey: 'schedule.tuesday' },
  { index: 2, i18nKey: 'schedule.wednesday' },
  { index: 3, i18nKey: 'schedule.thursday' },
  { index: 4, i18nKey: 'schedule.friday' },
] as const;

const formatRoomDisplay = (roomStr: string, t: (key: string) => string): string => {
  return formatRoomDisplayUtil(roomStr, t('schedule.room_prefix'));
};

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getCurrentCalendarDate = () => {
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const mockParam =
        urlParams.get('mockDate') ||
        (window as unknown as { __MOCK_DATE__?: string }).__MOCK_DATE__ ||
        localStorage.getItem('mock_date');
      if (mockParam) {
        if (mockParam.toLowerCase() === 'friday' || mockParam.toLowerCase() === 'fri') {
          return new Date(2026, 8, 11);
        }
        const parsed = new Date(mockParam);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatShortDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

export const SummaryScheduleScreen: React.FC<SummaryScheduleScreenProps> = ({
  shifts: initialShifts,
  onViewAccountDetail,
}) => {
  const { t, language } = useSystemSettings();
  const today = startOfDay(getCurrentCalendarDate());
  const todayISO = toISODate(today);

  const [view, setView] = useState<SummaryView>('week');
  const [calendarDate, setCalendarDate] = useState(today);
  const [weeklySummaryCells, setWeeklySummaryCells] = useState<ApiSummaryCell[]>([]);
  const [historyShifts, setHistoryShifts] = useState<ShiftSlot[]>([]);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [historyRetryKey, setHistoryRetryKey] = useState(0);

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
      const res = await api.apiGet<{
        data?: { cells?: ApiSummaryCell[] };
        cells?: ApiSummaryCell[];
      }>('/api/v1/schedule/weekly-summary', { signal: controller.signal });
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
    if (view === 'week') {
      void fetchWeeklySummary();
    }
  }, [view, fetchWeeklySummary]);

  // Fetch history when view is history or calendarDate changes
  const fetchHistoryMonth = useCallback(async (date: Date) => {
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthRequestController.current?.abort();
    const controller = new AbortController();
    const sequence = ++monthRequestSequence.current;
    monthRequestController.current = controller;
    setIsLoadingMonth(true);
    setHistoryError(false);
    try {
      const res = await api.apiGet<{
        data?: { cells?: ApiHistoryCell[] };
        cells?: ApiHistoryCell[];
      }>(`/api/v1/work-history?month=${month}`, {
        signal: controller.signal,
      });
      if (sequence !== monthRequestSequence.current) return;
      const cells: ApiHistoryCell[] = res.data?.cells ?? res.cells ?? [];
      const slots = historyToSlots(cells);
      setHistoryShifts(slots);
    } catch (error) {
      if (!api.isRequestAborted(error)) {
        if (sequence === monthRequestSequence.current) {
          setHistoryError(true);
        }
      }
    } finally {
      if (sequence === monthRequestSequence.current) setIsLoadingMonth(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'history') {
      void fetchHistoryMonth(calendarDate);
    }
    return () => monthRequestController.current?.abort();
  }, [calendarDate, fetchHistoryMonth, view, historyRetryKey]);

  useEffect(() => {
    if (view !== 'history') return;

    const handleFocus = () => {
      void fetchHistoryMonth(calendarDate);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchHistoryMonth(calendarDate);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [calendarDate, fetchHistoryMonth, view]);

  useEffect(() => {
    if (view !== 'history') return;
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
    shiftType: 'morning' | 'afternoon';
    shiftTimeLabel: string;
    ctvList: Array<AssignedCTV & { roomDisplay: string; taskDisplay: string }>;
  } | null>(null);

  const getAssignedCTVs = (workDate: string, type: 'morning' | 'afternoon') =>
    getAssignedCTVsForDate(historyShifts, workDate, type);

  const avatarMap = useMemo(() => {
    const map = new Map<string, string>();
    initialShifts?.forEach((s) => {
      s.assignedCTVs?.forEach((c) => {
        if (c.id && c.avatar) map.set(c.id, c.avatar);
      });
    });
    return map;
  }, [initialShifts]);

  // Aggregate weekly schedule across all CTVs for Monday-Friday (dayIndex 0..4)
  const getWeeklySummaryCTVs = (
    dayIndex: number,
    type: 'morning' | 'afternoon',
  ): Array<AssignedCTV & { roomDisplay: string; taskDisplay: string }> => {
    const targetWeekday = dayIndex + 1;
    const targetPeriod = type === 'morning' ? 'MORNING' : 'AFTERNOON';
    const cell = weeklySummaryCells.find(
      (c) => c.weekday === targetWeekday && c.period === targetPeriod,
    );
    if (!cell || !cell.shiftAssignments) return [];
    return cell.shiftAssignments.map((a) => {
      const roomFormatted = formatRoomLabel(a.roomCode) || '';
      return {
        id: a.accountId,
        name: a.displayName,
        avatar: avatarMap.get(a.accountId),
        initials: a.displayName.slice(0, 2).toUpperCase(),
        phone: a.phone ?? undefined,
        room: roomFormatted,
        roomDisplay: roomFormatted,
        taskDisplay: '',
        status: 'Đã duyệt' as const,
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
    const dayNameStr = t(WEEKDAY_KEYS[dow] || 'schedule.monday');
    const dateFormatted = formatDateLocale(today, language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const dayLabel = `${dayNameStr} - ${dateFormatted}`;
    const isWeekday = dow >= 0 && dow <= 4;
    const morningList = isWeekday ? getWeeklySummaryCTVs(dow, 'morning') : [];
    const afternoonList = isWeekday ? getWeeklySummaryCTVs(dow, 'afternoon') : [];
    type Item = { ctv: AssignedCTV; shifts: ('morning' | 'afternoon')[] };
    const map = new Map<string, Item>();
    morningList.forEach((ctv) => map.set(ctv.id, { ctv, shifts: ['morning'] }));
    afternoonList.forEach((ctv) => {
      if (map.has(ctv.id)) map.get(ctv.id)!.shifts.push('afternoon');
      else map.set(ctv.id, { ctv, shifts: ['afternoon'] });
    });
    return {
      dayLabel,
      list: Array.from(map.values()),
      morningList,
      afternoonList,
    };
  };
  const todayData = getTodayCTVList();

  const handleCTVClick = (ctv: AssignedCTV) => {
    if (ctv.id) onViewAccountDetail?.(ctv.id);
  };

  const handleOpenWeekdayShiftDetail = (
    dayIndex: number,
    shiftType: 'morning' | 'afternoon',
    ctvList: Array<AssignedCTV & { roomDisplay: string; taskDisplay: string }>,
  ) => {
    setSelectedShiftDetail({
      dayName: t(WEEKDAYS[dayIndex]?.i18nKey || 'schedule.monday'),
      dateFormatted: t('schedule.weekly_schedule_label'),
      shiftType,
      shiftTimeLabel: shiftType === 'morning' ? '08:00 - 12:00' : '13:30 - 17:30',
      ctvList,
    });
  };

  const handleOpenShiftDetail = (
    dayIndex: number,
    dateFormatted: string,
    shiftType: 'morning' | 'afternoon',
    workDate: string,
  ) => {
    const raw = getAssignedCTVs(workDate, shiftType);
    const enriched = raw.map((ctv) => ({
      ...ctv,
      roomDisplay: formatRoomLabel(ctv.room) || '',
      taskDisplay: ctv.taskContent || '',
    }));
    setSelectedShiftDetail({
      dayName: t(WEEKDAYS[dayIndex]?.i18nKey || 'schedule.monday'),
      dateFormatted,
      shiftType,
      shiftTimeLabel: shiftType === 'morning' ? '08:00 - 12:00' : '13:30 - 17:30',
      ctvList: enriched,
    });
  };

  const formatMonthLabel = (date: Date) => {
    const formatted = formatDateLocale(date, language, { month: 'long', year: 'numeric' });
    return formatted ? formatted.charAt(0).toUpperCase() + formatted.slice(1) : '';
  };

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-200">
      <h2 className="text-2xl font-bold text-[#1a1b1e] dark:text-slate-100 tracking-tight">
        {t('schedule.summary_title')}
      </h2>

      {/* Card: Today contributor list */}
      <div className="bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">badge</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                <span>{t('schedule.today_list')}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent/10 text-accent dark:bg-accent/20 dark:text-blue-200 font-bold">
                  {todayData.dayLabel}
                </span>
              </h3>
            </div>
          </div>
        </div>

        {todayData.list.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <span className="material-symbols-outlined text-[36px] block mb-1 opacity-50">
              person_off
            </span>
            <p className="text-sm font-medium">{t('schedule.no_today')}</p>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-[#1f2023]">
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Table Header: 4 Columns */}
                <div className="grid grid-cols-[150px_1fr_1fr_1fr] bg-slate-50/90 dark:bg-[#1a1b1e]/90 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="py-3.5 px-4 text-center border-r border-slate-200 dark:border-slate-800">
                    {t('schedule.shift_work')}
                  </div>
                  <div className="py-3.5 px-4">{t('schedule.ctv_name')}</div>
                  <div className="py-3.5 px-4 text-center">{t('schedule.phone_number')}</div>
                  <div className="py-3.5 px-4 text-right">{t('schedule.assigned_room')}</div>
                </div>

                {/* ================= SECTION: CA SÁNG ================= */}
                <div className="grid grid-cols-[150px_1fr]">
                  {/* Left Column: Cột Ca Sáng (Chỉ có icon + Sáng, to rõ nét) */}
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center text-center select-none">
                    <div className="inline-flex items-center justify-center gap-2 text-base font-bold text-amber-700 dark:text-amber-400">
                      <span className="material-symbols-outlined text-[26px]">wb_sunny</span>
                      <span className="tracking-wide">{t('schedule.morning')}</span>
                    </div>
                  </div>

                  {/* Right Column: Danh sách CTV Ca Sáng (Cuộn độc lập, max-h vừa đủ trọn vẹn 5 dòng) */}
                  <div className="max-h-[325px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                    {todayData.morningList.length === 0 ? (
                      <div className="py-8 px-4 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 font-medium text-xs gap-1.5">
                        <span className="material-symbols-outlined text-[24px] opacity-50 select-none">
                          person_off
                        </span>
                        <span>{t('schedule.no_morning')}</span>
                      </div>
                    ) : (
                      todayData.morningList.map((ctv, idx) => {
                        const isAssigned =
                          ctv.roomDisplay &&
                          ctv.roomDisplay !== 'Chưa gán buồng' &&
                          ctv.roomDisplay !== 'Chưa cập nhật';
                        return (
                          <div
                            key={`morning-${ctv.id || idx}`}
                            className="grid grid-cols-[1fr_1fr_1fr] items-center py-3.5 px-4 hover:bg-slate-50/80 dark:hover:bg-[#1a1b1e]/60 transition-colors text-xs"
                          >
                            {/* Họ tên CTV */}
                            <div
                              onClick={() => handleCTVClick(ctv)}
                              className="inline-flex items-center gap-3 cursor-pointer group min-w-0 pr-3"
                              title={t('schedule.click_to_view_detail')}
                            >
                              {ctv.avatar ? (
                                <img
                                  src={ctv.avatar}
                                  alt={ctv.name}
                                  className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-slate-400 dark:group-hover:ring-slate-500 transition-all"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-[#1b365d] text-white font-bold text-xs flex items-center justify-center shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-slate-400 dark:group-hover:ring-slate-500 transition-all">
                                  {ctv.initials || ctv.name.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:underline underline-offset-2 transition-all truncate">
                                {ctv.name}
                              </span>
                            </div>

                            {/* Số điện thoại (Nằm ở giữa cột) */}
                            <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                              <span className="material-symbols-outlined text-[15px] text-slate-400">
                                call
                              </span>
                              <span>{ctv.phone || '—'}</span>
                            </div>

                            {/* Buồng làm việc (Nằm sát bên phải) */}
                            <div className="flex items-center justify-end">
                              {isAssigned ? (
                                <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-semibold rounded-lg border border-blue-100 dark:border-blue-900/60 inline-flex items-center gap-1 text-[11px]">
                                  <span className="material-symbols-outlined text-[14px] text-blue-600 dark:text-blue-400">
                                    meeting_room
                                  </span>
                                  <span>{formatRoomDisplay(ctv.roomDisplay, t)}</span>
                                </span>
                              ) : (
                                <div className="w-[88px] flex justify-center">
                                  <span className="text-slate-400 dark:text-slate-500 font-bold text-sm tracking-wider select-none">
                                    --
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ================= 10PX DIVIDER STRIP ================= */}
                <div className="h-[10px] w-full bg-slate-50/90 dark:bg-[#1a1b1e]/90 border-t border-b border-slate-200 dark:border-slate-800" />

                {/* ================= SECTION: CA CHIỀU ================= */}
                <div className="grid grid-cols-[150px_1fr]">
                  {/* Left Column: Cột Ca Chiều (Chỉ có icon + Chiều, to rõ nét) */}
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center text-center select-none">
                    <div className="inline-flex items-center justify-center gap-2 text-base font-bold text-indigo-700 dark:text-indigo-400">
                      <span className="material-symbols-outlined text-[26px]">wb_twilight</span>
                      <span className="tracking-wide">{t('schedule.afternoon')}</span>
                    </div>
                  </div>

                  {/* Right Column: Danh sách CTV Ca Chiều (Cuộn độc lập, max-h vừa đủ trọn vẹn 5 dòng) */}
                  <div className="max-h-[325px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                    {todayData.afternoonList.length === 0 ? (
                      <div className="py-8 px-4 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 font-medium text-xs gap-1.5">
                        <span className="material-symbols-outlined text-[24px] opacity-50 select-none">
                          person_off
                        </span>
                        <span>{t('schedule.no_afternoon')}</span>
                      </div>
                    ) : (
                      todayData.afternoonList.map((ctv, idx) => {
                        const isAssigned =
                          ctv.roomDisplay &&
                          ctv.roomDisplay !== 'Chưa gán buồng' &&
                          ctv.roomDisplay !== 'Chưa cập nhật';
                        return (
                          <div
                            key={`afternoon-${ctv.id || idx}`}
                            className="grid grid-cols-[1fr_1fr_1fr] items-center py-3.5 px-4 hover:bg-slate-50/80 dark:hover:bg-[#1a1b1e]/60 transition-colors text-xs"
                          >
                            {/* Họ tên CTV */}
                            <div
                              onClick={() => handleCTVClick(ctv)}
                              className="inline-flex items-center gap-3 cursor-pointer group min-w-0 pr-3"
                              title={t('schedule.click_to_view_detail')}
                            >
                              {ctv.avatar ? (
                                <img
                                  src={ctv.avatar}
                                  alt={ctv.name}
                                  className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-slate-400 dark:group-hover:ring-slate-500 transition-all"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-[#1b365d] text-white font-bold text-xs flex items-center justify-center shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-slate-400 dark:group-hover:ring-slate-500 transition-all">
                                  {ctv.initials || ctv.name.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:underline underline-offset-2 transition-all truncate">
                                {ctv.name}
                              </span>
                            </div>

                            {/* Số điện thoại (Nằm ở giữa cột) */}
                            <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                              <span className="material-symbols-outlined text-[15px] text-slate-400">
                                call
                              </span>
                              <span>{ctv.phone || '—'}</span>
                            </div>

                            {/* Buồng làm việc (Nằm sát bên phải) */}
                            <div className="flex items-center justify-end">
                              {isAssigned ? (
                                <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-semibold rounded-lg border border-blue-100 dark:border-blue-900/60 inline-flex items-center gap-1 text-[11px]">
                                  <span className="material-symbols-outlined text-[14px] text-blue-600 dark:text-blue-400">
                                    meeting_room
                                  </span>
                                  <span>{formatRoomDisplay(ctv.roomDisplay, t)}</span>
                                </span>
                              ) : (
                                <div className="w-[88px] flex justify-center">
                                  <span className="text-slate-400 dark:text-slate-500 font-bold text-sm tracking-wider select-none">
                                    --
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main card: tabs + week/history */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#25262b]">
        {/* Tabs bar */}
        <div className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/35">
          <div
            className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            role="group"
            aria-label={t('schedule.summary_title')}
          >
            {(['week', 'history'] as SummaryView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`min-h-11 rounded-lg px-4 text-xs font-bold transition-colors duration-200 cursor-pointer ${view === v ? 'bg-accent text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >
                {v === 'week' ? t('schedule.tab_weekly') : t('schedule.tab_history')}
              </button>
            ))}
          </div>
        </div>

        {view === 'week' ? (
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-[22px] text-accent"
                  aria-hidden="true"
                >
                  calendar_month
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {t('schedule.tab_weekly')}
                </h3>
              </div>
              {isLoadingWeekly && (
                <div
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-accent animate-pulse"
                  role="status"
                  aria-live="polite"
                >
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                  <span>{t('updating')}</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[700px] space-y-3">
                {/* Header Mon-Fri */}
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((wd) => {
                    const isToday = (today.getDay() + 6) % 7 === wd.index;
                    const dayLabel = t(wd.i18nKey);
                    return (
                      <div
                        key={wd.index}
                        className="rounded-xl bg-slate-100/90 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5"
                      >
                        <span>{dayLabel}</span>
                        {isToday && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white normal-case tracking-normal leading-tight">
                            {t('today')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Day cards - aggregated from weekly schedule of all CTVs */}
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((wd) => {
                    const isToday = (today.getDay() + 6) % 7 === wd.index;
                    const morningCTVs = getWeeklySummaryCTVs(wd.index, 'morning');
                    const afternoonCTVs = getWeeklySummaryCTVs(wd.index, 'afternoon');

                    return (
                      <div
                        key={wd.index}
                        className={`rounded-2xl border-2 p-3 min-h-[110px] shadow-2xs transition-colors ${
                          isToday
                            ? 'border-accent bg-blue-50/30 dark:border-accent dark:bg-blue-950/25'
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                        }`}
                      >
                        <div className="space-y-2 flex flex-col justify-start">
                          {morningCTVs.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenWeekdayShiftDetail(wd.index, 'morning', morningCTVs)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/80 border border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between text-left transition-all cursor-pointer group"
                              title={t('schedule.view_morning_ctvs')}
                            >
                              <span className="flex items-center text-amber-800 dark:text-amber-300">
                                <span className="material-symbols-outlined text-[18px]">
                                  wb_sunny
                                </span>
                              </span>
                              <span className="text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded group-hover:scale-105 transition-transform">
                                {morningCTVs.length} {t('schedule.ctv_short')}
                              </span>
                            </button>
                          ) : afternoonCTVs.length > 0 ? (
                            <div className="h-[32px]" aria-hidden="true" />
                          ) : null}

                          {afternoonCTVs.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenWeekdayShiftDetail(wd.index, 'afternoon', afternoonCTVs)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-950/80 border border-purple-200/80 dark:border-purple-900/40 flex items-center justify-between text-left transition-all cursor-pointer group"
                              title={t('schedule.view_afternoon_ctvs')}
                            >
                              <span className="flex items-center text-purple-800 dark:text-purple-300">
                                <span className="material-symbols-outlined text-[18px]">
                                  wb_twilight
                                </span>
                              </span>
                              <span className="text-[10px] font-bold bg-purple-200/80 dark:bg-purple-900/70 text-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded group-hover:scale-105 transition-transform">
                                {afternoonCTVs.length} {t('schedule.ctv_short')}
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
                <span
                  className="material-symbols-outlined text-[22px] text-accent"
                  aria-hidden="true"
                >
                  calendar_month
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {t('schedule.tab_history')}
                </h3>
              </div>
              {isLoadingMonth && (
                <div
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-accent animate-pulse"
                  role="status"
                  aria-live="polite"
                >
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                  <span>{t('updating')}</span>
                </div>
              )}
              <div
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                role="group"
                aria-label={t('month_navigation')}
              >
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label={t('previous_month')}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    chevron_left
                  </span>
                </button>
                <span
                  className="min-w-[112px] px-2 text-center text-xs font-bold text-slate-900 dark:text-slate-100"
                  aria-live="polite"
                >
                  {formatMonthLabel(monthStart)}
                </span>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label={t('next_month')}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            {historyError && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
              >
                <span>{t('work_history_load_error')}</span>
                <button
                  type="button"
                  onClick={() => setHistoryRetryKey((current) => current + 1)}
                  className="min-h-11 rounded-xl border border-rose-300 bg-white px-4 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900 cursor-pointer"
                >
                  {t('retry')}
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <div className="min-w-[700px] space-y-3">
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d.index}
                      className="rounded-xl bg-slate-100/90 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {t(d.i18nKey)}
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {monthWeeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-5 gap-3">
                      {week.map((date, di) => {
                        if (!date)
                          return (
                            <div
                              key={di}
                              className="min-h-[110px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 opacity-40 dark:border-slate-800/60 dark:bg-[#1f2023]/30"
                              aria-hidden="true"
                            />
                          );
                        const dateISO = toISODate(date);
                        const isToday = dateISO === todayISO;
                        const dateFormatted = formatDateLocale(date, language, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        });
                        const morningCTVs = getAssignedCTVs(dateISO, 'morning');
                        const afternoonCTVs = getAssignedCTVs(dateISO, 'afternoon');

                        return (
                          <div
                            key={dateISO}
                            className={`flex min-h-[110px] flex-col rounded-2xl border-2 p-3 shadow-2xs transition-colors ${isToday ? 'border-accent bg-blue-50/30 dark:border-accent dark:bg-blue-950/25' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}
                          >
                            <div className="flex items-center justify-center border-b border-slate-100 dark:border-slate-800/80 pb-1.5 mb-2">
                              <span className="flex items-center justify-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <span>{formatShortDate(date)}</span>
                                {isToday && (
                                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    {t('today')}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="space-y-1.5 min-h-[58px] flex flex-col justify-start">
                              {morningCTVs.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenShiftDetail(di, dateFormatted, 'morning', dateISO)
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/80 border border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between text-left transition-all cursor-pointer group"
                                  title={t('schedule.view_morning_ctvs')}
                                >
                                  <span className="flex items-center text-amber-800 dark:text-amber-300">
                                    <span className="material-symbols-outlined text-[16px]">
                                      wb_sunny
                                    </span>
                                  </span>
                                  <span className="text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded group-hover:scale-105 transition-transform">
                                    {morningCTVs.length} {t('schedule.ctv_short')}
                                  </span>
                                </button>
                              ) : afternoonCTVs.length > 0 ? (
                                <div className="h-[32px]" aria-hidden="true" />
                              ) : null}
                              {afternoonCTVs.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenShiftDetail(di, dateFormatted, 'afternoon', dateISO)
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-950/80 border border-purple-200/80 dark:border-purple-900/40 flex items-center justify-between text-left transition-all cursor-pointer group"
                                  title={t('schedule.view_afternoon_ctvs')}
                                >
                                  <span className="flex items-center text-purple-800 dark:text-purple-300">
                                    <span className="material-symbols-outlined text-[16px]">
                                      wb_twilight
                                    </span>
                                  </span>
                                  <span className="text-[10px] font-bold bg-purple-200/80 dark:bg-purple-900/70 text-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded group-hover:scale-105 transition-transform">
                                    {afternoonCTVs.length} {t('schedule.ctv_short')}
                                  </span>
                                </button>
                              ) : morningCTVs.length > 0 ? (
                                <div className="h-[32px]" aria-hidden="true" />
                              ) : null}
                              {morningCTVs.length === 0 && afternoonCTVs.length === 0 && (
                                <div className="flex-1 flex items-center justify-center py-2">
                                  <span className="text-[11px] text-slate-400">—</span>
                                </div>
                              )}
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

      {/* Modal Shift Details */}
      {selectedShiftDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#25262b] rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#1f2023] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">
                  <span className="material-symbols-outlined text-[18px]">event_note</span>
                  <span>{t('schedule.shift_detail_title')}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedShiftDetail.shiftType === 'morning'
                    ? t('schedule.morning_shift')
                    : t('schedule.afternoon_shift')}{' '}
                  - {selectedShiftDetail.dayName} ({selectedShiftDetail.dateFormatted})
                </h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedShiftDetail(null)}
                  className="w-9 h-9 rounded-full bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  title={t('close')}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {selectedShiftDetail.ctvList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <span className="material-symbols-outlined text-[44px] block opacity-40">
                    group_off
                  </span>
                  <p className="text-sm font-semibold">{t('schedule.no_ctv_registered_shift')}</p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-[#1f2023] border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="py-3.5 px-4">{t('schedule.ctv_name')}</th>
                          <th className="py-3.5 px-4">{t('schedule.phone_number')}</th>
                          <th className="py-3.5 px-4 text-right">{t('schedule.assigned_room')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {selectedShiftDetail.ctvList.map((ctv, idx) => (
                          <tr
                            key={ctv.id || idx}
                            className="hover:bg-slate-50/80 dark:hover:bg-[#1f2023]/60 transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <div
                                onClick={() => {
                                  handleCTVClick(ctv);
                                  setSelectedShiftDetail(null);
                                }}
                                className="inline-flex items-center gap-3 cursor-pointer group"
                                title={t('schedule.click_to_view_detail')}
                              >
                                {ctv.avatar ? (
                                  <img
                                    src={ctv.avatar}
                                    alt={ctv.name}
                                    className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-slate-400 dark:group-hover:ring-slate-500 transition-all"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-[#1b365d] text-white font-bold text-xs flex items-center justify-center shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-slate-400 dark:group-hover:ring-slate-500 transition-all">
                                    {ctv.initials || ctv.name.substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:underline underline-offset-2 transition-all">
                                  {ctv.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                                <span className="material-symbols-outlined text-[15px] text-slate-400">
                                  call
                                </span>
                                <span>{ctv.phone || '—'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {formatRoomDisplay(ctv.roomDisplay, t) === '--' ? (
                                <span className="text-slate-400 dark:text-slate-500 font-bold text-sm tracking-wider select-none pr-1">
                                  --
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-semibold rounded-lg border border-blue-100 dark:border-blue-900/60 inline-block text-[11px]">
                                  {formatRoomDisplay(ctv.roomDisplay, t)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
