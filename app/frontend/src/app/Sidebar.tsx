import type { AuthUser } from '../shared/api/contracts';
import type { AppView, NavigationItem } from '../shared/types';
import { useSystemSettings } from '../shared/context/SystemSettingsContext';
import { useState } from 'react';

const navigation: NavigationItem[] = [
  { id: 'accounts', icon: 'TK', label: 'Quản lý tài khoản', roles: ['ADMIN'] },
  { id: 'requests', icon: 'HS', label: 'Duyệt hồ sơ', roles: ['ADMIN'] },
  { id: 'my-schedule', icon: 'LC', label: 'Lịch làm việc của tôi', roles: ['CTV'] },
  { id: 'summary-schedule', icon: 'LT', label: 'Lịch làm việc tổng hợp', roles: ['ADMIN'] },
  { id: 'profile', icon: 'CN', label: 'Thông tin tài khoản', roles: ['ADMIN', 'CTV'] },
];

interface SidebarProps {
  user: AuthUser;
  currentView: AppView;
  isLoggingOut: boolean;
  collapsed?: boolean;
  onSelect: (view: AppView) => void;
  onLogout: () => void;
  onToggleCollapse?: () => void;
  onOpenSettings?: () => void;
}

export function Sidebar({
  user,
  currentView,
  isLoggingOut,
  collapsed = false,
  onSelect,
  onLogout,
  onToggleCollapse,
  onOpenSettings,
}: SidebarProps) {
  const { systemName } = useSystemSettings();
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false);
  const roleLabel = user.role === 'ADMIN' ? 'Giao diện quản trị' : 'Giao diện cộng tác viên';

  return (
    <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'}>
      <header className="sidebar-brand">
        <span className="sidebar-logo" aria-hidden="true">CTV</span>
        <span className="sidebar-brand-copy">
          <strong>{systemName}</strong>
          <small>{roleLabel}</small>
        </span>
        {onToggleCollapse && (
          <button
            type="button"
            className="collapse-action"
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            onClick={onToggleCollapse}
          >
            <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
          </button>
        )}
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
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <footer className="sidebar-footer">
        {isAccountMenuOpen && (
          <div className="account-menu" role="menu" aria-label="Tùy chọn tài khoản">
            <button type="button" role="menuitem" onClick={() => {
              onSelect('profile');
              setAccountMenuOpen(false);
            }}>Thông tin tài khoản</button>
            <button type="button" role="menuitem" onClick={() => {
              onOpenSettings?.();
              setAccountMenuOpen(false);
            }}>Cài đặt</button>
            <button type="button" role="menuitem" onClick={onLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </button>
          </div>
        )}
        <button
          type="button"
          className="account-summary account-trigger"
          aria-label={`${isAccountMenuOpen ? 'Đóng' : 'Mở'} menu tài khoản của ${user.displayName}`}
          aria-expanded={isAccountMenuOpen}
          aria-haspopup="menu"
          onClick={() => setAccountMenuOpen((open) => !open)}
        >
          <span className="avatar" aria-hidden="true">{initials(user.displayName)}</span>
          <span className="account-copy"><strong>{user.displayName}</strong><small>{user.role}</small></span>
        </button>
      </footer>
    </aside>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();
}
