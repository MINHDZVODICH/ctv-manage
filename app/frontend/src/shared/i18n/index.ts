import type { LanguageOption } from '../types';
import type { LocaleTranslations } from './types';
import { commonTranslations } from './locales/common';
import { authTranslations } from './locales/auth';
import { accountsTranslations } from './locales/accounts';
import { scheduleTranslations } from './locales/schedule';
import { profileTranslations } from './locales/profile';
import { sharedTranslations } from './locales/shared';

// Legacy keys preserved for direct backward compatibility
const legacyVietnamese: LocaleTranslations = {
  system_name: 'Hệ thống Quản lý CTV',
  admin_view: 'Giao diện Quản trị viên',
  ctv_view: 'Giao diện Cộng tác viên',
  nav_accounts: 'Quản lý tài khoản',
  nav_requests: 'Yêu cầu đăng ký',
  nav_schedule: 'Lịch làm việc',
  nav_my_schedule: 'Lịch làm việc',
  nav_meetings: 'Lịch làm việc tổng hợp',
  nav_my_meetings: 'Lịch làm việc tổng hợp',
  nav_summary: 'Lịch làm việc tổng hợp',
  nav_profile: 'Hồ sơ cá nhân',
  nav_settings: 'Cài đặt hệ thống',
  switch_to_ctv: 'Đổi sang Cộng tác viên',
  switch_to_admin: 'Đổi sang Admin',
  logout: 'Đăng xuất',

  close: 'Đóng',
  done: 'Hoàn tất',
  edit: 'Chỉnh sửa',
  delete: 'Xóa',
  change: 'Thay đổi',
  save: 'Lưu thay đổi',
  save_btn: 'Lưu',
  cancel: 'Hủy',
  add: 'Thêm',
  add_account: 'Thêm tài khoản',
  create_account: 'Tạo tài khoản mới',
  create_meeting: 'Tạo phiên họp',
  search: 'Tìm kiếm',
  search_placeholder: 'Tìm kiếm thông tin...',
  filter: 'Bộ lọc',
  all: 'Tất cả',
  all_roles: 'Tất cả vai trò',
  all_status: 'Tất cả trạng thái',
  confirm: 'Xác nhận',
  refresh: 'Làm mới',
  back: 'Quay lại',
  view_details: 'Xem chi tiết',
  upload_photo: 'Tải ảnh lên',
  approve: 'Phê duyệt',
  reject: 'Từ chối',
  export_excel: 'Xuất Excel',
  actions: 'Thao tác',

  theme_setting: 'Giao diện',
  contrast_setting: 'Độ tương phản',
  accent_setting: 'Màu điểm nhấn',
  language_setting: 'Ngôn ngữ',
  light_mode: 'Sáng',
  dark_mode: 'Tối',
  low_contrast: 'Thấp',
  medium_contrast: 'Trung bình',
  high_contrast: 'Cao',
  color_gray: 'Xám',
  color_green: 'Lục',
  color_blue: 'Lam',
  color_yellow: 'Vàng',
  color_red: 'Đỏ',
  color_orange: 'Cam',
  color_purple: 'Tím',

  role_admin: 'Quản trị viên',
  role_ctv: 'Cộng tác viên',
  status_active: 'Kích hoạt',
  status_inactive: 'Vô hiệu hóa',
  status_pending: 'Chờ duyệt',
  status_approved: 'Đã duyệt',
  status_rejected: 'Đã từ chối',
  role: 'Vai trò',
  status: 'Trạng thái',

  account_info: 'Thông tin tài khoản',
  change_password: 'Đổi mật khẩu',
  edit_info: 'Chỉnh sửa',
  personal_info: 'Thông tin cá nhân',
  account_details: 'Thông tin chi tiết',
  full_name: 'Họ và tên',
  date_of_birth: 'Ngày sinh',
  dob: 'Ngày sinh',
  email: 'Email',
  phone_number: 'Số điện thoại',
  phone: 'Số điện thoại',
  gender: 'Giới tính',
  gender_male: 'Nam',
  gender_female: 'Nữ',
  gender_other: 'Khác',
  address: 'Địa chỉ',
  not_updated: 'Chưa cập nhật',
  registration_date: 'Ngày đăng ký',
  join_date: 'Ngày gia nhập',
  cv_title: 'Hồ sơ ứng tuyển (CV)',
  cccd_title: 'Ảnh chụp CCCD (Mặt trước & Mặt sau)',
  cccd_front: 'CCCD Mặt trước',
  cccd_back: 'CCCD Mặt sau',
  front_side: 'Mặt trước',
  back_side: 'Mặt sau',
  avatar: 'Ảnh đại diện',
  assigned_room: 'Buồng làm việc được chỉ định',
  skills_expertise: 'Kỹ năng & Chuyên môn',
  activity_history: 'Lịch sử hoạt động',
  shifts_completed: 'Số ca hoàn thành',
  avg_rating: 'Đánh giá trung bình',

  current_password: 'Mật khẩu hiện tại',
  new_password: 'Mật khẩu mới',
  confirm_new_password: 'Xác nhận mật khẩu mới',
  show_password: 'Hiện mật khẩu',
  hide_password: 'Ẩn mật khẩu',
  updating: 'Đang cập nhật...',

  summary_schedule_title: 'Lịch làm việc tổng hợp',
  today_ctv_list: 'Danh sách CTV đăng ký hôm nay',
  no_ctv_today: 'Chưa có CTV nào đăng ký hôm nay',
  total_label: 'Tổng số:',
  ctv_unit: 'Cộng tác viên',
  tab_weekly_summary: 'Lịch tuần tổng hợp',
  tab_history_summary: 'Lịch sử tổng hợp',
  morning_shift: 'Ca Sáng',
  afternoon_shift: 'Ca Chiều',
  mon: 'Thứ 2',
  tue: 'Thứ 3',
  wed: 'Thứ 4',
  thu: 'Thứ 5',
  fri: 'Thứ 6',
  sat: 'Thứ 7',
  sun: 'Chủ Nhật',
  today: 'Hôm nay',
  month: 'Tháng',
  shift: 'Ca',
  morning: 'Sáng',
  afternoon: 'Chiều',
  weekly_schedule: 'Lịch tuần',
  work_history: 'Lịch sử làm việc',
  loading: 'Đang tải...',
  retry: 'Thử lại',
  month_navigation: 'Chuyển tháng',
  previous_month: 'Xem tháng trước',
  next_month: 'Xem tháng sau',
  work_history_load_error: 'Không thể tải lịch sử làm việc.',

  requests_title: 'Yêu cầu đăng ký tài khoản',
  requests_subtitle: 'Duyệt hoặc từ chối hồ sơ đăng ký tài khoản CTV mới',
  tab_pending_req: 'Chờ duyệt',
  tab_approved_req: 'Đã duyệt',
  tab_rejected_req: 'Đã từ chối',
  applicant: 'Ứng viên',
  submission_date: 'Ngày gửi',
  no_requests: 'Không có yêu cầu nào',
};

