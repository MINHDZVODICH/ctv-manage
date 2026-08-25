import { useMemo, useState } from 'react';
import { ViewAccountDetailModal } from '../accounts/ViewAccountDetailModal';
import { messageFor, type AccountDetail } from '../accounts/useAccounts';
import { apiClient } from '../../shared/api/client';
import { addMonths, periodLabel, shiftKey, todayInBangkok, type SchedulePeriod } from '../../shared/utils/scheduleSelectors';
import { ShiftRosterModal } from './ShiftRosterModal';
import { useScheduleSummary } from './useScheduleSummary';

export function SummaryScheduleScreen({ initialMonth = todayInBangkok().slice(0, 7) }: { initialMonth?: string }) {
  const [month, setMonth] = useState(initialMonth);
  const schedule = useScheduleSummary(month);
  const [profile, setProfile] = useState<AccountDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const slots = useMemo(() => new Map((schedule.data?.days ?? []).flatMap((day) => day.slots.map((slot) => [shiftKey(day.date, slot.period), slot]))), [schedule.data]);
  const calendar = useMemo(() => calendarDays(month), [month]);
  const openProfile = async (accountId: string) => {
    setProfile(null); setProfileError(null); setProfileLoading(true);
    try { setProfile(await apiClient.get<AccountDetail>(`/accounts/${accountId}`)); }
    catch (reason) { setProfileError(messageFor(reason)); }
    finally { setProfileLoading(false); }
  };
  const roster = schedule.roster;
  return <section className="feature-screen summary-schedule-screen" aria-labelledby="summary-schedule-title">
    <div className="screen-heading"><p className="eyebrow">Quản trị lịch</p><h1 id="summary-schedule-title">Lịch làm việc tổng hợp</h1></div>
    <section className="schedule-panel">
      <header className="calendar-navigation"><button type="button" aria-label="Tháng trước" onClick={() => setMonth((value) => addMonths(`${value}-01`, -1).slice(0, 7))}>‹</button><strong>{formatMonth(month)}</strong><button type="button" aria-label="Tháng sau" onClick={() => setMonth((value) => addMonths(`${value}-01`, 1).slice(0, 7))}>›</button></header>
      {schedule.error && <p className="form-error" role="alert">{schedule.error}</p>}
      {schedule.isLoading ? <p className="loading-state" aria-live="polite">Đang tải lịch tổng hợp...</p> : <div className="summary-calendar" aria-label={`Lịch tổng hợp ${month}`}><div className="summary-weekdays">{['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'].map((label) => <strong key={label}>{label}</strong>)}</div><div className="summary-grid">{calendar.map((day, index) => day ? <article className={day === todayInBangkok() ? 'summary-day today' : 'summary-day'} key={day}><header>{day.slice(8, 10)}/{day.slice(5, 7)}</header>{(['MORNING', 'AFTERNOON'] as SchedulePeriod[]).map((period) => { const slot = slots.get(shiftKey(day, period)); return slot ? <button key={period} type="button" className={`summary-slot ${period.toLowerCase()}`} aria-label={`${slot.count} cộng tác viên, ${periodLabel(period)}`} onClick={() => void schedule.openRoster(slot.shiftId)}><span>{periodLabel(period)}</span><strong>{slot.count} cộng tác viên</strong></button> : <span key={period} className="summary-empty">{periodLabel(period)} · Trống</span>; })}</article> : <div className="summary-day blank" key={`blank-${index}`} />)}</div></div>}
    </section>
    {(schedule.isRosterLoading || roster) && <ShiftRosterModal date={roster?.workDate ?? ''} period={roster?.period ?? 'MORNING'} roster={roster?.coWorkers ?? null} isLoading={schedule.isRosterLoading} onClose={schedule.closeRoster} onOpenProfile={(id) => { schedule.closeRoster(); void openProfile(id); }} />}
    {(profileLoading || profile || profileError) && <ViewAccountDetailModal account={profile} isLoading={profileLoading} error={profileError} isSaving={false} readOnly onClose={() => { setProfile(null); setProfileError(null); }} onSaveNotes={() => undefined} onResetPassword={() => undefined} onEditProfile={() => undefined} onReplaceFile={() => undefined} onDeleteFile={() => undefined} />}
  </section>;
}

export function calendarDays(month: string): Array<string | null> { const [year, number] = month.split('-').map(Number); const last = new Date(Date.UTC(year, number, 0)).getUTCDate(); const days: Array<string | null> = []; let row: Array<string | null> = []; for (let day = 1; day <= last; day += 1) { const weekday = new Date(Date.UTC(year, number - 1, day)).getUTCDay(); if (weekday < 1 || weekday > 5) continue; if (row.length === 0) row = Array(weekday - 1).fill(null); row.push(`${month}-${String(day).padStart(2, '0')}`); if (weekday === 5) { days.push(...row); row = []; } } if (row.length) { while (row.length < 5) row.push(null); days.push(...row); } return days; }
function formatMonth(value: string) { const [year, month] = value.split('-').map(Number); return `Tháng ${month}, ${year}`; }
