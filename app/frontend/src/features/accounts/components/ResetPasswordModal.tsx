import React, { useState } from "react";
import { UserAccount } from "../../../types";

const PASSWORD_GROUPS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%",
] as const;

const secureRandomIndex = (maxExclusive: number) => {
  const values = new Uint32Array(1);
  const range = 0x1_0000_0000;
  const limit = range - (range % maxExclusive);
  let value = limit;

  while (value >= limit) {
    crypto.getRandomValues(values);
    value = values[0];
  }

  return value % maxExclusive;
};

const generateRandomPassword = (length = 12) => {
  const allCharacters = PASSWORD_GROUPS.join("");
  const characters = PASSWORD_GROUPS.map(
    (group) => group[secureRandomIndex(group.length)],
  );

  while (characters.length < length) {
    characters.push(allCharacters[secureRandomIndex(allCharacters.length)]);
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
};


interface ResetPasswordModalProps {
  account: UserAccount | null;
  onClose: () => void;
  onConfirmReset: (id: string, newPassword: string, requireChangeOnLogin: boolean) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  account,
  onClose,
  onConfirmReset,
}) => {
  const [password, setPassword] = useState(generateRandomPassword);
  const [copied, setCopied] = useState(false);

  if (!account) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(password);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    onConfirmReset(account.id, password.trim(), true);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e1f23] rounded-2xl border border-[#E2E8F0] dark:border-[#3b3d45] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#F8FAFC] dark:bg-[#25262b]">
          <div className="flex items-center gap-2.5 text-[#1b365d] dark:text-[#87a0cd]">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">lock_reset</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1b365d] dark:text-white leading-tight">
                Đặt lại mật khẩu
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 1. User Target Card */}
          <div className="bg-slate-50 dark:bg-[#25262b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-3">
            {account.avatar ? (
              <img
                src={account.avatar}
                alt={account.name}
                className="w-10 h-10 rounded-full object-cover border border-slate-300 dark:border-slate-600 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1b365d] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {account.initials || account.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 dark:text-white truncate text-sm">
                {account.name}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-xs truncate mt-0.5">
                {account.email}
              </div>
            </div>
          </div>

          {/* 2. Password Generator Field */}
          <div>
            <label
              htmlFor="generated-reset-password"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Mật khẩu mới được tạo tự động <span className="text-red-500">*</span>:
            </label>

            <div className="relative">
              <input
                id="generated-reset-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                autoComplete="new-password"
                spellCheck={false}
                className="w-full text-sm font-mono font-bold tracking-wider pl-3.5 pr-20 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-[#1a1b1e] text-slate-800 dark:text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                required
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generateRandomPassword());
                    setCopied(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded cursor-pointer"
                  title="Tạo mật khẩu khác"
                  aria-label="Tạo mật khẩu khác"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded cursor-pointer"
                  title="Sao chép mật khẩu"
                  aria-label="Sao chép mật khẩu"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {copied ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
            </div>

            {copied && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>Đã sao chép mật khẩu vào bộ nhớ tạm!</span>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
            <button
              type="submit"
              disabled={!password.trim()}
              className="px-6 py-2.5 bg-accent hover:opacity-90 active:opacity-80 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-opacity shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default ResetPasswordModal;
