# Ma trận truy vết hệ thống (Traceability Matrices)

Tài liệu này thiết lập mối liên kết truy vết 1:1 xuyên suốt hệ thống CTV Manage giữa các tầng: **Nghiệp vụ (Use Case) ↔ Sơ đồ tương tác (Sequence Diagram) ↔ Giao diện (Frontend Screen) ↔ Giao diện lập trình (API Endpoint & Schema) ↔ Bộ điều khiển & Dịch vụ (Controller & Service) ↔ Mô hình dữ liệu (Prisma Model)**.

---

## Ma trận 1: Use Case ↔ Sequence Diagram ↔ API Endpoint ↔ Controller ↔ Service

| Mã UC | Tên Use Case | Sơ đồ tuần tự | API Endpoint & Method | Controller Handler | Service Method |
|---|---|---|---|---|---|
| **1.1** | Đăng nhập | [01-dang-nhap.md](sequence-diagrams/01-dang-nhap.md) | `POST /api/v1/auth/sessions` | `auth.controller.ts:login` | `auth.service.ts:authenticate` |
| **1.2** | Đăng xuất | [08-dang-xuat.md](sequence-diagrams/08-dang-xuat.md) | `DELETE /api/v1/auth/sessions/current` | `auth.controller.ts:logout` | `auth.service.ts:revokeCurrentSession` |
| **1.3** | Đăng ký tài khoản | [02-dang-ky.md](sequence-diagrams/02-dang-ky.md) | `POST /api/v1/registration-requests` | `registration.controller.ts:create` | `registration.service.ts:createRequest` |
| **1.4** | Quản lý danh sách tài khoản | [09-quan-ly-tai-khoan.md](sequence-diagrams/09-quan-ly-tai-khoan.md) | `GET /api/v1/accounts` | `accounts.controller.ts:list` | `accounts.service.ts:listAccounts` |
| **1.5** | Kích hoạt/vô hiệu hóa tài khoản | [09-quan-ly-tai-khoan.md](sequence-diagrams/09-quan-ly-tai-khoan.md) | `PATCH /api/v1/accounts/:id/status` | `accounts.controller.ts:patchStatus` | `accounts.service.ts:changeStatus` |
| **1.6** | Xóa tài khoản | [09-quan-ly-tai-khoan.md](sequence-diagrams/09-quan-ly-tai-khoan.md) | `DELETE /api/v1/accounts/:id` | `accounts.controller.ts:del` | `accounts.service.ts:softDelete` |
| **1.7** | Xem thông tin tài khoản (CTV) | [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md) | `GET /api/v1/users/me` | `users.controller.ts:getMe` | `users.service.ts:getMyProfile` |
| **1.7** | Xem thông tin tài khoản (Admin) | [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md) | `GET /api/v1/accounts/:id` | `accounts.controller.ts:getById` | `accounts.service.ts:getAccount` |
| **1.8** | Cập nhật hồ sơ (CTV) | [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md) | `PATCH /api/v1/users/me` | `users.controller.ts:patchMe` | `users.service.ts:updateMyProfile` |
| **1.8** | Tải lên / thay tệp hồ sơ (CTV) | [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md) | `PUT /api/v1/users/me/files/:category` | `files.controller.ts:putMyFile` | `files.service.ts:uploadFileForAccount` |
| **1.8** | Xóa tệp hồ sơ (CTV) | [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md) | `DELETE /api/v1/users/me/files/:category` | `files.controller.ts:deleteMyFile` | `files.service.ts:deleteFileForAccount` |
| **1.8** | Cập nhật hồ sơ (Admin) | [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md) | `PATCH /api/v1/accounts/:id` | `accounts.controller.ts:patch` | `accounts.service.ts:updateAccount` |
| **1.8** | Tải lên tệp hồ sơ (Admin) | [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md) | `PUT /api/v1/accounts/:accountId/files/:category` | `files.controller.ts:putAccountFile` | `files.service.ts:uploadFileForAccount` |
| **1.8** | Xóa tệp hồ sơ (Admin) | [10-xem-cap-nhat-ho-so.md](sequence-diagrams/10-xem-cap-nhat-ho-so.md) | `DELETE /api/v1/accounts/:accountId/files/:category` | `files.controller.ts:deleteAccountFile` | `files.service.ts:deleteFileForAccount` |
| **1.9** | Đổi mật khẩu (Người dùng) | [05-doi-va-dat-lai-mat-khau.md](sequence-diagrams/05-doi-va-dat-lai-mat-khau.md) | `POST /api/v1/users/me/password-changes` | `users.controller.ts:postPasswordChange` | `users.service.ts:changePassword` |
| **1.9** | Đặt lại mật khẩu (Admin) | [05-doi-va-dat-lai-mat-khau.md](sequence-diagrams/05-doi-va-dat-lai-mat-khau.md) | `POST /api/v1/accounts/:id/password-resets` | `accounts.controller.ts:postPasswordReset` | `accounts.service.ts:resetPassword` |
| **1.10** | Xem danh sách chờ duyệt | [03-duyet-ho-so.md](sequence-diagrams/03-duyet-ho-so.md) | `GET /api/v1/registration-requests` | `registration.controller.ts:list` | `registration.service.ts:listPending` |
| **1.10** | Phê duyệt / từ chối hồ sơ | [03-duyet-ho-so.md](sequence-diagrams/03-duyet-ho-so.md) | `PATCH /api/v1/registration-requests/:requestId` | `registration.controller.ts:decide` | `registration.service.ts:decide` |
| **1.11** | Cài đặt hệ thống | *(Không có sơ đồ)* | *(Client local state)* | `SystemSettingsContext` | LocalStorage (theme, contrast, v.v.) |
| **2.1** | Đăng ký / cập nhật lịch CTV | [04-dang-ky-cap-nhat-lich-lam-viec.md](sequence-diagrams/04-dang-ky-cap-nhat-lich-lam-viec.md) | `GET /api/v1/users/me/schedule`<br/>`PUT /api/v1/users/me/schedule` | `schedule.controller.ts:getMySchedule`<br/>`schedule.controller.ts:putMySchedule` | `schedule.service.ts:getMySchedule`<br/>`schedule.service.ts:upsertSchedule` |
| **2.2** | Xem lịch tuần cá nhân (CTV) | [11-xem-lich-tuan-va-lich-su.md](sequence-diagrams/11-xem-lich-tuan-va-lich-su.md) | `GET /api/v1/users/me/schedule` | `schedule.controller.ts:getMySchedule` | `schedule.service.ts:getMySchedule` |
| **2.2** | Xem lịch sử làm việc (CTV) | [11-xem-lich-tuan-va-lich-su.md](sequence-diagrams/11-xem-lich-tuan-va-lich-su.md) | `GET /api/v1/users/me/work-history` | `schedule.controller.ts:getMyWorkHistory` | `schedule.service.ts:getMyWorkHistory` |
| **2.3** | Chốt lịch sử tự động 17:30 | [06-chot-lich-su-lam-viec-tu-dong.md](sequence-diagrams/06-chot-lich-su-lam-viec-tu-dong.md) | Cron / Startup Recovery (Không qua HTTP) | `main.ts:snapshotTodayWorkHistory` | `schedule.service.ts:snapshotTodayWorkHistory` |
| **2.4** | Xem lịch tuần tổng hợp (Admin) | [07-xem-lich-lam-viec-tong-hop.md](sequence-diagrams/07-xem-lich-lam-viec-tong-hop.md) | `GET /api/v1/schedule/weekly-summary` | `schedule.controller.ts:getWeeklySummary` | `schedule.service.ts:getWeeklySummary` |
| **2.4** | Xem lịch sử tổng hợp (Admin) | [07-xem-lich-lam-viec-tong-hop.md](sequence-diagrams/07-xem-lich-lam-viec-tong-hop.md) | `GET /api/v1/work-history` | `schedule.controller.ts:getWorkHistory` | `schedule.service.ts:getWorkHistory` |
| **2.5** | Xem hồ sơ CTV trong modal | [12-xem-chi-tiet-ca-va-ho-so-ctv.md](sequence-diagrams/12-xem-chi-tiet-ca-va-ho-so-ctv.md) | `GET /api/v1/accounts/:id` | `accounts.controller.ts:getById` | `accounts.service.ts:getAccount` |
| **2.5** | Xem lịch tuần CTV trong modal | [12-xem-chi-tiet-ca-va-ho-so-ctv.md](sequence-diagrams/12-xem-chi-tiet-ca-va-ho-so-ctv.md) | `GET /api/v1/accounts/:id/schedule` | `schedule.controller.ts:getAccountSchedule` | `schedule.service.ts:getAccountSchedule` |
| **2.5** | Xem lịch sử CTV trong modal | [12-xem-chi-tiet-ca-va-ho-so-ctv.md](sequence-diagrams/12-xem-chi-tiet-ca-va-ho-so-ctv.md) | `GET /api/v1/work-history?accountId=:id` | `schedule.controller.ts:getWorkHistory` | `schedule.service.ts:getWorkHistory` |
| **2.5** | Cập nhật ghi chú CTV | [12-xem-chi-tiet-ca-va-ho-so-ctv.md](sequence-diagrams/12-xem-chi-tiet-ca-va-ho-so-ctv.md) | `PATCH /api/v1/accounts/:id/notes` | `accounts.controller.ts:patchNotes` | `accounts.service.ts:updateNotes` |
| **2.5** | Tải / xem tệp đính kèm (CV, CCCD) | [12-xem-chi-tiet-ca-va-ho-so-ctv.md](sequence-diagrams/12-xem-chi-tiet-ca-va-ho-so-ctv.md) | `GET /api/v1/files/:fileId/content` | `files.controller.ts:getContent` | `files.service.ts:authorizeFile` + `fileStorage.ts` |

