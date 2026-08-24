import { type FormEvent, useState } from 'react';

interface Props { isSubmitting: boolean; serverError: string | null; onClose: () => void; onSubmit: (currentPassword: string, newPassword: string) => void }

export function ChangePasswordModal({ isSubmitting, serverError, onClose, onSubmit }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!currentPassword) return setError('Vui lòng nhập mật khẩu hiện tại');
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) return setError('Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ và số');
    if (newPassword !== confirmation) return setError('Mật khẩu xác nhận không khớp');
    setError(null); onSubmit(currentPassword, newPassword);
  };
  return <div className="dialog-backdrop"><form className="compact-dialog" role="dialog" aria-modal="true" aria-label="Đổi mật khẩu tài khoản" onSubmit={submit}>
    <header><div><p className="eyebrow">Bảo mật</p><h2>Đổi mật khẩu</h2></div><button type="button" aria-label="Đóng đổi mật khẩu" onClick={onClose}>×</button></header>
    <label>Mật khẩu hiện tại<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
    <label>Mật khẩu mới<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
    <label>Xác nhận mật khẩu mới<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
    {(error || serverError) && <p className="form-error" role="alert">{error ?? serverError}</p>}
    <footer><button type="button" className="secondary-action" onClick={onClose}>Hủy</button><button type="submit" className="primary-action" disabled={isSubmitting}>{isSubmitting ? 'Đang đổi...' : 'Đổi mật khẩu'}</button></footer>
  </form></div>;
}
