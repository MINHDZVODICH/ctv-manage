# Kế hoạch Tối ưu Hóa Phép Đo, Dependencies và Cache Docker Build

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa phép đo kích thước Docker image trong CI/local, đo đạc baseline thực tế, tối ưu build context, thu gọn dependencies frontend/backend có lockfile đồng bộ và tối ưu hóa phân lớp cache cho Dockerfile/CI Buildx.

**Architecture:** 
- Script `scripts/check-image-sizes.mjs` nhận tham số image tag động từ CLI / biến môi trường thay vì hardcode `latest`.
- `docker/frontend.Dockerfile` chuyển sang cài đặt độc lập `workspace=app/frontend` với BuildKit cache mount (`/root/.npm`).
- `docker/backend.Dockerfile` loại bỏ manifest động không lockfile, chuyển sang `npm ci --omit=dev` với lockfile đồng bộ, tách lớp `prisma:generate` đứng trước source code để tối đa hóa layer cache khi sửa code.
- `.dockerignore` loại bỏ các artifact không cần thiết (`release.zip`, `.playwright-mcp`, `.agents`).

**Tech Stack:** Docker, Docker Buildx, Node.js 22, Alpine Linux, Prisma ORM, Nginx Alpine, GitHub Actions CI.

## Global Constraints
- Ngân sách dung lượng: `ctv-backend` ≤ 350 MiB, `ctv-frontend` ≤ 50 MiB (đo bằng `docker image inspect {{.Size}}`).
- Giữ nguyên các chức năng runtime: Database migration tự động khi backend khởi động, GNU tar cho tính năng khôi phục upload, Argon2 cho xác thực, Nginx reverse proxy API.
- Sửa code thông thường trong `app/backend/src` hoặc `app/frontend/src` không được làm chạy lại layer cài đặt dependencies (`npm ci`).
- Lưu tag baseline trước khi thay đổi để có thể rollback (`minhdz163/ctv-backend:baseline`, `minhdz163/ctv-frontend:baseline`).
- Compose local chạy PostgreSQL 16, bản release chạy PostgreSQL 18. Không can thiệp thay đổi database engine trong phạm vi task tối ưu build này.

---

### Task 1: Sửa phép đo và kiểm tra dung lượng Docker Image (P0)

**Files:**
- Modify: `scripts/check-image-sizes.mjs:1-67`
- Modify: `.github/workflows/ci.yml:109-114`
- Test: `tests/docker-size-check.unit.test.ts` (hoặc kiểm tra chạy trực tiếp với CLI arguments)

**Interfaces:**
- CLI Usage: `node scripts/check-image-sizes.mjs [backend-image-tag] [frontend-image-tag]`
- Env fallback: `BACKEND_IMAGE`, `FRONTEND_IMAGE`
- Default fallback: `ctv-backend:latest`, `ctv-frontend:latest`

- [x] **Step 1: Cập nhật `scripts/check-image-sizes.mjs` để nhận image tags động**

Hỗ trợ lấy tên image từ CLI argv (`process.argv[2]`, `process.argv[3]`) hoặc biến môi trường `BACKEND_IMAGE`, `FRONTEND_IMAGE`, fallback về `ctv-backend:latest`, `ctv-frontend:latest`.

```javascript
const backendTag = process.argv[2] || process.env.BACKEND_IMAGE || 'ctv-backend:latest';
const frontendTag = process.argv[3] || process.env.FRONTEND_IMAGE || 'ctv-frontend:latest';

const BUDGETS = {
  backend: {
    name: backendTag,
    maxBytes: 350 * 1024 * 1024, // 350 MB budget
    baselineMb: 467.04,
  },
  frontend: {
    name: frontendTag,
    maxBytes: 50 * 1024 * 1024, // 50 MB budget
    baselineMb: 102.47,
  },
};
```

- [x] **Step 2: Cập nhật `.github/workflows/ci.yml` truyền đúng tag vừa build**

Trong `.github/workflows/ci.yml`:
```yaml
      - name: Build and verify release Docker image sizes
        run: |
          docker build -f docker/backend.Dockerfile -t ctv-backend:1.0.1 .
          docker build -f docker/frontend.Dockerfile -t ctv-frontend:1.0.0 .
          node scripts/check-image-sizes.mjs ctv-backend:1.0.1 ctv-frontend:1.0.0
```

- [x] **Step 3: Kiểm tra script với các image hiện có trên máy local**

Chạy thử nghiệm:
```bash
node scripts/check-image-sizes.mjs minhdz163/ctv-backend:latest minhdz163/ctv-frontend:latest
```
Xác nhận output nhận đúng tag `minhdz163/ctv-backend:latest` và `minhdz163/ctv-frontend:latest`.

