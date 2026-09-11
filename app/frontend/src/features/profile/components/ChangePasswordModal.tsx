import React, { useState } from 'react';
import * as api from '../../../shared/api';
import { useSystemSettings } from '../../../shared/context/SystemSettingsContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { t } = useSystemSettings();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      setErrorMsg(t("profile.enter_current_password"));
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg(t("profile.password_hint"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t("profile.password_mismatch"));
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await api.apiPost('/api/v1/users/me/password-changes', { currentPassword: oldPassword, newPassword });
      onSuccess();
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      onClose();
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Current password is incorrect') || msg.includes('INVALID_PASSWORD') || msg.includes('không chính xác')) {
        setErrorMsg(t("profile.current_password_incorrect"));
      } else if (msg.includes('Account not found') || msg.includes('NOT_FOUND')) {
        setErrorMsg(t("profile.account_not_found"));
      } else if (msg.includes('Validation failed') || msg.includes('VALIDATION_ERROR')) {
        setErrorMsg(t("profile.invalid_input"));
      } else {
        setErrorMsg(msg || t("profile.password_change_failed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e1f23] rounded-xl border border-[#E2E8F0] dark:border-[#3b3d45] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#F8FAFC] dark:bg-[#18191c]">
          <h3 className="text-lg font-bold text-[#1a1b1e] dark:text-slate-100">{t('change_password')}</h3>
          <button
            onClick={onClose}
            className="text-[#74777f] hover:text-[#1a1b1e] dark:text-slate-400 dark:hover:text-white p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-[#ffdad6] text-[#ba1a1a] dark:bg-rose-950/60 dark:text-rose-200 text-xs font-semibold rounded flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 mb-1">
              {t('current_password')}
            </label>
            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-[#c4c6cf] dark:border-slate-700 rounded text-sm text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-accent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#1a1b1e] dark:text-slate-400 dark:hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                title={showOldPassword ? t('hide_password') : t('show_password')}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showOldPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 mb-1">
              {t('new_password')}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-[#c4c6cf] dark:border-slate-700 rounded text-sm text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-accent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#1a1b1e] dark:text-slate-400 dark:hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                title={showNewPassword ? t('hide_password') : t('show_password')}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showNewPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 mb-1">
              {t('confirm_new_password')}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-[#c4c6cf] dark:border-slate-700 rounded text-sm text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-accent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#1a1b1e] dark:text-slate-400 dark:hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                title={showConfirmPassword ? t('hide_password') : t('show_password')}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showConfirmPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#3b3d45] flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-accent hover:opacity-90 disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              {isSubmitting ? t('updating') : t('change_password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
