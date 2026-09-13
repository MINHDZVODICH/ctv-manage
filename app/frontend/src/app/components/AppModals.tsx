import React from 'react';
import type { UserAccount } from '../../shared/types';
import { SettingsModal } from '../../shared/ui';
import { ViewAccountDetailModal, ViewRequestModal } from '../../features/accounts';
import { EditProfileModal, ChangePasswordModal } from '../../features/profile';
import type { UseAccountsAdminResult } from '../../features/accounts';
import type { UseRegistrationRequestsResult } from '../../features/registration';
import type { UseScheduleDashboardResult } from '../../features/schedule';
import type { useProfile } from '../../features/profile';

export interface AppModalsProps {
  accountsAdmin: UseAccountsAdminResult;
  regRequests: UseRegistrationRequestsResult;
  scheduleDash: UseScheduleDashboardResult;
  profileActions: ReturnType<typeof useProfile>;
  currentUser: UserAccount | null;
  isEditProfileOpen: boolean;
  onCloseEditProfile: () => void;
  isChangePasswordOpen: boolean;
  onCloseChangePassword: () => void;
  onChangePasswordSuccess: () => void;
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  accountsAdmin,
  regRequests,
  scheduleDash,
  profileActions,
  currentUser,
  isEditProfileOpen,
  onCloseEditProfile,
  isChangePasswordOpen,
  onCloseChangePassword,
  onChangePasswordSuccess,
  isSettingsOpen,
  onCloseSettings,
}) => {
  return (
    <>
      <ViewRequestModal
        request={regRequests.selectedRequest}
        onClose={regRequests.closeRequestDetail}
        onApprove={regRequests.approveRequest}
        onReject={regRequests.rejectRequest}
      />
      <ViewAccountDetailModal
        account={accountsAdmin.selectedAccountDetail}
        shifts={scheduleDash.shifts}
        onClose={accountsAdmin.closeAccountDetail}
        onToggleStatus={accountsAdmin.toggleAccountStatus}
        onSaveNotes={accountsAdmin.saveAccountNotes}
        onResetPassword={accountsAdmin.resetPassword}
      />
      {currentUser && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          user={currentUser}
          onClose={onCloseEditProfile}
          onSave={profileActions.saveProfile}
        />
      )}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={onCloseChangePassword}
        onSuccess={onChangePasswordSuccess}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={onCloseSettings} />
    </>
  );
};
