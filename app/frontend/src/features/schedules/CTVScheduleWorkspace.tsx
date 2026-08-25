import { useMemo, useState } from 'react';
import { formatDayMonth, formatMonth, formatShortDate } from '../../shared/utils/formatters';
import {
  addDays, addMonths, monthOf, PERIODS, periodLabel, ROOMS, roomLabel, shiftKey, todayInBangkok, WEEKDAYS, weekRange,
  type RoomCode, type SchedulePeriod,
} from '../../shared/utils/scheduleSelectors';
import { ShiftDetailModal } from './ShiftDetailModal';
import { useMySchedule, type PatternSlot, type RegistrationPayload, type ScheduleRegistration } from './useMySchedule';

type CalendarView = 'week' | 'history';

interface Props { today?: string; initialDate?: string }

export function CTVScheduleWorkspace({ today = todayInBangkok(), initialDate = today }: Props) {
  const [view, setView] = useState<CalendarView>('week');
  const [cursor, setCursor] = useState(initialDate);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const range = weekRange(cursor);
  const month = monthOf(cursor);
  const schedule = useMySchedule(view === 'week' ? { from: range.from, to: range.to } : { month });
  const bySlot = useMemo(() => new Map(schedule.shifts.map((item) => [shiftKey(item.workDate, item.period), item])), [schedule.shifts]);

  return (
    <div className="schedule-workspace">
      <section className="schedule-hero">
        <div><p className="eyebrow">Lịch làm việc</p><h2>Lịch cá nhân của bạn</h2><p>Đăng ký mẫu tuần, xem ca và quản lý các ca sắp tới.</p></div>
        <button type="button" className="primary-button" onClick={() => setRegistrationOpen(true)}>Đăng ký lịch làm việc</button>
      </section>

      {schedule.notice && <div className="schedule-notice" role="status"><span>{schedule.notice}</span><button type="button" aria-label="Đóng thông báo" onClick={schedule.clearNotice}>×</button></div>}
      {schedule.error && <p className="form-error" role="alert">{schedule.error}</p>}

      <section className="schedule-panel">
        <header className="schedule-toolbar">
          <div className="schedule-tabs" role="tablist" aria-label="Chế độ xem lịch">
            <button type="button" role="tab" aria-selected={view === 'week'} onClick={() => setView('week')}>Lịch tuần</button>
            <button type="button" role="tab" aria-selected={view === 'history'} onClick={() => setView('history')}>Lịch sử làm việc</button>
          </div>
          <span className="room-chip">{roomLabel(schedule.registration?.roomCode)}</span>
        </header>

        <div className="calendar-navigation">
          <button type="button" aria-label={view === 'week' ? 'Xem tuần trước' : 'Xem tháng trước'} onClick={() => setCursor(view === 'week' ? addDays(cursor, -7) : addMonths(cursor, -1))}>‹</button>
          <strong>{view === 'week' ? `${formatDayMonth(range.from)} - ${formatShortDate(range.to)}` : formatMonth(month)}</strong>
          <button type="button" aria-label={view === 'week' ? 'Xem tuần sau' : 'Xem tháng sau'} onClick={() => setCursor(view === 'week' ? addDays(cursor, 7) : addMonths(cursor, 1))}>›</button>
        </div>

        {schedule.isLoading ? <p className="loading-state" aria-live="polite">Đang tải lịch làm việc...</p> : view === 'week' ? (
          <div className="week-calendar" aria-label="Lịch tuần cá nhân">
            {range.days.map((day, index) => (
              <article key={day} className={day === today ? 'day-column today' : 'day-column'}>
                <header><strong>{WEEKDAYS[index].label}</strong><span>{formatDayMonth(day)}</span>{day === today && <small>Hôm nay</small>}</header>
                {PERIODS.map(({ period, label }) => {
                  const item = bySlot.get(shiftKey(day, period));
                  return item ? <button key={period} type="button" className={`shift-card ${period.toLowerCase()}`} aria-label={`${label}, ${formatDayMonth(day)}`} onClick={() => void schedule.openDetail(item.shiftId)}><strong>{label}</strong><span>{roomLabel(item.roomCode)}</span></button>
                    : <div key={period} className="empty-shift"><span>{label}</span><small>Trống</small></div>;
                })}
              </article>
            ))}
          </div>
        ) : (
          <HistoryTable shifts={schedule.shifts} onOpen={(shiftId) => void schedule.openDetail(shiftId)} />
        )}
      </section>

      {registrationOpen && <RegistrationDialog key={`${schedule.registration?.id ?? 'new'}:${schedule.registration?.version ?? 'new'}`} registration={schedule.registration} today={today} isSaving={schedule.isSaving} onClose={() => setRegistrationOpen(false)} onSave={async (payload) => {
        const saved = await schedule.saveRegistration(payload);
        if (saved) setRegistrationOpen(false);
      }} />}
      {schedule.isDetailLoading && <div className="dialog-backdrop"><p className="loading-card" role="status">Đang tải chi tiết ca...</p></div>}
      {schedule.detail && <ShiftDetailModal detail={schedule.detail} isSaving={schedule.isSaving} onClose={schedule.clearDetail} onCancelOne={(id) => void schedule.cancelOne(id)} onCancelSeries={(detail) => void schedule.cancelSeries(detail)} />}
    </div>
  );
}