---

## Ma trận 2: API Endpoint ↔ Validation Schema ↔ Response DTO

| API Endpoint | Phương thức | Schema kiểm thực (Request Validation) | Kiểu phản hồi thành công (Response DTO) | Mã HTTP |
|---|---|---|---|---|
| `/api/v1/health` | GET | Không có | `{ status: 'ok' }` | 200 |
| `/api/v1/auth/sessions` | POST | `loginSchema`: `email` (email), `password` (string min 1) | `{ user: UserDto }` | 201 |
| `/api/v1/auth/sessions/current` | DELETE | Không có | `void` (Xóa cookie) | 204 |
| `/api/v1/auth/sessions/me` | GET | Không có | `{ user: UserDto }` | 200 |
| `/api/v1/users/me` | GET | Không có | `{ user: UserDto & { files: AccountFileDto[] } }` | 200 |
| `/api/v1/users/me` | PATCH | `patchMeSchema`: `displayName?`, `phone?`, `dateOfBirth?`, `gender?`, `address?`, `expectedVersion?` | `{ user: UserDto & { files: AccountFileDto[] } }` | 200 |
| `/api/v1/users/me/password-changes` | POST | `passwordChangeSchema`: `currentPassword` (min 1), `newPassword` (min 8, max 128) | `void` | 204 |
| `/api/v1/accounts` | GET | `listQuerySchema`: `q?`, `status?`, `page?` (min 1), `pageSize?` (min 1, max 100) | `{ data: AccountRowDto[], total: number, page: number, pageSize: number }` | 200 |
| `/api/v1/accounts/:id` | GET | `idParamSchema`: `id` (string min 1) | `{ data: AccountDetailDto }` | 200 |
| `/api/v1/accounts/:id/schedule` | GET | `idParamSchema`: `id` (string min 1) | `{ data: ScheduleDto \| null }` | 200 |
| `/api/v1/accounts/:id` | PATCH | `idParamSchema` + `patchBodySchema`: `displayName?`, `phone?`, `dateOfBirth?`, `gender?`, `address?`, `expectedVersion?` | `{ data: AccountDetailDto }` | 200 |
| `/api/v1/accounts/:id/notes` | PATCH | `idParamSchema` + `patchNotesBodySchema`: `adminNotes` (string nullable), `expectedVersion?` | `{ data: AccountDetailDto }` | 200 |
| `/api/v1/accounts/:id/status` | PATCH | `idParamSchema` + `patchStatusBodySchema`: `status` (`ACTIVE` \| `DISABLED`), `expectedVersion?` | `{ data: AccountDetailDto }` | 200 |
| `/api/v1/accounts/:id/password-resets` | POST | `idParamSchema` + `passwordResetBodySchema`: `newPassword` (min 8), `mustChangePassword?` | `{ data: AccountDetailDto }` | 200 |
| `/api/v1/accounts/:id` | DELETE | `idParamSchema`: `id` (string min 1) | `{ data: AccountDetailDto }` | 200 |
| `/api/v1/registration-requests` | POST | Multer (memoryStorage, max 5MB) + `createBodySchema` + `assertFileMagic` | `{ request: RegistrationRequestDto }` | 201 |
| `/api/v1/registration-requests` | GET | `listQuerySchema`: `q?`, `page?`, `pageSize?`, `status?` (`PENDING` \| `APPROVED` \| `REJECTED`) | `{ data: RegistrationRequestDto[], total: number, page: number, pageSize: number }` | 200 |
| `/api/v1/registration-requests/:requestId` | PATCH | `decideBodySchema`: `decision` (`APPROVED` \| `REJECTED`), `expectedStatus` (`PENDING`), `rejectionReason?` | `{ request: RegistrationRequestDto }` | 200 |
| `/api/v1/users/me/schedule` | GET | Không có | `{ data: ScheduleDto \| null }` | 200 |
| `/api/v1/users/me/schedule` | PUT | `putScheduleSchema`: `roomCode` (ROOM_1..4), `slots`: `[{ weekday: 1..5, period: MORNING\|AFTERNOON }]`, `expectedVersion?` | `{ data: ScheduleDto }` | 200 |
| `/api/v1/schedule/weekly-summary` | GET | Không có | `{ data: { cells: WeeklyCellDto[] }, cells: WeeklyCellDto[] }` | 200 |
| `/api/v1/schedule-summary` | GET | `summaryQuerySchema`: `month?` (YYYY-MM) XOR (`from?`, `to?`), `accountId?` | `{ data: { cells: WeeklyCellDto[] }, cells: WeeklyCellDto[] }` | 200 |
| `/api/v1/users/me/work-history` | GET | `workHistoryQuerySchema`: `month` (YYYY-MM) | `{ data: { month: string, entries: HistoryEntryDto[] }, month, entries }` | 200 |
| `/api/v1/work-history` | GET | `workHistoryQuerySchema`: `month` (YYYY-MM), `accountId?` | `{ data: { month, entries: HistoryAdminEntryDto[], cells: HistoryCellDto[] }, month, entries, cells }` | 200 |
| `/api/v1/files/:fileId/content` | GET | Path param `fileId` (string min 1) | Binary Stream + Header `Content-Disposition`, `Content-Type` | 200 |
| `/api/v1/users/me/files/:category` | PUT | Multer single `file` (max 5MB) + `parseCategory` (`CCCD_FRONT` \| `CCCD_BACK` \| `CV`) | `{ file: FileDto }` | 201 |
| `/api/v1/users/me/files/:category` | DELETE | `parseCategory` (`CCCD_FRONT` \| `CCCD_BACK` \| `CV`) | `void` | 204 |
| `/api/v1/accounts/:accountId/files/:category` | PUT | Multer single `file` (max 5MB) + `accountId` + `parseCategory` | `{ file: FileDto }` | 201 |
| `/api/v1/accounts/:accountId/files/:category` | DELETE | `accountId` + `parseCategory` | `void` | 204 |

