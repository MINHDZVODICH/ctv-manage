import React, { useEffect, useState } from 'react';
import type { UserAccount } from '../../../shared/types';
import { onlyDigits } from '../../../shared/utils/formatters';
import { useSystemSettings } from '../../../shared/context/SystemSettingsContext';

interface EditProfileModalProps {
  isOpen: boolean;
  user: UserAccount;
  onClose: () => void;
  onSave: (updatedData: Partial<UserAccount>) => void;
}

const normalizeGenderValue = (val?: string) => {
  if (!val) return '';
  if (val === 'MALE' || val === 'Nam') return 'Nam';
  if (val === 'FEMALE' || val === 'Nữ') return 'Nữ';
  if (val === 'OTHER' || val === 'Khác') return 'Khác';
  return val;
};

const parseDobToParts = (rawDob?: string) => {
  if (!rawDob || !rawDob.trim()) {
    return { day: '', month: '', year: '' };
  }
  const str = rawDob.trim();
  const vnMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (vnMatch) {
    return {
      day: vnMatch[1].padStart(2, '0'),
      month: vnMatch[2].padStart(2, '0'),
      year: vnMatch[3],
    };
  }
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoMatch) {
    return {
      day: isoMatch[3].padStart(2, '0'),
      month: isoMatch[2].padStart(2, '0'),
      year: isoMatch[1],
    };
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return {
      day: String(d.getUTCDate()).padStart(2, '0'),
      month: String(d.getUTCMonth() + 1).padStart(2, '0'),
      year: String(d.getUTCFullYear()),
    };
  }
  return { day: '', month: '', year: '' };
};

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  user,
  onClose,
  onSave,
}) => {
  const { t } = useSystemSettings();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);

  const initialDobParts = parseDobToParts(user.dob);
  const [dobDay, setDobDay] = useState(initialDobParts.day);
  const [dobMonth, setDobMonth] = useState(initialDobParts.month);
  const [dobYear, setDobYear] = useState(initialDobParts.year);

  const [gender, setGender] = useState(normalizeGenderValue(user.gender));
  const [address, setAddress] = useState(user.address || '');
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name);
      setNameError(null);
      setPhone(user.phone || '');
      const parts = parseDobToParts(user.dob);
      setDobDay(parts.day);
      setDobMonth(parts.month);
      setDobYear(parts.year);
      setGender(normalizeGenderValue(user.gender));
      setAddress(user.address || '');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const maxDaysInMonth = new Date(
    parseInt(dobYear || '2000', 10),
    parseInt(dobMonth || '1', 10),
    0,
  ).getDate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('profile.error_name_required');
      return;
    }
    if (name.trim().length > 100) {
      setNameError('profile.error_name_max_length');
      return;
    }
    setNameError(null);
    const dob = dobDay && dobMonth && dobYear ? `${dobDay}/${dobMonth}/${dobYear}` : '';
    onSave({
      name: name.trim(),
      phone,
      dob,
      gender,
      address,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#1e1f23] rounded-2xl border border-[#E2E8F0] dark:border-[#3b3d45] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#F8FAFC] dark:bg-[#18191c] shrink-0">
          <h3 className="text-base font-bold text-[#1a1b1e] dark:text-slate-100">
            {t('profile.edit_title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#74777f] hover:text-[#1a1b1e] dark:text-slate-400 dark:hover:text-white p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0"
        >
          <div>
            <label className="block text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 mb-1">
              {t('full_name')} <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              className={`w-full px-3 py-2 border rounded-lg text-sm text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#002046] dark:focus:border-blue-400 outline-none ${
                nameError
                  ? 'border-[#DC2626]'
                  : 'border-[#c4c6cf] dark:border-slate-700'
              }`}
            />
            {nameError && (
              <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                {t(nameError)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-profile-phone"
                className="block text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 mb-1"
              >
                {t('phone_number')}
              </label>
              <input
                id="edit-profile-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                minLength={6}
                pattern="[0-9]{6,15}"
                title={t('profile.phone_hint')}
                value={phone}
                onChange={(e) => setPhone(onlyDigits(e.target.value, 15))}
                className="w-full px-3 py-2 border border-[#c4c6cf] dark:border-slate-700 rounded-lg text-sm text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#002046] dark:focus:border-blue-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 mb-1">
                {t('date_of_birth')}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {/* Ngày */}
                <div className="relative">
                  <select
                    value={dobDay}
                    onChange={(e) => setDobDay(e.target.value)}
                    title={t('profile.day')}
                    className="w-full h-[38px] pl-2 pr-5 border border-[#c4c6cf] dark:border-slate-700 rounded-lg text-xs font-medium text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#002046] dark:focus:border-blue-400 outline-none cursor-pointer appearance-none text-center"
                  >
                    <option value="">--</option>
                    {Array.from({ length: maxDaysInMonth }, (_, i) => {
                      const d = String(i + 1).padStart(2, '0');
                      return (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      );
                    })}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                    expand_more
                  </span>
                </div>

                {/* Tháng */}
                <div className="relative">
                  <select
                    value={dobMonth}
                    onChange={(e) => {
                      const m = e.target.value;
                      setDobMonth(m);
                      const maxDays = new Date(
                        parseInt(dobYear || '2000', 10),
                        parseInt(m, 10),
                        0,
                      ).getDate();
                      if (parseInt(dobDay, 10) > maxDays) {
                        setDobDay(String(maxDays).padStart(2, '0'));
                      }
                    }}
                    title={t('profile.month')}
                    className="w-full h-[38px] pl-2 pr-5 border border-[#c4c6cf] dark:border-slate-700 rounded-lg text-xs font-medium text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#002046] dark:focus:border-blue-400 outline-none cursor-pointer appearance-none text-center"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, '0');
                      return (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      );
                    })}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                    expand_more
                  </span>
                </div>

                {/* Năm */}
                <div className="relative">
                  <select
                    value={dobYear}
                    onChange={(e) => {
                      const y = e.target.value;
                      setDobYear(y);
                      const maxDays = new Date(
                        parseInt(y, 10),
                        parseInt(dobMonth || '1', 10),
                        0,
                      ).getDate();
                      if (parseInt(dobDay, 10) > maxDays) {
                        setDobDay(String(maxDays).padStart(2, '0'));
                      }
                    }}
                    title={t('profile.year')}
                    className="w-full h-[38px] pl-2 pr-5 border border-[#c4c6cf] dark:border-slate-700 rounded-lg text-xs font-medium text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#002046] dark:focus:border-blue-400 outline-none cursor-pointer appearance-none text-center"
                  >
                    <option value="">--</option>
                    {Array.from({ length: new Date().getFullYear() - 1939 }, (_, i) => {
                      const y = String(1940 + i);
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    }).reverse()}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                    expand_more
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 mb-1">
                {t('gender')}
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-[#c4c6cf] dark:border-slate-700 rounded-lg text-sm text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#002046] dark:focus:border-blue-400 outline-none"
              >
                <option value="">{t('not_updated')}</option>
                <option value="Nam">{t('gender_male')}</option>
                <option value="Nữ">{t('gender_female')}</option>
                <option value="Khác">{t('gender_other')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 mb-1">
                {t('address')}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('profile.address_placeholder')}
                className="w-full px-3 py-2 border border-[#c4c6cf] dark:border-slate-700 rounded-lg text-sm text-[#1a1b1e] dark:text-slate-100 bg-white dark:bg-slate-800 focus:border-[#002046] dark:focus:border-blue-400 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#3b3d45] flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-accent hover:opacity-90 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
