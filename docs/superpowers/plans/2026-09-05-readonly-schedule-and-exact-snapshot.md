# Read-Only Weekly Schedule, History Display, and Exact 17:30 History Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Weekly Schedule and Work History views into clean, non-interactive read-only displays (removing `selectedShift`, shift-detail modal, and button wrappers), and replace the 14-day backfill history sync with an idempotent, exact 17:30 Asia/Bangkok snapshot of today's schedule into `History`.

**Architecture:** 
- Frontend: `CTVScheduleWorkspace.tsx` replaces `<button>` shift cards with a dedicated non-interactive `ShiftBadge` component for morning and afternoon shifts, deletes `selectedShift` state, Escape listeners, and the 140+ line shift-detail modal. The only mutation path is the "Cập nhật" (Update) button opening the weekly schedule modal.
- Backend: `schedule.service.ts` replaces `syncDailyHistory` with `snapshotTodayWorkHistory(now = new Date())`, which runs strictly for weekdays after 17:30 Bangkok, snapshots only today's schedule using `prisma.history.createMany({ data, skipDuplicates: true })` without backfilling past days. `GET /users/me/work-history` reads strictly from `History`, returning a clean `{ month, entries: [{ id, workDate, period, roomCode }], cells }` DTO.
- Scheduling: `main.ts` removes the hourly interval and calculates the exact timer delay to 17:30 Asia/Bangkok, running once on startup only to recover if restarted after 17:30.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS, Express 4.21, Prisma 6.4, PostgreSQL, Vitest 3.2, Playwright 1.55.

---

## Tasks

### Task 1: Backend — Exact 17:30 Snapshot & Dedicated CTV History DTO (TDD)

**Files:**
- Modify: `app/backend/src/modules/schedule/schedule.service.ts`
- Modify: `app/backend/src/modules/schedule/schedule.controller.ts`
- Modify: `app/backend/src/main.ts`
- Test: `app/backend/tests/schedule-redesign.integration.test.ts`
- Test: `app/backend/tests/schedules-and-history.integration.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export async function snapshotTodayWorkHistory(now?: Date): Promise<{
    processedCount: number;
    skipped?: boolean;
    reason?: string;
  }>;
  export const syncDailyHistory = snapshotTodayWorkHistory;
  export const syncWorkHistory = snapshotTodayWorkHistory;
  export async function getMyWorkHistory(accountId: string, month: string): Promise<{
    month: string;
    entries: Array<{ id: string; workDate: string; period: string; roomCode: string }>;
    cells: any[];
  }>;
  ```

- [ ] **Step 1: Write the failing tests in `schedule-redesign.integration.test.ts`**

Update Test 4, 5, 6 in `app/backend/tests/schedule-redesign.integration.test.ts`:
1. Assert `snapshotTodayWorkHistory` at 10:00 UTC (17:00 Bangkok, before 17:30) returns `processedCount: 0` and leaves today empty.
2. Assert `snapshotTodayWorkHistory` on a weekend returns `processedCount: 0` and leaves the database empty.
3. Assert `snapshotTodayWorkHistory` at 10:30 UTC (17:30 Bangkok) snapshots only today's shifts into `History`.
4. Assert running `snapshotTodayWorkHistory` a second time creates 0 duplicates (`skipDuplicates: true`).
5. Assert updating CTV schedule after 17:30 does not alter existing history records.
6. Assert `GET /api/v1/users/me/work-history?month=...` returns `entries: [{ id, workDate, period, roomCode }]`.

- [ ] **Step 2: Run backend test to verify failure**

Run: `npm test` in `app/backend`
Expected: FAIL (because `snapshotTodayWorkHistory` or new test assertions are not yet exported/adapted).

- [ ] **Step 3: Implement `snapshotTodayWorkHistory` and `getMyWorkHistory` in `schedule.service.ts`**

In `app/backend/src/modules/schedule/schedule.service.ts`:
1. Replace `syncDailyHistory` with `snapshotTodayWorkHistory(now = new Date())`:
   - Compute Asia/Bangkok time (`UTC+7`).
   - If `hours < 17 || (hours === 17 && minutes < 30)`, return `{ processedCount: 0, skipped: true, reason: 'BEFORE_CUTOFF' }`.
   - If `jsDay === 0 || jsDay === 6` (weekend), return `{ processedCount: 0, skipped: true, reason: 'WEEKEND' }`.
   - Take only `todayYmd` (no 14-day lookback, no backfill).
   - Collect matching CTV shifts for `todayYmd` and execute:
     ```ts
     const result = await prisma.history.createMany({
       data: historyEntries,
       skipDuplicates: true,
     });
     ```
   - Alias: `export const syncDailyHistory = snapshotTodayWorkHistory;` and `export const syncWorkHistory = snapshotTodayWorkHistory;`.
2. Add dedicated `getMyWorkHistory(accountId: string, month: string)`:
   - Query `prisma.history.findMany({ where: { accountId, workDate: { gte: range.from, lte: range.to } } })`.
   - Return `{ month, entries, cells }`.
3. In `schedule.controller.ts`:
   - Update `getMyWorkHistory` to call `service.getMyWorkHistory(user.id, q.month)`.
