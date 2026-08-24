import { cloneElement, type FormEvent, type ReactElement, useRef, useState } from 'react';
import { messageFor, useRegistrationSubmission, type RegistrationFiles, type RegistrationProfile } from './useRegistrationRequests';

interface RegistrationScreenProps {
  onBackToLogin: () => void;
}

const initialProfile: RegistrationProfile = {
  displayName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  address: '',
  password: '',
};

export function RegistrationScreen({ onBackToLogin }: RegistrationScreenProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [files, setFiles] = useState<RegistrationFiles>({});
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileForm = useRef<HTMLFormElement>(null);
  const submitRegistration = useRegistrationSubmission();

  const update = (field: keyof RegistrationProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (profile.password !== confirmPassword) {
      setError('Mật khẩu phải trùng khớp!');
      return;
    }
    setSubmitting(true);
    try {
      const payload: RegistrationProfile = {
        displayName: profile.displayName.trim(),
        email: profile.email.trim(),
        password: profile.password,
        phone: profile.phone.trim(),
        ...(profile.dateOfBirth ? { dateOfBirth: profile.dateOfBirth } : {}),
        ...(profile.gender ? { gender: profile.gender } : {}),
        ...(profile.address?.trim() ? { address: profile.address.trim() } : {}),
      };
      await submitRegistration(payload, files);
      setProfile((current) => ({ ...current, password: '' }));
      setConfirmPassword('');
      setFiles({});
      fileForm.current?.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
        input.value = '';
      });
      setNotice('Đã gửi hồ sơ đăng ký. Vui lòng chờ Quản trị viên phê duyệt.');
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page registration-page">
      <section className="login-card registration-card" aria-labelledby="registration-title">
        <div className="brand-mark" aria-hidden="true">CTV</div>
        <p className="eyebrow">Hệ thống Quản lý CTV</p>
        <h1 id="registration-title">Đăng ký Cộng tác viên</h1>
        <p className="login-intro">Gửi thông tin cá nhân và hồ sơ tùy chọn để Quản trị viên xét duyệt.</p>

        {notice && <p className="registration-success" role="status">{notice}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        <form ref={fileForm} onSubmit={(event) => void submit(event)} className="registration-form">
          <div className="form-grid">
            <Field label="Họ và tên" required>
              <input value={profile.displayName} onChange={(event) => update('displayName', event.target.value)} required />
            </Field>
            <Field label="Email" required>
              <input type="email" value={profile.email} onChange={(event) => update('email', event.target.value)} required />
            </Field>
            <Field label="Số điện thoại" required>
              <input type="tel" value={profile.phone} onChange={(event) => update('phone', event.target.value)} required />
            </Field>
            <Field label="Ngày sinh">
              <input type="date" value={profile.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} />
            </Field>
            <Field label="Giới tính">
              <select value={profile.gender ?? ''} onChange={(event) => update('gender', event.target.value)}>
                <option value="">Chưa chọn</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </Field>
            <Field label="Địa chỉ">
              <input value={profile.address} onChange={(event) => update('address', event.target.value)} />
            </Field>
            <Field label="Mật khẩu" required>
              <input type="password" value={profile.password} minLength={8} onChange={(event) => update('password', event.target.value)} required />
            </Field>
            <Field label="Nhập lại mật khẩu" required>
              <input type="password" value={confirmPassword} minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </Field>
          </div>

          <fieldset className="upload-fieldset">
            <legend>Hồ sơ đính kèm (tùy chọn)</legend>
            <FileField label="CCCD mặt trước" accept=".jpg,.jpeg,.png,.webp" onChange={(file) => setFiles((current) => ({ ...current, cccdFront: file }))} />
            <FileField label="CCCD mặt sau" accept=".jpg,.jpeg,.png,.webp" onChange={(file) => setFiles((current) => ({ ...current, cccdBack: file }))} />
            <FileField label="Hồ sơ ứng tuyển (CV)" accept=".pdf,.doc,.docx" onChange={(file) => setFiles((current) => ({ ...current, cv: file }))} />
          </fieldset>

          <button className="primary-action" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang gửi hồ sơ...' : 'Gửi yêu cầu đăng ký'}
          </button>
          <button className="secondary-action" type="button" onClick={onBackToLogin}>Quay lại đăng nhập</button>
        </form>
      </section>
    </main>
  );
}

function Field({ children, label, required = false }: { children: ReactElement<Record<string, unknown>>; label: string; required?: boolean }) {
  const id = `registration-${label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <label className="registration-field" htmlFor={id}>
      <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
      {cloneElement(children, { id, 'aria-label': label })}
    </label>
  );
}

function FileField({ label, accept, onChange }: { label: string; accept: string; onChange: (file?: File) => void }) {
  return (
    <label className="file-field">
      <span>{label}</span>
      <input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0])} />
    </label>
  );
}