- [x] **Step 4: Commit**
```bash
git add scripts/check-image-sizes.mjs .github/workflows/ci.yml
git commit -m "fix(ci): support dynamic image tags in check-image-sizes script"
```

---

### Task 2: Đo Baseline Thực Tế (P0)

**Files:**
- Document: `docs/benchmarks/2026-09-17-docker-baseline.md`

- [x] **Step 1: Đo kích thước image hiện tại**

Đo dung lượng thực tế của image local:
```bash
docker image inspect minhdz163/ctv-backend:latest --format '{{.Size}}'
docker image inspect minhdz163/ctv-frontend:latest --format '{{.Size}}'
```

- [x] **Step 2: Phân tích kích thước các layers**

Chạy `docker history` để phân tích chi tiết dung lượng từng layer:
```bash
docker history minhdz163/ctv-backend:latest --format "table {{.CreatedBy}}\t{{.Size}}"
docker history minhdz163/ctv-frontend:latest --format "table {{.CreatedBy}}\t{{.Size}}"
```

- [x] **Step 3: Đo build context hiện tại**

Kiểm tra kích thước build context gửi đến Docker daemon khi chạy build:
```bash
docker build --no-cache -f docker/frontend.Dockerfile -t test-ctx-frontend .
```
Ghi lại kích thước "transferring context: ...".

- [x] **Step 4: Đo thời gian build không cache và có cache**

Đo thời gian build không cache (`--no-cache`) và có cache (chạy lần 2).

- [x] **Step 5: Ghi nhận kết quả vào tài liệu benchmark**

Lưu các chỉ số baseline đo được vào `docs/benchmarks/2026-09-17-docker-baseline.md`.

---

### Task 3: Thu Nhỏ Build Context (`.dockerignore`) (P1)

**Files:**
- Modify: `.dockerignore`

- [x] **Step 1: Kiểm tra các thư mục và file rác có mặt trong context**

Xác minh sự tồn tại của `release.zip`, `.playwright-mcp`, `.agents`, `release/*.zip`, v.v.

- [x] **Step 2: Thêm các pattern loại trừ vào `.dockerignore`**

```dockerignore
.agents
.playwright-mcp
release.zip
*.zip
```

- [x] **Step 3: Kiểm tra lại dung lượng build context sau khi bỏ qua**

Chạy lại lệnh build để xác nhận `transferring context` đã giảm xuống mức tối thiểu cần thiết.

- [x] **Step 4: Commit**
```bash
git add .dockerignore
git commit -m "perf(docker): exclude release archives and agent directories from build context"
```

---

### Task 4: Thu Gọn Dependencies và Tối Ưu Cache Frontend (P1)

**Files:**
- Modify: `docker/frontend.Dockerfile`

- [x] **Step 1: Cập nhật `docker/frontend.Dockerfile`**

Thay thế `npm ci` toàn monorepo bằng cài đặt riêng cho workspace frontend kết hợp cache mount:
```dockerfile
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY app/frontend/package.json ./app/frontend/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=app/frontend --include-workspace-root=false

COPY app/frontend ./app/frontend

RUN npm run build --workspace=app/frontend

FROM nginx:alpine-slim

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/app/frontend/dist /usr/share/nginx/html

EXPOSE 80
```

- [x] **Step 2: Kiểm tra build frontend local**
```bash
docker build -f docker/frontend.Dockerfile -t ctv-frontend:test .
```
Xác nhận build thành công và kích thước ≤ 50 MiB.

- [x] **Step 3: Kiểm tra cache hit khi thay đổi source**
Chạm thử vào một file trong `app/frontend/src/` và chạy lại build: xác nhận layer `npm ci` được lấy từ cache (`CACHED`).

- [x] **Step 4: Commit**
```bash
git add docker/frontend.Dockerfile
git commit -m "perf(docker): isolate frontend workspace install and add npm cache mount"
```

---

### Task 5: Khóa Dependencies Backend Có Lockfile và Phân Tầng Cache (P1)

**Files:**
- Modify: `docker/backend.Dockerfile`

- [x] **Step 1: Thay đổi quy trình cài đặt production dependencies trong backend**

Thay vì dùng `node -e` ghi đè `package.json` và chạy `npm install` không lockfile:
1. Dùng `package-lock.json` đồng bộ.
2. Cài production dependencies bằng `npm ci --omit=dev --workspace=app/backend --include-workspace-root=false` kết hợp cache mount `--mount=type=cache,target=/root/.npm`.
3. Tách layer `prisma:generate`: Copy `app/backend/prisma` trước và chạy `prisma:generate`, sau đó mới copy `app/backend/src` để tránh re-generate khi chỉ sửa logic source.
4. Đảm bảo runtime stage có Prisma CLI để `entrypoint.sh` chạy `prisma migrate deploy` khi container khởi động.

