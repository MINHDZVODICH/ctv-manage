import React, { useEffect, useState, useCallback } from "react";
import {
  UserAccount,
  UserRole,
  RegistrationRequest,
  ShiftSlot,
  MeetingItem,
  Participant,
  NotificationItem,
  ViewTab,
} from "./types";
import { Sidebar } from "./components/Navigation/Sidebar";

import { LoginScreen } from "./components/Screens/LoginScreen";
import { AccountListScreen } from "./components/Screens/AccountListScreen";
import { ScheduleScreen } from "./components/Screens/ScheduleScreen";
import { SummaryScheduleScreen } from "./components/Screens/SummaryScheduleScreen";
import { RequestsScreen } from "./components/Screens/RequestsScreen";
import { ProfileScreen } from "./components/Screens/ProfileScreen";

import { CreateUserModal } from "./components/Modals/CreateUserModal";
import { CreateMeetingModal } from "./components/Modals/CreateMeetingModal";
import { ViewRequestModal } from "./components/Modals/ViewRequestModal";
import { ViewAccountDetailModal } from "./components/Modals/ViewAccountDetailModal";
import { EditProfileModal } from "./components/Modals/EditProfileModal";
import { ChangePasswordModal } from "./components/Modals/ChangePasswordModal";
import { NotificationsPopover } from "./components/Modals/NotificationsPopover";
import { SettingsModal } from "./components/Modals/SettingsModal";
import { useSystemSettings } from "./context/SystemSettingsContext";
import { api } from "./api/client";