function HistoryTable({ shifts, onOpen }: { shifts: ReturnType<typeof useMySchedule>['shifts']; onOpen: (id: string) => void }) {
  return (
    <div className="history-table-wrap">
      <table className="history-table" aria-label="Lịch sử làm việc">
        <thead><tr><th>Ngày</th><th>Ca</th><th>Buồng</th><th>Nội dung</th><th>Trạng thái</th></tr></thead>
        <tbody>{shifts.length === 0 ? <tr><td colSpan={5}><span className="empty-state compact">Không có ca làm việc trong tháng này.</span></td></tr> : shifts.map((shift) => (
          <tr key={shift.assignmentId}><td>{formatShortDate(shift.workDate)}</td><td><button type="button" className="table-shift-link" aria-label={`${periodLabel(shift.period)}, ${formatDayMonth(shift.workDate)}`} onClick={() => onOpen(shift.shiftId)}>{periodLabel(shift.period)}</button></td><td>{roomLabel(shift.roomCode)}</td><td>{shift.workContent}</td><td>{shift.canCancel ? 'Sắp tới' : 'Đã qua'}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function RegistrationDialog({ registration, today, isSaving, onClose, onSave }: {
  registration: ScheduleRegistration | null; today: string; isSaving: boolean; onClose: () => void; onSave: (payload: RegistrationPayload) => Promise<void>;
}) {
  const [startDate, setStartDate] = useState(registration?.startDate ?? today);
  const [endDate, setEndDate] = useState(registration?.endDate ?? addDays(today, 60));
  const [roomCode, setRoomCode] = useState<RoomCode | ''>(registration?.roomCode ?? '');
  const [workContent, setWorkContent] = useState(registration?.workContent ?? '');
  const [slots, setSlots] = useState<PatternSlot[]>(registration?.slots ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const toggle = (weekday: number, period: SchedulePeriod) => setSlots((current) => current.some((slot) => slot.weekday === weekday && slot.period === period)
    ? current.filter((slot) => slot.weekday !== weekday || slot.period !== period)
    : [...current, { weekday, period }]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: string[] = [];
    if (!roomCode) nextErrors.push('Vui lòng chọn buồng làm việc.');
    if (slots.length === 0) nextErrors.push('Vui lòng chọn ít nhất một ca trong tuần.');
    if (endDate < startDate) nextErrors.push('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
    if (!workContent.trim()) nextErrors.push('Vui lòng nhập nội dung công việc.');
    setErrors(nextErrors);
    if (nextErrors.length > 0 || !roomCode) return;
    await onSave({ startDate, endDate, timeZone: 'Asia/Bangkok', roomCode, workContent: workContent.trim(), slots, version: registration?.version ?? null });
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="schedule-dialog registration-dialog" role="dialog" aria-modal="true" aria-label="Đăng ký lịch làm việc">
        <form onSubmit={(event) => void submit(event)}>
          <header><div><p className="eyebrow">Mẫu lịch tuần</p><h2>Đăng ký lịch làm việc</h2></div><button type="button" aria-label="Đóng cửa sổ đăng ký" onClick={onClose}>×</button></header>
          <div className="registration-body">
            {errors.length > 0 && <div className="validation-summary" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
            <div className="form-grid two-columns">
              <label>Ngày bắt đầu<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
              <label>Ngày kết thúc<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
            </div>
            <label>Buồng làm việc<select value={roomCode} onChange={(event) => setRoomCode(event.target.value as RoomCode | '')}><option value="">-- Chọn buồng --</option>{ROOMS.map((room) => <option key={room.code} value={room.code}>{room.label}</option>)}</select></label>
            <label>Nội dung công việc<textarea rows={3} value={workContent} onChange={(event) => setWorkContent(event.target.value)} placeholder="Mô tả công việc dự kiến trong ca" /></label>
            <fieldset className="pattern-fieldset"><legend>Mẫu ca làm việc theo tuần</legend><div className="pattern-grid">{WEEKDAYS.map((day) => <div key={day.weekday} className="pattern-day"><strong>{day.label}</strong>{PERIODS.map(({ period, label }) => {
              const selected = slots.some((slot) => slot.weekday === day.weekday && slot.period === period);
              return <button key={period} type="button" aria-label={`${day.label} ${label}`} aria-pressed={selected} onClick={() => toggle(day.weekday, period)}>{selected ? '✓ ' : ''}{label}</button>;
            })}</div>)}</div></fieldset>
          </div>
          <footer><button type="button" className="secondary-button" onClick={onClose}>Đóng</button><button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Lưu lịch'}</button></footer>
        </form>
      </section>
    </div>
  );
}
