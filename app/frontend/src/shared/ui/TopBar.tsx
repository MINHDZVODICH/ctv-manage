import React from 'react';
import type { ViewTab } from '../types';
import { useSystemSettings } from '../context/SystemSettingsContext';

interface TopBarProps {
  currentTab: ViewTab;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  unreadNotifCount: number;
  onToggleNotifications: () => void;
  onOpenSettings: () => void;
  onSelectTab: (tab: ViewTab) => void;
  userAvatar?: string;
  userName?: string;
  userInitials?: string;
  onToggleMobileMenu?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  unreadNotifCount,
  onToggleNotifications,
  onOpenSettings,
  onSelectTab,
  userAvatar,
  userName = 'Admin',
  userInitials,
  onToggleMobileMenu,
}) => {
  const { t } = useSystemSettings();

  return (
    <header className="bg-white dark:bg-[#1a1b1e] h-16 w-full border-b border-[#E2E8F0] dark:border-[#c4c6cf] flex items-center justify-between px-6 flex-shrink-0 z-10 transition-all duration-200 relative">
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-[#44474e] hover:text-[#002046] transition-colors rounded cursor-pointer"
            title={t('topbar.menu')}
            aria-label={t('topbar.menu')}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Button */}
        {onToggleNotifications && (
          <button
            type="button"
            onClick={onToggleNotifications}
            className="p-2 text-[#44474e] hover:text-[#002046] dark:hover:text-[#d6e3ff] transition-colors rounded-full hover:bg-[#f4f3f7] dark:hover:bg-[#28292e] cursor-pointer relative"
            title={t('topbar.notifications')}
            aria-label={t('topbar.notifications')}
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 bg-[#EA580C] text-white text-[10px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center">
                {unreadNotifCount}
              </span>
            )}
          </button>
        )}

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 text-[#44474e] hover:text-[#002046] dark:hover:text-[#d6e3ff] transition-colors rounded-full hover:bg-[#f4f3f7] dark:hover:bg-[#28292e] cursor-pointer"
          title={t('topbar.settings')}
          aria-label={t('topbar.settings')}
        >
          <span className="material-symbols-outlined">settings</span>
        </button>

        {/* User Avatar */}
        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          className="relative focus:outline-none focus:ring-2 focus:ring-accent rounded-full cursor-pointer"
          title={t('topbar.profile')}
          aria-label={t('topbar.profile')}
        >
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName || t('topbar.user_avatar')}
              className="w-9 h-9 rounded-full object-cover border border-[#E2E8F0] shadow-xs hover:opacity-90 transition-opacity"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#1b365d] text-white font-bold flex items-center justify-center text-xs border border-[#E2E8F0] shadow-xs hover:opacity-90 transition-opacity">
              {userInitials ||
                (userName
                  ? userName
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? '')
                      .join('')
                  : 'U')}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
