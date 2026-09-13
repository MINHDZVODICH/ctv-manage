import React from 'react';
import type { UserAccount, ViewTab } from '../../shared/types';
import { AccountListScreen, RequestsScreen } from '../../features/accounts';
import { ScheduleScreen, SummaryScheduleScreen } from '../../features/schedule';
import { ProfileScreen } from '../../features/profile';
import type { UseAccountsAdminResult } from '../../features/accounts';
import type { UseRegistrationRequestsResult } from '../../features/registration';
import type { UseScheduleDashboardResult } from '../../features/schedule';

export interface AppContentProps {
  currentTab: ViewTab;
  accountsAdmin: UseAccountsAdminResult;
  regRequests: UseRegistrationRequestsResult;
  scheduleDash: UseScheduleDashboardResult;
  effectiveUser: UserAccount;
  currentUser: UserAccount | null;
  showToast: (msg: string) => void;
  onOpenEditProfile: () => void;
  onOpenChangePassword: () => void;
  onUpdateAvatar: (newAvatarUrl: string) => void | Promise<unknown>;
  onUpdateCccdFront: (url: string) => Promise<unknown>;
  onUpdateCccdBack: (url: string) => Promise<unknown>;
  onUpdateCvFile: (
    cvData: { cvFile: string; cvFileName: string; cvFileSize?: string } | null,
  ) => void | Promise<unknown>;
}

export const AppContent: React.FC<AppContentProps> = ({
  currentTab,
  accountsAdmin,
  regRequests,
  scheduleDash,
  effectiveUser,
  currentUser,
  showToast,
  onOpenEditProfile,
  onOpenChangePassword,
  onUpdateAvatar,
  onUpdateCccdFront,
  onUpdateCccdBack,
  onUpdateCvFile,
}) => {
  return (
    <div className="max-w-7xl w-full mx-auto">
      {currentTab === 'accounts' && (
        <AccountListScreen
          accounts={accountsAdmin.accounts}
          total={accountsAdmin.accountQuery.total}
          page={accountsAdmin.accountQuery.page}
          pageSize={accountsAdmin.accountQuery.pageSize}
          searchTerm={accountsAdmin.accountSearchInput}
          loading={accountsAdmin.accountQuery.loading}
          error={accountsAdmin.accountQuery.error}
          onSearchChange={accountsAdmin.setAccountSearchInput}
          onPageChange={accountsAdmin.setPage}
          onResetFilters={accountsAdmin.resetFilters}
          onToggleAccountStatus={accountsAdmin.toggleAccountStatus}
          onDeleteAccount={accountsAdmin.deleteAccount}
          onViewAccountDetail={accountsAdmin.openAccountDetail}
          onResetPassword={accountsAdmin.resetPassword}
        />
      )}
      {currentTab === 'requests' && (
        <RequestsScreen
          requests={regRequests.requests}
          total={regRequests.requestQuery.total}
          page={regRequests.requestQuery.page}
          pageSize={regRequests.requestQuery.pageSize}
          searchTerm={regRequests.requestSearchInput}
          loading={regRequests.requestQuery.loading}
          error={regRequests.requestQuery.error}
          onSearchChange={regRequests.setRequestSearchInput}
          onPageChange={regRequests.setPage}
          onResetFilters={regRequests.resetFilters}
          onApproveRequest={regRequests.approveRequest}
          onRejectRequest={regRequests.rejectRequest}
          onViewRequestDetail={regRequests.openRequestDetail}
        />
      )}
      {currentTab === 'schedule' && (
        <ScheduleScreen
          shifts={scheduleDash.shifts}
          accounts={accountsAdmin.accounts}
          onUpdateShifts={scheduleDash.setShifts}
          onShowToast={showToast}
          onReload={scheduleDash.loadShifts}
          onViewAccountDetail={accountsAdmin.openAccountDetail}
          currentUser={effectiveUser}
          userRole={effectiveUser.role}
        />
      )}
      {currentTab === 'meetings' && (
        <SummaryScheduleScreen
          shifts={scheduleDash.shifts}
          onViewAccountDetail={accountsAdmin.openAccountDetailById}
          onShowToast={showToast}
          currentUser={currentUser ?? undefined}
          userRole={effectiveUser.role}
        />
      )}
      {currentTab === 'profile' && currentUser && (
        <ProfileScreen
          user={currentUser}
          onOpenEditProfile={onOpenEditProfile}
          onOpenChangePassword={onOpenChangePassword}
          onUpdateAvatar={onUpdateAvatar}
          onUpdateCccdFront={onUpdateCccdFront}
          onUpdateCccdBack={onUpdateCccdBack}
          onUpdateCvFile={onUpdateCvFile}
        />
      )}
    </div>
  );
};
