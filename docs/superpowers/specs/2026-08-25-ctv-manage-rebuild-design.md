# Thiết kế tái triển khai CTV Manage

## Mục tiêu

Xây lại hoàn toàn `app/frontend` và `app/backend` thành hệ thống full-stack chạy được, bao phủ các use case trong `docs/`, đồng thời giữ giao diện hiển thị tương đương `prototype/` ở cùng dữ liệu, vai trò và viewport.

## Nguồn chuẩn và quy tắc xung đột

- `prototype/` là nguồn chuẩn cho bố cục, màu sắc, typography, khoảng cách, modal, responsive và các trạng thái hiển thị.
- `docs/USE-CASE.md`, `docs/API_SPEC.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md` và `docs/sequence-diagrams/` là nguồn chuẩn cho nghiệp vụ, API, dữ liệu, phân quyền và bảo mật.
- Khi hai nguồn xung đột, giữ hình thức của prototype nhưng dùng hành vi trong tài liệu.
- `app/frontend` không import module từ `prototype/`. Có thể dùng markup và class hiển thị của prototype làm tài liệu tham chiếu khi dựng lại component.
- Loại bỏ cơ chế demo: đổi vai trò, dữ liệu nghiệp vụ seed trong frontend, localStorage cho lịch/tài khoản/hồ sơ, modal cuộc họp và component không có use case/API tương ứng.
- `SystemSettingsContext` chỉ quản lý theme, tương phản, màu nhấn và ngôn ngữ; đây không phải dữ liệu nghiệp vụ.

## Kiến trúc

Repository giữ mô hình npm workspaces:

```text
app/
  frontend/  React 19 + Vite 6 + Tailwind CSS 4
  backend/   Node.js 22 + Express 4 + Prisma + SQLite
```

Frontend đi theo `App Shell → Feature UI → Feature Hook → Shared API Client`. Backend đi theo `middleware → route/controller → service → Prisma/file storage`. Controller không gọi Prisma trực tiếp; frontend không tự giả lập kết quả backend.

### Frontend

```text
app/frontend/src/
  main.tsx
  app/
    App.tsx
    Sidebar.tsx
  features/
    auth/
    accounts/
    registration-requests/
    schedules/
    profile/
    notifications/
  shared/
    api/
    context/
    ui/
    utils/
    types.ts
```

- `App` tải session hiện tại trước khi chọn cây giao diện.
- Session trả về `ADMIN` hoặc `CTV`; không có nút tự đổi vai trò.
- API client dùng `credentials: "include"`, lấy CSRF token cho mutation đã đăng nhập và chuẩn hóa `{ error }` thành `ApiError`.
- Mỗi feature hook sở hữu loading, error và dữ liệu của feature; App Shell chỉ điều phối màn hình và overlay.
- Danh sách tài khoản, yêu cầu và thông báo dùng phân trang server-side.
- Lịch tuần, lịch sử tháng và lịch tổng hợp dùng dữ liệu chung từ SQLite.

### Backend

```text
app/backend/src/
  server.ts
  app.ts
  config.ts
  middleware/
  shared/
  modules/
    auth/
    registration-requests/
    accounts/
    files/
    schedules/
    notifications/
```

- Tất cả endpoint nằm dưới `/api/v1`.
- Zod validate body, query, params và các giá trị enum.
- Service kiểm tra actor và ownership; UI ẩn nút không thay thế authorization.
- Lỗi nghiệp vụ dùng `ApiError` và được ánh xạ tập trung về `{ error: { code, message, details, requestId } }`.
- Pino không log mật khẩu, cookie, token, password hash, storage path hay nội dung file.

## Dữ liệu

Prisma schema hiện thực toàn bộ entity và constraint trong `DATABASE.md`:

- `Account`, `Session`, `RegistrationRequest`, `FileAsset`, `RegistrationRequestFile`, `AccountFile`.
- `ScheduleRegistration`, `SchedulePatternSlot`, `Shift`, `ShiftAssignment`.
- `Notification`.

SQLite bật foreign keys, busy timeout và WAL khi khởi động. Mọi thay đổi nhiều bảng quan trọng chạy trong transaction:

- Duyệt hồ sơ tạo tài khoản, chuyển liên kết file và tạo thông báo.
- Vô hiệu hóa tài khoản thu hồi session và hủy assignment tương lai.
- Soft delete thu hồi session nhưng giữ lịch sử ca.
- Upsert lịch kiểm tra `version` rồi đồng bộ assignment.

Để đáp ứng `Idempotency-Key` trong API, schema có bảng hạ tầng `IdempotencyRecord` lưu hash key, scope, actor/public fingerprint, request hash, status code và response JSON. Đây là dữ liệu kỹ thuật, không tạo domain/use case mới. Key trùng payload trả kết quả cũ; key trùng payload khác trả `409 IDEMPOTENCY_KEY_REUSED`.

## Xác thực và bảo mật

