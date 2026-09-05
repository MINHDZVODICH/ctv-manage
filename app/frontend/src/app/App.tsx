import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { UserAccount, RegistrationRequest, ShiftSlot, ViewTab } from '../types';
import { Sidebar, SettingsModal } from '../shared/ui';
import { LoginScreen } from '../features/auth';
import {
  AccountListScreen,
  RequestsScreen,
  ViewAccountDetailModal,
  ResetPasswordModal,
  ViewRequestModal,
} from '../features/accounts';
import { ScheduleScreen, SummaryScheduleScreen } from '../features/schedule';
import {
  ProfileScreen,
  EditProfileModal,
  ChangePasswordModal,
  useProfile,
} from '../features/profile';
import { useSystemSettings } from '../context/SystemSettingsContext';
import { useAuth } from '../shared/auth/AuthContext';
import * as api from '../shared/api';
import {
  accountToUserAccount,
  accountsToUserAccounts,
  requestsToRegistrationRequests,
  myShiftsToSlots,
  summaryToSlots,
  mapRole,
  fileUrl,
} from '../shared/mappers';

const SHIFT_STORAGE_KEY = 'ctv_schedule_cache';
const PAGE_SIZE = 5;

interface PaginatedQueryState {
  page: number;
  pageSize: number;
  q: string;
  total: number;
  loading: boolean;
  error: string | null;
}

