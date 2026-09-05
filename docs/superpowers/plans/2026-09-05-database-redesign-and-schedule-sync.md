# Kế hoạch Thực hiện: Tái cấu trúc Cơ sở dữ liệu & Đồng nhất Lịch làm việc / Lịch sử

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tinh gọn cơ sở dữ liệu thành 3 bảng cốt lõi (`Schedule`, `Shift`, `History`), lấy "Đăng ký lịch làm việc" làm nguồn chân lý duy nhất, đồng nhất dữ liệu trên 4 màn hình lịch tuần và 3 màn hình lịch sử làm việc, chốt lịch sử hôm nay sau 17:30 và xóa bỏ thông báo thừa.

**Architecture:** 
- Thay thế 5 bảng cũ (`ScheduleRegistration`, `SchedulePatternSlot`, `ShiftAssignment`, `WorkHistory`, và `Shift` cũ) bằng 3 bảng chuẩn hóa: `Schedule` (lịch tuần và buồng của CTV), `Shift` (các ca Thứ 2-Thứ 6 của lịch đó), và `History` (lịch sử ca làm việc đã hoàn thành).
- Backend cung cấp API đọc/ghi trực tiếp từ `Schedule` và `Shift` cho lịch tuần; và đọc/ghi `History` cho lịch sử với logic snapshot sau 17:30 (Asia/Bangkok).
- Frontend đồng nhất 4 màn hình lịch tuần đọc từ `Schedule`+`Shift`, và 3 màn hình lịch sử đọc từ `History`, loại bỏ thông báo thừa "Chưa có ca làm việc đã hoàn thành trong tháng này.".

**Tech Stack:** TypeScript, Node.js, Express, Prisma ORM, PostgreSQL, React 19, Tailwind CSS, Playwright.

