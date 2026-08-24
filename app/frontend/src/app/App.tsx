import { useEffect, useState } from 'react';
import { LoginScreen } from '../features/auth/LoginScreen';
import { AuthProvider, useAuth } from '../features/auth/useAuth';
import type { AppView } from '../shared/types';
import { Sidebar } from './Sidebar';

const viewTitles: Record<AppView, string> = {
  accounts: 'Quản lý tài khoản',
  requests: 'Duyệt hồ sơ đăng ký',
  'my-schedule': 'Lịch làm việc của tôi',
  'summary-schedule': 'Lịch làm việc tổng hợp',
  profile: 'Thông tin tài khoản',
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { error, isLoading, isSubmitting, logout, user } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('accounts');

  useEffect(() => {
    if (user) setCurrentView(user.role === 'ADMIN' ? 'accounts' : 'my-schedule');
  }, [user]);

  if (isLoading) {
    return <main className="session-loading" aria-live="polite">Đang tải phiên làm việc...</main>;
  }
  if (!user) return <LoginScreen />;

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        currentView={currentView}
        isLoggingOut={isSubmitting}
        onSelect={setCurrentView}
        onLogout={() => { void logout().catch(() => undefined); }}
      />
      <main className="workspace">
        <p className="eyebrow">Không gian làm việc</p>
        <h1>{viewTitles[currentView]}</h1>
        <p className="workspace-note">Dữ liệu cho chức năng này sẽ được tải từ API ở vertical slice tương ứng.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
    </div>
  );
}
