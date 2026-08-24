import { type FormEvent, useState } from 'react';
import { messageFor, type RegistrationRequestDetail, useRegistrationRequests } from './useRegistrationRequests';
import { ViewRequestModal } from './ViewRequestModal';

export function RequestsScreen() {
  const { items, pagination, isLoading, error, load, decide, detail } = useRegistrationRequests();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RegistrationRequestDetail | null>(null);
  const [isDetailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showDetail = async (requestId: string) => {
    setSelected(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setSelected(await detail(requestId));
    } catch (reason) {
      setDetailError(messageFor(reason));
    } finally {
      setDetailLoading(false);
    }
  };

  const makeDecision = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setDecidingId(requestId);
    setNotice(null);
    try {
      await decide(requestId, decision);
      setSelected(null);
      setDetailLoading(false);
      setNotice(decision === 'APPROVED' ? 'Đã duyệt hồ sơ thành công.' : 'Đã từ chối hồ sơ.');
    } catch (reason) {
      setDetailError(messageFor(reason));
    } finally {
      setDecidingId(null);
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    void load(1, search);
  };

  return (
    <section className="requests-workspace" aria-labelledby="requests-title">
      <header className="workspace-heading">
        <div><p className="eyebrow">Quản lý hồ sơ</p><h1 id="requests-title">Duyệt hồ sơ đăng ký</h1></div>
        <span className="pending-badge">{pagination.total} chờ duyệt</span>
      </header>
      <form className="requests-toolbar" onSubmit={submitSearch}>
        <label htmlFor="request-search">Tìm theo họ tên, email hoặc số điện thoại</label>
        <div><input id="request-search" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit">Tìm kiếm</button></div>
      </form>
      {notice && <p className="registration-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {isLoading ? <p aria-live="polite">Đang tải hồ sơ...</p> : items.length === 0 ? (
        <div className="empty-state"><strong>Không có hồ sơ chờ duyệt</strong><span>Các yêu cầu mới sẽ xuất hiện tại đây.</span></div>
      ) : (
        <div className="request-table-wrap">
          <table className="request-table">
            <thead><tr><th>Họ tên</th><th>Liên hệ</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>{items.map((item) => (
              <tr key={item.id}>
                <td><button type="button" className="link-action" aria-label={`Xem hồ sơ ${item.displayName}`} onClick={() => void showDetail(item.id)}>{item.displayName}</button></td>
                <td><span>{item.email}</span><small>{item.phone ?? 'Chưa có SĐT'}</small></td>
                <td>{new Date(item.submittedAt).toLocaleDateString('vi-VN')}</td>
                <td><span className="status-pill">Chờ duyệt</span></td>
                <td className="row-actions">
                  <button type="button" className="reject-action" aria-label={`Từ chối hồ sơ ${item.displayName}`} disabled={decidingId === item.id} onClick={() => void makeDecision(item.id, 'REJECTED')}>Từ chối</button>
                  <button type="button" className="approve-action" aria-label={`Phê duyệt hồ sơ ${item.displayName}`} disabled={decidingId === item.id} onClick={() => void makeDecision(item.id, 'APPROVED')}>Phê duyệt</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {pagination.total > pagination.pageSize && (
        <nav className="pagination" aria-label="Phân trang hồ sơ">
          <button type="button" disabled={pagination.page <= 1} onClick={() => void load(pagination.page - 1, search)}>Trang trước</button>
          <span>Trang {pagination.page}</span>
          <button type="button" disabled={pagination.page * pagination.pageSize >= pagination.total} onClick={() => void load(pagination.page + 1, search)}>Trang sau</button>
        </nav>
      )}
      {(isDetailLoading || selected || detailError) && (
        <ViewRequestModal
          request={selected}
          isLoading={isDetailLoading}
          error={detailError}
          isDeciding={Boolean(decidingId)}
          onClose={() => { setSelected(null); setDetailLoading(false); setDetailError(null); }}
          onDecision={(decision) => selected && void makeDecision(selected.id, decision)}
        />
      )}
    </section>
  );
}
