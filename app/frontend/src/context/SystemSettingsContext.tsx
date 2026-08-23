import React, { createContext, useContext, useState, useEffect } from "react";
import { ContrastOption, AccentColorOption, LanguageOption } from "../types";

export interface SystemSettingsContextType {
  isDarkMode: boolean;
  contrast: ContrastOption;
  accentColor: AccentColorOption;
  language: LanguageOption;
  toggleDarkMode: () => void;
  setContrast: (contrast: ContrastOption) => void;
  setAccentColor: (color: AccentColorOption) => void;
  setLanguage: (lang: LanguageOption) => void;
  t: (key: string) => string;
}

const accentMap: Record<
  AccentColorOption,
  { primary: string; hover: string; light: string; text: string }
> = {
  Trắng: { primary: "#475569", hover: "#334155", light: "#f1f5f9", text: "#ffffff" },
  Lục: { primary: "#10b981", hover: "#059669", light: "#ecfdf5", text: "#ffffff" },
  Lam: { primary: "#2563eb", hover: "#1d4ed8", light: "#eff6ff", text: "#ffffff" },
  Vàng: { primary: "#d97706", hover: "#b45309", light: "#fffbeb", text: "#ffffff" },
  Đỏ: { primary: "#dc2626", hover: "#b91c1c", light: "#fef2f2", text: "#ffffff" },
  Cam: { primary: "#ea580c", hover: "#c2410c", light: "#fff7ed", text: "#ffffff" },
  Tím: { primary: "#9333ea", hover: "#7e22ce", light: "#faf5ff", text: "#ffffff" },
};

const translations: Record<LanguageOption, Record<string, string>> = {
  "Tiếng Việt": {
    system_name: "Hệ thống Quản lý CTV",
    admin_view: "Giao diện Quản trị viên",
    ctv_view: "Giao diện Cộng tác viên",
    nav_accounts: "Quản lý tài khoản",
    nav_requests: "Yêu cầu đăng ký",
    nav_schedule: "Lịch làm việc",
    nav_my_schedule: "Lịch làm việc",
    nav_meetings: "Lịch làm việc tổng hợp",
    nav_my_meetings: "Lịch làm việc tổng hợp",
    nav_summary: "Lịch làm việc tổng hợp",
    nav_profile: "Hồ sơ cá nhân",
    nav_settings: "Cài đặt hệ thống",
    switch_to_ctv: "Đổi sang Cộng tác viên",
    switch_to_admin: "Đổi sang Admin",
    logout: "Đăng xuất",
    close: "Đóng",
    done: "Hoàn tất",
    edit: "Chỉnh sửa",
    delete: "Xóa",
    change: "Thay đổi",
    save: "Lưu thay đổi",
    add_account: "Thêm tài khoản",
    create_meeting: "Tạo phiên họp",
    search_placeholder: "Tìm kiếm thông tin...",
    theme_setting: "Giao diện",
    contrast_setting: "Độ tương phản",
    accent_setting: "Màu điểm nhấn",
    language_setting: "Ngôn ngữ",
    light_mode: "Sáng",
    dark_mode: "Tối",
    low_contrast: "Thấp",
    medium_contrast: "Trung bình",
    high_contrast: "Cao",
    account_info: "Thông tin tài khoản",
    change_password: "Đổi mật khẩu",
    edit_info: "Chỉnh sửa thông tin",
    personal_info: "Thông tin cá nhân",
    account_details: "Thông tin chi tiết",
  },
  "Tiếng Anh": {
    system_name: "Contributor Mgmt",
    admin_view: "Administrator View",
    ctv_view: "Contributor View",
    nav_accounts: "Account List",
    nav_requests: "Registration Requests",
    nav_schedule: "Shift Registration",
    nav_my_schedule: "Shift Registration",
    nav_meetings: "Combined Work Schedule",
    nav_my_meetings: "Combined Work Schedule",
    nav_summary: "Combined Work Schedule",
    nav_profile: "Personal Profile",
    nav_settings: "System Settings",
    switch_to_ctv: "Switch to Contributor",
    switch_to_admin: "Switch to Admin",
    logout: "Logout",
    close: "Close",
    done: "Done",
    edit: "Edit",
    delete: "Delete",
    change: "Change",
    save: "Save changes",
    add_account: "Add Account",
    create_meeting: "New Meeting",
    search_placeholder: "Search keywords...",
    theme_setting: "Theme",
    contrast_setting: "Contrast",
    accent_setting: "Accent Color",
    language_setting: "Language",
    light_mode: "Light",
    dark_mode: "Dark",
    low_contrast: "Low",
    medium_contrast: "Medium",
    high_contrast: "High",
    account_info: "Account Information",
    change_password: "Change Password",
    edit_info: "Edit Information",
    personal_info: "Personal Information",
    account_details: "Account Details",
  },
};

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [contrast, setContrast] = useState<ContrastOption>("Trung bình");
  const [accentColor, setAccentColor] = useState<AccentColorOption>("Lam");
  const [language, setLanguage] = useState<LanguageOption>("Tiếng Việt");

  // Apply dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Apply contrast attribute
  useEffect(() => {
    const contrastVal = contrast === "Cao" ? "high" : contrast === "Thấp" ? "low" : "medium";
    document.documentElement.setAttribute("data-contrast", contrastVal);
  }, [contrast]);

  // Apply accent color CSS variables
  useEffect(() => {
    const config = accentMap[accentColor] || accentMap["Lam"];
    document.documentElement.style.setProperty("--accent-primary", config.primary);
    document.documentElement.style.setProperty("--accent-hover", config.hover);
    document.documentElement.style.setProperty("--accent-light", config.light);
    document.documentElement.style.setProperty("--accent-text", config.text);
  }, [accentColor]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  const t = (key: string): string => {
    return translations[language]?.[key] || translations["Tiếng Việt"]?.[key] || key;
  };

  return (
    <SystemSettingsContext.Provider
      value={{
        isDarkMode,
        contrast,
        accentColor,
        language,
        toggleDarkMode,
        setContrast,
        setAccentColor,
        setLanguage,
        t,
      }}
    >
      {children}
    </SystemSettingsContext.Provider>
  );
};

export const useSystemSettings = () => {
  const context = useContext(SystemSettingsContext);
  if (!context) {
    throw new Error("useSystemSettings must be used within a SystemSettingsProvider");
  }
  return context;
};
