import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { UserAccount, RegistrationRequest, ShiftSlot, ViewTab } from '../types';
import { Sidebar } from '../components/Navigation/Sidebar';
import { LoginScreen } from '../components/Screens/LoginScreen';
import { AccountListScreen } from '../components/Screens/AccountListScreen';
import { RequestsScreen } from '../components/Screens/RequestsScreen';
import { ProfileScreen } from '../components/Screens/ProfileScreen';
import { ScheduleScreen } from '../components/Screens/ScheduleScreen';
import { SummaryScheduleScreen } from '../components/Screens/SummaryScheduleScreen';
import { ViewRequestModal } from '../components/Modals/ViewRequestModal';
import { ViewAccountDetailModal } from '../components/Modals/ViewAccountDetailModal';
import { EditProfileModal } from '../components/Modals/EditProfileModal';
import { ChangePasswordModal } from '../components/Modals/ChangePasswordModal';
import { SettingsModal } from '../components/Modals/SettingsModal';
import { useSystemSettings } from '../context/SystemSettingsContext';
import { useAuth } from '../shared/AuthContext';
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
      try {
        const regRes: any = await api.apiGet('/api/v1/users/me/schedule-registration').catch(() => ({ data: null }));
        const reg = regRes.data ?? regRes;
        const shiftRes: any = await api.apiGet('/api/v1/users/me/shifts').catch(() => ({ data: [] }));
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
        const slots = myShiftsToSlots(list, u, reg);
        setShifts(slots);
      } catch {}
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
    if (authUser && !isAdmin && currentTab === 'schedule') void loadShifts();
  }, [authUser, currentTab, isAdmin, loadShifts]);

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
        else if (!isAdmin && currentTab === 'schedule') void loadShifts();
      }, 0);
    };
    window.addEventListener('focus', refreshVisibleResource);
    document.addEventListener('visibilitychange', refreshVisibleResource);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('focus', refreshVisibleResource);
      document.removeEventListener('visibilitychange', refreshVisibleResource);
    };
  }, [authUser, currentTab, isAdmin, loadAccounts, loadRequests, loadShifts, refreshCurrentUser]);

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
    try {
      await api.apiPost(`/api/v1/accounts/${id}/password-resets`, { newPassword, mustChangePassword: requireChangeOnLogin });
      showToast(`Đã đặt lại mật khẩu thành công. Mật khẩu mới: ${newPassword}`);
      if (selectedAccountDetail?.id === id) {
        setSelectedAccountDetail((prev) => (prev ? { ...prev, password: newPassword } as any : prev));
      }
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

  const handleSaveProfile = async (updated: Partial<UserAccount>) => {
    if (!currentUser) return;
    try {
      // map name -> displayName
      const payload: any = {};
      if (updated.name !== undefined) payload.displayName = updated.name;
      if (updated.phone !== undefined) payload.phone = updated.phone;
      if (updated.address !== undefined) payload.address = updated.address;
      if ((updated as any).gender !== undefined) payload.gender = (updated as any).gender;
      if ((updated as any).dob !== undefined) payload.dateOfBirth = (updated as any).dob;
      // need version
      const meRes: any = await api.apiGet('/api/v1/users/me');
      const version = meRes.user?.version ?? meRes.data?.version;
      if (version !== undefined) payload.expectedVersion = version;
      await api.apiPatch('/api/v1/users/me', payload);
      await refreshCurrentUser();
      showToast('Đã cập nhật thông tin hồ sơ cá nhân.');
    } catch (e: any) {
      showToast(e.message ?? 'Cập nhật hồ sơ thất bại');
    }
  };

  const handleUpdateAvatar = async (url: string) => {
    // This is called with base64 dataUrl from ProfileScreen; upload via file API
    if (!url) {
      try {
        await api.apiDelete('/api/v1/users/me/files/AVATAR');
        showToast('Đã xóa ảnh đại diện');
        await refreshCurrentUser();
      } catch (e: any) {
        showToast(e.message ?? 'Xóa ảnh thất bại');
      }
      return;
    }
    try {
      const blob = await (await fetch(url)).blob();
      const form = new FormData();
      form.append('file', blob, 'avatar.png');
      await api.apiUpload('/api/v1/users/me/files/AVATAR', form, 'PUT');
      showToast('Đã thay đổi ảnh đại diện thành công');
      await refreshCurrentUser();
    } catch (e: any) {
      showToast(e.message ?? 'Tải ảnh thất bại');
    }
  };

  const handleUpdateCccd = async (kind: 'CCCD_FRONT' | 'CCCD_BACK', url: string) => {
    if (!url) {
      try {
        await api.apiDelete(`/api/v1/users/me/files/${kind}`);
        showToast(`Đã xóa ảnh CCCD ${kind === 'CCCD_FRONT' ? 'mặt trước' : 'mặt sau'}`);
        await refreshCurrentUser();
      } catch (e: any) {
        showToast(e.message ?? 'Xóa ảnh thất bại');
      }
      return;
    }
    try {
      const blob = await (await fetch(url)).blob();
      const form = new FormData();
      form.append('file', blob, `${kind}.png`);
      await api.apiUpload(`/api/v1/users/me/files/${kind}`, form, 'PUT');
      showToast('Đã thay đổi ảnh CCCD thành công');
      await refreshCurrentUser();
    } catch (e: any) {
      showToast(e.message ?? 'Tải ảnh CCCD thất bại');
    }
  };

  const handleUpdateCv = async (cvData: { cvFile: string; cvFileName: string; cvFileSize?: string } | null) => {
    if (!cvData) {
      try {
        await api.apiDelete('/api/v1/users/me/files/CV');
        showToast('Đã xóa file CV');
        await refreshCurrentUser();
      } catch (e: any) {
        showToast(e.message ?? 'Xóa CV thất bại');
      }
      return;
    }
    try {
      const blob = await (await fetch(cvData.cvFile)).blob();
      const form = new FormData();
      form.append('file', blob, cvData.cvFileName);
      await api.apiUpload('/api/v1/users/me/files/CV', form, 'PUT');
      showToast(`Đã cập nhật file CV: ${cvData.cvFileName}`);
      await refreshCurrentUser();
    } catch (e: any) {
      showToast(e.message ?? 'Tải CV thất bại');
    }
  };

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
    </div>
  );
};

export default App;