- Mật khẩu dùng Argon2id; policy tối thiểu 8 ký tự, có chữ và số, tối đa 128 ký tự.
- Đăng nhập tạo token ngẫu nhiên 256 bit; database chỉ lưu SHA-256 của token.
- Cookie `ctv_session` có `HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` bật ở production.
- CSRF token là HMAC-SHA256 gắn với session và secret server; so sánh constant-time.
- Login và đăng ký kiểm tra `Origin`, content type và rate limit.
- Bootstrap Admin chỉ qua biến môi trường của seed script; không hard-code credential trong source.
- File nằm dưới `FILE_STORAGE_ROOT` ngoài static root. `storageKey` luôn là path tương đối đã chuẩn hóa và bị chặn traversal.
- Upload kiểm tra extension, MIME, magic bytes và byte limit. Download kiểm tra owner/Admin rồi đặt `Content-Type` và `Content-Disposition` an toàn.

## Luồng nghiệp vụ

### Auth

- Public login và đăng ký.
- App tải session hiện tại; account disabled/deleted hoặc session revoked không thể tiếp tục.
- Logout idempotent và xóa cookie.
- Đổi/reset mật khẩu thu hồi session theo API spec; response không echo mật khẩu.

### Đăng ký và duyệt hồ sơ

- Form multipart gửi `profile`, file tùy chọn và `Idempotency-Key`.
- File đi qua staging; transaction tạo metadata; thất bại phải dọn hoặc quarantine.
- Hai Admin duyệt cùng hồ sơ: chỉ transaction đầu với `expectedStatus=PENDING` thành công.
- Duyệt tạo CTV; từ chối không tạo account; response không lộ dữ liệu nhạy cảm.

### Tài khoản, hồ sơ và file

- Admin tìm kiếm/phân trang tài khoản CTV, xem chi tiết, cập nhật, khóa/mở khóa, soft delete, ghi chú và reset mật khẩu.
- Người dùng xem/cập nhật hồ sơ của mình và thay/xóa file theo quyền.
- Admin có thể thay/xóa file của CTV.
- Các DTO danh sách không chứa CCCD/CV, hash hoặc storage key.

### Lịch

- Room là enum cố định `ROOM_1`–`ROOM_4`; không có bảng hay màn hình quản trị phòng.
- Period chỉ có `MORNING`, `AFTERNOON`; weekday chỉ từ 1 đến 5.
- Upsert mẫu lịch sinh `Shift` chung theo `workDate + period` và `ShiftAssignment` riêng cho CTV.
- Version conflict trả `409`; frontend tải lại thay vì ghi đè.
- Hủy một assignment và hủy chuỗi đều idempotent.
- Lịch cá nhân, lịch sử và lịch tổng hợp đọc cùng bảng assignment.
- Chi tiết ca cho CTV chỉ trả dữ liệu tối thiểu; Admin tải hồ sơ nhạy cảm bằng request tài khoản riêng.

### Thông báo

- Thông báo sinh từ service nguồn, không phải do frontend tự tạo.
- Người dùng chỉ đọc và đổi trạng thái thông báo của chính mình.

## Giao diện

- Login/registration, Sidebar, danh sách, lịch, hồ sơ, popover, modal và responsive được dựng lại theo prototype.
- Desktop chuẩn so sánh ở 1440×900; mobile chuẩn ở 390×844.
- Dữ liệu test được seed vào database để cả prototype reference và app mới có nội dung ổn định khi chụp ảnh.
- Sai khác được chấp nhận chỉ với nội dung do hành vi production yêu cầu: không có chuyển vai trò, không có meetings, loading/error/empty state thật và dữ liệu từ server.
- Không dùng ảnh base64 nghiệp vụ trong state; avatar/file hiển thị qua endpoint được ủy quyền hoặc object URL đã thu hồi.

## Xử lý lỗi

- Validation hiển thị tại trường khi `details` xác định field; lỗi còn lại hiện banner/toast theo phong cách prototype.
- `401` làm sạch session state và về login; `403` giữ session nhưng chặn thao tác; `409` buộc reload resource liên quan.
- Backend không trả stack trace, Prisma error, đường dẫn file hay secret.
- Request ID đi xuyên response/log để truy vết.

## Kiểm thử

- TDD bắt buộc cho service, validation, authorization, API client, hooks và hành vi UI.
- Backend integration test dùng SQLite test database thật và HTTP app thật; chỉ filesystem root được cô lập vào thư mục tạm.
- Frontend test dùng Vitest, Testing Library và MSW hoặc HTTP test adapter ở biên API; assertion tập trung hành vi người dùng.
- Playwright chạy smoke flow Admin và CTV, đồng thời chụp desktop/mobile để kiểm tra parity với prototype.
- Cổng hoàn thành: test, typecheck, production build, Prisma validation/migration, Docker build và kiểm tra endpoint đều thành công.

## Triển khai

- Docker Compose chạy backend, frontend và volume cho SQLite/uploads.
- Backend phục vụ API; frontend build thành static asset và reverse proxy `/api/v1` về backend.
- CI chạy install khóa lockfile, Prisma generate/validate, test, typecheck, build và Docker build.

## Ngoài phạm vi

- Không có realtime/WebSocket.
- Không có quản trị phòng.
- Không có cuộc họp.
- Không có OAuth, email delivery, object storage hoặc cloud database.
- Không sửa `prototype/` để biến nó thành ứng dụng thật.
