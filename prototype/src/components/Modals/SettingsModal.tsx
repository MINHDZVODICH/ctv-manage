import React, { useState } from 'react';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import { ContrastOption, AccentColorOption, LanguageOption } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const accentColorMap: Record<AccentColorOption, { name: string; hex: string; bgClass: string }> = {
  'Trắng': { name: 'Trắng', hex: '#ffffff', bgClass: 'bg-slate-100 border border-slate-300 dark:bg-white' },
  'Lục': { name: 'Lục', hex: '#10b981', bgClass: 'bg-emerald-500' },
  'Lam': { name: 'Lam', hex: '#2563eb', bgClass: 'bg-blue-600' },
  'Vàng': { name: 'Vàng', hex: '#eab308', bgClass: 'bg-amber-400' },
  'Đỏ': { name: 'Đỏ', hex: '#ef4444', bgClass: 'bg-red-500' },
  'Cam': { name: 'Cam', hex: '#f97316', bgClass: 'bg-orange-500' },
  'Tím': { name: 'Tím', hex: '#a855f7', bgClass: 'bg-purple-500' },
};

interface DropdownItem<T> {
  label: string;
  value: T;
  icon?: string;
  colorBgClass?: string;
}

function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  isDarkMode = false,
}: {
  value: T;
  options: DropdownItem<T>[];
  onChange: (val: T) => void;
  isDarkMode?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 pl-3 pr-2.5 py-1.5 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
          isDarkMode
            ? 'bg-[#28292d] hover:bg-[#323338] text-slate-100 border-slate-700/60'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300/80'
        }`}
      >
        {selectedOption?.colorBgClass && (
          <span className={`w-3 h-3 rounded-full ${selectedOption.colorBgClass} inline-block shrink-0`} />
        )}
        <span>{selectedOption?.label || value}</span>
        <span className={`material-symbols-outlined text-[18px] ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          expand_more
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div
            className={`absolute right-0 top-full mt-1.5 z-40 border rounded-xl shadow-2xl p-1.5 min-w-[150px] text-left animate-in fade-in zoom-in-95 duration-100 ${
              isDarkMode
                ? 'bg-[#25262a] border-slate-700/80 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800 shadow-xl'
            }`}
          >
            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-between gap-3 transition-colors cursor-pointer text-left ${
                    isSelected
                      ? isDarkMode
                        ? 'bg-blue-600/20 text-blue-400 font-semibold'
                        : 'bg-blue-50 text-blue-600 font-semibold'
                      : isDarkMode
                      ? 'text-slate-200 hover:bg-slate-700/60'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 text-left justify-start">
                    {opt.colorBgClass && (
                      <span className={`w-3 h-3 rounded-full ${opt.colorBgClass} inline-block shrink-0`} />
                    )}
                    <span className="text-left font-medium">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400 shrink-0">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    isDarkMode,
    contrast,
    accentColor,
    language,
    toggleDarkMode,
    setContrast,
    setAccentColor,
    setLanguage,
    t,
  } = useSystemSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div
        className={`rounded-2xl border shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
          isDarkMode
            ? 'bg-[#1e1e20] text-white border-slate-800'
            : 'bg-white text-slate-800 border-slate-200'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDarkMode
              ? 'border-slate-800/80 bg-[#18181a]'
              : 'border-slate-200 bg-slate-50/80'
          }`}
        >
          <h3
            className={`text-base font-bold flex items-center gap-2 ${
              isDarkMode ? 'text-slate-100' : 'text-slate-800'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              settings
            </span>
            {t('nav_settings')}
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded-full transition-colors cursor-pointer ${
              isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content list */}
        <div
          className={`p-2 sm:p-4 divide-y ${
            isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'
          }`}
        >
          {/* Row 1: Giao diện */}
          <div
            className={`flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors ${
              isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
            }`}
          >
            <span
              className={`text-sm font-medium ${
                isDarkMode ? 'text-slate-200' : 'text-slate-700'
              }`}
            >
              {t('theme_setting')}
            </span>
            <CustomSelect<'Sáng' | 'Tối'>
              isDarkMode={isDarkMode}
              value={isDarkMode ? 'Tối' : 'Sáng'}
              options={[
                { label: t('light_mode'), value: 'Sáng' },
                { label: t('dark_mode'), value: 'Tối' },
              ]}
              onChange={(val) => {
                if ((val === 'Tối' && !isDarkMode) || (val === 'Sáng' && isDarkMode)) {
                  toggleDarkMode();
                }
              }}
            />
          </div>

          {/* Row 2: Độ tương phản */}
          <div
            className={`flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors ${
              isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
            }`}
          >
            <span
              className={`text-sm font-medium ${
                isDarkMode ? 'text-slate-200' : 'text-slate-700'
              }`}
            >
              {t('contrast_setting')}
            </span>
            <CustomSelect<ContrastOption>
              isDarkMode={isDarkMode}
              value={contrast}
              options={[
                { label: t('low_contrast'), value: 'Thấp' },
                { label: t('medium_contrast'), value: 'Trung bình' },
                { label: t('high_contrast'), value: 'Cao' },
              ]}
              onChange={setContrast}
            />
          </div>

          {/* Row 3: Màu điểm nhấn */}
          <div
            className={`flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors ${
              isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
            }`}
          >
            <span
              className={`text-sm font-medium ${
                isDarkMode ? 'text-slate-200' : 'text-slate-700'
              }`}
            >
              {t('accent_setting')}
            </span>
            <CustomSelect<AccentColorOption>
              isDarkMode={isDarkMode}
              value={accentColor}
              options={(Object.keys(accentColorMap) as AccentColorOption[]).map((key) => ({
                label: key,
                value: key,
                colorBgClass: accentColorMap[key].bgClass,
              }))}
              onChange={setAccentColor}
            />
          </div>

          {/* Row 4: Ngôn ngữ */}
          <div
            className={`flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors ${
              isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
            }`}
          >
            <span
              className={`text-sm font-medium ${
                isDarkMode ? 'text-slate-200' : 'text-slate-700'
              }`}
            >
              {t('language_setting')}
            </span>
            <CustomSelect<LanguageOption>
              isDarkMode={isDarkMode}
              value={language}
              options={[
                { label: 'Tiếng Việt', value: 'Tiếng Việt' },
                { label: 'Tiếng Anh', value: 'Tiếng Anh' },
              ]}
              onChange={setLanguage}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className={`p-4 border-t flex items-center justify-end ${
            isDarkMode
              ? 'bg-[#18181a] border-slate-800/80'
              : 'bg-slate-50/80 border-slate-200'
          }`}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 bg-accent hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
