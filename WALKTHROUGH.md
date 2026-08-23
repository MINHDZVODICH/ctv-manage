# Báo cáo Triển khai & Làm sạch Dữ liệu Hệ thống (CTV Manage)

Hệ thống đã được làm sạch toàn bộ dữ liệu mẫu và đưa về **Trạng thái Trống (0-data clean state)**:

- **Database**: Đã dọn sạch toàn bộ các bảng dữ liệu phát sinh (`Account`, `Session`, `RegistrationRequest`, `Shift`, `ShiftAssignment`, `ScheduleRegistration`, `Notification`, `AuditLog`, `FileAsset`).
- **Tài khoản duy nhất được giữ lại để quản trị**:
  - **Email**: `admin@vienkhcn.vn`
  - **Mật khẩu**: `admin123`
- **Frontend**:
  - `INITIAL_ACCOUNTS`, `INITIAL_REQUESTS`, `INITIAL_SHIFTS`, `INITIAL_MEETINGS`, `INITIAL_NOTIFICATIONS` đều là mảng rỗng `[]`.
  - Toàn bộ các màn hình hiển thị trạng thái rỗng (Empty State) chỉn chu, thân thiện và có hướng dẫn/nút hành động rõ ràng.

---

## 1. Trạng thái Giao diện khi chưa có dữ liệu

1. **Danh sách Tài khoản (`AccountListScreen`)**:
   - Hiển thị thông báo *"Chưa có tài khoản cộng tác viên nào"* kèm nút bấm *"Tạo tài khoản mới"* để quản trị viên có thể thêm trực tiếp.
2. **Hồ sơ Đăng ký Ứng tuyển (`RequestsScreen`)**:
   - Hiển thị thông báo *"Chưa có hồ sơ đăng ký ứng tuyển nào"* kèm mô tả khi có ứng viên nộp hồ sơ từ bên ngoài sẽ xuất hiện tại đây.
3. **Lịch Làm việc CTV (`CTVScheduleWorkspace`)**:
   - Lịch tuần/tháng trống sạch sẽ, có nút *"Đăng ký lịch làm việc"* nổi bật để CTV thiết lập mẫu ca trực.
4. **Lịch Tổng hợp Tháng (`SummaryScheduleScreen`)**:
   - Lưới lịch hiển thị 0 CTV ở các ngày, danh sách trực hôm nay hiển thị *"Chưa có CTV nào đăng ký hôm nay"*.
5. **Thông báo (`NotificationsPopover`)**:
   - Hiển thị *"Không có thông báo mới nào"*.

---

## 2. Hướng dẫn Đăng nhập & Bắt đầu Sử dụng

Khởi động hệ thống:
```bash
npm run dev
```
1. Truy cập `http://localhost:5173`.
2. Đăng nhập bằng tài khoản Quản trị viên:
   - **Email**: `admin@vienkhcn.vn`
   - **Mật khẩu**: `admin123`
3. Quản trị viên có thể:
   - Bấm nút **Tạo tài khoản** để thêm CTV mới.
   - Thử nghiệm chức năng nộp hồ sơ ứng tuyển từ màn hình đăng nhập.
