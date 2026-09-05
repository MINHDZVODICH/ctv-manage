# Remove Frontend 17:30 Cutoff & Add Auto-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all frontend time-based cutoff and history suppression logic so the database is the sole source of truth, implement automatic history refetching on window focus, visibility change, and post-17:30 snapshot, and remove deprecated backend sync aliases.

**Architecture:**
- **Backend:** Remove legacy `syncDailyHistory` and `syncWorkHistory` aliases from `schedule.service.ts`; keep `snapshotTodayWorkHistory` and 17:30 scheduler untouched.
- **Frontend Core Helper:** Export `getMsUntilPostCutoffRefresh(now?: Date): number | null` in `utils/scheduleSelectors.ts` for scheduling a one-time refresh at 17:30:01 Asia/Bangkok.
- **Frontend Screens & Modal:**
  - `SummaryScheduleScreen.tsx`: Delete `isAfterCutoffTime()`, remove `isHistorical` frontend gate, render history directly from API response, attach `focus`/`visibilitychange` refetch and post-17:30 timer.
  - `CTVScheduleWorkspace.tsx`: Remove `isPastOrToday` gate, render shifts directly with `getHistoryShift()`, extract `fetchWorkHistory()`, attach `focus`/`visibilitychange` refetch and post-17:30 timer.
  - `ViewAccountDetailModal.tsx`: Extract `fetchAccountHistory()`, attach `focus`/`visibilitychange` refetch and post-17:30 timer while modal and work-history view are active.
- **Verification:** Playwright E2E tests verifying that today's history renders regardless of clock time, refetches on window focus/visibility change, and refreshes after cutoff timer.

**Tech Stack:** React 19, TypeScript 5.8, Express 4.21, Prisma 6.4, Vitest 3.2, Playwright 1.55.

---

### Task 1: Backend — Remove Legacy History-Sync Aliases

**Files:**
- Modify: `app/backend/src/modules/schedule/schedule.service.ts`
- Test: `app/backend/tests/schedule-redesign.integration.test.ts`
- Test: `app/backend/tests/schedules-and-history.integration.test.ts`

- [ ] **Step 1: Remove aliases in `schedule.service.ts`**

Delete:
```ts
export const syncDailyHistory = snapshotTodayWorkHistory;
```
and:
```ts
export const syncWorkHistory = syncDailyHistory;
```

- [ ] **Step 2: Run backend tests to ensure zero breakages**

Run: `npm test` in `app/backend`
Expected: PASS (all 10 test files and 66 tests passing).

---

### Task 2: Frontend — Shared Cutoff Refresh Delay Calculator

**Files:**
- Modify: `app/frontend/src/utils/scheduleSelectors.ts`

**Interfaces:**
- Produces:
  ```ts
  export function getMsUntilPostCutoffRefresh(now?: Date): number | null;
  ```

- [ ] **Step 1: Implement `getMsUntilPostCutoffRefresh`**

In `app/frontend/src/utils/scheduleSelectors.ts`:
Calculate time in Asia/Bangkok. Target 10:30:01 UTC (17:30:01 Bangkok) on today's calendar date in Bangkok.
If target is in the future relative to `now`, return positive difference in ms; otherwise return `null`.

---

### Task 3: Frontend — Remove Frontend Cutoff & Implement History Refetching

**Files:**
- Modify: `app/frontend/src/components/Screens/SummaryScheduleScreen.tsx`
- Modify: `app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx`
- Modify: `app/frontend/src/components/Modals/ViewAccountDetailModal.tsx`

- [ ] **Step 1: Update `SummaryScheduleScreen.tsx`**

1. Delete `isAfterCutoffTime()` function.
2. Remove `const isHistorical = dateISO < todayISO || (isToday && isAfterCutoffTime());`.
3. Set `morningCTVs = getAssignedCTVs(dateISO, "morning");` and `afternoonCTVs = getAssignedCTVs(dateISO, "afternoon");` directly.
4. Render morning/afternoon shift buttons directly without `isHistorical` wrapping.
5. In `SummaryScheduleScreen`:
   - Keep `fetchHistoryMonth(date: Date)` as single history loader.
   - Add `useEffect` for `window:focus` and `document:visibilitychange` when `view === "history"`.
   - Add `useEffect` with `getMsUntilPostCutoffRefresh()` to trigger `fetchHistoryMonth(calendarDate)` when `view === "history"`.

- [ ] **Step 2: Update `CTVScheduleWorkspace.tsx`**

1. In month view grid rendering, remove `const isPastOrToday = dateISO <= todayISO;`.
2. Replace with direct lookup:
   ```tsx
   const morningShift = getHistoryShift(date, "morning");
   const afternoonShift = getHistoryShift(date, "afternoon");
   ```
3. Extract inline history request to `fetchWorkHistory = useCallback(...)`.
4. Refetch when:
   - switching to Work History (`calendarView === "month"`),
   - changing month (`calendarDate`),
   - pressing Retry (`historyRetryKey`).
5. Add `useEffect` for `window:focus` and `document:visibilitychange` to refetch when visible.
6. Add `useEffect` with `getMsUntilPostCutoffRefresh()` to trigger `fetchWorkHistory()` if open across 17:30.

- [ ] **Step 3: Update `ViewAccountDetailModal.tsx`**

1. Extract inline history request into `fetchAccountHistory = useCallback(...)`.
2. Refetch when:
   - `showWorkHistory` opens,
   - `account?.id` changes,
   - `historyDate` (month) changes.
3. Add `useEffect` for `window:focus` and `document:visibilitychange` while `showWorkHistory` is true and account is a CTV.
4. Add `useEffect` with `getMsUntilPostCutoffRefresh()` to trigger `fetchAccountHistory()` while modal is open across 17:30.

- [ ] **Step 4: Run frontend typecheck and build**

Run: `npm run typecheck` in `app/frontend`
Run: `npm run build` in `app/frontend`
Expected: PASS with 0 errors.

---

### Task 4: Tests & Verification

**Files:**
- Modify: `app/frontend/e2e/ctv.spec.ts`
- Modify: `app/frontend/e2e/admin.spec.ts`

- [ ] **Step 1: Add E2E tests for History display without frontend clock suppression and for auto-refresh**

1. Verify CTV Work History renders today's shift from API even if mock date / clock is morning.
2. Verify Summary Work History renders today's shift from API even if mock date / clock is morning.
3. Verify window focus and document visibility events trigger history refetch.

- [ ] **Step 2: Run all Playwright E2E tests**

Run: `npx playwright test` in `app/frontend`
Expected: PASS (all tests passing).

- [ ] **Step 3: Run backend test suite**

Run: `npm test` in `app/backend`
Expected: PASS (all 66 tests passing).
