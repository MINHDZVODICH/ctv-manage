import { periodLabel, roomLabel, type SchedulePeriod } from '../../shared/utils/scheduleSelectors';
import type { RosterMember } from './useScheduleSummary';

export function ShiftRosterModal({ date, period, roster, isLoading, onClose, onOpenProfile }: { date: string; period: SchedulePeriod; roster: RosterMember[] | null; isLoading: boolean; onClose: () => void; onOpenProfile: (accountId: string) => void }) {
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="schedule-dialog roster-dialog" role="dialog" aria-modal="true" aria-label="Chi tiết ca làm việc">
      <header><div><p className="eyebrow">Ca dùng chung</p><h2>{periodLabel(period)} · {new Date(`${date}T00:00:00.000Z`).toLocaleDateString('vi-VN')}</h2></div><button type="button" aria-label="Đóng chi tiết ca" onClick={onClose}>×</button></header>
      <div className="roster-body">{isLoading ? <p aria-live="polite">Đang tải danh sách CTV...</p> : !roster?.length ? <p className="empty-state">Chưa có CTV đang hoạt động trong ca này.</p> : <table className="roster-table"><thead><tr><th>Cộng tác viên</th><th>Buồng</th><th>Nội dung</th><th>Trạng thái</th></tr></thead><tbody>{roster.map((member) => <tr key={member.accountId}><td><button type="button" className="account-person" onClick={() => onOpenProfile(member.accountId)}>{member.displayName}</button></td><td>{roomLabel(member.roomCode)}</td><td>{member.workContent}</td><td>{member.status === 'ACTIVE' ? 'Đang phân công' : 'Đã hủy'}</td></tr>)}</tbody></table>}</div>
      <footer><button type="button" className="secondary-button" onClick={onClose}>Đóng</button></footer>
    </section>
  </div>;
}
