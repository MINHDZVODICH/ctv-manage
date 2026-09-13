import React from 'react';
import type { UserAccount, ViewTab } from '../../shared/types';
import { Sidebar } from '../../shared/ui';

export interface AppNavigationProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  pendingRequestsCount: number;
  onLogout: () => void;
  effectiveUser: UserAccount;
  onOpenSettings: () => void;
  isSidebarCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

export const AppNavigation: React.FC<AppNavigationProps> = ({
  currentTab,
  onSelectTab,
  pendingRequestsCount,
  onLogout,
  effectiveUser,
  onOpenSettings,
  isSidebarCollapsed,
  onToggleCollapse,
  isMobileMenuOpen,
  onCloseMobileMenu,
}) => {
  return (
    <>
      <div className="hidden md:block">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          pendingRequestsCount={pendingRequestsCount}
          onLogout={onLogout}
          userName={effectiveUser.name}
          userRole={effectiveUser.role}
          userAvatar={effectiveUser.avatar}
          userInitials={effectiveUser.initials}
          onOpenSettings={onOpenSettings}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
      </div>

      {isMobileMenuOpen && (
        <div
          onClick={onCloseMobileMenu}
          aria-hidden="true"
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        />
      )}
      {isMobileMenuOpen && (
        <div className="fixed inset-y-0 left-0 w-[280px] bg-[#f4f3f7] z-40 md:hidden flex flex-col">
          <Sidebar
            currentTab={currentTab}
            onSelectTab={(tab) => {
              onSelectTab(tab);
              onCloseMobileMenu();
            }}
            pendingRequestsCount={pendingRequestsCount}
            onLogout={onLogout}
            userName={effectiveUser.name}
            userRole={effectiveUser.role}
            userAvatar={effectiveUser.avatar}
            userInitials={effectiveUser.initials}
            onOpenSettings={() => {
              onOpenSettings();
              onCloseMobileMenu();
            }}
            isCollapsed={false}
          />
        </div>
      )}
    </>
  );
};
