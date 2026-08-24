import { type ChangeEvent, useState } from 'react';
import type { FileCategory } from '../accounts/useAccounts';
import { messageFor } from '../accounts/useAccounts';
import { ChangePasswordModal } from './ChangePasswordModal';
import { EditProfileModal } from './EditProfileModal';
import { useProfile } from './useProfile';

const fileLabels: Record<FileCategory, string> = {
  AVATAR: 'Ảnh đại diện', CCCD_FRONT: 'CCCD mặt trước', CCCD_BACK: 'CCCD mặt sau', CV: 'Hồ sơ ứng tuyển (CV)',
};

export function ProfileScreen() {
  const profileState = useProfile();
  const { profile } = profileState;
  const [isEditing, setEditing] = useState(false);
  const [isChangingPassword, setChangingPassword] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const perform = async (operation: () => Promise<unknown>, success: string, after?: () => void) => {
    setSubmitting(true); setActionError(null); setNotice(null);
    try { await operation(); setNotice(success); after?.(); }
    catch (reason) { setActionError(messageFor(reason)); }
    finally { setSubmitting(false); }
  };
  const replace = (category: FileCategory) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const success = category === 'AVATAR' ? 'Thay đổi ảnh đại diện thành công.' : `Đã thay đổi ${fileLabels[category].toLowerCase()}.`;
    void perform(() => profileState.replaceFile(category, file), success);
    event.target.value = '';
  };

  if (profileState.isLoading && !profile) return <section className="profile-workspace"><p aria-live="polite">Đang tải hồ sơ cá nhân...</p></section>;
  if (!profile) return <section className="profile-workspace"><p className="form-error" role="alert">{profileState.error ?? 'Không tìm thấy hồ sơ.'}</p><button type="button" onClick={() => void profileState.load()}>Thử lại</button></section>;

  return <section className="profile-workspace" aria-labelledby="profile-title">
    <header className="workspace-heading"><div><p className="eyebrow">Tài khoản cá nhân</p><h1 id="profile-title">Thông tin tài khoản</h1><p>Quản lý thông tin và hồ sơ đính kèm của bạn.</p></div><div className="heading-actions"><button type="button" className="secondary-action" aria-label="Mở đổi mật khẩu" onClick={() => setChangingPassword(true)}>Đổi mật khẩu</button><button type="button" className="primary-action" onClick={() => setEditing(true)}>Chỉnh sửa thông tin</button></div></header>
    {notice && <p className="registration-success" role="status">{notice}</p>}
    {(profileState.error || actionError) && <p className="form-error" role="alert">{actionError ?? profileState.error}</p>}
    <div className="profile-layout">
      <aside className="profile-identity-card">{profile.avatarFileId ? <img src={`/api/v1/files/${profile.avatarFileId}/content`} alt={`Ảnh đại diện ${profile.displayName}`} /> : <span className="profile-avatar-fallback">{initials(profile.displayName)}</span>}<strong>{profile.displayName}</strong><span>{profile.role === 'ADMIN' ? 'Quản trị viên' : 'Cộng tác viên'}</span><span>{profile.ctvCode}</span><label className="file-action">Thay đổi ảnh đại diện<input type="file" aria-label="Ảnh đại diện" accept="image/jpeg,image/png,image/webp" onChange={replace('AVATAR')} /></label></aside>
      <div className="profile-content"><section className="profile-info-card"><h2>Thông tin cá nhân</h2><div className="detail-grid"><Detail label="Họ và tên" value={profile.displayName} /><Detail label="Email" value={profile.email} /><Detail label="Số điện thoại" value={profile.phone ?? 'Chưa cung cấp'} /><Detail label="Ngày sinh" value={profile.dateOfBirth ?? 'Chưa cung cấp'} /><Detail label="Giới tính" value={profile.gender ?? 'Chưa cung cấp'} /><Detail label="Địa chỉ" value={profile.address ?? 'Chưa cung cấp'} /></div></section>
        <section className="profile-files"><h2>Hồ sơ đính kèm</h2>{(['CCCD_FRONT', 'CCCD_BACK', 'CV'] as FileCategory[]).map((category) => { const file = profile.files.find((entry) => entry.category === category); return <article key={category}><div><strong>{fileLabels[category]}</strong>{file ? <a href={`/api/v1/files/${file.id}/content`} target="_blank" rel="noreferrer">{file.originalName} · {formatBytes(file.sizeBytes)}</a> : <span>Chưa có tệp</span>}</div><div><label className="file-action">{file ? 'Thay đổi' : 'Tải lên'}<input type="file" aria-label={fileLabels[category]} accept={category === 'CV' ? '.pdf,.doc,.docx' : 'image/jpeg,image/png,image/webp'} onChange={replace(category)} /></label>{file && <button type="button" className="danger-link" onClick={() => void perform(() => profileState.deleteFile(category), `Đã xóa ${fileLabels[category].toLowerCase()}.`)}>Xóa</button>}</div></article>; })}</section>
      </div>
    </div>
    {isEditing && <EditProfileModal profile={profile} isSubmitting={isSubmitting} error={actionError} onClose={() => { setEditing(false); setActionError(null); }} onSave={(input) => void perform(() => profileState.update(input), 'Đã cập nhật thông tin hồ sơ cá nhân.', () => setEditing(false))} />}
    {isChangingPassword && <ChangePasswordModal isSubmitting={isSubmitting} serverError={actionError} onClose={() => { setChangingPassword(false); setActionError(null); }} onSubmit={(currentPassword, newPassword) => void perform(() => profileState.changePassword(currentPassword, newPassword), 'Đổi mật khẩu thành công!', () => setChangingPassword(false))} />}
  </section>;
}

function Detail({ label, value }: { label: string; value: string }) { return <p><strong>{label}</strong><span>{value}</span></p>; }
function initials(value: string) { return value.split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase(); }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
