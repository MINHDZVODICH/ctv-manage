import { type FormEvent, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { isVersionConflict, messageFor, type AccountDetail, type AccountStatus, type AccountSummary, type FileCategory, useAccounts } from './useAccounts';
import { EditProfileModal } from '../profile/EditProfileModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { ViewAccountDetailModal } from './ViewAccountDetailModal';

export function AccountListScreen() {
  const accounts = useAccounts();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AccountStatus | ''>('');
  const [confirmStatus, setConfirmStatus] = useState<AccountSummary | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AccountSummary | null>(null);
  const [resetAccount, setResetAccount] = useState<AccountSummary | null>(null);
  const [selected, setSelected] = useState<AccountDetail | null>(null);
  const [isEditingAccount, setEditingAccount] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isMutating, setMutating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    void accounts.load({ q: search, status: status || undefined, page: 1, pageSize: 5 });
  };
  const openDetail = async (accountId: string) => {
    setDetailLoading(true); setDialogError(null); setSelected(null);
    try { setSelected(await accounts.detail(accountId)); } catch (reason) { setDialogError(messageFor(reason)); }
    finally { setDetailLoading(false); }
  };
  const refreshDetail = async (accountId: string) => setSelected(await accounts.detail(accountId));
  const refreshResources = async (accountId?: string) => {
    const [detail] = await Promise.all([accountId ? accounts.detail(accountId) : Promise.resolve(null), accounts.load(accounts.query)]);
    if (detail) setSelected(detail);
  };
  const mutate = async (operation: () => Promise<unknown>, success: string, conflictAccountId?: string) => {
    setMutating(true); setDialogError(null); setNotice(null);
    try { await operation(); setNotice(success); }
    catch (reason) {
      if (isVersionConflict(reason)) {
        await refreshResources(conflictAccountId);
        setEditingAccount(false);
        setNotice('Dữ liệu đã thay đổi trên máy chủ. Đã tải lại thông tin mới nhất.');
      } else setDialogError(messageFor(reason));
    }
    finally { setMutating(false); }
  };
  const replaceFile = (category: FileCategory, file: File) => {
    if (!selected) return;
    const form = new FormData(); form.set('file', file);
    void mutate(async () => { await apiClient.putMultipart(`/accounts/${selected.id}/files/${slug(category)}`, form); await refreshDetail(selected.id); }, `Đã thay đổi ${fileLabel(category)}.`);
  };
  const deleteFile = (category: FileCategory) => {
    if (!selected) return;
    void mutate(async () => { await apiClient.delete(`/accounts/${selected.id}/files/${slug(category)}`); await refreshDetail(selected.id); }, `Đã xóa ${fileLabel(category)}.`);
  };

  const totalPages = Math.max(1, Math.ceil(accounts.total / accounts.query.pageSize));
  return <section className="accounts-workspace" aria-labelledby="accounts-title">
    <header className="workspace-heading"><div><p className="eyebrow">Quản lý Cộng tác viên</p><h1 id="accounts-title">Danh sách tài khoản</h1><p>Tổng số <strong>{accounts.total}</strong> tài khoản</p></div></header>
    <form className="accounts-toolbar" onSubmit={submitSearch}>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo họ tên, email, sđt..." />
      <select aria-label="Trạng thái tài khoản" value={status} onChange={(event) => setStatus(event.target.value as AccountStatus | '')}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Kích hoạt</option><option value="DISABLED">Vô hiệu hóa</option></select>
      <button type="submit" className="primary-action">Tìm kiếm</button>
      <button type="button" className="secondary-action" onClick={() => { setSearch(''); setStatus(''); void accounts.load({ q: '', page: 1, pageSize: 5 }); }}>Đặt lại</button>
    </form>
    {notice && <p className="registration-success" role="status">{notice}</p>}
    {accounts.error && <p className="form-error" role="alert">{accounts.error}</p>}
    {accounts.isLoading ? <p aria-live="polite">Đang tải tài khoản...</p> : accounts.items.length === 0 ? <div className="empty-state"><strong>Không tìm thấy tài khoản</strong><span>Thử thay đổi từ khóa hoặc trạng thái.</span></div> : <div className="account-table-wrap"><table className="account-table"><thead><tr><th>STT</th><th>Họ và tên</th><th>Số điện thoại</th><th>Ngày đăng ký</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{accounts.items.map((account, index) => <tr key={account.id}><td>{(accounts.query.page - 1) * 5 + index + 1}</td><td><button type="button" className="account-person" aria-label={`Xem hồ sơ ${account.displayName}`} onClick={() => void openDetail(account.id)}>{account.avatarFileId ? <img src={`/api/v1/files/${account.avatarFileId}/content`} alt="" /> : <span>{initials(account.displayName)}</span>}<strong>{account.displayName}</strong></button><small>{account.email}</small></td><td>{account.phone ?? '---'}</td><td>{formatDate(account.joinedAt)}</td><td><span className={`account-status ${account.status.toLowerCase()}`}>{account.status === 'ACTIVE' ? 'Kích hoạt' : 'Vô hiệu hóa'}</span></td><td className="table-actions"><button type="button" title="Đặt lại mật khẩu" aria-label={`Đặt lại mật khẩu ${account.displayName}`} onClick={() => { setDialogError(null); setResetAccount(account); }}>↻</button><button type="button" title={account.status === 'ACTIVE' ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản'} onClick={() => setConfirmStatus(account)}>{account.status === 'ACTIVE' ? '🔒' : '🔓'}</button><button type="button" title="Xóa tài khoản" onClick={() => setConfirmDelete(account)}>🗑</button></td></tr>)}</tbody></table></div>}
    <nav className="pagination" aria-label="Phân trang tài khoản"><button type="button" disabled={accounts.query.page <= 1} onClick={() => void accounts.load({ ...accounts.query, page: accounts.query.page - 1 })}>Trang trước</button><span>Trang {accounts.query.page}/{totalPages}</span><button type="button" disabled={accounts.query.page >= totalPages} onClick={() => void accounts.load({ ...accounts.query, page: accounts.query.page + 1 })}>Trang sau</button></nav>
    {confirmStatus && <Confirm title={confirmStatus.status === 'ACTIVE' ? 'Vô hiệu hóa tài khoản?' : 'Kích hoạt tài khoản?'} account={confirmStatus} action={confirmStatus.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'} onClose={() => setConfirmStatus(null)} onConfirm={() => void mutate(async () => { await accounts.changeStatus(confirmStatus); setConfirmStatus(null); }, 'Đã cập nhật trạng thái tài khoản.')} />}
    {confirmDelete && <Confirm title="Xóa tài khoản?" account={confirmDelete} action="Xóa tài khoản" danger onClose={() => setConfirmDelete(null)} onConfirm={() => void mutate(async () => { await accounts.remove(confirmDelete.id); setConfirmDelete(null); }, 'Đã xóa tài khoản.')} />}
    {(detailLoading || selected) && <ViewAccountDetailModal account={selected} isLoading={detailLoading} error={selected && !resetAccount && !isEditingAccount ? dialogError : null} isSaving={isMutating} onClose={() => { setSelected(null); setDialogError(null); }} onSaveNotes={(notes) => selected && void mutate(async () => setSelected(await accounts.saveNotes(selected, notes)), 'Đã lưu ghi chú.', selected.id)} onResetPassword={() => { if (selected) { setDialogError(null); setResetAccount(selected); } }} onEditProfile={() => { setDialogError(null); setEditingAccount(true); }} onReplaceFile={replaceFile} onDeleteFile={deleteFile} />}
    {isEditingAccount && selected && <EditProfileModal profile={selected} isSubmitting={isMutating} error={dialogError} onClose={() => { setEditingAccount(false); setDialogError(null); }} onSave={(input) => void mutate(async () => { await accounts.update(selected, input); await refreshResources(selected.id); setEditingAccount(false); }, 'Đã cập nhật thông tin tài khoản.', selected.id)} />}
    {resetAccount && <ResetPasswordModal account={resetAccount} isSubmitting={isMutating} error={dialogError} onClose={() => { setResetAccount(null); setDialogError(null); }} onConfirm={(newPassword, requireChange, key) => void mutate(async () => { await accounts.resetPassword(resetAccount.id, newPassword, requireChange, key); await refreshResources(selected?.id === resetAccount.id ? resetAccount.id : undefined); setResetAccount(null); }, 'Đã đặt lại mật khẩu tài khoản.')} />}
  </section>;
}

function Confirm({ title, account, action, danger, onClose, onConfirm }: { title: string; account: AccountSummary; action: string; danger?: boolean; onClose: () => void; onConfirm: () => void }) { return <div className="dialog-backdrop"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2><p><strong>{account.displayName}</strong><br />{account.email}</p><footer><button type="button" className="secondary-action" onClick={onClose}>Hủy</button><button type="button" className={danger ? 'danger-action' : 'primary-action'} onClick={onConfirm}>{action}</button></footer></section></div>; }
function initials(value: string) { return value.split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase(); }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString('vi-VN') : '---'; }
function slug(category: FileCategory) { return category.toLowerCase().replace('_', '-') as Lowercase<FileCategory>; }
function fileLabel(category: FileCategory) { return ({ AVATAR: 'ảnh đại diện', CCCD_FRONT: 'CCCD mặt trước', CCCD_BACK: 'CCCD mặt sau', CV: 'CV' } as const)[category]; }
