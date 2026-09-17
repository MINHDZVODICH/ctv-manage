# Báo Cáo Đo Đạc Baseline và Tối Ưu Hóa Docker Build

**Thời điểm đo:** 17/09/2026  
**Môi trường:** Docker Desktop (Windows / WSL2 Engine), Node.js 22 Alpine, Nginx Alpine.

---

## 1. Kết Quả Đo Đạc Kích Thước Image

| Hạng mục | Baseline Ban Đầu | Ngân Sách Quy Định | Kích Thước Đo Được Hiện Tại | % Giảm so với Baseline | Trạng Thái Gate |
|---|---|---|---|---|---|
| **Backend** (`ctv-backend`) | 467.04 MB | ≤ 350.00 MB | **106.53 MB** (111,704,230 bytes) | **-77.2%** | ✅ PASS |
| **Frontend** (`ctv-frontend`) | 102.47 MB | ≤ 50.00 MB | **8.24 MB** (8,637,297 bytes) | **-92.0%** | ✅ PASS |

Baseline images đã được lưu trữ trên Docker Hub:
- `minhdz163/ctv-backend:baseline` (và `:latest` cũ)
- `minhdz163/ctv-frontend:baseline` (và `:latest` cũ)

---

## 2. Phân Tích Cấu Trúc Layers và Dependencies

### Backend (`ctv-backend`)
- **Base image:** `node:22-alpine` (~134 MB uncompressed / 48 MB compressed)
- **Hệ thống OS packages:** `openssl` (cho Prisma engine), `tar` (GNU tar 1.35 cho tính năng restore/backup)
- **Node Modules Runtime:**
  - Tổng kích thước `/app/node_modules`: ~69.7 MB
  - Thư mục `@prisma` (bao gồm `libquery-engine` và `schema-engine` cho `linux-musl-openssl-3.0.x`): 48.8 MB
  - Thư mục `prisma` (Prisma CLI 6.4.1): 12.2 MB
  - Toàn bộ production dependencies còn lại (`argon2`, `express`, `zod`, `multer`, `pino`): ~8.7 MB
- **Compiled code (`dist/`):** < 1 MB
- **Prisma Schema & Migrations (`prisma/`):** < 500 KB

### Frontend (`ctv-frontend`)
- **Base image:** `nginx:alpine-slim` (~12.5 MB)
- **Static Assets (`dist/`):** ~2.3 MB
- **Nginx Config:** < 2 KB

---

## 3. Tối Ưu Build Context (`.dockerignore`)
Trước khi tối ưu:
- Build context bao gồm các file nén `release.zip`, `.playwright-mcp`, `.agents`, khiến context gửi tới daemon lớn và lãng phí I/O.
Sau khi bổ sung vào `.dockerignore`:
- Context gửi đi giảm xuống còn ~**315 kB**.

---

## 4. Phân Tầng Cache (Docker Layering & Buildx)
1. **Frontend (`docker/frontend.Dockerfile`):**
   - Cô lập workspace `npm ci --workspace=app/frontend --include-workspace-root=false`.
   - Sử dụng BuildKit cache mount `--mount=type=cache,target=/root/.npm`.
   - Thay đổi mã nguồn trong `app/frontend/src/` hoàn toàn không làm invalidate cache của layer cài đặt thư viện.

2. **Backend (`docker/backend.Dockerfile`):**
   - Loại bỏ đoạn mã sửa đổi `package.json` động tại thời điểm build và `npm install` không lockfile.
   - Sử dụng `package-lock.json` đồng bộ với `npm ci --omit=dev --workspace=app/backend --include-workspace-root=false`.
   - Phân tách `COPY app/backend/prisma` + `RUN npm run prisma:generate` đứng trước `COPY app/backend ./app/backend`. Nhờ đó, việc sửa đổi source code trong `app/backend/src/` không kích hoạt lại cả `npm ci` lẫn `prisma:generate`.

3. **CI GitHub Actions Buildx:**
   - Sử dụng `docker/setup-buildx-action@v3`.
   - Thiết lập cache phân tách theo scope: `scope=backend` và `scope=frontend` với backend cache type `gha` (`mode=max`).
   - Thêm cờ `--load` để tự động nạp image vào Docker daemon phục vụ script kiểm tra dung lượng `check-image-sizes.mjs`.

---

## 5. Đánh Giá Kiến Trúc: Giữ hay Tách Migration Khỏi Runtime Image (P2)
- **Đo đạc thực tế:** Thư mục Prisma CLI `node_modules/prisma` chỉ chiếm **12.2 MB**.
- **Kích thước tổng:** Backend image hiện tại chỉ **106.53 MB**, cách rất xa ngân sách 350.00 MB (dư hơn 243 MB).
- **Đánh giá rủi ro & vận hành:**
  - Giữ Prisma CLI và cơ chế `entrypoint.sh` chạy `prisma migrate deploy` khi khởi động giúp container tự quản lý schema, đảm bảo tính toàn vẹn và đơn giản khi triển khai đơn lẻ (Render, VPS, docker-compose) mà không cần cấu hình thêm service phụ trợ hay orchestration phức tạp.
- **Quyết định:** Giữ nguyên cơ chế migration tự động trong `backend-entrypoint.sh`.
