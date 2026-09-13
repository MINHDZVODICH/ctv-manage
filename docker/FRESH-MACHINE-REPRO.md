# Fresh Machine Reproduction: Registration SERVICE_UNAVAILABLE

## 1. Mục đích & Giả thuyết kiểm chứng (Hypothesis)
- **Hiện tượng trên máy người khác**: Khi người dùng vào form đăng ký tài khoản và nộp thông tin, giao diện báo lỗi:
  `"Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau."` (HTTP 503 `SERVICE_UNAVAILABLE`).
- **Giả thuyết kiểm chứng**:
  Cơ chế bảo vệ tần suất đăng ký (`registrationIpRateLimiter` tại `registration.routes.ts`) sử dụng middleware `rateLimiter.ts` gọi vào bảng `RateLimitWindow` trong PostgreSQL.
  Nếu máy người dùng chạy database mới mà **chưa được áp dụng các file migration (hoặc dump khôi phục thiếu bảng/enum này)**, truy vấn SQL sẽ phát sinh lỗi:
  `Raw query failed. Code: 42P01. Message: relation "RateLimitWindow" does not exist`.
  Middleware rate limiter bắt lỗi này và kích hoạt cơ chế **fail-closed**, trả về HTTP 503 `SERVICE_UNAVAILABLE`.
- **Phạm vi kết luận**: Thử nghiệm này tái hiện giả thuyết thiếu migration/bảng trong môi trường cô lập có kiểm soát; đây không phải là bằng chứng khẳng định nguyên nhân duy nhất trên máy từ xa (cần kiểm tra thêm log hoặc cấu hình thực tế của máy từ xa để xác nhận).

---

## 2. Kiến trúc & Thiết lập môi trường cô lập (Isolated Project)
- **Tập tin cấu hình**: [`compose.fresh-machine.yaml`](compose.fresh-machine.yaml)
- **Tên project Docker độc lập**: `ctv-fresh-machine`
- **Tách biệt cổng & volume (Không đụng chạm database hoặc container hiện hữu)**:
  - Frontend: `127.0.0.1:18080 -> 80/tcp` (Không ảnh hưởng cổng `8080` của `ctv-release`).
  - PostgreSQL: `127.0.0.1:15432 -> 5432/tcp` (Chỉ dùng cho local Prisma CLI migration).
  - Volumes riêng biệt (Docker tự động gắn tiền tố theo tên project): `ctv-fresh-machine_fresh_postgres_data` và `ctv-fresh-machine_fresh_uploads` (khai báo trong compose file là `fresh_postgres_data` và `fresh_uploads`).
  - Tái sử dụng images có sẵn trên máy: `minhdz163/ctv-backend:latest`, `minhdz163/ctv-frontend:latest`, `postgres:18-alpine` (`pull_policy: never`, không rebuild/pull lại).

---

## 3. Nhật ký các bước thực nghiệm & Bằng chứng thực tế (Evidence)

### Bước 1: Khởi động cụm container cô lập
```powershell
docker compose -f docker/compose.fresh-machine.yaml up -d
```
Trạng thái các container (`docker ps`):
- `ctv-fresh-machine-frontend-1`: Port `127.0.0.1:18080->80/tcp`
- `ctv-fresh-machine-backend-1`: Port `4001/tcp`
- `ctv-fresh-machine-postgres-1`: Port `127.0.0.1:15432->5432/tcp` (Healthy)

### Bước 2: Kiểm tra Health endpoints (Lưu ý quan trọng)
```powershell
curl.exe -i http://127.0.0.1:18080/api/v1/health
curl.exe -i http://127.0.0.1:18080/api/v1/health/ready
```
- Kết quả: Cả 2 đều trả về **`HTTP 200 OK`** (`{"status":"ok"}`, `{"status":"ready"}`) vì `/api/v1/health/ready` chỉ thực hiện `SELECT 1` kiểm tra kết nối DB.
- **Kết luận**: Không thể kết luận ứng dụng hoạt động đầy đủ chỉ dựa vào health check khi các bảng nghiệp vụ chưa tồn tại.

### Bước 3: Gửi yêu cầu đăng ký TRƯỚC KHI chạy migrations (BEFORE migrations)
Lệnh gửi request tổng hợp (synthetic request):
```powershell
curl.exe -i -X POST http://127.0.0.1:18080/api/v1/registration-requests `
  -F "email=repro_test@example.com" `
  -F "displayName=Repro Test" `
  -F "password=Password123!"
```
**Phản hồi HTTP nhận được**:
```http
HTTP/1.1 503 Service Unavailable
Server: nginx/1.31.5
Content-Type: application/json; charset=utf-8
X-Request-ID: c7b1b1ca-291c-4bfd-b287-42f524cfe0c1

