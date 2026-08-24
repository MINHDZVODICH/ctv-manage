import { type FormEvent, useState } from 'react';
import { useAuth } from './useAuth';

export function LoginScreen({ onRegister }: { onRegister?: () => void }) {
  const { error, isSubmitting, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login(email, password);
    } catch {
      // The hook keeps the normalized message while the form remains mounted.
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">CTV</div>
        <p className="eyebrow">Hệ thống Quản lý CTV</p>
        <h1 id="login-title">Đăng nhập</h1>
        <p className="login-intro">Sử dụng tài khoản được cấp để truy cập không gian làm việc.</p>

        <form onSubmit={(event) => void submit(event)} className="login-form">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <label htmlFor="login-password">Mật khẩu</label>
          <div className="password-field">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
          {onRegister && (
            <button className="secondary-action" type="button" onClick={onRegister}>Đăng ký Cộng tác viên</button>
          )}
        </form>
      </section>
    </main>
  );
}
