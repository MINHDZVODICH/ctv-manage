import React, { useState } from 'react';
import type { ViewTab } from '../types';
import { useSystemSettings } from '../context/SystemSettingsContext';
import amstLogo from '../../assets/logo.png';

interface SidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  pendingRequestsCount: number;
  onLogout: () => void;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  userInitials?: string;
  onOpenSettings?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSwitchRole?: (role: 'Admin' | 'Cộng tác viên') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingRequestsCount,
  onLogout,
  userName = 'Admin',
  userRole = 'Admin',
  userAvatar,
  userInitials,
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse,
  onSwitchRole,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { t } = useSystemSettings();

  const isAdmin = userRole === 'Admin';

  return (
    <aside
      className={`bg-[#f4f3f7] dark:bg-[#1a1b1e] h-screen fixed left-0 top-0 border-r border-[#E2E8F0] dark:border-[#c4c6cf] flex flex-col z-20 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-[72px]' : 'w-[280px]'
      }`}
    >
      {/* Header */}
      <div
        className={`px-3 py-3.5 border-b border-[#E2E8F0] dark:border-[#c4c6cf] flex items-center ${
          isCollapsed ? 'justify-center' : 'justify-between gap-1.5'
        }`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img
                src={amstLogo}
                alt={t('sidebar.logo_alt')}
                className="w-8 h-8 object-contain drop-shadow-xs"
              />
            </div>
            <h1 className="font-bold text-sm text-[#1b365d] dark:text-[#d6e3ff] leading-tight tracking-tight whitespace-nowrap truncate">
              {t('system_name')}
            </h1>
          </div>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            className={`p-1.5 text-[#44474e] dark:text-[#c4c6cf] hover:text-[#002046] dark:hover:text-white hover:bg-[#e9e8ec] dark:hover:bg-[#2c2d33] rounded-lg transition-colors cursor-pointer shrink-0 ${
              isCollapsed ? 'mx-auto' : ''
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isCollapsed ? 'side_navigation' : 'first_page'}
            </span>
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-3 flex flex-col gap-1.5 px-3 overflow-y-auto overflow-x-hidden">
        {/* Admin only: Accounts */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => onSelectTab('accounts')}
            title={isCollapsed ? t('nav_accounts') : undefined}
            aria-label={t('nav_accounts')}
            className={`flex items-center ${
              isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3.5 py-3'
            } rounded-lg text-sm font-semibold transition-all duration-150 text-left w-full cursor-pointer relative ${
              currentTab === 'accounts'
                ? 'bg-accent text-white shadow-xs'
                : 'text-[#44474e] dark:text-slate-200 hover:bg-[#e9e7eb] dark:hover:bg-[#2a2b30] hover:text-[#002046]'
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px] shrink-0"
              style={{ fontVariationSettings: currentTab === 'accounts' ? "'FILL' 1" : "'FILL' 0" }}
            >
              group
            </span>
            {!isCollapsed && <span className="truncate">{t('nav_accounts')}</span>}
          </button>
        )}

        {/* Admin only: Requests */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => onSelectTab('requests')}
            title={isCollapsed ? `${t('nav_requests')} (${pendingRequestsCount})` : undefined}
            aria-label={t('nav_requests')}
            className={`flex items-center ${
              isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3.5 py-3'
            } rounded-lg text-sm font-semibold transition-all duration-150 text-left w-full cursor-pointer relative ${
              currentTab === 'requests'
                ? 'bg-accent text-white shadow-xs'
                : 'text-[#44474e] dark:text-slate-200 hover:bg-[#e9e7eb] dark:hover:bg-[#2a2b30] hover:text-[#002046]'
            }`}
          >
            <div
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} truncate`}
            >
              <span
                className="material-symbols-outlined text-[22px] shrink-0"
                style={{
                  fontVariationSettings: currentTab === 'requests' ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                person_add
              </span>
              {!isCollapsed && <span className="truncate">{t('nav_requests')}</span>}
            </div>
            {pendingRequestsCount > 0 && (
              <span
                className={
                  isCollapsed
                    ? 'absolute top-1 right-1 bg-[#EA580C] text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center'
                    : 'bg-[#EA580C] text-white text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0'
                }
              >
                {pendingRequestsCount}
              </span>
            )}
          </button>
        )}

        {/* CTV only: Schedule */}
        {!isAdmin && (
          <button
            type="button"
            onClick={() => onSelectTab('schedule')}
            title={isCollapsed ? t('nav_my_schedule') : undefined}
            aria-label={t('nav_my_schedule')}
            className={`flex items-center ${
              isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3.5 py-3'
            } rounded-lg text-sm font-semibold transition-all duration-150 text-left w-full cursor-pointer relative ${
              currentTab === 'schedule'
                ? 'bg-accent text-white shadow-xs'
                : 'text-[#44474e] dark:text-slate-200 hover:bg-[#e9e7eb] dark:hover:bg-[#2a2b30] hover:text-[#002046]'
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px] shrink-0"
              style={{ fontVariationSettings: currentTab === 'schedule' ? "'FILL' 1" : "'FILL' 0" }}
            >
              calendar_month
            </span>
            {!isCollapsed && <span className="truncate">{t('nav_my_schedule')}</span>}
          </button>
        )}

        {/* Admin only: Summary Schedule */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => onSelectTab('meetings')}
            title={isCollapsed ? t('nav_summary') : undefined}
            aria-label={t('nav_summary')}
            className={`flex items-center ${
              isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3.5 py-3'
            } rounded-lg text-sm font-semibold transition-all duration-150 text-left w-full cursor-pointer relative ${
              currentTab === 'meetings'
                ? 'bg-accent text-white shadow-xs'
                : 'text-[#44474e] dark:text-slate-200 hover:bg-[#e9e7eb] dark:hover:bg-[#2a2b30] hover:text-[#002046]'
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px] shrink-0"
              style={{ fontVariationSettings: currentTab === 'meetings' ? "'FILL' 1" : "'FILL' 0" }}
            >
              calendar_month
            </span>
            {!isCollapsed && <span className="truncate">{t('nav_summary')}</span>}
          </button>
        )}
      </nav>

      {/* User Profile Widget Footer with Popover */}
      <div className="p-3 border-t border-[#E2E8F0] dark:border-[#c4c6cf] relative">
        {/* User Popover Menu */}
        {isUserMenuOpen && (
          <>
            {/* Transparent backdrop for outside click */}
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsUserMenuOpen(false)}
              aria-hidden="true"
            />

            <div
              role="menu"
              aria-label={t('sidebar.user_menu')}
              className={`absolute bottom-full mb-2 bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-xl shadow-xl p-2 z-40 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
                isCollapsed ? 'left-2 w-48' : 'left-3 right-3'
              }`}
            >
              {/* Menu Actions */}
              <div className="space-y-1">
                {/* Profile */}
                <div
                  role="menuitem"
                  onClick={() => {
                    onSelectTab('profile');
                    setIsUserMenuOpen(false);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab('profile');
                      setIsUserMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors text-left cursor-pointer ${
                      currentTab === 'profile'
                        ? 'bg-accent text-white'
                        : 'text-[#1a1b1e] dark:text-white hover:bg-[#f4f3f7] dark:hover:bg-[#32343b]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">account_circle</span>
                    <span>{t('nav_profile')}</span>
                  </button>
                </div>

                {/* Settings */}
                {onOpenSettings && (
                  <div
                    role="menuitem"
                    onClick={() => {
                      onOpenSettings();
                      setIsUserMenuOpen(false);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSettings();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-[#1a1b1e] dark:text-white hover:bg-[#f4f3f7] dark:hover:bg-[#32343b] transition-colors text-left cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">settings</span>
                      <span>{t('nav_settings')}</span>
                    </button>
                  </div>
                )}

                {/* Logout */}
                <div
                  role="menuitem"
                  onClick={() => {
                    onLogout();
                    setIsUserMenuOpen(false);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer border-t border-[#E2E8F0] dark:border-[#3b3d45] mt-1 pt-2"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    <span>{t('logout')}</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* User Card Bar */}
        <button
          type="button"
          aria-expanded={isUserMenuOpen}
          aria-haspopup="true"
          title={t('sidebar.user_menu')}
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={`w-full flex items-center ${
            isCollapsed ? 'justify-center p-1.5' : 'justify-between p-2'
          } rounded-xl hover:bg-[#e9e7eb] dark:hover:bg-[#25262b] transition-colors cursor-pointer group text-left`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName || t('topbar.user_avatar')}
                className="w-9 h-9 rounded-full object-cover border border-white dark:border-[#3b3d45] shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#1b365d] text-white font-bold flex items-center justify-center text-xs shrink-0 border border-white dark:border-[#3b3d45] shadow-2xs">
                {userInitials ||
                  userName
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase() ?? '')
                    .join('') ||
                  userName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {!isCollapsed && (
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-[#1a1b1e] dark:text-white truncate">
                  {userName}
                </h4>
                <p className="text-[10px] text-[#74777f] dark:text-[#c4c6cf] truncate">
                  {userRole === 'Admin' ? t('role_admin') : t('role_ctv')}
                </p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <span className="material-symbols-outlined text-[18px] text-[#74777f] group-hover:text-[#1a1b1e] dark:text-[#c4c6cf] transition-transform">
              {isUserMenuOpen ? 'unfold_less' : 'unfold_more'}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};