{"error":{"code":"SERVICE_UNAVAILABLE","message":"Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau."}}
```
**Bằng chứng trích xuất từ log của backend (`ctv-fresh-machine-backend-1`)**:
```json
{
  "level": 50,
  "time": 1789296566297,
  "err": {
    "type": "PrismaClientKnownRequestError",
    "message": "\nInvalid `prisma.$queryRaw()` invocation:\n\n\nRaw query failed. Code: `42P01`. Message: `relation \"RateLimitWindow\" does not exist`",
    "code": "P2010",
    "meta": {
      "message": "relation \"RateLimitWindow\" does not exist",
      "code": "42P01"
    }
  },
  "scope": "REGISTRATION_IP",
  "msg": "Rate limit check failed - failing closed"
}
{"level":30,"time":1789296566298,"method":"POST","route":"/api/v1/registration-requests","status":503,"durationMs":4,"msg":"<-- POST /api/v1/registration-requests 503 4ms"}
```
-> Tái hiện thông báo lỗi và mã lỗi tương ứng với ảnh chụp màn hình.

---

### Bước 4: Áp dụng Prisma Migrations vào DB cô lập (127.0.0.1:15432)
Vì runtime image loại bỏ Prisma CLI dev-dependencies để tối ưu dung lượng, sử dụng Prisma CLI trên máy host trỏ trực tiếp vào DB cô lập.
Để tránh lưu lại biến môi trường ảnh hưởng đến các lệnh khác về sau, biến `$env:DATABASE_URL` ban đầu được lưu lại và phục hồi trong khối `finally`:
```powershell
$previousDbUrl = $env:DATABASE_URL
try {
    $env:DATABASE_URL = "postgresql://ctv_manage:ctv_manage@127.0.0.1:15432/ctv_manage?schema=public"
    npm run prisma:deploy --workspace=app/backend
} finally {
    $env:DATABASE_URL = $previousDbUrl
}
```
Kết quả: 7 migrations áp dụng thành công:
- `20260904090000_init_postgresql`
- `20260905090000_redesign_schedule_shift_history`
- `20260907170407_add_snapshot_run_and_rate_limit_window` (tạo `RateLimitWindow` và enum `RateLimitScope`)
- `20260909100000_work_history_checkpoint`
- `20260909110000_work_history_progress_clock`
- `20260911140000_strengthen_domain_integrity`
- `20260913100000_pending_registration_unique`

---

### Bước 5: Gửi yêu cầu đăng ký SAU KHI chạy migrations (AFTER migrations)
Lệnh:
```powershell
curl.exe -i -X POST http://127.0.0.1:18080/api/v1/registration-requests `
  -F "email=synthetic.fresh@example.com" `
  -F "displayName=Synthetic User" `
  -F "password=Password123!" `
  -F "phone=0987654321" `
  -F "dateOfBirth=2000-01-01" `
  -F "gender=MALE"
```
**Phản hồi HTTP nhận được**:
```http
HTTP/1.1 201 Created
Server: nginx/1.31.5
Content-Type: application/json; charset=utf-8
X-Request-ID: 40825e98-acdf-4ed3-8891-069dc47c2f14

{"request":{"id":"cmtzozno90000o201sompxvas","email":"synthetic.fresh@example.com","displayName":"Synthetic User","phone":"0987654321","dateOfBirth":"2000-01-01T00:00:00.000Z","gender":"MALE","address":null,"status":"PENDING","rejectionReason":null,"reviewedById":null,"approvedAccountId":null,"submittedAt":"2026-09-13T10:49:48.441Z","reviewedAt":null,"files":[]}}
```
**Backend log**:
```json
{"level":30,"time":1789296588448,"method":"POST","route":"/api/v1/registration-requests","status":201,"durationMs":59,"msg":"<-- POST /api/v1/registration-requests 201 59ms"}
```
-> Đăng ký thành công, bản ghi được tạo với mã phản hồi HTTP 201.

---

## 4. Lệnh dọn dẹp môi trường (Scoped Cleanup Command)
Khi người dùng muốn tắt và xóa bỏ toàn bộ môi trường test này (chỉ xóa đúng project `ctv-fresh-machine`):
```powershell
docker compose -f docker/compose.fresh-machine.yaml down -v
```
*(Lệnh này chỉ xóa container, network và volumes của `ctv-fresh-machine`, không ảnh hưởng đến bất kỳ dữ liệu hay container nào khác).*

---

## 5. Giải pháp chuẩn hóa dài hạn (Permanent Production Solution)

### A. Cơ chế Entrypoint tự động Migrate
Thay vì phụ thuộc vào Prisma CLI trên máy host của người dùng (vốn không có Node.js/npm), runtime image của backend được đóng gói kèm Prisma CLI và script khởi động [`docker/backend-entrypoint.sh`](backend-entrypoint.sh):
1. **Trước khi server lắng nghe cổng**: Script tự động chạy `./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma`.
2. **Nếu migration thành công hoặc đã up-to-date**: Script chuyển quyền thực thi sang `node dist/src/main.js` (PID 1) để phục vụ yêu cầu.
3. **Nếu migration thất bại**: Script lập tức thoát với mã lỗi (`set -e`), container dừng lại ngay và tuyệt đối không mở cổng tiếp nhận dữ liệu khi schema chưa sẵn sàng.

### B. Quy trình nâng cấp cho người dùng hiện hữu (Existing User Upgrade)
- Người dùng chỉ cần bấm đúp **`update.bat`**.
- Docker sẽ kéo image backend mới về, tự động áp dụng các migration còn thiếu vào database hiện tại mà không làm mất dữ liệu người dùng đã nhập.

