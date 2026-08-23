import React, { useState } from "react";
import { UserAccount, UserRole } from "../../types";
import { formatPhoneNumber } from "../../utils/formatters";
import { ResetPasswordModal } from "../Modals/ResetPasswordModal";

interface AccountListScreenProps {
  accounts: UserAccount[];
  onCreateAccount?: () => void;
  onToggleAccountStatus: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onViewAccountDetail: (account: UserAccount) => void;
  onChangeRole?: (id: string, newRole: UserRole) => void;
  onResetPassword?: (id: string, newPassword: string, requireChangeOnLogin: boolean) => void;
}

export const AccountListScreen: React.FC<AccountListScreenProps> = ({
  accounts,
  onToggleAccountStatus,
  onDeleteAccount,
  onViewAccountDetail,
  onResetPassword,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Confirm Modals state
  const [accountToToggle, setAccountToToggle] = useState<UserAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<UserAccount | null>(null);
  const [accountToResetPassword, setAccountToResetPassword] = useState<UserAccount | null>(null);

  // Filter out Admin accounts strictly (Only display Cộng tác viên accounts)
  const ctvAccounts = accounts.filter((acc) => acc.role !== "Admin");

  // Filter CTV accounts by search term
  const filteredAccounts = ctvAccounts.filter((acc) => {
    const matchSearch =
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.phone.includes(searchTerm);

    return matchSearch;
  });

  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredAccounts.slice(startIndex, startIndex + itemsPerPage);

  const handleResetFilters = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1b1e] tracking-tight">Danh sách tài khoản</h2>
          <p className="text-sm text-[#44474e] mt-1">
            Tổng số <span className="font-semibold text-[#1a1b1e]">{ctvAccounts.length}</span> tài
            khoản
          </p>
        </div>
      </div>

      {/* Toolbar Section */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search */}
          <div className="md:col-span-10 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#44474e]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm theo họ tên, email, sđt..."
              className="w-full pl-10 pr-4 py-2 h-[40px] border border-[#E2E8F0] rounded text-sm bg-white text-[#1a1b1e] focus:border-[#1b365d] focus:ring-1 focus:ring-[#1b365d] outline-none"
            />
          </div>

          {/* Reset Action */}
          <div className="md:col-span-2 flex items-center justify-end">
            <button
              onClick={handleResetFilters}
              className="text-[#44474e] hover:text-[#1b365d] font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Đặt lại</span>
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-xs flex flex-col">
        <div className="overflow-x-auto overflow-y-hidden h-[395px]">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-[45px]">
                <th className="py-3 px-4 text-xs font-semibold text-[#44474e] uppercase tracking-wider w-16">
                  STT
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-[#44474e] uppercase tracking-wider">
                  Họ và tên
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-[#44474e] uppercase tracking-wider">
                  Số điện thoại
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-[#44474e] uppercase tracking-wider">
                  Ngày đăng ký
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-[#44474e] uppercase tracking-wider text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#74777f] text-sm">
                    Không tìm thấy tài khoản phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                currentItems.map((acc, index) => (
                  <tr
                    key={acc.id}
                    className="hover:bg-[#f4f3f7] transition-colors group cursor-default h-[64px] border-b border-[#E2E8F0]"
                  >
                    <td className="py-3.5 px-4 text-sm text-[#44474e]">{startIndex + index + 1}</td>
                    <td className="py-3.5 px-4">
                      <div
                        onClick={() => onViewAccountDetail(acc)}
                        className="flex items-center gap-3 cursor-pointer group/user inline-flex"
                        title={`Xem hồ sơ chi tiết của ${acc.name}`}
                      >
                        {acc.avatar ? (
                          <img
                            src={acc.avatar}
                            alt={acc.name}
                            className="w-9 h-9 rounded-full object-cover border border-[#E2E8F0] group-hover/user:border-[#1b365d] group-hover/user:scale-105 transition-all"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#aec7f7] text-[#2e476f] flex items-center justify-center font-bold text-xs group-hover/user:scale-105 transition-all">
                            {acc.initials || acc.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-sm text-[#1a1b1e] group-hover/user:text-[#1b365d] group-hover/user:underline transition-colors">
                            {acc.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-sm text-[#44474e] font-medium">
                      {acc.phone ? formatPhoneNumber(acc.phone) : "---"}
                    </td>
                    <td className="py-3.5 px-4 text-sm text-[#44474e]">{acc.registerDate}</td>
                    <td className="py-3.5 px-4 text-right">
                      {acc.role !== "Admin" && (
                        <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setAccountToResetPassword(acc)}
                            className="p-1.5 text-[#44474e] hover:text-[#1b365d] hover:bg-[#d8e2f9] rounded transition-colors cursor-pointer"
                            title="Đặt lại mật khẩu mặc định (Quên MK)"
                          >
                            <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                          </button>
                          <button
                            onClick={() => setAccountToToggle(acc)}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              acc.status === "Kích hoạt"
                                ? "text-[#44474e] hover:text-[#EA580C] hover:bg-[#ffddb9]"
                                : "text-[#44474e] hover:text-[#16A34A] hover:bg-[#c7ecc7]"
                            }`}
                            title={
                              acc.status === "Kích hoạt"
                                ? "Vô hiệu hóa tài khoản"
                                : "Kích hoạt tài khoản"
                            }
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {acc.status === "Kích hoạt" ? "lock" : "lock_open"}
                            </span>
                          </button>
                          <button
                            onClick={() => setAccountToDelete(acc)}
                            className="p-1.5 text-[#44474e] hover:text-[#DC2626] hover:bg-[#ffdad6] rounded transition-colors cursor-pointer"
                            title="Xóa tài khoản"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-end p-4 border-t border-[#E2E8F0] bg-white h-[61px]">
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded border border-[#E2E8F0] text-[#44474e] hover:bg-[#f4f3f7] transition-colors disabled:opacity-40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 flex items-center justify-center rounded text-xs font-semibold transition-colors cursor-pointer ${
                  currentPage === pageNum
                    ? "bg-accent text-white"
                    : "border border-[#E2E8F0] dark:border-slate-700 text-[#44474e] dark:text-slate-200 hover:bg-[#f4f3f7] dark:hover:bg-slate-800"
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="w-8 h-8 flex items-center justify-center rounded border border-[#E2E8F0] text-[#44474e] hover:bg-[#f4f3f7] transition-colors disabled:opacity-40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* UC 1.6 Modal: Confirm Activate / Disable */}
      {accountToToggle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#ffddb9] text-[#EA580C] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-[#1a1b1e]">
                {accountToToggle.status === "Kích hoạt"
                  ? "Vô hiệu hóa tài khoản?"
                  : "Kích hoạt tài khoản?"}
              </h3>
              <p className="text-xs text-[#44474e] mt-2">
                Họ và tên:{" "}
                <span className="font-semibold text-[#1a1b1e]">{accountToToggle.name}</span>
                <br />
                Email: <span className="font-semibold text-[#1a1b1e]">{accountToToggle.email}</span>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                onClick={() => setAccountToToggle(null)}
                className="px-4 py-2 text-xs font-semibold text-[#44474e] hover:bg-gray-100 rounded transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  onToggleAccountStatus(accountToToggle.id);
                  setAccountToToggle(null);
                }}
                className={`px-4 py-2 text-xs font-semibold text-white rounded transition-colors cursor-pointer ${
                  accountToToggle.status === "Kích hoạt"
                    ? "bg-[#EA580C] hover:bg-[#c2410c]"
                    : "bg-[#16A34A] hover:bg-[#15803d]"
                }`}
              >
                {accountToToggle.status === "Kích hoạt" ? "Vô hiệu hóa" : "Kích hoạt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UC 1.7 Modal: Confirm Delete */}
      {accountToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#DC2626] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">error</span>
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-[#1a1b1e]">Xóa tài khoản?</h3>
              <p className="text-xs text-[#DC2626] font-semibold mt-1">
                Thao tác này không thể hoàn tác
              </p>
              <p className="text-xs text-[#44474e] mt-2">
                Họ và tên:{" "}
                <span className="font-semibold text-[#1a1b1e]">{accountToDelete.name}</span>
                <br />
                Email: <span className="font-semibold text-[#1a1b1e]">{accountToDelete.email}</span>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                onClick={() => setAccountToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-[#44474e] hover:bg-gray-100 rounded transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  onDeleteAccount(accountToDelete.id);
                  setAccountToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#b91c1c] rounded transition-colors cursor-pointer"
              >
                Xóa tài khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {accountToResetPassword && (
        <ResetPasswordModal
          account={accountToResetPassword}
          onClose={() => setAccountToResetPassword(null)}
          onConfirmReset={(id, newPassword, requireChange) => {
            if (onResetPassword) {
              onResetPassword(id, newPassword, requireChange);
            }
          }}
        />
      )}
    </div>
  );
};
