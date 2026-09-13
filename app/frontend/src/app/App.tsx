import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { UserAccount, ViewTab } from '../shared/types';
import { LoginScreen } from '../features/auth';
import { useAccountsAdmin } from '../features/accounts';
import { useRegistrationRequests } from '../features/registration';
import { useScheduleDashboard } from '../features/schedule';
import { useProfile } from '../features/profile';
import { useSystemSettings } from '../shared/context/SystemSettingsContext';
import { useAuth } from '../shared/auth/AuthContext';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useTabRefresh } from './hooks/useTabRefresh';
import { AppNavigation } from './components/AppNavigation';
import { AppContent } from './components/AppContent';
import { AppModals } from './components/AppModals';
import { mapRole } from '../shared/mappers';

export const App: React.FC = () => {
  const { isDarkMode, t } = useSystemSettings();
  const { user: authUser, loading: authLoading, login, register, logout } = useAuth();
  const { user: currentUser, refreshUser: refreshCurrentUser, clearUser } = useCurrentUser();

  const [currentTab, setCurrentTab] = useState<ViewTab>('accounts');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  const isAdmin = authUser?.role === 'ADMIN';
  const isLoggedIn = !!authUser;

  const accountsAdmin = useAccountsAdmin({ isAdmin, onToast: showToast, t });
  const regRequests = useRegistrationRequests({ isAdmin, onToast: showToast, t });
  const scheduleDash = useScheduleDashboard({
    authUser,
    isAdmin,
    currentUser,
    onToast: showToast,
    t,
  });
  const profileActions = useProfile({
    onSuccess: showToast,
    onError: showToast,
    onRefreshUser: async () => {
      await refreshCurrentUser();
    },
  });

  useTabRefresh({
    authUser,
    currentTab,
    isAdmin,
    loadAccounts: accountsAdmin.loadAccounts,
    loadRequests: regRequests.loadRequests,
    loadShifts: scheduleDash.loadShifts,
    refreshCurrentUser,
    onToast: showToast,
    reloadFailedMessage: t('app.schedule_reload_failed'),
    scheduleFailedMessage: t('app.schedule_failed_retry'),
  });

  useEffect(() => {
    if (!authUser) return;
    if (authUser.role === 'ADMIN' && currentTab === 'schedule') setCurrentTab('accounts');
    if (authUser.role !== 'ADMIN' && (currentTab === 'accounts' || currentTab === 'requests')) {
      setCurrentTab('schedule');
    }
  }, [authUser, currentTab]);

  const handleLogout = async () => {
    await logout();
    accountsAdmin.clearAccounts();
    regRequests.clearRequests();
    scheduleDash.clearShifts();
    clearUser();
    showToast(t('app.logout_success'));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9fd]">
        <span className="text-sm text-[#74777f]">{t('common.loading')}</span>
      </div>
    );
  }

  if (!isLoggedIn || !authUser) {
    return (
      <LoginScreen
        onLoginSuccess={async (email, password) => {
          await login(email, password);
          showToast(t('app.login_success_with_email', { email }));
        }}
        onRequestRegister={async (formData: unknown) => {
          if (formData instanceof FormData) await register(formData);
        }}
      />
    );
  }

  const effectiveUser: UserAccount = currentUser ?? {
    id: authUser.id,
    stt: 1,
    name: authUser.displayName,
    email: authUser.email,
    phone: '',
    role: mapRole(authUser.role),
    status: 'Kích hoạt',
    registerDate: '',
  };

  return (
    <div
      className={`h-screen flex overflow-hidden bg-[#faf9fd] text-[#1a1b1e] ${isDarkMode ? 'dark' : ''}`}
    >
      {toastMessage && (
        <div
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-[#002046] text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200"
        >
          <span className="material-symbols-outlined text-[18px] text-[#16A34A]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <AppNavigation
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setIsMobileMenuOpen(false);
        }}
        pendingRequestsCount={regRequests.pendingRequestsCount}
        onLogout={handleLogout}
        effectiveUser={effectiveUser}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
      />

      <div
        className={`flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[280px]'}`}
      >
        <div className="md:hidden p-3 border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#f4f3f7] dark:bg-[#1a1b1e] flex items-center justify-between z-10 shrink-0">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label={t('sidebar.menu')}
            className="p-2 text-[#002046] dark:text-[#d6e3ff] hover:bg-[#e3e2e6] rounded-lg flex items-center gap-2 font-semibold text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined">menu</span>
            <span>{t('sidebar.menu')}</span>
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <AppContent
            currentTab={currentTab}
            accountsAdmin={accountsAdmin}
            regRequests={regRequests}
            scheduleDash={scheduleDash}
            effectiveUser={effectiveUser}
            currentUser={currentUser}
            showToast={showToast}
            onOpenEditProfile={() => setIsEditProfileOpen(true)}
            onOpenChangePassword={() => setIsChangePasswordOpen(true)}
            onUpdateAvatar={profileActions.updateAvatar}
            onUpdateCccdFront={(url) => profileActions.updateCccd('CCCD_FRONT', url)}
            onUpdateCccdBack={(url) => profileActions.updateCccd('CCCD_BACK', url)}
            onUpdateCvFile={profileActions.updateCv}
          />
        </main>
      </div>

      <AppModals
        accountsAdmin={accountsAdmin}
        regRequests={regRequests}
        scheduleDash={scheduleDash}
        profileActions={profileActions}
        currentUser={currentUser}
        isEditProfileOpen={isEditProfileOpen}
        onCloseEditProfile={() => setIsEditProfileOpen(false)}
        isChangePasswordOpen={isChangePasswordOpen}
        onCloseChangePassword={() => setIsChangePasswordOpen(false)}
        onChangePasswordSuccess={() => showToast(t('app.change_password_success'))}
        isSettingsOpen={isSettingsOpen}
        onCloseSettings={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default App;
