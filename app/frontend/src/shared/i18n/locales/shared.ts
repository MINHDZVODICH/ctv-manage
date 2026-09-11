import { DomainTranslations } from "../types";

export const sharedTranslations: DomainTranslations = {
  vi: {
    // Pagination
    "pagination.prev": "Trước",
    "pagination.next": "Sau",
    "pagination.page": "Trang",
    "pagination.of": "trên",
    "pagination.goto": "Đi tới trang",
    "pagination.aria_prev": "Trang trước",
    "pagination.aria_next": "Trang sau",
    "pagination.aria_page": "Trang {{page}}",

    // TopBar & Sidebar
    "topbar.profile": "Hồ sơ cá nhân",
    "topbar.settings": "Cài đặt hệ thống",
    "topbar.notifications": "Thông báo",
    "topbar.logout": "Đăng xuất",
    "topbar.user_avatar": "Ảnh đại diện người dùng",
    "sidebar.expand": "Mở rộng thanh điều hướng",
    "sidebar.collapse": "Thu gọn thanh điều hướng",

    // Notifications
    "notifications.title": "Thông báo",
    "notifications.mark_all_read": "Đánh dấu tất cả là đã đọc",
    "notifications.empty": "Không có thông báo mới",
    "notifications.clear_all": "Xóa tất cả thông báo",
    "notifications.delete": "Xóa thông báo",
    "notifications.just_now": "Vừa xong",
    "notifications.minutes_ago": "{{count}} phút trước",
    "notifications.hours_ago": "{{count}} giờ trước",
    "notifications.days_ago": "{{count}} ngày trước",

    // App Toasts / Global Messages
    "app.loading": "Đang khởi tạo hệ thống...",
    "app.login_success": "Đăng nhập thành công!",
    "app.logout_success": "Đã đăng xuất khỏi hệ thống.",
    "app.account_list_failed": "Không thể tải danh sách tài khoản.",
    "app.requests_failed": "Không thể tải danh sách yêu cầu đăng ký.",
    "app.schedule_failed": "Không thể tải lịch làm việc.",
    "app.profile_failed": "Không thể tải thông tin hồ sơ.",
    "app.account_disabled": "Đã vô hiệu hóa tài khoản {{name}}",
    "app.account_enabled": "Đã kích hoạt tài khoản {{name}}",
    "app.account_deleted": "Đã xóa tài khoản {{name}}",
    "app.req_approved": "Đã phê duyệt hồ sơ của {{name}}",
    "app.req_rejected": "Đã từ chối hồ sơ của {{name}}",
    "app.password_reset_success": "Đã đặt lại mật khẩu cho tài khoản.",
    "app.file_uploaded": "Tải tệp lên thành công.",
    "app.file_deleted": "Đã xóa tệp thành công.",
  },
  en: {
    // Pagination
    "pagination.prev": "Previous",
    "pagination.next": "Next",
    "pagination.page": "Page",
    "pagination.of": "of",
    "pagination.goto": "Go to page",
    "pagination.aria_prev": "Previous page",
    "pagination.aria_next": "Next page",
    "pagination.aria_page": "Page {{page}}",

    // TopBar & Sidebar
    "topbar.profile": "Personal Profile",
    "topbar.settings": "System Settings",
    "topbar.notifications": "Notifications",
    "topbar.logout": "Logout",
    "topbar.user_avatar": "User avatar",
    "sidebar.expand": "Expand sidebar",
    "sidebar.collapse": "Collapse sidebar",

    // Notifications
    "notifications.title": "Notifications",
    "notifications.mark_all_read": "Mark all as read",
    "notifications.empty": "No new notifications",
    "notifications.clear_all": "Clear all notifications",
    "notifications.delete": "Delete notification",
    "notifications.just_now": "Just now",
    "notifications.minutes_ago": "{{count}} minutes ago",
    "notifications.hours_ago": "{{count}} hours ago",
    "notifications.days_ago": "{{count}} days ago",

    // App Toasts / Global Messages
    "app.loading": "Initializing application...",
    "app.login_success": "Logged in successfully!",
    "app.logout_success": "Logged out successfully.",
    "app.account_list_failed": "Unable to load accounts list.",
    "app.requests_failed": "Unable to load registration requests.",
    "app.schedule_failed": "Unable to load work schedule.",
    "app.profile_failed": "Unable to load profile data.",
    "app.account_disabled": "Account {{name}} has been disabled",
    "app.account_enabled": "Account {{name}} has been activated",
    "app.account_deleted": "Account {{name}} has been deleted",
    "app.req_approved": "Application for {{name}} has been approved",
    "app.req_rejected": "Application for {{name}} has been rejected",
    "app.password_reset_success": "Account password has been reset.",
    "app.file_uploaded": "File uploaded successfully.",
    "app.file_deleted": "File deleted successfully.",
  },
};