const legacyEnglish: LocaleTranslations = {
  system_name: 'Contributor Management',
  admin_view: 'Administrator View',
  ctv_view: 'Contributor View',
  nav_accounts: 'Account List',
  nav_requests: 'Registration Requests',
  nav_schedule: 'Shift Registration',
  nav_my_schedule: 'Shift Registration',
  nav_meetings: 'Combined Work Schedule',
  nav_my_meetings: 'Combined Work Schedule',
  nav_summary: 'Combined Work Schedule',
  nav_profile: 'Personal Profile',
  nav_settings: 'System Settings',
  switch_to_ctv: 'Switch to Contributor',
  switch_to_admin: 'Switch to Admin',
  logout: 'Logout',

  close: 'Close',
  done: 'Done',
  edit: 'Edit',
  delete: 'Delete',
  change: 'Change',
  save: 'Save changes',
  save_btn: 'Save',
  cancel: 'Cancel',
  add: 'Add',
  add_account: 'Add Account',
  create_account: 'Create Account',
  create_meeting: 'New Meeting',
  search: 'Search',
  search_placeholder: 'Search keywords...',
  filter: 'Filter',
  all: 'All',
  all_roles: 'All Roles',
  all_status: 'All Status',
  confirm: 'Confirm',
  refresh: 'Refresh',
  back: 'Back',
  view_details: 'View Details',
  upload_photo: 'Upload Photo',
  approve: 'Approve',
  reject: 'Reject',
  export_excel: 'Export Excel',
  actions: 'Actions',

  theme_setting: 'Theme',
  contrast_setting: 'Contrast',
  accent_setting: 'Accent Color',
  language_setting: 'Language',
  light_mode: 'Light',
  dark_mode: 'Dark',
  low_contrast: 'Low',
  medium_contrast: 'Medium',
  high_contrast: 'High',
  color_gray: 'Gray',
  color_green: 'Green',
  color_blue: 'Blue',
  color_yellow: 'Yellow',
  color_red: 'Red',
  color_orange: 'Orange',
  color_purple: 'Purple',

  role_admin: 'Administrator',
  role_ctv: 'Contributor',
  status_active: 'Active',
  status_inactive: 'Disabled',
  status_pending: 'Pending',
  status_approved: 'Approved',
  status_rejected: 'Rejected',
  role: 'Role',
  status: 'Status',

  account_info: 'Account Information',
  change_password: 'Change Password',
  edit_info: 'Edit',
  personal_info: 'Personal Information',
  account_details: 'Detailed Information',
  full_name: 'Full Name',
  date_of_birth: 'Date of Birth',
  dob: 'Date of Birth',
  email: 'Email',
  phone_number: 'Phone Number',
  phone: 'Phone Number',
  gender: 'Gender',
  gender_male: 'Male',
  gender_female: 'Female',
  gender_other: 'Other',
  address: 'Address',
  not_updated: 'Not updated',
  registration_date: 'Registration Date',
  join_date: 'Join Date',
  cv_title: 'Application CV',
  cccd_title: 'Citizen ID (Front & Back)',
  cccd_front: 'Citizen ID - Front',
  cccd_back: 'Citizen ID - Back',
  front_side: 'Front side',
  back_side: 'Back side',
  avatar: 'Profile Avatar',
  assigned_room: 'Assigned Workroom',
  skills_expertise: 'Skills & Expertise',
  activity_history: 'Activity History',
  shifts_completed: 'Completed Shifts',
  avg_rating: 'Average Rating',

  current_password: 'Current Password',
  new_password: 'New Password',
  confirm_new_password: 'Confirm New Password',
  show_password: 'Show Password',
  hide_password: 'Hide Password',
  updating: 'Updating...',

  summary_schedule_title: 'Combined Work Schedule',
  today_ctv_list: 'Contributors Registered Today',
  no_ctv_today: 'No contributors registered today',
  total_label: 'Total:',
  ctv_unit: 'Contributors',
  tab_weekly_summary: 'Weekly Summary',
  tab_history_summary: 'History Summary',
  morning_shift: 'Morning',
  afternoon_shift: 'Afternoon',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
  today: 'Today',
  month: 'Month',
  shift: 'Shift',
  morning: 'Morning',
  afternoon: 'Afternoon',
  weekly_schedule: 'Weekly Schedule',
  work_history: 'Work History',
  loading: 'Loading...',
  retry: 'Retry',
  month_navigation: 'Change month',
  previous_month: 'View previous month',
  next_month: 'View next month',
  work_history_load_error: 'Unable to load work history.',

  requests_title: 'Registration Requests',
  requests_subtitle: 'Review or reject new contributor registration profiles',
  tab_pending_req: 'Pending',
  tab_approved_req: 'Approved',
  tab_rejected_req: 'Rejected',
  applicant: 'Applicant',
  submission_date: 'Submission Date',
  no_requests: 'No requests found',
};

