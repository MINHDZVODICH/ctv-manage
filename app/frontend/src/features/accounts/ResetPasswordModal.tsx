import { type FormEvent, useState } from 'react';
import type { AccountSummary } from './useAccounts';

interface Props {
  account: AccountSummary;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (password: string, requireChange: boolean) => void;
}

export function ResetPasswordModal({ account, isSubmitting, error, onClose, onConfirm }: Props) {
  const [password, setPassword] = useState('CTV@123456');
  const [requireChange, setRequireChange] = useState(true);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password) onConfirm(password, requireChange);
  };
  return (
    <div className="dialog-backdrop">
      <form className="compact-dialog" role="dialog" aria-modal="true" aria-label={`Đặt lại mật khẩu ${account.displayName}`} onSubmit={submit}>
        <header><div><p className="eyebrow">Bảo mật tài khoản</p><h2>Đặt lại mật khẩu</h2></div><button type="button" aria-label="Đóng đặt lại mật khẩu" onClick={onClose}>×</button></header>
        <p className="account-dialog-person"><strong>{account.displayName}</strong><span>{account.email}</span></p>
        <label>Mật khẩu mặc định mới<input type="text" value={password} maxLength={128} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="check-field"><input type="checkbox" checked={requireChange} onChange={(event) => setRequireChange(event.target.checked)} />Yêu cầu đổi mật khẩu khi đăng nhập</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer><button type="button" className="secondary-action" onClick={onClose}>Hủy</button><button type="submit" className="primary-action" disabled={!password || isSubmitting}>{isSubmitting ? 'Đang đặt lại...' : 'Xác nhận'}</button></footer>
      </form>
    </div>
  );
}
