# PostgreSQL Setup and SQLite Data Migration

Ứng dụng dùng PostgreSQL 16 qua Prisma ORM. SQLite không còn được dùng khi chạy ứng dụng hoặc test; các tệp `app/backend/prisma/*.db*` chỉ được giữ cục bộ làm nguồn nhập dữ liệu/rollback.

## Khởi động PostgreSQL local

Yêu cầu Docker có hỗ trợ `docker compose`.

```powershell
npm.cmd run db:up
npm.cmd run prisma:deploy
```

Compose tạo hai database:

- `ctv_manage` cho phát triển.
- `ctv_manage_test` cho Vitest và Playwright.

Chuỗi kết nối mẫu nằm trong `app/backend/.env.example`. Không dùng database production làm `DATABASE_TEST_URL`; test runner từ chối reset database không có hậu tố `_test` hoặc `-test`.

Nếu dùng PostgreSQL đã cài trực tiếp thay vì Compose, hãy tạo một role ứng dụng và hai database tương đương bằng tài khoản quản trị PostgreSQL, rồi thay thông tin xác thực trong `app/backend/.env`:

```sql
CREATE ROLE ctv_manage WITH LOGIN PASSWORD 'replace-with-a-local-password';
CREATE DATABASE ctv_manage OWNER ctv_manage;
CREATE DATABASE ctv_manage_test OWNER ctv_manage;
```

Không dùng mật khẩu local mẫu cho môi trường production.

## Tạo dữ liệu mẫu mới

```powershell
npm.cmd run prisma:seed
```

Seed xóa dữ liệu ứng dụng đang có trước khi tạo lại bộ dữ liệu mẫu, vì vậy chỉ chạy trên môi trường phát triển.

## Chuyển dữ liệu từ SQLite hiện có

1. Khởi động PostgreSQL và áp dụng migration.
2. Đảm bảo database PostgreSQL đích chưa có dữ liệu ứng dụng.
3. Dry-run để kiểm tra dữ liệu nguồn:

```powershell
cd app/backend
node scripts/migrate-sqlite-to-postgres.mjs --dry-run --source prisma/dev.db
```

4. Nhập dữ liệu:

```powershell
node scripts/migrate-sqlite-to-postgres.mjs --source prisma/dev.db
```

Công cụ giữ nguyên ID, quan hệ, timestamp, trạng thái và giá trị boolean. Toàn bộ phần ghi PostgreSQL chạy trong một transaction; nếu một bảng lỗi thì không có dữ liệu nào được commit. Công cụ cũng từ chối ghi khi bất kỳ bảng đích nào đã có dữ liệu.

## Test

```powershell
npm.cmd run test:api
npm.cmd run test:e2e
```

Mỗi suite reset `ctv_manage_test` bằng migration đã commit. Có thể trỏ sang PostgreSQL test khác qua `DATABASE_TEST_URL`, miễn tên database được đánh dấu là test.

## Xem dữ liệu bằng pgAdmin 4

Mở `F:\PostgreSQL\pgAdmin 4\runtime\pgAdmin4.exe`, sau đó chọn **Servers → Register → Server**.

- General → Name: `CTV Manage Local`
- Connection → Host name/address: `localhost`
- Port: `5432`
- Maintenance database: `ctv_manage`
- Username: `ctv_manage`
- Password: mật khẩu local đã cấu hình trong `app/backend/.env`

Sau khi lưu, mở **Servers → CTV Manage Local → Databases → ctv_manage → Schemas → public → Tables**. Nhấp phải vào một bảng, chọn **View/Edit Data → All Rows** để xem dạng lưới. Tên bảng Prisma có phân biệt hoa thường, vì vậy khi dùng Query Tool cần đặt tên trong dấu nháy kép, ví dụ:

```sql
SELECT * FROM "Account" ORDER BY "createdAt" DESC;
SELECT * FROM "RegistrationRequest" ORDER BY "submittedAt" DESC;
SELECT * FROM "ShiftAssignment" ORDER BY "assignedAt" DESC;
SELECT * FROM "WorkHistory" ORDER BY "workDate" DESC;
```

## Production

Đặt `DATABASE_URL` bằng secret của môi trường triển khai, sau đó chạy:

```powershell
npm.cmd run prisma:deploy
```

Không dùng `prisma migrate dev`, `prisma migrate reset`, seed, hoặc công cụ nhập SQLite trên database production.
