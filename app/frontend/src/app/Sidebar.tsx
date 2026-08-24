import type { AuthUser } from '../shared/api/contracts';
import type { AppView, NavigationItem } from '../shared/types';
import { useSystemSettings } from '../shared/context/SystemSettingsContext';

const navigation: NavigationItem[] = [
  { id: 'accounts', label: 'Quản lý tài khoản', roles: ['ADMIN'] },
  { id: 'requests', label: 'Duyệt hồ sơ', roles: ['ADMIN'] },
  { id: 'my-schedule', label: 'Lịch làm việc của tôi', roles: ['CTV'] },
  { id: 'summary-schedule', label: 'Lịch làm việc tổng hợp', roles: ['ADMIN'] },
  { id: 'profile', label: 'Thông tin tài khoản', roles: ['ADMIN', 'CTV'] },
];

interface SidebarProps {
  user: AuthUser;
  currentView: AppView;
  isLoggingOut: boolean;
  onSelect: (view: AppView) => void;
  onLogout: () => void;
}

export function Sidebar({ user, currentView, isLoggingOut, onSelect, onLogout }: SidebarProps) {
  const { systemName } = useSystemSettings();
  const roleLabel = user.role === 'ADMIN' ? 'Giao diện quản trị' : 'Giao diện cộng tác viên';

  return (
    <aside className="sidebar">
      <header className="sidebar-brand">
        <span className="sidebar-logo" aria-hidden="true">CTV</span>
        <span>
          <strong>{systemName}</strong>
          <small>{roleLabel}</small>
        </span>
      </header>

      <nav aria-label="Điều hướng chính">
        {navigation.filter((item) => item.roles.includes(user.role)).map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === currentView ? 'nav-item active' : 'nav-item'}
            aria-current={item.id === currentView ? 'page' : undefined}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <footer className="sidebar-footer">
        <div className="account-summary">
          <span className="avatar" aria-hidden="true">{initials(user.displayName)}</span>
          <span><strong>{user.displayName}</strong><small>{user.role}</small></span>
        </div>
        <button type="button" className="logout-action" onClick={onLogout} disabled={isLoggingOut}>
          {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
        </button>
      </footer>
    </aside>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();
}
