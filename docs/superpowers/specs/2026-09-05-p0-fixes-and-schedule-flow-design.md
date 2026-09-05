# Thiết kế Kỹ thuật: Phase 1 — Xử lý triệt để các lỗi P0 & Chuẩn hóa luồng Đăng ký/Cập nhật/Hủy ca

**Ngày lập:** 2026-09-05  
**Trạng thái:** Proposed  
**Mục tiêu:** Khắc phục triệt để các lỗi sai hành vi (P0) liên quan đến Vô hiệu hóa tài khoản, Auth Middleware, Bảo mật mật khẩu đặt lại, và Thống nhất luồng Cập nhật/Hủy ca qua Form Đăng ký lịch làm việc thay vì các fake stub ảo.

---

## 1. Bối cảnh & Vấn đề hiện tại

### 1.1. Lỗi Vô hiệu hóa tài khoản (Account Disabling)
* Trong `app/backend/src/modules/accounts/accounts.service.ts`, hàm `disableSideEffects` thực thi:
  ```ts
  await prisma.schedule.deleteMany({ where: { accountId } });
  ```
  Hành vi này xóa vĩnh viễn toàn bộ `Schedule` và các `Shift` của CTV khi bị khóa hoặc xóa mềm (`softDelete`). Điều này phá vỡ tính toàn vẹn dữ liệu, làm mất lịch sử và kiểm toán công tác.
* Việc thu hồi session (`revokeSessions`) được gọi tách rời, không nằm trong transaction với câu lệnh cập nhật trạng thái tài khoản.

### 1.2. Lỗi Auth Middleware đối với tài khoản không hoạt động
* Trong `app/backend/src/middleware/auth.ts`:
  ```ts
  if (account.status !== 'ACTIVE' && req.path !== '/api/v1/auth/sessions/current') {
    // still allow logout
  }
  ```
  Khối điều kiện bị rỗng, chỉ có comment. Khi tài khoản bị vô hiệu hóa trong database nhưng phiên (cookie) vẫn còn hạn, request tiếp theo vẫn được gán `req.user` và đi tiếp vào các API bảo mật.

### 1.3. Lỗi Thành công ảo ở Thao tác Hủy / Cập nhật ca làm việc
* Trong `app/backend/src/modules/schedule/schedule.service.ts`, các hàm:
  * `cancelOne` -> trả về `{ affectedCount: 1 }`
  * `cancelSeries` -> trả về `{ count: 1 }`
  * `extendRecurringSchedules` -> trả về `{ registrationCount: 0, createdCount: 0 }`
  đều là các stub giả lập không lưu vết hay tác động gì xuống database.
* Các route `DELETE /api/v1/users/me/shift-assignments/:assignmentId`, `DELETE /api/v1/users/me/schedule-registrations/:id/assignments`, `DELETE /api/v1/users/me/schedule-registrations/:id/series` đang trỏ vào các stub này.
* Trên Frontend (`CTVScheduleWorkspace.tsx`):
  * Khi bấm vào một ca làm việc trên Lịch tuần, popup hiển thị nút "Hủy ca", "Hủy ca định kỳ" gọi vào các stub trên.
  * Thao tác "Đổi buồng làm việc" (`handleRoomChange`) chỉ thay đổi state trong bộ nhớ RAM của component và gọi `onUpdateShifts`, không hề gọi API lưu xuống backend, khi F5 trang dữ liệu lập tức quay về giá trị cũ.
  * Form "Đăng ký lịch làm việc" khi mở ra lại bị reset về rỗng (`setRegistrationPattern(createEmptyWeeklyPattern())`), không nạp các ca đã đăng ký trước đó của CTV, khiến CTV không thể chỉnh sửa hay hủy bớt ca trực từ chính form này.

### 1.4. Lỗi Bảo mật thông tin mật khẩu đặt lại (Password Reset)
* Trong `app/frontend/src/app/App.tsx`, hàm `handleResetPassword` gán `{ ...prev, password: newPassword }` vào `selectedAccountDetail`. Plaintext password bị lưu trong state toàn cục dài hạn không cần thiết.

---

## 2. Yêu cầu & Thiết kế Giải pháp

### 2.1. Backend: Bảo toàn Lịch làm việc & Transactional Session Revocation
* **File:** `app/backend/src/modules/accounts/accounts.service.ts`
* **Quy tắc:**
  1. Loại bỏ hoàn toàn `prisma.schedule.deleteMany({ where: { accountId } })` khỏi `changeStatus` và `softDelete`.
  2. Bọc việc cập nhật `account.status = 'DISABLED'` (hoặc `deletedAt`) và thu hồi phiên (`prisma.session.updateMany`) vào `prisma.$transaction`:
  ```ts
  const [updated] = await prisma.$transaction([
    prisma.account.update({
      where: { id: accountId },
      data: { status, version: { increment: 1 } },
      include: { accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } } },
    }),
    prisma.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  ```
  Tương tự đối với hàm `softDelete(accountId)`.

### 2.2. Backend: Chặn truy cập đối với tài khoản không ACTIVE trong Auth Middleware
* **File:** `app/backend/src/middleware/auth.ts`
* **Quy tắc:**
  * Nếu `account.status !== 'ACTIVE'`:
    * Kiểm tra: Nếu là request đăng xuất (`req.method === 'DELETE' && req.path.includes('/auth/sessions/current')`) thì cho phép đi tiếp.
    * Tất cả các trường hợp khác: Ném lỗi `Errors.forbidden('ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa')` (HTTP 403).