export const App: React.FC = () => {
  const { isDarkMode } = useSystemSettings();
  const { user: authUser, loading: authLoading, login, register, logout } = useAuth();

  const [currentTab, setCurrentTab] = useState<ViewTab>('accounts');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [shifts, setShifts] = useState<ShiftSlot[]>([]);
  const [accountQuery, setAccountQuery] = useState<PaginatedQueryState>({ page: 1, pageSize: PAGE_SIZE, q: '', total: 0, loading: false, error: null });
  const [requestQuery, setRequestQuery] = useState<PaginatedQueryState>({ page: 1, pageSize: PAGE_SIZE, q: '', total: 0, loading: false, error: null });
  const [accountSearchInput, setAccountSearchInput] = useState('');
  const [requestSearchInput, setRequestSearchInput] = useState('');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  const accountRequestController = useRef<AbortController | null>(null);
  const requestRequestController = useRef<AbortController | null>(null);
  const accountRequestSequence = useRef(0);
  const requestRequestSequence = useRef(0);

  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<UserAccount | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [resetResultModal, setResetResultModal] = useState<{ accountName: string; password: string } | null>(null);
  const [hasCopiedPassword, setHasCopiedPassword] = useState(false);

  // ---- helpers ----
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const isAdmin = authUser?.role === 'ADMIN';
  const isLoggedIn = !!authUser;

  // ---- load current user profile ----
  const refreshCurrentUser = useCallback(async () => {
    if (!authUser) {
      setCurrentUser(null);
      return null;
    }
    try {
      const res: any = await api.apiGet('/api/v1/users/me');
      const raw = res.user ?? res.data ?? res;
      if (raw?.id) {
        const mapped = accountToUserAccount(raw as any, 0);
        setCurrentUser(mapped);
        return mapped;
      }
    } catch {}
    if (authUser) {
      setCurrentUser({
        id: authUser.id,
        stt: 1,
        name: authUser.displayName,
        email: authUser.email,
        phone: '',
        role: mapRole(authUser.role),
        status: 'Kích hoạt',
        registerDate: '',
      });
    }
    return null;
  }, [authUser]);

  useEffect(() => {
    refreshCurrentUser();
  }, [refreshCurrentUser]);

  // ---- load accounts (admin) ----
  const loadAccounts = useCallback(async () => {
    if (!isAdmin) return;
    accountRequestController.current?.abort();
    const controller = new AbortController();
    const sequence = ++accountRequestSequence.current;
    accountRequestController.current = controller;
    const { page, pageSize, q } = accountQuery;
    setAccountQuery((current) => ({ ...current, loading: true, error: null }));
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (q.trim()) params.set('q', q.trim());
      const res: any = await api.apiGet(`/api/v1/accounts?${params.toString()}`, { signal: controller.signal });
      const rows = res.data ?? res.items ?? [];
      const total = res.total ?? rows.length;
      if (sequence !== accountRequestSequence.current) return;
      const lastPage = Math.max(1, Math.ceil(total / pageSize));
      if (total > 0 && rows.length === 0 && page > lastPage) {
        setAccountQuery((current) => ({ ...current, page: lastPage, total, loading: false }));
        return;
      }
      setAccounts(accountsToUserAccounts(rows));
      setAccountQuery((current) => ({ ...current, total, loading: false, error: null }));
    } catch (error) {
      if (api.isRequestAborted(error) || sequence !== accountRequestSequence.current) return;
      setAccountQuery((current) => ({ ...current, loading: false, error: 'Không thể tải danh sách tài khoản.' }));
    }
  }, [accountQuery.page, accountQuery.pageSize, accountQuery.q, isAdmin]);

  const loadRequests = useCallback(async () => {
    if (!isAdmin) return;
    requestRequestController.current?.abort();
    const controller = new AbortController();
    const sequence = ++requestRequestSequence.current;
    requestRequestController.current = controller;
    const { page, pageSize, q } = requestQuery;
    setRequestQuery((current) => ({ ...current, loading: true, error: null }));
    try {
      const params = new URLSearchParams({ status: 'PENDING', page: String(page), pageSize: String(pageSize) });
      if (q.trim()) params.set('q', q.trim());
      const res: any = await api.apiGet(`/api/v1/registration-requests?${params.toString()}`, { signal: controller.signal });
      const rows = res.items ?? res.data ?? [];
      const total = res.total ?? rows.length;
      if (sequence !== requestRequestSequence.current) return;
      const lastPage = Math.max(1, Math.ceil(total / pageSize));
      if (total > 0 && rows.length === 0 && page > lastPage) {
        setRequestQuery((current) => ({ ...current, page: lastPage, total, loading: false }));
        return;
      }
      setRequests(requestsToRegistrationRequests(rows));
      setRequestQuery((current) => ({ ...current, total, loading: false, error: null }));
    } catch (error) {
      if (api.isRequestAborted(error) || sequence !== requestRequestSequence.current) return;
      setRequestQuery((current) => ({ ...current, loading: false, error: 'Không thể tải danh sách yêu cầu đăng ký.' }));
    }
  }, [isAdmin, requestQuery.page, requestQuery.pageSize, requestQuery.q]);

  const loadShifts = useCallback(async () => {
    if (!authUser) return;
    if (!isAdmin) {
      const [registrationResult, shiftResult] = await Promise.allSettled([
        api.apiGet('/api/v1/users/me/schedule-registration'),
        api.apiGet('/api/v1/users/me/shifts'),
      ]);
      if (shiftResult.status === 'rejected') throw shiftResult.reason;

      const regRes: any = registrationResult.status === 'fulfilled' ? registrationResult.value : null;
      const shiftRes: any = shiftResult.value;
      const reg = regRes?.data ?? regRes;
      const list: any[] = shiftRes.data ?? shiftRes.items ?? shiftRes ?? [];
      const u: UserAccount =
        currentUser ??
        ({
          id: authUser.id,
          name: authUser.displayName,
          email: authUser.email,
          phone: '',
          role: mapRole(authUser.role),
          status: 'Kích hoạt',
          registerDate: '',
        } as unknown as UserAccount);
      setShifts(myShiftsToSlots(list, u, reg));
      if (registrationResult.status === 'rejected') throw registrationResult.reason;
    } else {
      // Admin: load summary for current month
      try {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const res: any = await api.apiGet(`/api/v1/schedule-summary?month=${month}`).catch(() => ({ data: { cells: [] } }));
        const cells = res.data?.cells ?? res.cells ?? [];
        setShifts(summaryToSlots(cells));
      } catch {}
    }
  }, [authUser, isAdmin, currentUser]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAccountQuery((current) => ({ ...current, q: accountSearchInput, page: 1 }));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [accountSearchInput]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setRequestQuery((current) => ({ ...current, q: requestSearchInput, page: 1 }));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [requestSearchInput]);

  useEffect(() => {
    if (!authUser || !isAdmin || currentTab !== 'accounts') {
      accountRequestController.current?.abort();
      return;
    }
    void loadAccounts();
    return () => accountRequestController.current?.abort();
  }, [authUser, currentTab, isAdmin, loadAccounts]);

  useEffect(() => {
    if (!authUser || !isAdmin || currentTab !== 'requests') {
      requestRequestController.current?.abort();
      return;
    }
    void loadRequests();
    return () => requestRequestController.current?.abort();
  }, [authUser, currentTab, isAdmin, loadRequests]);

  useEffect(() => {
    if (authUser && !isAdmin && currentTab === 'schedule') {
      void loadShifts().catch(() => showToast('Không thể tải lịch làm việc. Vui lòng thử lại.'));
    }
  }, [authUser, currentTab, isAdmin, loadShifts, showToast]);

  // A focus and a visibility event often fire together; defer once and refresh only the visible resource.
  useEffect(() => {
    let timer: number | null = null;
    const refreshVisibleResource = () => {
      if (document.visibilityState !== 'visible' || !authUser || timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        if (currentTab === 'profile') void refreshCurrentUser();
        else if (isAdmin && currentTab === 'accounts') void loadAccounts();
        else if (isAdmin && currentTab === 'requests') void loadRequests();
        else if (!isAdmin && currentTab === 'schedule') {
          void loadShifts().catch(() => showToast('Không thể tải lại lịch làm việc.'));
        }
      }, 0);
    };
    window.addEventListener('focus', refreshVisibleResource);
    document.addEventListener('visibilitychange', refreshVisibleResource);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('focus', refreshVisibleResource);
      document.removeEventListener('visibilitychange', refreshVisibleResource);
    };
  }, [authUser, currentTab, isAdmin, loadAccounts, loadRequests, loadShifts, refreshCurrentUser, showToast]);

  // ---- tab default per role ----
  useEffect(() => {
    if (!authUser) return;
    if (authUser.role === 'ADMIN' && currentTab === 'schedule') setCurrentTab('accounts');
    if (authUser.role !== 'ADMIN' && (currentTab === 'accounts' || currentTab === 'requests')) {
      setCurrentTab('schedule');
    }
  }, [authUser?.role]);

  // ---- handlers wiring to API ----
  const handleOpenAccountDetail = async (acc: UserAccount) => {
    setSelectedAccountDetail(acc);
    try {
      const detailRes: any = await api.apiGet(`/api/v1/accounts/${acc.id}`);
      const raw = detailRes.data ?? (detailRes as any);
      if (raw?.id) {
        const mapped = accountToUserAccount(raw, acc.stt);
        setSelectedAccountDetail(mapped);
      }
    } catch {}
  };

  const handleOpenAccountDetailById = async (id: string) => {
    try {
      const detailRes: any = await api.apiGet(`/api/v1/accounts/${id}`);
      const raw = detailRes.data ?? detailRes;
      if (raw?.id) setSelectedAccountDetail(accountToUserAccount(raw, 0));
    } catch (error) {
      if (!api.isRequestAborted(error)) showToast('Không thể tải thông tin tài khoản.');
    }
  };

  const handleOpenRequestDetail = (req: RegistrationRequest) => {
    setSelectedRequest(req);
  };

  const handleLoginSuccess = async (email: string, password: string) => {
    try {
      await login(email, password);
      showToast(`Đăng nhập thành công với ${email}`);
    } catch (e: any) {
      throw e;
    }
  };

  const handleLogout = async () => {
    await logout();
    setAccounts([]);
    setRequests([]);
    setShifts([]);
    showToast('Đã đăng xuất khỏi hệ thống');
  };

  const handleToggleAccountStatus = async (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    const targetStatus = acc.status === 'Kích hoạt' ? 'DISABLED' : 'ACTIVE';
    try {
      // Need version: fetch detail to get version if not in list
      const detailRes: any = await api.apiGet(`/api/v1/accounts/${id}`);
      const version = detailRes.data?.version ?? (detailRes as any).version ?? undefined;
      await api.apiPatch(`/api/v1/accounts/${id}/status`, { status: targetStatus, expectedVersion: version });
      showToast(targetStatus === 'DISABLED' ? `Đã khóa tài khoản ${acc.name}` : `Đã kích hoạt lại ${acc.name}`);
      await loadAccounts();
      if (selectedAccountDetail?.id === id) {
        handleOpenAccountDetail({ ...acc, status: targetStatus === 'DISABLED' ? 'Vô hiệu hóa' : 'Kích hoạt' });
      }
    } catch (e: any) {
      showToast(e.message ?? 'Cập nhật trạng thái thất bại');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const target = accounts.find((a) => a.id === id);
    if (!target) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản ${target.name}?`)) return;
    try {
      await api.apiDelete(`/api/v1/accounts/${id}`);
      showToast(`Đã xóa tài khoản ${target.name}`);
      if (selectedAccountDetail?.id === id) setSelectedAccountDetail(null);
      await loadAccounts();
    } catch (e: any) {
      showToast(e.message ?? 'Xóa thất bại');
    }
  };

  const handleResetPassword = async (id: string, newPassword: string, requireChangeOnLogin: boolean) => {
    const target = accounts.find((a) => a.id === id) ?? (selectedAccountDetail?.id === id ? selectedAccountDetail : null);
    const accountName = target?.name ?? 'tài khoản';
    try {
      await api.apiPost(`/api/v1/accounts/${id}/password-resets`, { newPassword, mustChangePassword: requireChangeOnLogin });
      showToast('Đã đặt lại mật khẩu thành công');
      setResetResultModal({ accountName, password: newPassword });
    } catch (e: any) {
      showToast(e.message ?? 'Đặt lại mật khẩu thất bại');
    }
  };

  const handleSaveAccountNotes = async (id: string, notes: string) => {
    try {
      // fetch version
      const detailRes: any = await api.apiGet(`/api/v1/accounts/${id}`);
      const version = detailRes.data?.version ?? (detailRes as any).version;
      await api.apiPatch(`/api/v1/accounts/${id}/notes`, { adminNotes: notes, expectedVersion: version });
      setSelectedAccountDetail((prev) => (prev && prev.id === id ? { ...prev, notes } : prev));
      showToast('Đã lưu ghi chú quản trị viên thành công');
      await loadAccounts();
    } catch (e: any) {
      showToast(e.message ?? 'Lưu ghi chú thất bại');
    }
  };

  const handleApproveRequest = async (id: string) => {
    try {
      await api.apiPatch(`/api/v1/registration-requests/${id}`, { decision: 'APPROVED', expectedStatus: 'PENDING' });
      showToast('Đã phê duyệt hồ sơ');
      if (selectedRequest?.id === id) setSelectedRequest(null);
      await loadRequests();
    } catch (e: any) {
      showToast(e.message ?? 'Phê duyệt thất bại');
    }
  };

  const handleRejectRequest = async (id: string) => {
    try {
      await api.apiPatch(`/api/v1/registration-requests/${id}`, { decision: 'REJECTED', expectedStatus: 'PENDING' });
      if (selectedRequest?.id === id) setSelectedRequest(null);
      showToast('Đã từ chối hồ sơ');
      await loadRequests();
    } catch (e: any) {
      showToast(e.message ?? 'Từ chối thất bại');
    }
  };

  const {
    saveProfile: handleSaveProfile,
    updateAvatar: handleUpdateAvatar,
    updateCccd: handleUpdateCccd,
    updateCv: handleUpdateCv,
  } = useProfile({
    onSuccess: showToast,
    onError: showToast,
    onRefreshUser: refreshCurrentUser,
  });

  const handleEndAccountSchedule = async (accountId: string, _startDate: string, endDate: string, reason: string) => {
    // Use schedule summary cancel: not directly supported; cancel future assignments via schedule service
    // For now, use status change side-effect or manual shift cancellation per assignment is not exposed.
    // We'll call changeStatus DISABLED as fallback is not correct. Instead, show not implemented.
    showToast('Kết thúc lịch: vui lòng hủy từng ca trong Lịch làm việc.');
  };

  const pendingRequestsCount = requestQuery.total;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9fd]">
        <span className="text-sm text-[#74777f]">Đang tải...</span>
      </div>
    );
  }

  if (!isLoggedIn || !authUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onRequestRegister={async (formData: any) => {
          // LoginScreen will call with FormData now (see patched LoginScreen)
          // Fallback: if it passes RegistrationRequest object (old prototype), ignore
          if (formData instanceof FormData) {
            await register(formData);
          }
        }}
      />
    );
  }

  const userName = currentUser?.name ?? authUser.displayName;
  const userRoleLabel = currentUser?.role ?? mapRole(authUser.role);
  const userAvatar = currentUser?.avatar;
  const effectiveCurrentUser: UserAccount =
    currentUser ??
    ({
      id: authUser.id,
      stt: 1,
      name: authUser.displayName,
      email: authUser.email,
      phone: '',
      role: mapRole(authUser.role),
      status: 'Kích hoạt',
      registerDate: '',
    } as UserAccount);

  return (
    <div className={`h-screen flex overflow-hidden bg-[#faf9fd] text-[#1a1b1e] ${isDarkMode ? 'dark' : ''}`}>
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#002046] text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-[18px] text-[#16A34A]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="hidden md:block">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setIsMobileMenuOpen(false);
          }}
          pendingRequestsCount={pendingRequestsCount}
          onLogout={handleLogout}
          userName={userName}
          userRole={userRoleLabel}
          userAvatar={userAvatar}
          onSwitchRole={() => showToast('Đổi vai trò không khả dụng ở bản production')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {isMobileMenuOpen && (
        <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/50 z-30 md:hidden" />
      )}
      {isMobileMenuOpen && (
        <div className="fixed inset-y-0 left-0 w-[280px] bg-[#f4f3f7] z-40 md:hidden flex flex-col">
          <Sidebar
            currentTab={currentTab}
            onSelectTab={(tab) => {
              setCurrentTab(tab);
              setIsMobileMenuOpen(false);
            }}
            pendingRequestsCount={pendingRequestsCount}
            onLogout={handleLogout}
            userName={userName}
            userRole={userRoleLabel}
            userAvatar={userAvatar}
            onSwitchRole={() => {}}
            onOpenSettings={() => {
              setIsSettingsOpen(true);
              setIsMobileMenuOpen(false);
            }}
            isCollapsed={false}
          />
        </div>
      )}

      <div className={`flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[280px]'}`}>
        <div className="md:hidden p-3 border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#f4f3f7] dark:bg-[#1a1b1e] flex items-center justify-between z-10 shrink-0">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-[#002046] dark:text-[#d6e3ff] hover:bg-[#e3e2e6] rounded-lg flex items-center gap-2 font-semibold text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined">menu</span>
            <span>Danh mục</span>
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl w-full mx-auto">
            {currentTab === 'accounts' && (
              <AccountListScreen
                accounts={accounts}
                total={accountQuery.total}
                page={accountQuery.page}
                pageSize={accountQuery.pageSize}
                searchTerm={accountSearchInput}
                loading={accountQuery.loading}
                error={accountQuery.error}
                onSearchChange={setAccountSearchInput}
                onPageChange={(page) => setAccountQuery((current) => ({ ...current, page }))}
                onResetFilters={() => {
                  setAccountSearchInput('');
                  setAccountQuery((current) => ({ ...current, q: '', page: 1 }));
                }}
                onToggleAccountStatus={handleToggleAccountStatus}
                onDeleteAccount={handleDeleteAccount}
                onViewAccountDetail={handleOpenAccountDetail}
                onResetPassword={handleResetPassword}
              />
            )}
            {currentTab === 'requests' && (
              <RequestsScreen
                requests={requests}
                total={requestQuery.total}
                page={requestQuery.page}
                pageSize={requestQuery.pageSize}
                searchTerm={requestSearchInput}
                loading={requestQuery.loading}
                error={requestQuery.error}
                onSearchChange={setRequestSearchInput}
                onPageChange={(page) => setRequestQuery((current) => ({ ...current, page }))}
                onResetFilters={() => {
                  setRequestSearchInput('');
                  setRequestQuery((current) => ({ ...current, q: '', page: 1 }));
                }}
                onApproveRequest={handleApproveRequest}
                onRejectRequest={handleRejectRequest}
                onViewRequestDetail={handleOpenRequestDetail}
              />
            )}
            {currentTab === 'schedule' && (
              <ScheduleScreen
                shifts={shifts}
                accounts={accounts}
                onUpdateShifts={setShifts}
                onShowToast={showToast}
                onReload={loadShifts}
                onViewAccountDetail={handleOpenAccountDetail}
                currentUser={effectiveCurrentUser}
                userRole={userRoleLabel as any}
              />
            )}
            {currentTab === 'meetings' && (
              <SummaryScheduleScreen
                shifts={shifts}
                onViewAccountDetail={handleOpenAccountDetailById}
                onShowToast={showToast}
                currentUser={currentUser ?? undefined}
                userRole={userRoleLabel as any}
              />
            )}
            {currentTab === 'profile' && currentUser && (
              <ProfileScreen
                user={currentUser}
                onOpenEditProfile={() => setIsEditProfileOpen(true)}
                onOpenChangePassword={() => setIsChangePasswordOpen(true)}
                onUpdateAvatar={handleUpdateAvatar}
                onUpdateCccdFront={(url) => handleUpdateCccd('CCCD_FRONT', url)}
                onUpdateCccdBack={(url) => handleUpdateCccd('CCCD_BACK', url)}
                onUpdateCvFile={handleUpdateCv}
              />
            )}
          </div>
        </main>
      </div>

      <ViewRequestModal request={selectedRequest} onClose={() => setSelectedRequest(null)} onApprove={handleApproveRequest} onReject={handleRejectRequest} />
      <ViewAccountDetailModal
        account={selectedAccountDetail}
        shifts={shifts}
        onClose={() => setSelectedAccountDetail(null)}
        onToggleStatus={handleToggleAccountStatus}
        onSaveNotes={handleSaveAccountNotes}
        onEndSchedule={handleEndAccountSchedule}
        onResetPassword={handleResetPassword}
      />
      {currentUser && (
        <EditProfileModal isOpen={isEditProfileOpen} user={currentUser} onClose={() => setIsEditProfileOpen(false)} onSave={handleSaveProfile} />
      )}
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} onSuccess={() => showToast('Đổi mật khẩu thành công!')} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {resetResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e1f22] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e2e8f0] dark:border-[#2b2d31] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#2b2d31]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#16A34A] text-2xl">key</span>
                <h3 className="text-base font-bold text-[#002046] dark:text-[#d6e3ff]">
                  Đặt lại mật khẩu thành công
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetResultModal(null);
                  setHasCopiedPassword(false);
                }}
                className="text-[#64748B] hover:text-[#002046] dark:hover:text-white p-1 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#2b2d31] transition-colors"
                title="Đóng"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-sm text-[#475569] dark:text-[#94a3b8]">
                Mật khẩu mới cho tài khoản <span className="font-semibold text-[#002046] dark:text-white">{resetResultModal.accountName}</span> đã được tạo:
              </p>

              <div className="bg-[#f8fafc] dark:bg-[#141517] border border-[#e2e8f0] dark:border-[#2b2d31] rounded-xl p-3">
                <label className="block text-xs font-semibold text-[#64748B] dark:text-[#94a3b8] mb-1.5 uppercase tracking-wider">
                  Mật khẩu mới
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={resetResultModal.password}
                    className="flex-1 bg-transparent font-mono text-base font-semibold text-[#002046] dark:text-[#d6e3ff] outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(resetResultModal.password);
                        setHasCopiedPassword(true);
                        setTimeout(() => setHasCopiedPassword(false), 2000);
                      } catch {
                        // Fallback
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#002046] hover:bg-[#003166] text-white dark:bg-[#0066ff] dark:hover:bg-[#0052cc] transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {hasCopiedPassword ? 'check' : 'content_copy'}
                    </span>
                    <span>{hasCopiedPassword ? 'Đã sao chép' : 'Sao chép'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">info</span>
                <span>
                  Đây là lần duy nhất mật khẩu này hiển thị. Mật khẩu sẽ bị xóa khỏi bộ nhớ ngay khi đóng hộp thoại này.
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setResetResultModal(null);
                  setHasCopiedPassword(false);
                }}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#002046] hover:bg-[#003166] text-white dark:bg-[#0066ff] dark:hover:bg-[#0052cc] transition-colors shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
