# Kế hoạch triển khai: Hệ thống Quản lý và Điều phối Lịch trình Cộng tác viên (CTV)

Triển khai toàn bộ hệ thống theo đúng tài liệu thiết kế tại [`docs/`](file:///e:/CTV_Manage/docs) ([`ARCHITECTURE.md`](file:///e:/CTV_Manage/docs/ARCHITECTURE.md), [`DATABASE.md`](file:///e:/CTV_Manage/docs/DATABASE.md), [`API_SPEC.md`](file:///e:/CTV_Manage/docs/API_SPEC.md), [`USE-CASE.md`](file:///e:/CTV_Manage/docs/USE-CASE.md)), sử dụng giao diện từ [`prototype/`](file:///e:/CTV_Manage/prototype) làm frontend và kết nối hoàn chỉnh với Backend Express + SQLite + Prisma.

---

## 1. Cấu trúc hệ thống & Workspace

Hệ thống được tổ chức dạng **Monorepo** với 2 workspace chính:
- **`app/backend`**: Backend Express 4 + TypeScript, Prisma ORM với SQLite (WAL), Zod schemas, Session cookie/bearer authentication, Password hashing (Argon2 / bcryptjs), Multer private local file storage, Pino logger, Central Error Handler.
- **`app/frontend`**: Frontend React 19 + TypeScript + Vite + Tailwind CSS 4, chuyển từ [`prototype/`](file:///e:/CTV_Manage/prototype), tích hợp API client giao tiếp với backend qua `/api/v1` (Vite dev proxy tới port 5000).

```
CTV_Manage/
├── app/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── server.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── request-id.middleware.ts
│   │   │   │   └── error.middleware.ts
│   │   │   ├── shared/
│   │   │   │   ├── prisma.ts
│   │   │   │   ├── session.ts
│   │   │   │   ├── file-storage.ts
│   │   │   │   ├── logger.ts
│   │   │   │   └── api-error.ts
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       ├── accounts/
│   │   │       ├── registration-requests/
│   │   │       ├── schedules/
│   │   │       ├── notifications/
│   │   │       ├── files/
│   │   │       └── audit/
│   │   ├── uploads/          # Lưu trữ private CCCD, CV, Avatar
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── api/
│       │   │   ├── client.ts
│       │   │   └── contracts.ts
│       │   ├── components/
│       │   ├── context/
│       │   ├── utils/
│       │   ├── types.ts
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── vite.config.ts
│       └── package.json
├── docs/
├── package.json
```

---

## 2. Thiết kế Cơ sở dữ liệu (Prisma & SQLite)

Xây dựng schema SQLite WAL trong `app/backend/prisma/schema.prisma` khớp 100% với [`docs/DATABASE.md`](file:///e:/CTV_Manage/docs/DATABASE.md):

1. **`Account`**: Quản lý tài khoản Admin và CTV (id, email, passwordHash, role, status, mustChangePassword, displayName, phone, ctvCode, dateOfBirth, gender, citizenId, address, adminNotes, joinedAt, lastLoginAt, passwordChangedAt, createdAt, updatedAt, deletedAt).
2. **`Session`**: Phiên đăng nhập an toàn (id, accountId, tokenHash, expiresAt, revokedAt, ipAddress, userAgent, createdAt).
3. **`RegistrationRequest`**: Hồ sơ đăng ký CTV (id, email, displayName, phone, dateOfBirth, citizenId, address, experience, status: PENDING/APPROVED/REJECTED, rejectionReason, reviewedById, approvedAccountId, submittedAt, reviewedAt, updatedAt).
4. **`FileAsset`**: Metadata file upload (id, storageKey, originalName, mimeType, sizeBytes, sha256, createdAt, deletedAt).
5. **`RegistrationRequestFile` & `AccountFile`**: Liên kết file theo category (`AVATAR`, `CCCD_FRONT`, `CCCD_BACK`, `CV`).
6. **`Skill` & `AccountSkill`**: Danh sách kỹ năng CTV.
7. **`ScheduleRegistration` & `SchedulePatternSlot`**: Mẫu đăng ký lịch tuần của CTV (startDate, endDate, roomCode, workContent, version, status, slots: weekday, period, enabled).
8. **`Shift`**: Ca làm việc chung (workDate, weekday, period, roomCode, status, allowRegistration, targetCapacity).
9. **`ShiftAssignment`**: Phân công ca của từng CTV (shiftId, accountId, registrationId, status: PENDING/APPROVED/CANCELLED, taskContent, assignedById, assignedAt, approvedAt, cancelledAt, cancellationReason).
10. **`Notification`**: Thông báo người dùng (accountId, type, title, message, sourceType, sourceId, readAt, createdAt).
11. **`AuditLog`**: Nhật ký hành động quản trị (actorAccountId, action, targetType, targetId, requestId, metadataJson, createdAt).

---

## 3. Các Endpoint Backend API (`/api/v1`)

Được triển khai theo đúng chuẩn trong [`docs/API_SPEC.md`](file:///e:/CTV_Manage/docs/API_SPEC.md) và [`docs/sequence-diagrams/`](file:///e:/CTV_Manage/docs/sequence-diagrams):

### 3.1. Authentication & Session (`/api/v1/auth`)
- `POST /api/v1/auth/sessions`: Đăng nhập (email + password), trả session token qua cookie `session_token` (hoặc header `Authorization`), lưu tokenHash trong database.
- `GET /api/v1/auth/sessions/current`: Lấy thông tin user hiện tại từ session.
- `DELETE /api/v1/auth/sessions/current`: Đăng xuất (thu hồi session token).
- `POST /api/v1/auth/forgot-password`: Gửi mã OTP 6 số để xác nhận đặt lại mật khẩu.
- `POST /api/v1/auth/verify-otp`: Xác nhận mã OTP đặt lại mật khẩu.

### 3.2. Yêu cầu đăng ký CTV (`/api/v1/registration-requests`)
- `POST /api/v1/registration-requests`: CTV gửi hồ sơ đăng ký kèm file CCCD mặt trước, mặt sau và file CV (multipart/form-data).
- `GET /api/v1/registration-requests`: Admin xem danh sách hồ sơ (hỗ trợ filter status `PENDING`/`ALL`).
- `GET /api/v1/registration-requests/:id`: Chi tiết hồ sơ kèm thông tin file đính kèm.
- `PATCH /api/v1/registration-requests/:id`: Admin duyệt (`status: "APPROVED"`) hoặc từ chối (`status: "REJECTED"`, `rejectionReason`).
  - *Duyệt chạy trong Prisma Transaction*: Tạo `Account`, tạo mã `ctvCode`, chuyển `FileAsset` sang `AccountFile`, tạo notification và audit log.

### 3.3. Quản lý Tài khoản (`/api/v1/accounts` & `/api/v1/users/me`)
- `GET /api/v1/accounts`: Admin lấy danh sách tài khoản (phân trang, tìm kiếm họ tên/email/phone, lọc role/status).
- `POST /api/v1/accounts`: Admin tạo tài khoản thủ công.
- `GET /api/v1/accounts/:id`: Chi tiết tài khoản, lịch trình, kỹ năng, file đính kèm.
- `PATCH /api/v1/accounts/:id/status`: Kích hoạt / Vô hiệu hóa tài khoản (khi vô hiệu hóa: tự động hủy các ca làm tương lai).
- `DELETE /api/v1/accounts/:id`: Soft-delete tài khoản (`deletedAt`).
- `PATCH /api/v1/accounts/:id/role`: Đổi vai trò tài khoản (`Admin` / `Cộng tác viên`).
- `PUT /api/v1/accounts/:id/password`: Admin đặt lại mật khẩu mặc định (có cờ `mustChangePassword`).
- `PATCH /api/v1/accounts/:id/notes`: Lưu ghi chú nội bộ của Quản trị viên.
- `POST /api/v1/accounts/:id/end-schedule`: Kết thúc lịch làm việc từ ngày chỉ định, hủy toàn bộ ca tương lai và ghi log.
- `GET /api/v1/users/me`: Lấy hồ sơ cá nhân hiện tại.
- `PUT /api/v1/users/me`: Cập nhật thông tin cá nhân.
- `PUT /api/v1/users/me/password`: Đổi mật khẩu cá nhân (kiểm tra mật khẩu cũ).
- `POST /api/v1/users/me/avatar`, `POST /api/v1/users/me/cccd-front`, `POST /api/v1/users/me/cccd-back`, `POST /api/v1/users/me/cv`: Cập nhật file hồ sơ cá nhân.

### 3.4. Quản lý Lịch trình (`/api/v1/schedules`, `/api/v1/users/me/shifts`, `/api/v1/schedule-summary`)
- `GET /api/v1/users/me/schedule-registration`: Lấy mẫu đăng ký lịch gần nhất của CTV.
- `PUT /api/v1/users/me/schedule-registration`: CTV đăng ký hoặc cập nhật mẫu lịch tuần (phòng, ngày bắt đầu - kết thúc, slots sáng/chiều các thứ).
  - *Xử lý Transaction & Shift Generation*: Tính diff ca, upsert `Shift`, sinh hoặc cập nhật `ShiftAssignment`.
- `GET /api/v1/users/me/shifts`: Lấy danh sách ca làm việc của CTV (hỗ trợ filter theo khoảng ngày/tuần/tháng).
- `DELETE /api/v1/shift-registrations/:id`: Hủy ca làm việc:
  - `scope=single`: Hủy riêng ca đó.
  - `scope=series`: Hủy chuỗi ca định kỳ tương lai bắt đầu từ `fromDate`.
- `GET /api/v1/schedule-summary`: Lịch làm việc tổng hợp cho Admin (`?month=YYYY-MM`), trả về danh sách CTV làm việc hôm nay và thống kê số lượng CTV theo từng ca sáng/chiều trong từng ngày của tháng.
- `GET /api/v1/shifts/:id`: Lấy chi tiết ca làm việc và danh sách CTV được phân công.

### 3.5. File Storage & Streaming (`/api/v1/files`)
- `GET /api/v1/files/:id/content`: Stream file nhị phân có kiểm tra quyền (phục vụ xem CCCD/CV an toàn).

### 3.6. Thông báo (`/api/v1/notifications`)
- `GET /api/v1/notifications`: Lấy danh sách thông báo của người dùng.
- `PATCH /api/v1/notifications/read-all`: Đánh dấu tất cả là đã đọc.
- `DELETE /api/v1/notifications`: Xóa tất cả thông báo.

---

## 4. Tích hợp Frontend (`app/frontend`)

1. Chuyển source code từ `prototype/` sang `app/frontend/`.
2. Tạo `app/frontend/src/api/client.ts` và `app/frontend/src/api/contracts.ts` với đầy đủ error handling, authorization, cookie credentials.
3. Nâng cấp `App.tsx` từ sử dụng dummy state / `localStorage` sang gọi API thực tế:
   - Quản lý trạng thái xác thực qua `GET /api/v1/auth/sessions/current` khi khởi động.
   - Đăng nhập, Đăng xuất, Đăng ký duyệt CTV kết nối API.
   - Các màn hình `AccountListScreen`, `RequestsScreen`, `ScheduleScreen`, `CTVScheduleWorkspace`, `SummaryScheduleScreen`, `ProfileScreen` nhận dữ liệu sống từ Backend.
   - Đồng bộ trạng thái và hiển thị Toast thông báo theo phản hồi từ máy chủ.

---

## 5. Dữ liệu mẫu (Seed Data)

Khởi tạo database với dữ liệu mẫu tiêu chuẩn trong `app/backend/prisma/seed.ts`:
- **Tài khoản Quản trị viên**: `admin@vienkhcn.vn` / `admin123` (Họ tên: Quản Trị Viên Hệ Thống, Mã: ADM-001)
- **Tài khoản CTV**: `ctv1@vienkhcn.vn` / `12345678` (Nguyễn Văn An), `ctv2@vienkhcn.vn` / `12345678` (Trần Thị Bình)
- **Yêu cầu đăng ký mẫu**: Các hồ sơ PENDING chờ duyệt để Admin kiểm tra tính năng duyệt hồ sơ.
- **Ca làm & phân công mẫu**: Lịch tuần và lịch tháng hiện tại có sẵn phân công để xem Lịch tổng hợp ngay lập tức.

---

## 6. Kế hoạch xác minh (Verification Plan)

### Kiểm tra tự động & Build
- Chạy `npm run prisma:migrate` và `npm run prisma:seed` để tạo CSDL SQLite và nạp dữ liệu.
- Chạy `npm run typecheck` trên toàn bộ monorepo (cả `app/backend` và `app/frontend`).
- Chạy `npm run build` để xác nhận cả Backend và Frontend build thành công không có lỗi.

### Kiểm tra luồng chức năng (E2E Manual / API Verification)
1. **Luồng Xác thực**: Đăng nhập Admin & CTV, kiểm tra cookie session, lấy profile hiện tại, đăng xuất.
2. **Luồng Đăng ký & Duyệt hồ sơ**:
   - CTV gửi form đăng ký với thông tin và file đính kèm CCCD/CV.
   - Admin thấy thông báo và yêu cầu trong danh sách `RequestsScreen`.
   - Admin xem chi tiết, tải/xem file CCCD/CV, thực hiện Duyệt hoặc Từ chối kèm lý do.
   - Sau khi duyệt, kiểm tra tài khoản CTV mới xuất hiện trong `AccountListScreen`.
3. **Luồng Đăng ký & Phân công Lịch trình**:
   - CTV đăng nhập, mở `CTVScheduleWorkspace`, chọn phòng (Buồng 1 - 4) và mẫu ca tuần (Sáng/Chiều).
   - Bấm lưu mẫu lịch -> kiểm tra các ca tự động sinh trên lịch tuần và tháng.
   - CTV hủy 1 ca lẻ hoặc hủy chuỗi ca.
   - Admin mở `SummaryScheduleScreen`, kiểm tra hiển thị số lượng CTV chính xác theo ca và danh sách CTV trực hôm nay.
4. **Luồng Quản trị Tài khoản**:
   - Admin tìm kiếm, khóa/mở khóa tài khoản, đổi vai trò, đổi mật khẩu, kết thúc lịch làm việc của CTV.
5. **Luồng Hồ sơ cá nhân**:
   - Cập nhật thông tin cá nhân, cập nhật ảnh đại diện/CCCD/CV, đổi mật khẩu cá nhân.
