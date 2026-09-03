import React, { useState } from 'react';
import * as api from '../../shared/api';

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
      setErrorMsg('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp');
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
        setErrorMsg('Mật khẩu hiện tại không chính xác');
      } else if (msg.includes('Account not found') || msg.includes('NOT_FOUND')) {
        setErrorMsg('Không tìm thấy tài khoản');
      } else if (msg.includes('Validation failed') || msg.includes('VALIDATION_ERROR')) {
        setErrorMsg('Dữ liệu nhập không hợp lệ');
      } else {
        setErrorMsg(msg || 'Đổi mật khẩu thất bại, vui lòng thử lại');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <h3 className="text-lg font-bold text-[#1a1b1e]">Đổi mật khẩu</h3>
          <button
            onClick={onClose}
            className="text-[#74777f] hover:text-[#1a1b1e] p-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-[#ffdad6] text-[#ba1a1a] text-xs font-semibold rounded flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">
              Mật khẩu hiện tại
            </label>
            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-[#c4c6cf] rounded text-sm text-[#1a1b1e] focus:border-accent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#1a1b1e] p-0.5 rounded cursor-pointer transition-colors"
                title={showOldPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showOldPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">
              Mật khẩu mới
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-[#c4c6cf] rounded text-sm text-[#1a1b1e] focus:border-accent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#1a1b1e] p-0.5 rounded cursor-pointer transition-colors"
                title={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showNewPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">
              Xác nhận mật khẩu mới
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-[#c4c6cf] rounded text-sm text-[#1a1b1e] focus:border-accent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#1a1b1e] p-0.5 rounded cursor-pointer transition-colors"
                title={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showConfirmPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-accent hover:opacity-90 disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              {isSubmitting ? "Đang cập nhật..." : "Đổi mật khẩu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