export const App: React.FC = () => {
  const { isDarkMode } = useSystemSettings();

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Active view tab
  const [currentTab, setCurrentTab] = useState<ViewTab>("accounts");

  // Mobile sidebar state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Desktop sidebar collapsed state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Fallback guest user before auth
  const DEFAULT_GUEST: UserAccount = {
    id: "",
    stt: 1,
    name: "Quản Trị Viên",
    email: "admin@vienkhcn.vn",
    phone: "",
    role: "Admin",
    status: "Kích hoạt",
    registerDate: "",
    initials: "AD",
    cctvCode: "ADM-001",
  };

  // App Data State
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [shifts, setShifts] = useState<ShiftSlot[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Current logged in user details
  const [currentUser, setCurrentUser] = useState<UserAccount>(DEFAULT_GUEST);

  // Modal states
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<UserAccount | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Reload all application data from backend
  const loadAppData = useCallback(async (user: UserAccount) => {
    try {
      const [shiftsData, notifData] = await Promise.all([
        api.schedules.getMyShifts().catch(() => []),
        api.notifications.list().catch(() => []),
      ]);

      setShifts(shiftsData || []);
      setNotifications(notifData || []);

      if (user.role === "Admin") {
        const [accountsData, requestsData] = await Promise.all([
          api.accounts.list().catch(() => []),
          api.registrationRequests.list().catch(() => []),
        ]);
        setAccounts(accountsData || []);
        setRequests(requestsData || []);
      }
    } catch (err) {
      console.error("Error loading app data:", err);
    }
  }, []);

  // Check current session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await api.auth.getCurrentSession();
        if (session && session.user) {
          setCurrentUser(session.user);
          setIsLoggedIn(true);
          setCurrentTab(session.user.role === "Admin" ? "accounts" : "schedule");
          await loadAppData(session.user);
        }
      } catch {
        setIsLoggedIn(false);
      } finally {
        setIsInitializing(false);
      }
    };

    initSession();
  }, [loadAppData]);

  // Handlers
  const handleLoginSuccess = async (user: UserAccount) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    setCurrentTab(user.role === "Admin" ? "accounts" : "schedule");
    showToast(`Đăng nhập thành công với ${user.email}`);
    await loadAppData(user);
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    }
    setIsLoggedIn(false);
    showToast("Đã đăng xuất khỏi hệ thống");
  };

  // Account Operations
  const handleCreateAccount = async (userData: {
    name: string;
    email: string;
    phone: string;
    role: any;
    address: string;
  }) => {
    try {
      const newAcc = await api.accounts.create({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role,
        address: userData.address,
      });
      setAccounts((prev) => [newAcc, ...prev]);
      showToast(`Đã tạo tài khoản thành công cho ${userData.name}`);
      setIsCreateUserOpen(false);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi tạo tài khoản");
    }
  };

  const handleToggleAccountStatus = async (id: string) => {
    try {
      const updated = await api.accounts.toggleStatus(id);
      setAccounts((prev) => prev.map((acc) => (acc.id === id ? updated : acc)));
      if (selectedAccountDetail && selectedAccountDetail.id === id) {
        setSelectedAccountDetail(updated);
      }
      const newShifts = await api.schedules.getMyShifts();
      setShifts(newShifts);
      showToast(
        updated.status === "Vô hiệu hóa"
          ? `Đã khóa tài khoản ${updated.name} và hủy ca tương lai.`
          : `Đã kích hoạt lại tài khoản ${updated.name}`,
      );
    } catch (err: any) {
      showToast(err.message || "Lỗi khi cập nhật trạng thái tài khoản");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const target = accounts.find((a) => a.id === id);
    if (target && confirm(`Bạn có chắc chắn muốn xóa tài khoản ${target.name}?`)) {
      try {
        await api.accounts.delete(id);
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        if (selectedAccountDetail && selectedAccountDetail.id === id) {
          setSelectedAccountDetail(null);
        }
        showToast(`Đã xóa tài khoản ${target.name}`);
      } catch (err: any) {
        showToast(err.message || "Lỗi khi xóa tài khoản");
      }
    }
  };

  const handleChangeRole = async (id: string, newRole: UserRole) => {
    try {
      const updated = await api.accounts.changeRole(id, newRole);
      setAccounts((prev) => prev.map((acc) => (acc.id === id ? updated : acc)));
      showToast(`Đã đổi vai trò của ${updated.name} thành "${newRole}"`);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi đổi vai trò");
    }
  };

  const handleResetPassword = async (id: string, newPassword: string, requireChangeOnLogin: boolean) => {
    const target = accounts.find((a) => a.id === id);
    if (!target) return;

    try {
      await api.accounts.resetPassword(id, newPassword, requireChangeOnLogin);
      const updatedAcc = await api.accounts.get(id);
      setAccounts((prev) => prev.map((acc) => (acc.id === id ? updatedAcc : acc)));
      if (selectedAccountDetail && selectedAccountDetail.id === id) {
        setSelectedAccountDetail(updatedAcc);
      }
      showToast(`Đã đặt lại mật khẩu cho ${target.name} thành công.`);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi đặt lại mật khẩu");
    }
  };

  const handleSaveAccountNotes = async (id: string, notes: string) => {
    try {
      const updated = await api.accounts.saveNotes(id, notes);
      setAccounts((prev) => prev.map((acc) => (acc.id === id ? updated : acc)));
      if (selectedAccountDetail && selectedAccountDetail.id === id) {
        setSelectedAccountDetail(updated);
      }
      showToast("Đã lưu ghi chú quản trị viên thành công");
    } catch (err: any) {
      showToast(err.message || "Lỗi khi lưu ghi chú");
    }
  };

  const handleEndAccountSchedule = async (
    accountId: string,
    startDate: string,
    endDate: string,
    reason: string,
  ) => {
    const targetAcc = accounts.find((a) => a.id === accountId);
    const accName = targetAcc?.name || "CTV";

    try {
      const updated = await api.accounts.endSchedule(accountId, startDate, endDate, reason);
      setAccounts((prev) => prev.map((acc) => (acc.id === accountId ? updated : acc)));
      if (selectedAccountDetail && selectedAccountDetail.id === accountId) {
        setSelectedAccountDetail(updated);
      }
      const newShifts = await api.schedules.getMyShifts();
      setShifts(newShifts);
      showToast(`Đã kết thúc lịch làm việc của ${accName} từ ${endDate}.`);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi kết thúc lịch làm việc");
    }
  };

  // Request Operations
  const handleApproveRequest = async (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    try {
      await api.registrationRequests.review(id, "APPROVE");
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
      const updatedAccounts = await api.accounts.list();
      setAccounts(updatedAccounts);
      showToast(`Đã phê duyệt hồ sơ của ${req.name} và chuyển sang Danh sách tài khoản`);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi phê duyệt hồ sơ");
    }
  };

  const handleRejectRequest = async (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    try {
      await api.registrationRequests.review(id, "REJECT", "Hồ sơ chưa đạt yêu cầu");
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
      showToast(`Đã từ chối hồ sơ đăng ký của ${req.name}`);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi từ chối hồ sơ");
    }
  };

  // Meeting Operations
  const handleCreateMeeting = (meetingData: {
    title: string;
    dateDisplay: string;
    startTime: string;
    timeRange?: string;
    location: string;
    description: string;
    isOnline: boolean;
    participants?: Participant[];
  }) => {
    const newMeeting: MeetingItem = {
      id: `meet-${Date.now()}`,
      title: meetingData.title,
      dateDisplay: meetingData.dateDisplay,
      dateKey: "2026-08-23",
      dayIndex: 3,
      startTime: meetingData.startTime || "09:00",
      timeRange: meetingData.timeRange || meetingData.startTime,
      location: meetingData.location,
      organizer: currentUser.name,
      status: "Sắp diễn ra",
      statusColor: "info",
      isOnline: meetingData.isOnline,
      description: meetingData.description
        ? [meetingData.description]
        : ["Chưa có mô tả chi tiết."],
      participants:
        meetingData.participants && meetingData.participants.length > 0
          ? meetingData.participants
          : [
              {
                id: "p-user",
                name: currentUser.name,
                role: currentUser.role,
                avatar: currentUser.avatar,
                status: "confirmed",
              },
            ],
    };

    setMeetings([newMeeting, ...meetings]);
    showToast("Đã tạo phiên họp mới thành công!");
  };

  // Profile Save
  const handleSaveProfile = async (updated: Partial<UserAccount>) => {
    try {
      const result = await api.users.updateMyProfile(updated as any);
      setCurrentUser(result);
      showToast("Đã cập nhật thông tin hồ sơ cá nhân.");
    } catch (err: any) {
      showToast(err.message || "Lỗi khi cập nhật hồ sơ");
    }
  };

  const pendingRequestsCount = requests.filter((r) => r.status === "Chờ duyệt").length;
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#faf9fd] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1b365d] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-[#1b365d]">Đang tải hệ thống...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onRequestRegister={async () => {
          showToast("Đã gửi hồ sơ ứng tuyển thành công!");
          const reqs = await api.registrationRequests.list().catch(() => []);
          setRequests(reqs);
        }}
        onForgotPassword={() => alert("Vui lòng sử dụng tính năng quên mật khẩu trên màn hình đăng nhập.")}
      />
    );
  }

  return (
    <div
      className={`h-screen flex overflow-hidden bg-[#faf9fd] text-[#1a1b1e] ${isDarkMode ? "dark" : ""}`}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#002046] text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-[18px] text-[#16A34A]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setIsMobileMenuOpen(false);
        }}
        pendingRequestsCount={pendingRequestsCount}
        onLogout={handleLogout}
        userName={currentUser.name}
        userRole={currentUser.role}
        userAvatar={currentUser.avatar}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        ></div>
      )}

      {/* Mobile Sidebar */}
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
            userName={currentUser.name}
            userRole={currentUser.role}
            userAvatar={currentUser.avatar}
            onOpenSettings={() => {
              setIsSettingsOpen(true);
              setIsMobileMenuOpen(false);
            }}
            isCollapsed={false}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "md:ml-[72px]" : "md:ml-[280px]"
        }`}
      >
        {/* Mobile-Only Bar */}
        <div className="md:hidden p-3 border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#f4f3f7] dark:bg-[#1a1b1e] flex items-center justify-between z-10 shrink-0">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-[#002046] dark:text-[#d6e3ff] hover:bg-[#e3e2e6] rounded-lg flex items-center gap-2 font-semibold text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined">menu</span>
            <span>Danh mục</span>
          </button>

          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 text-[#002046] dark:text-[#d6e3ff] hover:bg-[#e3e2e6] rounded-lg cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadNotifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Notifications Popover */}
        <NotificationsPopover
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          onMarkAllAsRead={async () => {
            await api.notifications.markAllRead().catch(() => {});
            setNotifications(notifications.map((n) => ({ ...n, read: true })));
            showToast("Đã đánh dấu tất cả thông báo là đã đọc");
          }}
          onClearNotifications={async () => {
            await api.notifications.clearAll().catch(() => {});
            setNotifications([]);
            showToast("Đã xóa tất cả thông báo");
          }}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl w-full mx-auto">
            {currentTab === "accounts" && (
              <AccountListScreen
                accounts={accounts}
                onCreateAccount={() => setIsCreateUserOpen(true)}
                onToggleAccountStatus={handleToggleAccountStatus}
                onDeleteAccount={handleDeleteAccount}
                onViewAccountDetail={(acc) => setSelectedAccountDetail(acc)}
                onChangeRole={handleChangeRole}
                onResetPassword={handleResetPassword}
              />
            )}

            {currentTab === "requests" && (
              <RequestsScreen
                requests={requests}
                onApproveRequest={handleApproveRequest}
                onRejectRequest={handleRejectRequest}
                onViewRequestDetail={(req) => setSelectedRequest(req)}
              />
            )}

            {currentTab === "schedule" && (
              <ScheduleScreen
                shifts={shifts}
                accounts={accounts}
                onUpdateShifts={setShifts}
                onShowToast={showToast}
                onViewAccountDetail={(acc) => setSelectedAccountDetail(acc)}
                currentUser={currentUser}
                userRole={currentUser.role}
              />
            )}

            {currentTab === "meetings" && (
              <SummaryScheduleScreen
                shifts={shifts}
                accounts={accounts}
                onViewAccountDetail={(acc) => setSelectedAccountDetail(acc)}
                onShowToast={showToast}
                currentUser={currentUser}
                userRole={currentUser.role}
              />
            )}

            {currentTab === "profile" && (
              <ProfileScreen
                user={currentUser}
                onOpenEditProfile={() => setIsEditProfileOpen(true)}
                onOpenChangePassword={() => setIsChangePasswordOpen(true)}
                onUpdateAvatar={async (newAvatar) => {
                  await handleSaveProfile({ avatar: newAvatar });
                  if (!newAvatar) {
                    showToast("Đã xóa ảnh đại diện");
                  } else {
                    showToast("Đã thay đổi ảnh đại diện thành công");
                  }
                }}
                onUpdateCccdFront={async (url) => {
                  await handleSaveProfile({ cccdFront: url });
                  if (!url) {
                    showToast("Đã xóa ảnh CCCD mặt trước");
                  } else {
                    showToast("Đã thay đổi ảnh CCCD mặt trước thành công");
                  }
                }}
                onUpdateCccdBack={async (url) => {
                  await handleSaveProfile({ cccdBack: url });
                  if (!url) {
                    showToast("Đã xóa ảnh CCCD mặt sau");
                  } else {
                    showToast("Đã thay đổi ảnh CCCD mặt sau thành công");
                  }
                }}
                onUpdateCvFile={async (cvData) => {
                  if (!cvData) {
                    await handleSaveProfile({ cvFile: undefined, cvFileName: undefined, cvFileSize: undefined });
                    showToast("Đã xóa file CV");
                  } else {
                    await handleSaveProfile({
                      cvFile: cvData.cvFile,
                      cvFileName: cvData.cvFileName,
                      cvFileSize: cvData.cvFileSize,
                    });
                    showToast(`Đã cập nhật file CV: ${cvData.cvFileName}`);
                  }
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onSubmit={handleCreateAccount}
      />

      <CreateMeetingModal
        isOpen={isCreateMeetingOpen}
        onClose={() => setIsCreateMeetingOpen(false)}
        onSubmit={handleCreateMeeting}
        accounts={accounts}
      />

      <ViewRequestModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />

      <ViewAccountDetailModal
        account={selectedAccountDetail}
        shifts={shifts}
        onClose={() => setSelectedAccountDetail(null)}
        onToggleStatus={handleToggleAccountStatus}
        onSaveNotes={handleSaveAccountNotes}
        onEndSchedule={handleEndAccountSchedule}
        onResetPassword={handleResetPassword}
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        user={currentUser}
        onClose={() => setIsEditProfileOpen(false)}
        onSave={handleSaveProfile}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={() => showToast("Đổi mật khẩu thành công!")}
      />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default App;