---

## Ma trận 3: Prisma Model ↔ Backend Services ↔ API Endpoints

| Prisma Model | Mục đích lưu trữ | Module / Service xử lý | API Endpoint liên quan |
|---|---|---|---|
| **`Account`** | Lưu thông tin định danh, hồ sơ, mật khẩu băm, vai trò (`ADMIN`/`CTV`), trạng thái (`ACTIVE`/`DISABLED`), phiên bản (`version`), xóa mềm (`deletedAt`) | `auth.service.ts`<br/>`users.service.ts`<br/>`accounts.service.ts`<br/>`registration.service.ts`<br/>`schedule.service.ts` | `POST /auth/sessions`<br/>`DELETE /auth/sessions/current`<br/>`GET/PATCH /users/me`<br/>`POST /users/me/password-changes`<br/>`GET/PATCH/DELETE /accounts/*`<br/>`PATCH /registration-requests/:requestId`<br/>`GET /schedule/weekly-summary` |
| **`Session`** | Quản lý phiên làm việc đăng nhập, băm token (`tokenHash`), thời hạn (`expiresAt`), thu hồi (`revokedAt`), thông tin IP/User-Agent | `auth.service.ts`<br/>`users.service.ts`<br/>`accounts.service.ts`<br/>`middleware/auth.ts` | `POST /auth/sessions`<br/>`DELETE /auth/sessions/current`<br/>`POST /users/me/password-changes`<br/>`PATCH /accounts/:id/status`<br/>`DELETE /accounts/:id`<br/>Tất cả API yêu cầu xác thực |
| **`RegistrationRequest`** | Lưu đơn đăng ký CTV từ ứng viên chưa kích hoạt, trạng thái duyệt (`PENDING`/`APPROVED`/`REJECTED`), lý do từ chối, mật khẩu hash tạm | `registration.service.ts` | `POST /registration-requests`<br/>`GET /registration-requests`<br/>`PATCH /registration-requests/:requestId` |
| **`FileAsset`** | Lưu trữ metadata tệp vật lý: `storageKey`, `originalName`, `mimeType`, `sizeBytes`, `sha256`, trạng thái (`ACTIVE`/`QUARANTINED`) | `registration.service.ts`<br/>`files.service.ts` | `POST /registration-requests`<br/>`GET /files/:fileId/content`<br/>`PUT/DELETE .../files/:category` |
| **`RegistrationRequestFile`** | Bảng liên kết n-n giữa đơn đăng ký và tệp hồ sơ kèm danh mục (`CCCD_FRONT`, `CCCD_BACK`, `CV`) | `registration.service.ts` | `POST /registration-requests`<br/>`GET /registration-requests`<br/>`PATCH /registration-requests/:requestId` |
| **`AccountFile`** | Bảng liên kết n-n giữa tài khoản và tệp hồ sơ chính thức, hỗ trợ xóa mềm (`deletedAt`) và ràng buộc partial unique index theo danh mục | `registration.service.ts`<br/>`files.service.ts`<br/>`users.service.ts`<br/>`accounts.service.ts` | `PATCH /registration-requests/:requestId`<br/>`GET /users/me`<br/>`GET /accounts/:id`<br/>`PUT/DELETE .../files/:category` |
| **`Schedule`** | Lưu cấu hình lịch tuần lặp lại cố định của CTV (quan hệ 1:1 với `Account`), phòng trực (`roomCode`), phiên bản (`version`) | `schedule.service.ts` | `GET /users/me/schedule`<br/>`PUT /users/me/schedule`<br/>`GET /accounts/:id/schedule`<br/>`GET /schedule/weekly-summary`<br/>Background Snapshot (17:30 Bangkok) |
| **`Shift`** | Lưu chi tiết các ca trực cố định trong tuần của một `Schedule`: thứ (`weekday`: 1..5) và buổi (`period`: `MORNING`/`AFTERNOON`). Khóa chính kết hợp `(scheduleId, weekday, period)` | `schedule.service.ts` | `GET /users/me/schedule`<br/>`PUT /users/me/schedule`<br/>`GET /accounts/:id/schedule`<br/>`GET /schedule/weekly-summary`<br/>Background Snapshot (17:30 Bangkok) |
| **`History`** | Lưu ảnh chụp bất biến các ca làm việc đã hoàn thành (`status = 'COMPLETED'`) được chốt tự động vào 17:30 hằng ngày. Ràng buộc duy nhất `@@unique([accountId, workDate, period])` | `schedule.service.ts` | `GET /users/me/work-history`<br/>`GET /work-history`<br/>Background Snapshot (17:30 Bangkok & Startup Recovery) |

