import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { UserAccount, ShiftSlot } from '../../../shared/types';
import { formatPhoneNumber } from '../../../shared/utils/formatters';
import { formatRoomDisplay } from '../../../shared/utils/rooms';
import { getMsUntilPostCutoffRefresh } from '../../../shared/utils/scheduleSelectors';
import type { ApiScheduleData, ScheduleResponse, ApiHistoryCell } from '../../../shared/mappers';
import { historyToSlots, scheduleToPattern } from '../../../shared/mappers';
import * as api from '../../../shared/api';
import { useSystemSettings } from '../../../shared/context/SystemSettingsContext';
import { formatDateLocale } from '../../../shared/i18n';

interface ViewAccountDetailModalProps {
  account: UserAccount | null;
  shifts?: ShiftSlot[];
  onClose: () => void;
  onToggleStatus: (id: string) => void;
  onSaveNotes?: (id: string, notes: string) => void;
  onResetPassword?: (id: string, newPassword: string, requireChangeOnLogin: boolean) => void;
}

const WEEKDAY_INDICES = [0, 1, 2, 3, 4] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};
const addDays = (date: Date, amount: number) =>
  new Date(startOfDay(date).getTime() + amount * DAY_MS);
const startOfWeek = (date: Date) => {
  const normalized = startOfDay(date);
  return addDays(normalized, -((normalized.getDay() + 6) % 7));
};
const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatShortDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