- [x] **Step 2: Cập nhật `docker/backend.Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache openssl tar
WORKDIR /app

FROM base AS manifests
COPY package.json package-lock.json ./
COPY app/backend/package.json ./app/backend/package.json
COPY app/frontend/package.json ./app/frontend/package.json

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=app/backend --include-workspace-root=false

# Cache prisma generation separately from application source code
COPY app/backend/prisma ./app/backend/prisma
RUN npm run prisma:generate

# Copy source and build
COPY app/backend ./app/backend
RUN npm run build --workspace=app/backend -- --sourceMap false --declaration false --declarationMap false

FROM manifests AS production-deps
WORKDIR /app
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace=app/backend --include-workspace-root=false

# Copy generated Prisma Client from build stage
COPY --from=build /app/app/backend/node_modules/.prisma /app/node_modules/.prisma

# Optional migration stage
FROM build AS migration
WORKDIR /app/app/backend
CMD ["npx", "prisma", "migrate", "deploy"]

# Production Application Runtime stage
FROM base AS runtime
WORKDIR /app
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/app/backend/dist/src ./dist/src
COPY --from=build /app/app/backend/dist/scripts ./dist/scripts
COPY app/backend/prisma ./prisma
COPY app/backend/scripts/database-summary.mjs ./scripts/database-summary.mjs
COPY docker/bootstrap-admin.cjs ./scripts/bootstrap-admin.cjs
COPY docker/backend-entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh
COPY app/backend/package.json ./package.json

RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.scripts={start:'node dist/src/main.js','db:summary':'node scripts/database-summary.mjs','admin:bootstrap':'node scripts/bootstrap-admin.cjs','prisma:deploy':'prisma migrate deploy'};delete p.devDependencies;fs.writeFileSync('package.json',JSON.stringify(p,null,2));"

EXPOSE 4001
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
```

- [x] **Step 3: Kiểm tra build backend local và kiểm tra layer cache**
```bash
docker build -f docker/backend.Dockerfile -t ctv-backend:test .
```
Xác nhận:
- Build thành công.
- Dung lượng ≤ 350 MiB.
- Thay đổi một file trong `app/backend/src/` không làm mất cache layer `npm ci` và `prisma:generate`.

- [x] **Step 4: Commit**
```bash
git add docker/backend.Dockerfile
git commit -m "perf(docker): lock backend production dependencies and layer prisma generation"
```

---

### Task 6: Tối Ưu Cache Buildx Trong CI (P1)

**Files:**
- Modify: `.github/workflows/ci.yml`

- [x] **Step 1: Bổ sung Docker Buildx action trong `ci.yml`**
Thêm step `docker/setup-buildx-action@v3`.

- [x] **Step 2: Cấu hình GitHub Actions cache cho build images**
Tách riêng cache scope giữa backend (`scope=backend`) và frontend (`scope=frontend`).

- [x] **Step 3: Commit**
```bash
git add .github/workflows/ci.yml
git commit -m "ci: add docker buildx action with gha cache for image builds"
```

---

### Task 7: Đánh Giá và Quyết Định Tách Migration (P2)

**Files:**
- Research & Decision Log

- [x] **Step 1: Đo dung lượng của Prisma CLI trong runtime image**
Kiểm tra kích thước thư mục `node_modules/prisma` so với tổng `node_modules`.

- [x] **Step 2: Đánh giá phương án tách migration container**
Nếu dung lượng Prisma CLI < 30 MB và runtime image hiện tại đã nằm thoải mái trong ngân sách (ví dụ < 250 MB), giữ cơ chế migration tự động qua `entrypoint.sh` để đơn giản hóa vận hành và tránh rủi ro race condition khi deploy một container đơn lẻ. Nếu > 50 MB, thiết kế một service migration chạy trước trong compose.

- [x] **Step 3: Ghi nhận quyết định kiến trúc**

---

### Task 8: Kiểm Thử Nghiệm Thu Toàn Diện (Acceptance & Smoke Tests)

**Files:**
- Run test commands

- [x] **Step 1: Kiểm tra ngân sách dung lượng**
```bash
node scripts/check-image-sizes.mjs ctv-backend:test ctv-frontend:test
```

- [x] **Step 2: Chạy kiểm tra deployment startup**
```bash
node scripts/check-deployment-startup.mjs
```

- [x] **Step 3: Kiểm tra smoke test trên container thật**
1. Chạy compose lên: `docker compose up -d`
2. Kiểm tra log backend xem migration có tự động chạy thành công không: `docker compose logs backend`
3. Kiểm tra đăng nhập (xác thực Argon2).
4. Kiểm tra upload file CCCD/CV và tải xuống.
5. Kiểm tra Nginx proxy đến API backend.
6. Dọn dẹp sau kiểm thử: `docker compose down`
