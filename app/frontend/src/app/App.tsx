import { useEffect, useState } from 'react';
import { LoginScreen } from '../features/auth/LoginScreen';
import { AuthProvider, useAuth } from '../features/auth/useAuth';
import type { AppView } from '../shared/types';
import { Sidebar } from './Sidebar';
import { RegistrationScreen } from '../features/registration-requests/RegistrationScreen';
import { RequestsScreen } from '../features/registration-requests/RequestsScreen';
import { AccountListScreen } from '../features/accounts/AccountListScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { ScheduleScreen } from '../features/schedules/ScheduleScreen';
import { SummaryScheduleScreen } from '../features/schedules/SummaryScheduleScreen';
import { NotificationsProvider } from '../features/notifications/useNotifications';

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
  const { clearNotice, error, isLoading, isSubmitting, logout, notice, user } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('accounts');
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isRegistering, setRegistering] = useState(false);

  useEffect(() => {
    if (user) setCurrentView(user.role === 'ADMIN' ? 'accounts' : 'my-schedule');
  }, [user]);

  if (isLoading) {
    return <main className="session-loading" aria-live="polite">Đang tải phiên làm việc...</main>;
  }
  if (!user) {
    if (isRegistering) return <RegistrationScreen onBackToLogin={() => setRegistering(false)} />;
    return (
      <>
        {notice && <SuccessNotice message={notice} onClose={clearNotice} />}
        <LoginScreen onRegister={() => setRegistering(true)} />
      </>
    );
  }

  return (
    <NotificationsProvider key={user.id} accountId={user.id}>
    <div className={isSidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <div className="desktop-sidebar">
        <Sidebar
          user={user}
          currentView={currentView}
          isLoggingOut={isSubmitting}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelect={setCurrentView}
          onLogout={() => { void logout().catch(() => undefined); }}
        />
      </div>
      <div className="content-column">
        <header className="mobile-topbar">
          <button type="button" aria-label="Mở danh mục" onClick={() => setMobileMenuOpen(true)}>☰</button>
          <strong>Hệ thống Quản lý CTV</strong>
        </header>
        <main className="workspace">
          {currentView === 'requests' ? <RequestsScreen /> : currentView === 'accounts' && user.role === 'ADMIN' ? <AccountListScreen /> : currentView === 'profile' ? <ProfileScreen /> : currentView === 'my-schedule' && user.role === 'CTV' ? <ScheduleScreen /> : currentView === 'summary-schedule' && user.role === 'ADMIN' ? <SummaryScheduleScreen /> : (
            <>
              <p className="eyebrow">Không gian làm việc</p>
              <h1>{viewTitles[currentView]}</h1>
              <p className="workspace-note">Dữ liệu cho chức năng này sẽ được tải từ API ở vertical slice tương ứng.</p>
              {error && <p className="form-error" role="alert">{error}</p>}
            </>
          )}
        </main>
      </div>
      {isMobileMenuOpen && (
        <>
          <button
            type="button"
            className="mobile-overlay"
            aria-label="Đóng lớp phủ danh mục"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Danh mục điều hướng">
            <button
              type="button"
              className="mobile-drawer-close"
              aria-label="Đóng danh mục"
              onClick={() => setMobileMenuOpen(false)}
            >×</button>
            <Sidebar
              user={user}
              currentView={currentView}
              isLoggingOut={isSubmitting}
              onOpenSettings={() => setSettingsOpen(true)}
              onSelect={(view) => {
                setCurrentView(view);
                setMobileMenuOpen(false);
              }}
              onLogout={() => { void logout().catch(() => undefined); }}
            />
          </div>
        </>
      )}
      {notice && <SuccessNotice message={notice} onClose={clearNotice} />}
      {isSettingsOpen && (
        <div className="dialog-backdrop">
          <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Cài đặt hệ thống">
            <header>
              <div>
                <p className="eyebrow">Tùy chọn cá nhân</p>
                <h2>Cài đặt hệ thống</h2>
              </div>
              <button type="button" aria-label="Đóng cài đặt" onClick={() => setSettingsOpen(false)}>×</button>
            </header>
            <p>Các tùy chọn hiển thị và tài khoản sẽ được bổ sung trong vertical slice tương ứng.</p>
          </section>
        </div>
      )}
    </div>
    </NotificationsProvider>
  );
}

function SuccessNotice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="success-notice" role="status">
      <span>{message}</span>
      <button type="button" aria-label="Đóng thông báo" onClick={onClose}>×</button>
    </div>
  );
}
