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

const STORAGE_KEY_DARK_MODE = "ctv_sys_dark_mode";
const STORAGE_KEY_CONTRAST = "ctv_sys_contrast";
const STORAGE_KEY_ACCENT = "ctv_sys_accent";
const STORAGE_KEY_LANGUAGE = "ctv_sys_language";

const accentMap: Record<
  AccentColorOption,
  { primary: string; hover: string; light: string; text: string }
> = {
  Xám: { primary: "#64748b", hover: "#475569", light: "#f1f5f9", text: "#ffffff" },
  Lục: { primary: "#10b981", hover: "#059669", light: "#ecfdf5", text: "#ffffff" },
  Lam: { primary: "#2563eb", hover: "#1d4ed8", light: "#eff6ff", text: "#ffffff" },
  Vàng: { primary: "#d97706", hover: "#b45309", light: "#fffbeb", text: "#ffffff" },
  Đỏ: { primary: "#dc2626", hover: "#b91c1c", light: "#fef2f2", text: "#ffffff" },
  Cam: { primary: "#ea580c", hover: "#c2410c", light: "#fff7ed", text: "#ffffff" },
  Tím: { primary: "#9333ea", hover: "#7e22ce", light: "#faf5ff", text: "#ffffff" },
};

const translations: Record<LanguageOption, Record<string, string>> = {
  "Tiếng Việt": {
    // Navigation & System
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

    // Common Actions & Buttons
    close: "Đóng",
    done: "Hoàn tất",
    edit: "Chỉnh sửa",
    delete: "Xóa",
    change: "Thay đổi",
    save: "Lưu thay đổi",
    save_btn: "Lưu",
    cancel: "Hủy",
    add: "Thêm",
    add_account: "Thêm tài khoản",
    create_account: "Tạo tài khoản mới",
    create_meeting: "Tạo phiên họp",
    search: "Tìm kiếm",
    search_placeholder: "Tìm kiếm thông tin...",
    filter: "Bộ lọc",
    all: "Tất cả",
    all_roles: "Tất cả vai trò",
    all_status: "Tất cả trạng thái",
    confirm: "Xác nhận",
    refresh: "Làm mới",
    back: "Quay lại",
    view_details: "Xem chi tiết",
    upload_photo: "Tải ảnh lên",
    approve: "Phê duyệt",
    reject: "Từ chối",
    export_excel: "Xuất Excel",
    actions: "Thao tác",

    // Settings
    theme_setting: "Giao diện",
    contrast_setting: "Độ tương phản",
    accent_setting: "Màu điểm nhấn",
    language_setting: "Ngôn ngữ",
    light_mode: "Sáng",
    dark_mode: "Tối",
    low_contrast: "Thấp",
    medium_contrast: "Trung bình",
    high_contrast: "Cao",

    // Roles & Statuses
    role_admin: "Quản trị viên",
    role_ctv: "Cộng tác viên",
    status_active: "Kích hoạt",
    status_inactive: "Vô hiệu hóa",
    status_pending: "Chờ duyệt",
    status_approved: "Đã duyệt",
    status_rejected: "Đã từ chối",
    role: "Vai trò",
    status: "Trạng thái",

    // Profile & Info
    account_info: "Thông tin tài khoản",
    change_password: "Đổi mật khẩu",
    edit_info: "Chỉnh sửa thông tin",
    personal_info: "Thông tin cá nhân",
    account_details: "Thông tin chi tiết",
    full_name: "Họ và tên",
    date_of_birth: "Ngày sinh",
    dob: "Ngày sinh",
    email: "Email",
    phone_number: "Số điện thoại",
    phone: "Số điện thoại",
    gender: "Giới tính",
    gender_male: "Nam",
    gender_female: "Nữ",
    gender_other: "Khác",
    address: "Địa chỉ",
    not_updated: "Chưa cập nhật",
    registration_date: "Ngày đăng ký",
    join_date: "Ngày gia nhập",
    cv_title: "Hồ sơ ứng tuyển (CV)",
    cccd_title: "Ảnh chụp CCCD (Mặt trước & Mặt sau)",
    cccd_front: "CCCD Mặt trước",
    cccd_back: "CCCD Mặt sau",
    front_side: "Mặt trước",
    back_side: "Mặt sau",
    avatar: "Ảnh đại diện",
    assigned_room: "Buồng làm việc được chỉ định",
    skills_expertise: "Kỹ năng & Chuyên môn",
    activity_history: "Lịch sử hoạt động",
    shifts_completed: "Số ca hoàn thành",
    avg_rating: "Đánh giá trung bình",

    // Password Change
    current_password: "Mật khẩu hiện tại",
    new_password: "Mật khẩu mới",
    confirm_new_password: "Xác nhận mật khẩu mới",
    show_password: "Hiện mật khẩu",
    hide_password: "Ẩn mật khẩu",
    updating: "Đang cập nhật...",

    // Summary Schedule & Calendar
    summary_schedule_title: "Lịch làm việc tổng hợp",
    today_ctv_list: "Danh sách CTV đăng ký hôm nay",
    no_ctv_today: "Chưa có CTV nào đăng ký hôm nay",
    total_label: "Tổng số:",
    ctv_unit: "Cộng tác viên",
    tab_weekly_summary: "Lịch tuần tổng hợp",
    tab_history_summary: "Lịch sử tổng hợp",
    morning_shift: "Ca Sáng",
    afternoon_shift: "Ca Chiều",
    mon: "Thứ 2",
    tue: "Thứ 3",
    wed: "Thứ 4",
    thu: "Thứ 5",
    fri: "Thứ 6",
    sat: "Thứ 7",
    sun: "Chủ nhật",
    today: "Hôm nay",
    month: "Tháng",
    shift: "Ca",
    morning: "Sáng",
    afternoon: "Chiều",

    // Request Screen
    requests_title: "Yêu cầu đăng ký tài khoản",
    requests_subtitle: "Duyệt hoặc từ chối hồ sơ đăng ký tài khoản CTV mới",
    tab_pending_req: "Chờ duyệt",
    tab_approved_req: "Đã duyệt",
    tab_rejected_req: "Đã từ chối",
    applicant: "Ứng viên",
    submission_date: "Ngày gửi",
    no_requests: "Không có yêu cầu nào",
  },
  "Tiếng Anh": {
    // Navigation & System
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

    // Common Actions & Buttons
    close: "Close",
    done: "Done",
    edit: "Edit",
    delete: "Delete",
    change: "Change",
    save: "Save changes",
    save_btn: "Save",
    cancel: "Cancel",
    add: "Add",
    add_account: "Add Account",
    create_account: "Create Account",
    create_meeting: "New Meeting",
    search: "Search",
    search_placeholder: "Search keywords...",
    filter: "Filter",
    all: "All",
    all_roles: "All Roles",
    all_status: "All Status",
    confirm: "Confirm",
    refresh: "Refresh",
    back: "Back",
    view_details: "View Details",
    upload_photo: "Upload Photo",
    approve: "Approve",
    reject: "Reject",
    export_excel: "Export Excel",
    actions: "Actions",

    // Settings
    theme_setting: "Theme",
    contrast_setting: "Contrast",
    accent_setting: "Accent Color",
    language_setting: "Language",
    light_mode: "Light",
    dark_mode: "Dark",
    low_contrast: "Low",
    medium_contrast: "Medium",
    high_contrast: "High",

    // Roles & Statuses
    role_admin: "Administrator",
    role_ctv: "Contributor",
    status_active: "Active",
    status_inactive: "Disabled",
    status_pending: "Pending",
    status_approved: "Approved",
    status_rejected: "Rejected",
    role: "Role",
    status: "Status",

    // Profile & Info
    account_info: "Account Information",
    change_password: "Change Password",
    edit_info: "Edit Profile",
    personal_info: "Personal Information",
    account_details: "Detailed Information",
    full_name: "Full Name",
    date_of_birth: "Date of Birth",
    dob: "Date of Birth",
    email: "Email",
    phone_number: "Phone Number",
    phone: "Phone Number",
    gender: "Gender",
    gender_male: "Male",
    gender_female: "Female",
    gender_other: "Other",
    address: "Address",
    not_updated: "Not updated",
    registration_date: "Registration Date",
    join_date: "Join Date",
    cv_title: "Application CV",
    cccd_title: "Citizen ID (Front & Back)",
    cccd_front: "Citizen ID - Front",
    cccd_back: "Citizen ID - Back",
    front_side: "Front side",
    back_side: "Back side",
    avatar: "Profile Avatar",
    assigned_room: "Assigned Workroom",
    skills_expertise: "Skills & Expertise",
    activity_history: "Activity History",
    shifts_completed: "Completed Shifts",
    avg_rating: "Average Rating",

    // Password Change
    current_password: "Current Password",
    new_password: "New Password",
    confirm_new_password: "Confirm New Password",
    show_password: "Show Password",
    hide_password: "Hide Password",
    updating: "Updating...",

    // Summary Schedule & Calendar
    summary_schedule_title: "Combined Work Schedule",
    today_ctv_list: "Contributors Registered Today",
    no_ctv_today: "No contributors registered today",
    total_label: "Total:",
    ctv_unit: "Contributors",
    tab_weekly_summary: "Weekly Summary",
    tab_history_summary: "History Summary",
    morning_shift: "Morning",
    afternoon_shift: "Afternoon",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
    today: "Today",
    month: "Month",
    shift: "Shift",
    morning: "Morning",
    afternoon: "Afternoon",

    // Request Screen
    requests_title: "Registration Requests",
    requests_subtitle: "Review or reject new contributor registration profiles",
    tab_pending_req: "Pending",
    tab_approved_req: "Approved",
    tab_rejected_req: "Rejected",
    applicant: "Applicant",
    submission_date: "Submission Date",
    no_requests: "No requests found",
  },
};

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DARK_MODE);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [contrast, setContrastState] = useState<ContrastOption>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONTRAST) as ContrastOption;
      return saved && ["Thấp", "Trung bình", "Cao"].includes(saved) ? saved : "Trung bình";
    } catch {
      return "Trung bình";
    }
  });

  const [accentColor, setAccentColorState] = useState<AccentColorOption>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACCENT) as string;
      if (saved === "Trắng") return "Xám";
      if (saved && (saved in accentMap)) return saved as AccentColorOption;
      return "Lam";
    } catch {
      return "Lam";
    }
  });

  const [language, setLanguageState] = useState<LanguageOption>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANGUAGE) as LanguageOption;
      return saved && ["Tiếng Việt", "Tiếng Anh"].includes(saved) ? saved : "Tiếng Việt";
    } catch {
      return "Tiếng Việt";
    }
  });

  // Apply dark mode class and save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DARK_MODE, JSON.stringify(isDarkMode));
    } catch {}
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Apply contrast attribute and save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONTRAST, contrast);
    } catch {}
    const contrastVal = contrast === "Cao" ? "high" : contrast === "Thấp" ? "low" : "medium";
    document.documentElement.setAttribute("data-contrast", contrastVal);
  }, [contrast]);

  // Apply accent color CSS variables and save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCENT, accentColor);
    } catch {}
    const config = accentMap[accentColor] || accentMap["Lam"];
    document.documentElement.style.setProperty("--accent-primary", config.primary);
    document.documentElement.style.setProperty("--accent-hover", config.hover);
    document.documentElement.style.setProperty("--accent-light", config.light);
    document.documentElement.style.setProperty("--accent-text", config.text);
    document.documentElement.style.setProperty("--accent-text-brand", config.primary);
  }, [accentColor, isDarkMode]);

  // Save language to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LANGUAGE, language);
    } catch {}
  }, [language]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);
  const setContrast = (c: ContrastOption) => setContrastState(c);
  const setAccentColor = (a: AccentColorOption) => setAccentColorState(a);
  const setLanguage = (l: LanguageOption) => setLanguageState(l);

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
