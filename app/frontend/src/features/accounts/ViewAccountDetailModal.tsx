import { type ChangeEvent, useEffect, useState } from 'react';
import type { AccountDetail, FileCategory } from './useAccounts';

interface Props {
  account: AccountDetail | null;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
  onResetPassword: () => void;
  onEditProfile: () => void;
  onReplaceFile: (category: FileCategory, file: File) => void;
  onDeleteFile: (category: FileCategory) => void;
}

const labels: Record<FileCategory, string> = {
  AVATAR: 'Ảnh đại diện', CCCD_FRONT: 'CCCD mặt trước', CCCD_BACK: 'CCCD mặt sau', CV: 'Hồ sơ ứng tuyển',
};

export function ViewAccountDetailModal(props: Props) {
  const { account, isLoading, error, isSaving, onClose, onSaveNotes, onResetPassword, onEditProfile, onReplaceFile, onDeleteFile } = props;
  const [notes, setNotes] = useState('');
  useEffect(() => setNotes(account?.adminNotes ?? ''), [account?.id, account?.adminNotes]);

  const replace = (category: FileCategory) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onReplaceFile(category, file);
    event.target.value = '';
  };

  return (
    <div className="dialog-backdrop">
      <section className="account-detail-dialog" role="dialog" aria-modal="true" aria-label={`Hồ sơ ${account?.displayName ?? 'CTV'}`}>
        <header><div><p className="eyebrow">Hồ sơ Cộng tác viên</p><h2>{account?.displayName ?? 'Đang tải hồ sơ...'}</h2></div><button type="button" aria-label="Đóng hồ sơ" onClick={onClose}>×</button></header>
        {isLoading && <p aria-live="polite">Đang tải chi tiết tài khoản...</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {account && <div className="account-detail-body">
          <div className="profile-summary-card">
            {account.avatarFileId ? <img src={`/api/v1/files/${account.avatarFileId}/content`} alt={`Ảnh đại diện ${account.displayName}`} /> : <span className="avatar-fallback">{initials(account.displayName)}</span>}
            <div><strong>{account.displayName}</strong><span>{account.ctvCode ?? 'Chưa có mã CTV'}</span><span className={`account-status ${account.status.toLowerCase()}`}>{account.status === 'ACTIVE' ? 'Kích hoạt' : 'Vô hiệu hóa'}</span></div>
          </div>
          <div className="detail-grid">
            <Detail label="Email" value={account.email} /><Detail label="Số điện thoại" value={account.phone ?? 'Chưa cung cấp'} />
            <Detail label="Ngày sinh" value={account.dateOfBirth ?? 'Chưa cung cấp'} /><Detail label="Giới tính" value={account.gender ?? 'Chưa cung cấp'} />
            <Detail label="Địa chỉ" value={account.address ?? 'Chưa cung cấp'} /><Detail label="Ngày tham gia" value={formatDate(account.joinedAt)} />
          </div>
          <section className="profile-files"><h3>Hồ sơ đính kèm</h3>
            {(['AVATAR', 'CCCD_FRONT', 'CCCD_BACK', 'CV'] as FileCategory[]).map((category) => {
              const file = account.files.find((entry) => entry.category === category);
              return <article key={category}><div><strong>{labels[category]}</strong>{file ? <a href={`/api/v1/files/${file.id}/content`} target="_blank" rel="noreferrer">{file.originalName} · {formatBytes(file.sizeBytes)}</a> : <span>Chưa có tệp</span>}</div><div><label className="file-action">Thay đổi<input type="file" aria-label={`Thay đổi ${labels[category]}`} accept={category === 'CV' ? '.pdf,.doc,.docx' : 'image/jpeg,image/png,image/webp'} onChange={replace(category)} /></label>{file && <button type="button" className="danger-link" onClick={() => onDeleteFile(category)}>Xóa</button>}</div></article>;
            })}
          </section>
          <label className="notes-field">Ghi chú nội bộ<textarea value={notes} maxLength={4000} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>}
        <footer><button type="button" className="secondary-action" disabled={!account || isSaving} onClick={onResetPassword}>Đặt lại mật khẩu</button><button type="button" className="secondary-action" disabled={!account || isSaving} onClick={onEditProfile}>Chỉnh sửa thông tin</button><button type="button" className="primary-action" disabled={!account || isSaving} onClick={() => onSaveNotes(notes)}>{isSaving ? 'Đang lưu...' : 'Lưu ghi chú'}</button></footer>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <p><strong>{label}</strong><span>{value}</span></p>; }
function initials(value: string) { return value.split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase(); }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa cung cấp'; }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
