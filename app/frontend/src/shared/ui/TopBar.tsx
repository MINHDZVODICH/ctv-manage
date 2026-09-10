import React from 'react';
import { ViewTab } from '../../types';
import { useSystemSettings } from '../../context/SystemSettingsContext';

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
  onToggleMobileMenu
}) => {
  const { t } = useSystemSettings();

  return (
    <header className="bg-white dark:bg-[#1a1b1e] h-16 w-full border-b border-[#E2E8F0] dark:border-[#c4c6cf] flex items-center justify-between px-6 flex-shrink-0 z-10 transition-all duration-200 relative">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 text-[#44474e] hover:text-[#002046] transition-colors rounded"
          title="Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 text-[#44474e] hover:text-[#002046] dark:hover:text-[#d6e3ff] transition-colors rounded-full hover:bg-[#f4f3f7] dark:hover:bg-[#28292e] cursor-pointer"
          title={t('nav_settings')}
        >
          <span className="material-symbols-outlined">settings</span>
        </button>

        {/* User Avatar */}
        <button
          onClick={() => onSelectTab('profile')}
          className="relative focus:outline-none focus:ring-2 focus:ring-accent rounded-full cursor-pointer"
          title={t('nav_profile')}
        >
          {userAvatar ? (
            <img
              src={userAvatar}
              alt="Avatar người dùng"
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

