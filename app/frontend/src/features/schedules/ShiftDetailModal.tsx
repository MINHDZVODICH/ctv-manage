import { useState } from 'react';
import { formatLongDate } from '../../shared/utils/formatters';
import { periodLabel, roomLabel } from '../../shared/utils/scheduleSelectors';
import type { ShiftDetail } from './useMySchedule';

interface Props {
  detail: ShiftDetail;
  isSaving: boolean;
  onClose: () => void;
  onCancelOne: (assignmentId: string) => void;
  onCancelSeries: (detail: ShiftDetail) => void;
}

export function ShiftDetailModal({ detail, isSaving, onClose, onCancelOne, onCancelSeries }: Props) {
  const [confirmation, setConfirmation] = useState<'ONE' | 'SERIES' | null>(null);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="schedule-dialog shift-detail-dialog" role="dialog" aria-modal="true" aria-label="Chi tiết ca làm việc">
        <header>
          <div><p className="eyebrow">{periodLabel(detail.period)}</p><h2>Chi tiết ca làm việc</h2></div>
          <button type="button" aria-label="Đóng chi tiết ca" onClick={onClose}>×</button>
        </header>
        <div className="shift-detail-body">
          <dl className="shift-facts">
            <div><dt>Ngày làm việc</dt><dd>{formatLongDate(detail.workDate)}</dd></div>
            <div><dt>Trạng thái</dt><dd>{detail.canCancel ? 'Đã đăng ký' : 'Chỉ xem'}</dd></div>
            <div><dt>Buồng làm việc</dt><dd>{roomLabel(detail.assignment?.roomCode)}</dd></div>
            <div><dt>Nội dung công việc</dt><dd>{detail.assignment?.workContent || 'Không có nội dung'}</dd></div>
          </dl>
          <section aria-labelledby="coworker-title">
            <h3 id="coworker-title">CTV làm cùng</h3>
            {detail.coWorkers.length === 0 ? <p className="empty-state compact">Không có CTV khác trong ca này.</p> : (
              <ul className="coworker-list">{detail.coWorkers.map((person) => (
                <li key={person.accountId}><span className="avatar" aria-hidden="true">{initials(person.displayName)}</span><strong>{person.displayName}</strong><span>{roomLabel(person.roomCode)}</span></li>
              ))}</ul>
            )}
          </section>
          {!detail.canCancel && <p className="readonly-note">Ca đã qua hoặc không còn hiệu lực nên không thể hủy.</p>}
          {confirmation && (
            <div className="cancel-confirmation" role="alert">
              <p>Bạn có chắc muốn {confirmation === 'ONE' ? 'chỉ hủy ca này' : 'hủy chuỗi định kỳ từ ngày này'}?</p>
              <div><button type="button" className="secondary-button" onClick={() => setConfirmation(null)}>Quay lại</button><button type="button" className="danger-button" disabled={isSaving} onClick={() => {
                if (!detail.assignment) return;
                if (confirmation === 'ONE') onCancelOne(detail.assignment.assignmentId);
                else onCancelSeries(detail);
              }}>Xác nhận hủy</button></div>
            </div>
          )}
        </div>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>Đóng</button>
          {detail.canCancel && !confirmation && detail.assignment && (
            <><button type="button" className="secondary-button" onClick={() => setConfirmation('ONE')}>Chỉ hủy ca này</button><button type="button" className="danger-button" onClick={() => setConfirmation('SERIES')}>Hủy ca định kỳ</button></>
          )}
        </footer>
      </section>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase();
}
