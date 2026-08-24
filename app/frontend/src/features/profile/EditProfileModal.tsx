import { type FormEvent, useState } from 'react';
import type { AccountDetail } from '../accounts/useAccounts';
import type { ProfileUpdate } from './useProfile';

interface Props {
  profile: AccountDetail;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: ProfileUpdate) => void;
}

export function EditProfileModal({ profile, isSubmitting, error, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    displayName: profile.displayName,
    phone: profile.phone ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    gender: profile.gender ?? '',
    address: profile.address ?? '',
  });
  const field = (key: keyof typeof form) => ({
    value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [key]: event.target.value })),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({ displayName: form.displayName, phone: form.phone || null, dateOfBirth: form.dateOfBirth || null, gender: form.gender || null, address: form.address || null });
  };
  return <div className="dialog-backdrop"><form className="profile-form-dialog" role="dialog" aria-modal="true" aria-label="Chỉnh sửa thông tin hồ sơ" onSubmit={submit}>
    <header><div><p className="eyebrow">Hồ sơ cá nhân</p><h2>Chỉnh sửa thông tin</h2></div><button type="button" aria-label="Đóng chỉnh sửa hồ sơ" onClick={onClose}>×</button></header>
    <div className="form-grid"><label>Họ và tên<input required minLength={2} maxLength={120} {...field('displayName')} /></label><label>Số điện thoại<input maxLength={30} {...field('phone')} /></label><label>Ngày sinh<input type="date" {...field('dateOfBirth')} /></label><label>Giới tính<select {...field('gender')}><option value="">Chưa chọn</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label><label className="full-field">Địa chỉ<textarea maxLength={500} {...field('address')} /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <footer><button type="button" className="secondary-action" onClick={onClose}>Hủy</button><button type="submit" className="primary-action" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</button></footer>
  </form></div>;
}