**Spec:** [docs/superpowers/specs/2026-09-05-database-redesign-and-schedule-sync-design.md](file:///E:/CTV_Manage/docs/superpowers/specs/2026-09-05-database-redesign-and-schedule-sync-design.md)

## Global Constraints

- Tên 3 bảng mới: `Schedule`, `Shift`, `History`. Bỏ hoàn toàn các bảng: `ScheduleRegistration`, `SchedulePatternSlot`, `ShiftAssignment`, `WorkHistory`, và bảng `Shift` cũ.
- Múi giờ chuẩn hóa: `Asia/Bangkok` (UTC+7).
- Quy tắc chốt lịch sử: Trước 17:30 hôm nay ô lịch sử hôm nay để trống. Sau 17:30 hôm nay tự động chốt các ca hôm nay vào `History`. Thay đổi lịch trình không ảnh hưởng lịch sử đã chốt.
- Bỏ dòng thông báo: *"Chưa có ca làm việc đã hoàn thành trong tháng này."* trên giao diện.
- Đảm bảo 100% typecheck và test pass sau khi hoàn thành.

---

### Task 1: Prisma Schema & Migration cho Schedule, Shift, History

**Files:**
- Modify: `app/backend/prisma/schema.prisma`
- Modify: `app/backend/prisma/seed.ts`
- Test: `app/backend/tests/setup.ts`

**Interfaces:**
- Produces Prisma models:
  - `prisma.schedule`: `{ id, accountId, roomCode, version, createdAt, updatedAt }`
  - `prisma.shift`: `{ scheduleId, weekday, period }`
  - `prisma.history`: `{ id, accountId, workDate, period, roomCode, status, recordedAt }`

- [ ] **Step 1: Cập nhật `schema.prisma`**
Xóa bỏ các model `ScheduleRegistration`, `SchedulePatternSlot`, `ShiftAssignment`, `WorkHistory`, `Shift` cũ trong [schema.prisma](file:///E:/CTV_Manage/app/backend/prisma/schema.prisma). Thêm 3 model mới:
```prisma
model Schedule {
  id        String   @id @default(cuid())
  accountId String   @unique
  roomCode  String   // ROOM_1..4
  version   Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  shifts  Shift[]

  @@index([accountId])
}

model Shift {
  scheduleId String
  weekday    Int    // 1..5 (Thứ 2..Thứ 6)
  period     String // MORNING | AFTERNOON

  schedule Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

  @@id([scheduleId, weekday, period])
  @@index([scheduleId])
}

model History {
  id         String   @id @default(cuid())
  accountId  String
  workDate   DateTime
  period     String   // MORNING | AFTERNOON
  roomCode   String
  status     String   @default("COMPLETED")
  recordedAt DateTime @default(now())

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, workDate, period])
  @@index([accountId, workDate])
  @@index([workDate, period])
}
```
Và cập nhật model `Account` liên kết với `schedule Schedule?` và `histories History[]`.

- [ ] **Step 2: Chạy Prisma Generate & Push / Migration**
Chạy command:
```bash
npx prisma generate
```
trong thư mục `app/backend`.

- [ ] **Step 3: Cập nhật seed script**
Cập nhật [seed.ts](file:///E:/CTV_Manage/app/backend/prisma/seed.ts) để tạo dữ liệu mẫu cho `Schedule`, `Shift` và `History` của các tài khoản test (CTV1, CTV2, CTV3).

- [ ] **Step 4: Kiểm tra migration và seed**
Chạy:
```bash
npm run seed --workspace=backend
```
Xác nhận dữ liệu mẫu được nạp thành công vào database.

- [ ] **Step 5: Commit**
```bash
git add app/backend/prisma/schema.prisma app/backend/prisma/seed.ts
git commit -m "feat(db): redesign schema with Schedule, Shift and History tables"
```

---

### Task 2: Backend Schedule & History Service (TDD)

**Files:**
- Create: `app/backend/tests/schedule-redesign.integration.test.ts`
- Modify: `app/backend/src/modules/schedule/schedule.service.ts`
- Modify: `app/backend/src/modules/schedule/schedule.controller.ts`
- Modify: `app/backend/src/modules/schedule/schedule.routes.ts`
- Modify: `app/backend/src/modules/accounts/accounts.service.ts`

**Interfaces:**
- Consumes: Prisma models `Schedule`, `Shift`, `History`, `Account`.
- Produces APIs:
  - `GET /api/v1/users/me/schedule` -> `{ data: { roomCode, version, shifts: [{ weekday, period }] } }`
  - `PUT /api/v1/users/me/schedule` -> `{ roomCode, slots: [{ weekday, period }], expectedVersion }`
  - `GET /api/v1/accounts/:id/schedule` -> CTV schedule for admin
  - `GET /api/v1/schedule/weekly-summary` -> `{ cells: [{ weekday, period, count, ctvs: [{ accountId, displayName, roomCode, phone }] }] }`
  - `GET /api/v1/users/me/work-history?month=YYYY-MM` -> `{ month, cells: [...] }`
  - `GET /api/v1/work-history?month=YYYY-MM` -> `{ month, cells: [...] }`

- [ ] **Step 1: Viết failing integration test**
Tạo file `app/backend/tests/schedule-redesign.integration.test.ts`:
- Test 1: Đăng ký lịch tuần `PUT /api/v1/users/me/schedule` -> lưu đúng `Schedule` và các `Shift`.
- Test 2: Đọc lịch tuần `GET /api/v1/users/me/schedule` -> trả về đúng buồng và danh sách ca.
- Test 3: Lịch tuần tổng hợp `GET /api/v1/schedule/weekly-summary` -> đếm chính xác số CTV theo từng `(weekday, period)`.
- Test 4: `syncDailyHistory` trước 17:30 -> ngày hôm nay trống.
- Test 5: `syncDailyHistory` sau 17:30 -> ca hôm nay được lưu vào `History`.
- Test 6: Đổi lịch tuần -> bản ghi cũ trong `History` không bị thay đổi.

- [ ] **Step 2: Chạy test để xác nhận FAIL**
```bash
npm run test:integration -- app/backend/tests/schedule-redesign.integration.test.ts
```
Xác nhận tests fail vì service chưa triển khai.

- [ ] **Step 3: Triển khai Service & Controller**
Trong [schedule.service.ts](file:///E:/CTV_Manage/app/backend/src/modules/schedule/schedule.service.ts):
- Triển khai `getMySchedule`, `upsertSchedule`, `getAccountSchedule`, `getWeeklySummary`.
- Triển khai `syncDailyHistory(now = new Date())`: kiểm tra giờ UTC+7. Nếu < 17:30, chỉ sync các ngày trước hôm nay. Nếu >= 17:30, sync cả hôm nay.
- Triển khai `getWorkHistory(month, accountId?)`: đọc từ bảng `History`.
- Cập nhật [accounts.service.ts](file:///E:/CTV_Manage/app/backend/src/modules/accounts/accounts.service.ts): khi disable tài khoản hoặc xóa tài khoản, xử lý quan hệ `Schedule`.

- [ ] **Step 4: Chạy test để xác nhận PASS**
```bash
npm run test:integration -- app/backend/tests/schedule-redesign.integration.test.ts
```
Xác nhận tất cả tests pass.

- [ ] **Step 5: Commit**
```bash
git add app/backend/src/modules/schedule/ app/backend/src/modules/accounts/ app/backend/tests/
git commit -m "feat(backend): implement Schedule, Shift and History APIs with 17:30 snapshot logic"
```

---

### Task 3: Frontend Mappers & Types

**Files:**
- Modify: `app/frontend/src/types.ts`
- Modify: `app/frontend/src/shared/mappers.ts`

**Interfaces:**
- Produces:
  - Type `ScheduleResponse`: `{ roomCode: string; version: number; shifts: { weekday: number; period: string }[] }`
  - Function `scheduleToWeeklyPattern(shifts: { weekday: number; period: string }[]): WeeklyPattern`
  - Function `weeklySummaryToSlots(cells: ApiWeeklySummaryCell[]): ShiftSlot[]`
  - Function `historyCellsToSlots(cells: ApiHistoryCell[]): ShiftSlot[]`

- [ ] **Step 1: Cập nhật types.ts**
Định nghĩa interface cho `ScheduleResponse`, `WeeklySummaryResponse`, `HistoryResponse`.

- [ ] **Step 2: Cập nhật mappers.ts**
Viết mapper ánh xạ từ API mới sang UI model:
- `scheduleToPattern(data: ScheduleResponse): WeeklyPattern`
- `weeklySummaryToSlots(cells)`
- `historyToSlots(cells)`

- [ ] **Step 3: Kiểm tra typecheck**
```bash
npm run typecheck --workspace=frontend
```

- [ ] **Step 4: Commit**
```bash
git add app/frontend/src/types.ts app/frontend/src/shared/mappers.ts
git commit -m "feat(frontend): add mappers and types for Schedule, Shift and History"
```

---

### Task 4: Đồng nhất CTVScheduleWorkspace (Lịch tuần, Đăng ký & Lịch sử CTV)

**Files:**
- Modify: `app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx`
- Test: `app/frontend/e2e/ctv.spec.ts`

**Requirements:**
- Màn hình Đăng ký lịch làm việc: gọi `GET /api/v1/users/me/schedule`, lưu bằng `PUT /api/v1/users/me/schedule`.
- Lịch tuần: hiển thị trực tiếp từ `shifts` của CTV.
- Tab Lịch sử làm việc:
  - Gọi `GET /api/v1/users/me/work-history?month=...`.
  - Hiển thị các ca Sáng/Chiều đã lưu trong `History`.
  - **Xóa bỏ hoàn toàn dòng thông báo**: `"Chưa có ca làm việc đã hoàn thành trong tháng này."`.
  - Nếu trước 17:30 hôm nay, ô hôm nay để trống. Nếu sau 17:30, hiển thị ca hôm nay.

- [ ] **Step 1: Cập nhật logic load & save schedule trong CTVScheduleWorkspace**
Thay thế API endpoint cũ bằng `/api/v1/users/me/schedule`. Cập nhật state `weeklyPattern` và `room` từ API mới.

- [ ] **Step 2: Xóa khối thông báo "Chưa có ca làm việc..."**
Tìm và xóa:
```tsx
{!isHistoryLoading && !historyError && historyShifts.length === 0 && (
  <div className="rounded-xl border border-slate-200 ...">
    Chưa có ca làm việc đã hoàn thành trong tháng này.
  </div>
)}
```

- [ ] **Step 3: Cập nhật hiển thị lịch sử làm việc theo quy tắc 17:30**
Cập nhật `getHistoryShift` để đọc chính xác ca của CTV từ `historyShifts`.

- [ ] **Step 4: Kiểm tra giao diện và typecheck**
```bash
npm run typecheck --workspace=frontend
npm run build --workspace=frontend
```

- [ ] **Step 5: Commit**
```bash
git add app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx
git commit -m "feat(frontend): sync CTV schedule workspace with new APIs and remove notice"
```

---

### Task 5: Đồng nhất ViewAccountDetailModal (Hồ sơ & Lịch trình tài khoản)

**Files:**
- Modify: `app/frontend/src/components/Modals/ViewAccountDetailModal.tsx`

**Requirements:**
- Badge Buồng làm việc: Hiển thị đúng `schedule.roomCode` của CTV (ví dụ: `Buồng 1`), không hiển thị "Chưa cập nhật" khi CTV đã đăng ký.
- Lưới Lịch trình làm việc Thứ 2..Thứ 6: Hiển thị đúng các thẻ Ca Sáng, Ca Chiều từ `shifts` của CTV.
- Modal Lịch sử làm việc: Đọc từ `/api/v1/work-history?month=...&accountId=...`, hiển thị các ca hoàn thành khớp 100% với bên CTV.

- [ ] **Step 1: Load dữ liệu Schedule cho tài khoản trong modal**
Khi mở modal, gọi `GET /api/v1/accounts/:id/schedule` để lấy `roomCode` và `shifts`.
Cập nhật `assignedWorkRoom` hiển thị đúng buồng từ `schedule.roomCode`.

- [ ] **Step 2: Cập nhật lưới Thứ 2 - Thứ 6 trong tab Lịch trình**
Hiển thị thẻ Ca Sáng / Ca Chiều dựa trên các ca trong `shifts` của tài khoản này.

- [ ] **Step 3: Cập nhật modal Lịch sử làm việc**
Gọi `GET /api/v1/work-history?month=...&accountId=...` và render các ca hoàn thành từ `History`.

- [ ] **Step 4: Kiểm tra typecheck & build**
```bash
npm run typecheck --workspace=frontend
```

- [ ] **Step 5: Commit**
```bash
git add app/frontend/src/components/Modals/ViewAccountDetailModal.tsx
git commit -m "feat(frontend): sync account detail schedule and history with new models"
```

---

### Task 6: Đồng nhất SummaryScheduleScreen (Lịch tuần tổng hợp & Lịch sử tổng hợp)

**Files:**
- Modify: `app/frontend/src/components/Screens/SummaryScheduleScreen.tsx`

**Requirements:**
- Tab "Lịch tuần tổng hợp":
  - Gọi `GET /api/v1/schedule/weekly-summary`.
  - Hiển thị số lượng CTV đăng ký từng ca T2-T6 (ví dụ: `2 CTV`, `5 CTV`).
  - Khi click vào ca, hiển thị danh sách đúng các CTV và buồng của họ (`roomCode`).
- Tab "Lịch sử tổng hợp":
  - Gọi `GET /api/v1/work-history?month=...`.
  - Tổng hợp từ bảng `History`. Hiển thị đúng số lượng CTV theo từng ngày đã qua (và hôm nay nếu $\ge$ 17:30).

- [ ] **Step 1: Cập nhật tab Lịch tuần tổng hợp**
Gọi API `weekly-summary`, render số lượng CTV và danh sách chi tiết CTV theo ca tuần.

- [ ] **Step 2: Cập nhật tab Lịch sử tổng hợp**
Đọc dữ liệu từ `getWorkHistory` tháng, gom nhóm theo `workDate` và `period`.

- [ ] **Step 3: Kiểm tra typecheck & build**
```bash
npm run typecheck --workspace=frontend
npm run build --workspace=frontend
```

- [ ] **Step 4: Commit**
```bash
git add app/frontend/src/components/Screens/SummaryScheduleScreen.tsx
git commit -m "feat(frontend): sync summary schedule and history screen with new models"
```

---

### Task 7: Xác minh Toàn diện & Cập nhật E2E Tests (Verification)

**Files:**
- Modify: `app/frontend/e2e/ctv.spec.ts`
- Modify: `app/frontend/e2e/registration.spec.ts`
- Modify: `app/backend/tests/schedules-and-history.integration.test.ts`

- [ ] **Step 1: Cập nhật test suite backend**
Cập nhật các integration test cũ để chạy mượt mà với schema mới.

- [ ] **Step 2: Cập nhật E2E tests frontend**
Đảm bảo các test E2E kiểm tra đúng luồng:
1. CTV đăng ký Buồng 1 + ca T2 sáng, T3 chiều.
2. Lịch tuần CTV hiển thị đúng T2 sáng, T3 chiều.
3. Modal Hồ sơ CTV hiển thị Buồng 1 + T2 sáng, T3 chiều.
4. Lịch tuần tổng hợp hiển thị đúng số CTV và danh sách buồng.
5. Lịch sử hiển thị đồng nhất trên cả 3 màn hình và không còn dòng chữ thông báo thừa.

- [ ] **Step 3: Chạy toàn bộ Verification Commands**
```bash
npm run typecheck --workspace=backend
npm run typecheck --workspace=frontend
npm run build --workspace=frontend
npm run test:integration --workspace=backend
```

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "test: verify database redesign and schedule/history synchronization across all views"
```