export const translations: Record<LanguageOption, Record<string, string>> = {
  'Tiếng Việt': {
    ...legacyVietnamese,
    ...commonTranslations.vi,
    ...authTranslations.vi,
    ...accountsTranslations.vi,
    ...scheduleTranslations.vi,
    ...profileTranslations.vi,
    ...sharedTranslations.vi,
  },
  'Tiếng Anh': {
    ...legacyEnglish,
    ...commonTranslations.en,
    ...authTranslations.en,
    ...accountsTranslations.en,
    ...scheduleTranslations.en,
    ...profileTranslations.en,
    ...sharedTranslations.en,
  },
};

/**
 * Translates a key for a given language with parameter substitution and fallback.
 */
export function translate(
  language: LanguageOption,
  key: string,
  params?: Record<string, string | number>,
): string {
  const dict = translations[language] || translations['Tiếng Việt'];
  let text = dict[key] || translations['Tiếng Việt'][key] || key;

  if (process.env.NODE_ENV === 'development') {
    if (!dict[key]) {
      console.warn(`[i18n] Missing translation for key "${key}" in language "${language}"`);
    }
  }

  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      text = text.replace(
        new RegExp(`\\{\\{\\s*${pKey}\\s*\\}\\}|\\{${pKey}\\}`, 'g'),
        String(pVal),
      );
    }
  }

  return text;
}

/**
 * Returns the BCP 47 locale string corresponding to the application language.
 */
export function getLocale(language: LanguageOption): 'vi-VN' | 'en-US' {
  return language === 'Tiếng Anh' ? 'en-US' : 'vi-VN';
}

/**
 * Format a Date object or ISO string in locale-aware format.
 */
export function formatDateLocale(
  dateInput: Date | string | number,
  language: LanguageOption,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!dateInput) return '';
  const d =
    typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const defaultOptions: Intl.DateTimeFormatOptions = options || {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  return new Intl.DateTimeFormat(getLocale(language), defaultOptions).format(d);
}

/**
 * Format a short date (e.g. DD/MM)
 */
export function formatShortDateLocale(dateInput: Date | string, language: LanguageOption): string {
  return formatDateLocale(dateInput, language, { month: '2-digit', day: '2-digit' });
}

export * from './types';