export const ViewAccountDetailModal: React.FC<ViewAccountDetailModalProps> = ({
  account,
  shifts = [],
  onClose,
  onSaveNotes,
}) => {
  const { t, language } = useSystemSettings();

  const [previewImg, setPreviewImg] = useState<{ title: string; url: string } | null>(null);
  const [showWorkHistory, setShowWorkHistory] = useState<boolean>(false);
  const [historyDate, setHistoryDate] = useState<Date>(() => new Date());
  const [accountSchedule, setAccountSchedule] = useState<ApiScheduleData | null>(null);
  const [historyShifts, setHistoryShifts] = useState<ShiftSlot[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [notesText, setNotesText] = useState(account?.notes || '');
  const [isSavedNotes, setIsSavedNotes] = useState(false);

  useEffect(() => {
    setNotesText(account?.notes || '');
    setIsSavedNotes(false);
  }, [account?.id, account?.notes]);

  useEffect(() => {
    setShowWorkHistory(false);
    setHistoryDate(new Date());
    setHistoryShifts([]);
    setHistoryError('');
    setAccountSchedule(null);
  }, [account?.id]);

  useEffect(() => {
    if (!account || account.role === 'Admin') {
      setAccountSchedule(null);
      return;
    }

    let cancelled = false;

    void api
      .apiGet<ScheduleResponse | { data: ApiScheduleData | null }>(
        `/api/v1/accounts/${encodeURIComponent(account.id)}/schedule`,
      )
      .then((response) => {
        if (cancelled) return;
        const data =
          'data' in response && response.data !== undefined
            ? response.data
            : (response as unknown as ApiScheduleData);
        setAccountSchedule(data || null);
      })
      .catch(() => {
        if (!cancelled) {
          setAccountSchedule(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [account?.id, account?.role]);

  const accountHistoryController = useRef<AbortController | null>(null);
  const accountHistorySequence = useRef(0);
  const [historyRetryKey, setHistoryRetryKey] = useState(0);

  const fetchAccountHistory = useCallback(async () => {
    if (!showWorkHistory || !account || account.role === 'Admin') return;

    const month = `${historyDate.getFullYear()}-${String(historyDate.getMonth() + 1).padStart(2, '0')}`;
    accountHistoryController.current?.abort();
    const controller = new AbortController();
    const sequence = ++accountHistorySequence.current;
    accountHistoryController.current = controller;

    setIsHistoryLoading(true);
    setHistoryError('');

    try {
      const response = await api.apiGet<{
        data?: { cells?: ApiHistoryCell[] };
        cells?: ApiHistoryCell[];
      }>(`/api/v1/work-history?month=${month}&accountId=${encodeURIComponent(account.id)}`, {
        signal: controller.signal,
      });
      if (sequence !== accountHistorySequence.current) return;
      const cells: ApiHistoryCell[] = response.data?.cells ?? response.cells ?? [];
      setHistoryShifts(historyToSlots(cells));
    } catch (error) {
      if (!api.isRequestAborted(error)) {
        if (sequence === accountHistorySequence.current) {
          setHistoryError(t('accounts.history_load_failed'));
        }
      }
    } finally {
      if (sequence === accountHistorySequence.current) {
        setIsHistoryLoading(false);
      }
    }
  }, [account, historyDate, showWorkHistory, t]);

  useEffect(() => {
    if (showWorkHistory && account && account.role !== 'Admin') {
      void fetchAccountHistory();
    }
    return () => accountHistoryController.current?.abort();
  }, [
    fetchAccountHistory,
    showWorkHistory,
    account?.id,
    account?.role,
    historyDate,
    historyRetryKey,
  ]);

  useEffect(() => {
    if (!showWorkHistory || !account || account.role === 'Admin') return;

    const handleFocus = () => {
      void fetchAccountHistory();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchAccountHistory();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAccountHistory, showWorkHistory, account?.id, account?.role]);

  useEffect(() => {
    if (!showWorkHistory || !account || account.role === 'Admin') return;
    const delay = getMsUntilPostCutoffRefresh();
    if (delay === null) return;

    const timer = window.setTimeout(() => {
      void fetchAccountHistory();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [fetchAccountHistory, showWorkHistory, account?.id, account?.role]);

  // Compute registered start date for this CTV
  const userRegisteredStartDateISO = useMemo(() => {
    if (!account) return new Date().toISOString().split('T')[0];
    const userShifts = shifts.filter((s) =>
      (s.assignedCTVs || []).some((c) => c.id === account.id || c.name === account.name),
    );

    let earliest = '';
    userShifts.forEach((s) => {
      const candidate = s.registrationStartDate || s.workDate;
      if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
        if (!earliest || candidate < earliest) {
          earliest = candidate;
        }
      }
    });

    if (earliest) return earliest;

    if (account.joinDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(account.joinDate)) return account.joinDate;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(account.joinDate)) {
        const parts = account.joinDate.split('/');
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    if (account.registerDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(account.registerDate)) return account.registerDate;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(account.registerDate)) {
        const parts = account.registerDate.split('/');
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    return new Date().toISOString().split('T')[0];
  }, [account, shifts]);

  const userRegisteredStartDateFormatted = useMemo(() => {
    if (!userRegisteredStartDateISO) return '';
    const parts = userRegisteredStartDateISO.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return userRegisteredStartDateISO;
  }, [userRegisteredStartDateISO]);

  const schedulePattern = useMemo(
    () => scheduleToPattern(accountSchedule?.shifts || []),
    [accountSchedule],
  );

  if (!account) return null;

  const handleSaveNotes = () => {
    if (account) {
      if (onSaveNotes) {
        onSaveNotes(account.id, notesText);
      }
      setIsSavedNotes(true);
      setTimeout(() => setIsSavedNotes(false), 2000);
    }
  };

  const todayISO = toISODate(new Date());
  const currentWeekStart = startOfWeek(new Date());
  const currentWeekDates = WEEKDAY_INDICES.map((index) => addDays(currentWeekStart, index));

  const changeHistoryMonth = (amount: number) => {
    setHistoryDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const monthStart = new Date(historyDate.getFullYear(), historyDate.getMonth(), 1);
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

  const getHistoryShift = (date: Date, shiftType: 'morning' | 'afternoon') => {
    const dateISO = toISODate(date);
    return historyShifts.find((s) => s.workDate === dateISO && s.shiftType === shiftType);
  };

  const cccdFrontUrl = account.cccdFront;
  const cccdBackUrl = account.cccdBack;
  const hasCv = Boolean(account.cvFile);
  const cvFileName = account.cvFileName || 'CV';
  const isPdf = cvFileName.toLowerCase().endsWith('.pdf');

  const handleDownloadCV = () => {
    if (!account.cvFile) return;

    const a = document.createElement('a');
    a.href = account.cvFile;
    a.download = cvFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Helper to get shift status for a specific day and shift type
  const getShiftStatus = (
    dayOrIndex: number | string,
    shiftType: 'morning' | 'afternoon',
  ): 'working' | 'off' => {
    if (!accountSchedule) return 'off';
    let weekdayIndex: number;
    if (typeof dayOrIndex === 'number') {
      weekdayIndex = dayOrIndex;
    } else {
      const d = new Date(dayOrIndex);
      const dayOfWeek = d.getDay();
      weekdayIndex = dayOfWeek >= 1 && dayOfWeek <= 5 ? dayOfWeek - 1 : -1;
    }
    if (weekdayIndex < 0 || weekdayIndex > 4) return 'off';
    return schedulePattern[weekdayIndex]?.includes(shiftType) ? 'working' : 'off';
  };

  // Determine assigned work room for CTV
  const assignedWorkRoom = formatRoomDisplay(
    accountSchedule?.roomCode || account.workRoom || account.room,
    t('schedule.room_prefix'),
  );

  const weekdayLabels = [t('mon'), t('tue'), t('wed'), t('thu'), t('fri')];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#25262b] rounded-2xl border border-[#E2E8F0] dark:border-[#3b3d45] shadow-2xl w-full max-w-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#F8FAFC] dark:bg-[#1f2023]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1b365d]/10 text-[#1b365d] dark:bg-[#1b365d]/30 dark:text-[#87a0cd] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">badge</span>
            </div>
            <h3 className="text-base font-bold text-[#1b365d] dark:text-[#d6e3ff]">
              {t('accounts.profile_and_schedule_title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="text-[#74777f] hover:text-[#1b365d] dark:hover:text-white p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* User Profile Header Card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#1e1f23] border border-[#E2E8F0] dark:border-[#3b3d45]">
            <div className="flex items-center gap-4 min-w-0">
              {account.avatar ? (
                <img
                  src={account.avatar}
                  alt={account.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#1b365d] shadow-xs shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#1b365d] text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                  {account.initials || account.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="text-lg font-bold text-[#1b365d] dark:text-[#d6e3ff] break-words">
                  {account.name}
                </h4>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2 text-xs text-[#74777f] dark:text-[#c4c6cf] shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {account.role === 'Admin' ? t('role_admin') : t('role_ctv')}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    account.status === 'Kích hoạt'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800'
                  }`}
                >
                  {account.status === 'Kích hoạt' ? t('status_active') : t('status_inactive')}
                </span>
              </div>
              <p>
                {t('registration_date')}:{' '}
                <span className="font-semibold text-[#1b365d] dark:text-white">
                  {account.registerDate || account.joinDate || '15/05/2023'}
                </span>
              </p>
            </div>
          </div>

          {/* Section 1: Detailed Profile Info */}
          <div>
            <h5 className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">person</span>
              <span>{t('accounts.personal_and_account_info')}</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#F8FAFC] dark:bg-[#1e1f23] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#3b3d45]">
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45] gap-2">
                <span className="text-[#74777f] shrink-0">{t('full_name')}:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white break-words text-right min-w-0">{account.name}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45] gap-2">
                <span className="text-[#74777f] shrink-0">{t('email')}:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white break-words text-right min-w-0">
                  {account.email}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45] gap-2">
                <span className="text-[#74777f] shrink-0">{t('phone_number')}:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white break-words text-right min-w-0">
                  {formatPhoneNumber(account.phone)}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45] gap-2">
                <span className="text-[#74777f] shrink-0">{t('dob')}:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white break-words text-right min-w-0">
                  {account.dob || t('not_updated')}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45] gap-2">
                <span className="text-[#74777f] shrink-0">{t('gender')}:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white break-words text-right min-w-0">
                  {account.gender === 'Nam'
                    ? t('gender_male')
                    : account.gender === 'Nữ'
                      ? t('gender_female')
                      : account.gender
                        ? t('gender_other')
                        : t('not_updated')}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45] gap-2">
                <span className="text-[#74777f] shrink-0">{t('address')}:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white break-words text-right min-w-0">
                  {account.address || t('not_updated')}
                </span>
              </div>
            </div>

            <div className="mt-3 p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1e1f23] border border-[#E2E8F0] dark:border-[#3b3d45]">
              <div className="flex items-center mb-2.5">
                <span className="text-[11px] font-bold text-[#1b365d] dark:text-[#d6e3ff] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">badge</span>
                  <span>{t('accounts.cccd_title')}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {cccdFrontUrl ? (
                  <div
                    onClick={() =>
                      setPreviewImg({
                        title: `${t('cccd_front')} - ${account.name}`,
                        url: cccdFrontUrl,
                      })
                    }
                    className="relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#25262b] overflow-hidden h-28 cursor-pointer shadow-2xs hover:border-blue-400 transition-all"
                  >
                    <img
                      src={cccdFrontUrl}
                      alt={t('cccd_front')}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                      <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                      <span>{t('accounts.view_front')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-28 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-[#25262b] flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500">
                    <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                      image_not_supported
                    </span>
                    <span className="text-xs font-semibold">{t('accounts.not_provided')}</span>
                    <span className="text-[10px]">{t('front_side')}</span>
                  </div>
                )}

                {cccdBackUrl ? (
                  <div
                    onClick={() =>
                      setPreviewImg({
                        title: `${t('cccd_back')} - ${account.name}`,
                        url: cccdBackUrl,
                      })
                    }
                    className="relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#25262b] overflow-hidden h-28 cursor-pointer shadow-2xs hover:border-blue-400 transition-all"
                  >
                    <img
                      src={cccdBackUrl}
                      alt={t('cccd_back')}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                      <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                      <span>{t('accounts.view_back')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-28 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-[#25262b] flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500">
                    <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                      image_not_supported
                    </span>
                    <span className="text-xs font-semibold">{t('accounts.not_provided')}</span>
                    <span className="text-[10px]">{t('back_side')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CV Document Box */}
            <div className="mt-3 p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1e1f23] border border-[#E2E8F0] dark:border-[#3b3d45]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#1b365d] dark:text-[#d6e3ff] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">
                    description
                  </span>
                  <span>{t('cv_title')}</span>
                </span>
              </div>
              {hasCv ? (
                <div className="p-2.5 bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        isPdf
                          ? 'bg-red-50 text-red-600 border border-red-200/80 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60'
                          : 'bg-blue-50 text-blue-600 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {isPdf ? 'picture_as_pdf' : 'description'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1a1b1e] dark:text-white truncate">
                        {cvFileName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative group">
                      <a
                        href={account.cvFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('accounts.view_in_new_tab')}
                        className="w-9 h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center justify-center shadow-2xs cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </a>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
                      >
                        {t('accounts.view_in_new_tab')}
                      </span>
                    </div>

                    <div className="relative group">
                      <button
                        type="button"
                        onClick={handleDownloadCV}
                        aria-label={t('download')}
                        className="w-9 h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center justify-center shadow-2xs cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                      </button>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
                      >
                        {t('download')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white/70 dark:bg-[#25262b] border border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center gap-2.5 text-slate-400 dark:text-slate-500">
                  <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                    description
                  </span>
                  <span className="text-xs font-semibold">{t('accounts.not_provided')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Monday - Friday Schedule */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <h5 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                <span
                  className="material-symbols-outlined text-[22px] text-blue-700 dark:text-blue-300"
                  aria-hidden="true"
                >
                  calendar_month
                </span>
                <span>{t('accounts.work_schedule_title')}</span>
              </h5>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Work room badge */}
                {account.role !== 'Admin' && (
                  <div
                    title={`${t('schedule.room')}: ${assignedWorkRoom}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/80 rounded-lg text-xs font-semibold shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400">
                      meeting_room
                    </span>
                    <span className="font-bold text-[#1b365d] dark:text-[#93c5fd]">
                      {assignedWorkRoom}
                    </span>
                  </div>
                )}
                <div className="group relative">
                  <button
                    type="button"
                    onClick={() => setShowWorkHistory(true)}
                    aria-label={t('work_history')}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 shadow-2xs transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <span className="material-symbols-outlined text-[18px]">history</span>
                  </button>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {t('work_history')}
                  </span>
                </div>
              </div>
            </div>

            {account.role === 'Admin' ? (
              <div className="p-4 bg-slate-50 dark:bg-[#1e1f23] rounded-xl border border-[#E2E8F0] dark:border-[#3b3d45] flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined text-amber-500 text-[20px]">info</span>
                <span>{t('accounts.admin_no_schedule_note')}</span>
              </div>
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[650px] space-y-3">
                  <div className="grid grid-cols-5 gap-3">
                    {WEEKDAY_INDICES.map((idx) => {
                      const date = currentWeekDates[idx];
                      const dateISO = toISODate(date);
                      const isToday = dateISO === todayISO;

                      return (
                        <div
                          key={idx}
                          aria-current={isToday ? 'date' : undefined}
                          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
                            isToday
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                              : 'bg-slate-100/90 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span>{weekdayLabels[idx]}</span>
                          {isToday && <span className="sr-only">{t('today')}</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-5 gap-3">
                    {WEEKDAY_INDICES.map((idx) => {
                      const date = currentWeekDates[idx];
                      const dateISO = toISODate(date);
                      const morning = getShiftStatus(idx, 'morning');
                      const afternoon = getShiftStatus(idx, 'afternoon');
                      const isToday = dateISO === todayISO;

                      return (
                        <div
                          key={idx}
                          className={`min-h-[104px] rounded-2xl border-2 bg-white p-3 shadow-2xs transition-colors dark:bg-slate-900 ${
                            isToday
                              ? 'border-blue-600 dark:border-blue-400'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="space-y-2">
                            {morning !== 'off' ? (
                              <div
                                title={`${t('morning_shift')}: ${t('accounts.working')}`}
                                className="flex w-full items-center gap-2 whitespace-nowrap rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 shadow-xs dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
                              >
                                <span
                                  className="material-symbols-outlined text-[18px] text-amber-700 dark:text-amber-400"
                                  aria-hidden="true"
                                >
                                  wb_sunny
                                </span>
                                <span>{t('morning_shift')}</span>
                              </div>
                            ) : afternoon !== 'off' ? (
                              <div className="h-[38px]" aria-hidden="true" />
                            ) : null}

                            {afternoon !== 'off' && (
                              <div
                                title={`${t('afternoon_shift')}: ${t('accounts.working')}`}
                                className="flex w-full items-center gap-2 whitespace-nowrap rounded-xl border border-purple-200/90 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-900 shadow-xs dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-200"
                              >
                                <span
                                  className="material-symbols-outlined text-[18px] text-purple-700 dark:text-purple-400"
                                  aria-hidden="true"
                                >
                                  wb_twilight
                                </span>
                                <span>{t('afternoon_shift')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Notes */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#1e1f23] border border-[#E2E8F0] dark:border-[#3b3d45] space-y-2.5">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">
                  edit_note
                </span>
                <span>{t('accounts.notes')}</span>
              </h5>
              <button
                type="button"
                onClick={handleSaveNotes}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  isSavedNotes
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#1b365d] hover:bg-[#002046] dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isSavedNotes ? 'check_circle' : 'save'}
                </span>
                <span>{isSavedNotes ? t('accounts.saved') : t('save_btn')}</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#25262b] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none shadow-2xs leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>
      {/* CCCD LIGHTBOX PREVIEW MODAL */}
      {previewImg && (
        <div
          onClick={() => setPreviewImg(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[#1b365d] dark:text-[#87a0cd] text-[20px] shrink-0">
                  badge
                </span>
                <h3
                  className="font-bold text-sm text-[#1b365d] dark:text-[#d6e3ff] truncate"
                  title={previewImg.title}
                >
                  {previewImg.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewImg(null)}
                aria-label={t('close')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center max-h-[60vh]">
              <img
                src={previewImg.url}
                alt={previewImg.title}
                className="w-full h-auto object-contain max-h-[60vh]"
              />
            </div>
          </div>
        </div>
      )}

      {/* WORK HISTORY MODAL */}
      {showWorkHistory && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col my-auto">
            {/* Header matching image */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[24px] text-blue-600 dark:text-blue-400">
                  calendar_month
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {t('work_history')}
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
                  <span>{t('loading')}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div
                  className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-2xs dark:border-slate-700 dark:bg-slate-900"
                  role="group"
                  aria-label={t('month_navigation')}
                >
                  <button
                    type="button"
                    onClick={() => changeHistoryMonth(-1)}
                    className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label={t('previous_month')}
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span className="min-w-[120px] px-2 text-center text-xs font-bold text-slate-900 dark:text-slate-100 capitalize">
                    {formatDateLocale(historyDate, language, { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeHistoryMonth(1)}
                    className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label={t('next_month')}
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWorkHistory(false)}
                  aria-label={t('close')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {historyError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 flex items-center justify-between gap-2"
              >
                <span>{historyError}</span>
                <button
                  type="button"
                  onClick={() => setHistoryRetryKey((k) => k + 1)}
                  className="rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900 cursor-pointer"
                >
                  {t('retry')}
                </button>
              </div>
            )}

            {/* Grid calendar */}
            <div className="overflow-y-auto overflow-x-auto flex-1 pr-3 sm:pr-4 pb-2">
              <div className="min-w-[780px] space-y-3 mr-1">
                {/* 5 Column Weekday Header */}
                <div className="grid grid-cols-5 gap-3">
                  {weekdayLabels.map((dayName, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200/80 bg-slate-100/90 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-[#1f2023] dark:text-slate-200"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Weeks Rows */}
                <div className="space-y-3">
                  {monthWeeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-5 gap-3">
                      {week.map((date, dayIndex) => {
                        if (!date) {
                          return (
                            <div
                              key={dayIndex}
                              className="min-h-[140px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 opacity-40 dark:border-slate-800/60 dark:bg-[#1f2023]/30"
                            />
                          );
                        }

                        const dateISO = toISODate(date);
                        const isToday = dateISO === todayISO;
                        const dayStr = formatShortDate(date);
                        const morningShift = getHistoryShift(date, 'morning');
                        const afternoonShift = getHistoryShift(date, 'afternoon');

                        return (
                          <div
                            key={dateISO}
                            className={`flex min-h-[140px] flex-col justify-start rounded-2xl border p-3 transition-all ${
                              isToday
                                ? 'border-blue-600 bg-white ring-2 ring-blue-600/30 dark:border-blue-500 dark:bg-slate-900'
                                : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#222327] dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="mb-2.5 flex items-center justify-center gap-1.5 text-center">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {dayStr}
                              </span>
                              {isToday && (
                                <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {t('today')}
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 flex-1">
                              {morningShift ? (
                                <div className="flex w-full items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 shadow-xs select-none pointer-events-none transition-colors dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
                                  <span
                                    className="material-symbols-outlined text-[18px] text-amber-700 dark:text-amber-400"
                                    aria-hidden="true"
                                  >
                                    wb_sunny
                                  </span>
                                  <span className="text-amber-900 dark:text-amber-100">
                                    {t('morning_shift')}
                                  </span>
                                </div>
                              ) : afternoonShift ? (
                                <div className="h-[38px]" aria-hidden="true" />
                              ) : null}

                              {afternoonShift && (
                                <div className="flex w-full items-center gap-2 rounded-xl border border-purple-200/90 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-900 shadow-xs select-none pointer-events-none transition-colors dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-200">
                                  <span
                                    className="material-symbols-outlined text-[18px] text-purple-700 dark:text-purple-400"
                                    aria-hidden="true"
                                  >
                                    wb_twilight
                                  </span>
                                  <span className="text-purple-900 dark:text-purple-100">
                                    {t('afternoon_shift')}
                                  </span>
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
        </div>
      )}
    </div>
  );
};