4. In `main.ts`:
   - Replace hourly `setInterval` with exact timer calculation targeting `17:30 Asia/Bangkok` (10:30 UTC).
   - On server startup, run `snapshotTodayWorkHistory()` once.

- [ ] **Step 4: Run backend tests to verify they pass**

Run: `npm test` in `app/backend`
Expected: PASS (all 10 test files and 66 tests passing).

- [ ] **Step 5: Commit backend changes**

```bash
git add app/backend/src app/backend/tests
git commit -m "feat(backend): implement idempotent 17:30 history snapshot and dedicated CTV history DTO"
```

---

### Task 2: Frontend — Read-Only ShiftBadge & Remove Shift Detail Modal

**Files:**
- Modify: `app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx`
- Modify: `app/frontend/src/shared/mappers.ts` (if needed)

**Interfaces:**
- Produces:
  ```tsx
  interface ShiftBadgeProps {
    shiftType: "morning" | "afternoon";
    ariaLabel?: string;
    language?: string;
  }
  ```
  Non-interactive, read-only display element replacing clickable `<button>` shift cards in both Weekly Schedule and Work History views.

- [ ] **Step 1: Create `ShiftBadge` component in `CTVScheduleWorkspace.tsx`**

Implement `ShiftBadge`:
```tsx
const ShiftBadge: React.FC<{
  shiftType: "morning" | "afternoon";
  ariaLabel?: string;
  language?: string;
}> = ({ shiftType, ariaLabel, language }) => {
  const isMorning = shiftType === "morning";
  return (
    <div
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold shadow-2xs select-none ${
        isMorning
          ? "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-purple-200/90 bg-purple-50 text-purple-900 dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-200"
      }`}
      aria-label={ariaLabel}
    >
      <span
        className={`material-symbols-outlined text-[18px] ${
          isMorning ? "text-amber-700 dark:text-amber-400" : "text-purple-700 dark:text-purple-400"
        }`}
        aria-hidden="true"
      >
        {isMorning ? "wb_sunny" : "wb_twilight"}
      </span>
      <span className={isMorning ? "text-amber-900 dark:text-amber-100" : "text-purple-900 dark:text-purple-100"}>
        {language === "Tiếng Anh"
          ? (isMorning ? "Morning" : "Afternoon")
          : (isMorning ? "Ca Sáng" : "Ca Chiều")}
      </span>
    </div>
  );
};
```

- [ ] **Step 2: Remove interactive states, unused helpers, and shift-detail modal in `CTVScheduleWorkspace.tsx`**

1. Remove `selectedShift` state (`const [selectedShift, setSelectedShift] = useState(...)`).
2. Remove `handleEscape` listener on `selectedShift`.
3. Remove `formatFullDate` and `getShiftMeta` unused helpers.
4. In Weekly Schedule view: replace `<button onClick={() => setSelectedShift(...)} ...>` with `<ShiftBadge shiftType="morning" ... />` and `<ShiftBadge shiftType="afternoon" ... />`.
5. In Work History view: replace `<button onClick={() => setSelectedShift(...)} ...>` with `<ShiftBadge shiftType="morning" ... />` and `<ShiftBadge shiftType="afternoon" ... />`.
6. Remove the entire `{selectedShift && (<div role="dialog" ...>...</div>)}` modal block (lines ~940-1080).
7. Ensure history fetching consumes `response.data?.entries ?? response.entries` if available, falling back to `response.data?.cells ?? response.cells`.

- [ ] **Step 3: Run frontend typecheck and build**

Run: `npm run typecheck` in `app/frontend`
Run: `npm run build` in `app/frontend`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit frontend changes**

```bash
git add app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx
git commit -m "feat(frontend): make weekly schedule and work history read-only with ShiftBadge"
```

---

### Task 3: Verification & E2E Testing

**Files:**
- Modify: `app/frontend/e2e/ctv.spec.ts`
- Documentation: `docs/USE-CASE.md`

- [ ] **Step 1: Update Playwright E2E tests in `ctv.spec.ts`**

1. In Weekly Schedule: verify shift cards are rendered as non-clickable items (no button role for shift cards, no dialog opens on click).
2. In Work History: verify history shift cards are rendered as non-clickable items.
3. Verify editing is strictly triggered via the "Cập nhật" (Update) button.

- [ ] **Step 2: Run all Playwright E2E tests**

Run: `npx playwright test` in `app/frontend`
Expected: PASS (all 17 tests passing).

- [ ] **Step 3: Update documentation in `docs/USE-CASE.md`**

Document:
- Lịch tuần và Lịch sử làm việc hoàn toàn ở chế độ chỉ đọc (Read-only), không có modal chi tiết ca riêng lẻ.
- Mọi thao tác chỉnh sửa lịch tuần chỉ thực hiện qua nút "Cập nhật" (Update).
- Cơ chế chốt lịch sử: snapshot cố định vào 17:30 hằng ngày theo giờ Asia/Bangkok cho ngày hiện tại (không backfill 14 ngày trước đó).

- [ ] **Step 4: Commit and Push**

```bash
git add app/frontend/e2e/ctv.spec.ts docs/USE-CASE.md
git commit -m "test(e2e): assert read-only schedule cards and update use-case documentation"
git push origin main
```