### 2.3. Backend: Xóa bỏ toàn bộ Stub thành công ảo
* **File:** `app/backend/src/modules/schedule/schedule.routes.ts` & `schedule.controller.ts` & `schedule.service.ts`
* **Quy tắc:**
  * Xóa bỏ các endpoint:
    * `DELETE /api/v1/users/me/shift-assignments/:assignmentId`
    * `DELETE /api/v1/users/me/schedule-registrations/:id/assignments`
    * `DELETE /api/v1/users/me/schedule-registrations/:id/series`
  * Xóa bỏ các hàm stub trong `schedule.service.ts`: `cancelOne`, `cancelSeries`, `extendRecurringSchedules`.
  * Chuẩn hóa duy nhất API cập nhật toàn bộ lịch làm việc của CTV: `PUT /api/v1/users/me/schedule` (đã có cơ chế transaction, version lock và cập nhật shifts).

### 2.4. Frontend: Form "Đăng ký lịch làm việc" là trung tâm Quản lý Ca trực
* **File:** `app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx`
* **Quy tắc:**
  1. Khi mở Form Đăng ký lịch làm việc (`openRegistration`):
     * Nạp sẵn lịch tuần hiện tại: `setRegistrationPattern({ ...weeklyPattern })`.
     * Nạp sẵn buồng hiện tại: `setRoom(currentRoom)`.
  2. Thao tác của CTV:
     * Muốn **thêm ca**: Bấm vào ô `+` của thứ/buổi mong muốn -> chuyển thành tick xanh.
     * Muốn **hủy ca**: Bấm vào ca đang có tick xanh -> chuyển về `+` (bỏ chọn).
     * Muốn **đổi buồng**: Chọn buồng khác từ dropdown "Buồng làm việc".
     * Nút bấm hiển thị: "Cập nhật lịch làm việc" (nếu đã có lịch) hoặc "Đăng ký lịch làm việc" (nếu chưa có lịch).
  3. Gửi dữ liệu:
     * Bấm Lưu -> Gửi toàn bộ `slots` và `roomCode` qua `PUT /api/v1/users/me/schedule`.
     * Sau khi lưu thành công, tải lại lịch tuần đồng bộ.
  4. Dọn dẹp:
     * Loại bỏ các hàm `handleCancelShift`, `handleCancelRecurringShift`, `handleRoomChange` gọi stub hoặc sửa RAM ảo.
     * Card ca làm việc trên Lịch tuần khi bấm vào chỉ hiển thị thông tin ca trực hoặc mở form chỉnh sửa lịch tuần.

### 2.5. Frontend: Bảo mật Mật khẩu đặt lại
* **File:** `app/frontend/src/app/App.tsx`
* **Quy tắc:**
  * Xóa bỏ `password: newPassword` trong hàm `handleResetPassword`:
  ```ts
  const handleResetPassword = async (id: string, newPassword: string, requireChangeOnLogin: boolean) => {
    try {
      await api.apiPost(`/api/v1/accounts/${id}/password-resets`, { newPassword, mustChangePassword: requireChangeOnLogin });
      showToast(`Đã đặt lại mật khẩu thành công. Mật khẩu mới: ${newPassword}`);
    } catch (e: any) {
      showToast(e.message ?? 'Đặt lại mật khẩu thất bại');
    }
  };
  ```

---

## 3. Chiến lược Kiểm thử & Tiêu chí Nghiệm thu (Acceptance Criteria)

### 3.1. Automated Integration Tests (Backend)
1. **Disabled Account Authentication:**
   * CTV đăng nhập thành công và lấy session cookie.
   * Admin cập nhật trạng thái CTV sang `DISABLED`.
   * Thử gọi `GET /api/v1/users/me/schedule` với cookie cũ -> Bắt buộc nhận HTTP 403 `ACCOUNT_DISABLED`.
   * Thử gọi `DELETE /api/v1/auth/sessions/current` với cookie cũ -> Nhận HTTP 200/204 (đăng xuất thành công).
2. **Preserve Schedules on Account Disabling:**
   * CTV có `Schedule` và 4 `Shift`.
   * Admin vô hiệu hóa tài khoản (`DISABLED`) hoặc xóa mềm (`deletedAt`).
   * Kiểm tra trực tiếp trong database: `Schedule` và `Shift` của CTV vẫn tồn tại nguyên vẹn 100%.
3. **Transactional Session Revocation:**
   * Khi vô hiệu hóa tài khoản, tất cả bản ghi `Session` của tài khoản phải có `revokedAt != null`.
4. **Remove Fake Stubs & Verify Real Schedule Flow:**
   * Các endpoint `DELETE /api/v1/users/me/shift-assignments/:id` không còn tồn tại (HTTP 404).
   * CTV cập nhật, hủy ca, thêm ca thành công qua `PUT /api/v1/users/me/schedule`.

### 3.2. Manual & Frontend Verification
* Mở giao diện CTV: Bấm "Đăng ký lịch làm việc" -> Các ca đã có sẵn hiển thị tick xanh và buồng hiện tại.
* Bỏ chọn 1 ca (hủy ca đó) -> Bấm "Cập nhật" -> Lịch tuần cập nhật mất ca đó, F5 trang ca đó vẫn đã bị hủy thực sự.
* Thử đặt lại mật khẩu cho tài khoản trong Admin -> Không lưu password trong state dài hạn của modal chi tiết tài khoản.