---

## Ma trận 4: Frontend Screen/Component ↔ API Client / Context ↔ API Endpoint

| Màn hình / Thành phần giao diện (Frontend Screen) | Tệp nguồn hiện tại | Hook / API Client được sử dụng | API Endpoint được gọi |
|---|---|---|---|
| **Trang Đăng nhập** (`LoginScreen`) | `src/components/LoginScreen.tsx` | `AuthContext.login()` gọi `apiPost('/auth/sessions', ...)` | `POST /api/v1/auth/sessions` |
| **Kiểm tra phiên khởi động** (`App.tsx`) | `src/App.tsx` | `apiGet('/auth/sessions/me')` (hoặc `/users/me`) | `GET /api/v1/auth/sessions/me` |
| **Thanh Header / Menu người dùng** (`AppShell`) | `src/components/AppShell.tsx` | `AuthContext.logout()` gọi `apiDelete('/auth/sessions/current')` | `DELETE /api/v1/auth/sessions/current` |
| **Bảng Cài đặt hệ thống** (`SystemSettingsModal`) | `src/components/SystemSettingsModal.tsx` | `SystemSettingsContext` (cập nhật theme, font, color trong state & LocalStorage) | *(Không gọi backend API)* |
| **Biểu mẫu Đăng ký CTV** (`LoginScreen` tab Đăng ký) | `src/components/LoginScreen.tsx` | `apiUpload('/registration-requests', formData)` | `POST /api/v1/registration-requests` |
| **Danh sách tài khoản Admin** (`AccountsManagementScreen`) | `src/components/AccountsManagementScreen.tsx` | `apiGet('/accounts?q=...&status=...&page=...&pageSize=...')`<br/>`apiPatch('/accounts/:id/status', ...)`<br/>`apiDelete('/accounts/:id')` | `GET /api/v1/accounts`<br/>`PATCH /api/v1/accounts/:id/status`<br/>`DELETE /api/v1/accounts/:id` |
| **Hộp thoại đặt lại mật khẩu** (`ResetPasswordModal`) | `src/components/ResetPasswordModal.tsx` | `apiPost('/accounts/:id/password-resets', ...)` | `POST /api/v1/accounts/:id/password-resets` |
| **Danh sách duyệt hồ sơ Admin** (`RegistrationRequestsScreen`) | `src/components/RegistrationRequestsScreen.tsx` | `apiGet('/registration-requests?status=...&q=...')`<br/>`apiPatch('/registration-requests/:requestId', ...)` | `GET /api/v1/registration-requests`<br/>`PATCH /api/v1/registration-requests/:requestId` |
| **Xem tệp CCCD/CV trong duyệt hồ sơ** | `src/components/RegistrationRequestsScreen.tsx` | `fileUrl(fileId)` (mở qua link stream) | `GET /api/v1/files/:fileId/content` |
| **Lịch tuần cá nhân CTV** (`CTVScheduleWorkspace` tab Lịch tuần) | `src/components/CTVScheduleWorkspace.tsx` | `apiGet('/users/me/schedule')` | `GET /api/v1/users/me/schedule` |
| **Modal Đăng ký / Cập nhật lịch CTV** (`CTVScheduleWorkspace`) | `src/components/CTVScheduleWorkspace.tsx` | `apiPut('/users/me/schedule', { roomCode, slots, expectedVersion })` | `PUT /api/v1/users/me/schedule` |
| **Huy hiệu ca làm việc chỉ đọc** (`ShiftBadge`) | `src/components/ShiftBadge.tsx` | *(Chỉ hiển thị, không có hành vi click/cancel)* | *(Không gọi API)* |
| **Lịch sử làm việc CTV** (`CTVScheduleWorkspace` tab Lịch sử) | `src/components/CTVScheduleWorkspace.tsx` | `apiGet('/users/me/work-history?month=YYYY-MM')` | `GET /api/v1/users/me/work-history` |
| **Lịch tuần tổng hợp Admin** (`SummaryScheduleScreen` tab Lịch tuần) | `src/components/SummaryScheduleScreen.tsx` | `apiGet('/schedule/weekly-summary')` | `GET /api/v1/schedule/weekly-summary` |
| **Khối CTV hôm nay** (`SummaryScheduleScreen`) | `src/components/SummaryScheduleScreen.tsx` | Lọc từ kết quả của `getWeeklySummary()` theo thứ hôm nay ở Bangkok | *(Sử dụng chung kết quả của weekly-summary)* |
| **Lịch sử tổng hợp Admin** (`SummaryScheduleScreen` tab Lịch sử) | `src/components/SummaryScheduleScreen.tsx` | `apiGet('/work-history?month=YYYY-MM')` | `GET /api/v1/work-history` |
| **Modal Chi tiết ca làm việc** (`SummaryScheduleScreen`) | `src/components/SummaryScheduleScreen.tsx` | Đọc danh sách CTV từ cell đã nạp sẵn; bấm CTV kích hoạt `onViewAccountDetail` | *(Dùng dữ liệu đã cache)* |
| **Modal Hồ sơ & Lịch trình CTV** (`ViewAccountDetailModal`) | `src/components/ViewAccountDetailModal.tsx` | `apiGet('/accounts/:id')`<br/>`apiGet('/accounts/:id/schedule')`<br/>`apiGet('/work-history?month=...&accountId=:id')`<br/>`apiPatch('/accounts/:id/notes', ...)` | `GET /api/v1/accounts/:id`<br/>`GET /api/v1/accounts/:id/schedule`<br/>`GET /api/v1/work-history`<br/>`PATCH /api/v1/accounts/:id/notes` |
| **Xem / Tải tệp CV/CCCD trong modal hồ sơ** | `src/components/ViewAccountDetailModal.tsx` | `fileUrl(fileId)` (mở trực tiếp stream URL) | `GET /api/v1/files/:fileId/content` |
| **Trang Hồ sơ cá nhân CTV** (`ProfileScreen`) | `src/components/ProfileScreen.tsx` | `apiGet('/users/me')` | `GET /api/v1/users/me` |
| **Modal Chỉnh sửa hồ sơ** (`EditProfileModal`) | `src/components/EditProfileModal.tsx` | `apiPatch('/users/me', payload)`<br/>`apiUpload('/users/me/files/:category', formData)`<br/>`apiDelete('/users/me/files/:category')` | `PATCH /api/v1/users/me`<br/>`PUT /api/v1/users/me/files/:category`<br/>`DELETE /api/v1/users/me/files/:category` |
| **Hộp thoại tự đổi mật khẩu** (`ChangePasswordModal`) | `src/components/ChangePasswordModal.tsx` | `apiPost('/users/me/password-changes', payload)` | `POST /api/v1/users/me/password-changes` |
