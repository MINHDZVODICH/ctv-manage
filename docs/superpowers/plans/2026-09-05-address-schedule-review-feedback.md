# Address Schedule & Work History Review Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address code review feedback on Schedule & Work History by simplifying frontend workspace props, delivering a dedicated CTV History DTO without `cells` or `status`, updating the frontend consumer, and migrating legacy test references from `syncDailyHistory` to `snapshotTodayWorkHistory`.

**Architecture:**
- **Backend Service & Controller:** `getMyWorkHistory` in `schedule.service.ts` queries `prisma.history` directly for the authenticated `accountId`, mapping strictly to `{ month, entries: [{ id, workDate, period, roomCode }] }` (no `cells`, no `count`, no `shiftAssignments`, no `status`).
- **Frontend Mappers & Workspace:** `mappers.ts` provides `historyEntriesToSlots` to map CTV history entries to display slots; `CTVScheduleWorkspace.tsx` consumes `response.data?.entries ?? response.entries`, and drops obsolete `shifts` and `onUpdateShifts` props; `ScheduleScreen.tsx` caller is cleaned up.
- **Tests:** `schedules-and-history.integration.test.ts` and `schedule-redesign.integration.test.ts` replace all remaining `syncDailyHistory` calls with `snapshotTodayWorkHistory`, and assert the dedicated DTO contract on `/api/v1/users/me/work-history`.

**Tech Stack:** React 19, TypeScript 5.8, Express 4.21, Prisma 6.4, Vitest 3.2, Playwright 1.55.

---

### Task 1: Backend — Dedicated CTV DTO & Status Cleanup

**Files:**
- Modify: `app/backend/src/modules/schedule/schedule.service.ts:449-452`
- Test: `app/backend/tests/schedule-redesign.integration.test.ts`
- Test: `app/backend/tests/schedules-and-history.integration.test.ts`
- Test: `app/backend/tests/files-and-schedule.integration.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CTVWorkHistoryEntry {
    id: string;
    workDate: string;
    period: 'MORNING' | 'AFTERNOON';
    roomCode: string;
  }
  export interface CTVWorkHistoryResult {
    month: string;
    entries: CTVWorkHistoryEntry[];
  }
  export async function getMyWorkHistory(accountId: string, month: string): Promise<CTVWorkHistoryResult>;
  ```

- [ ] **Step 1: Update backend tests to assert dedicated CTV DTO**

In `app/backend/tests/schedule-redesign.integration.test.ts`:
- Replace `cellsBefore` assertion on `/users/me/work-history` with `entriesBefore` assertion (length 0).
- Update `workHistoryResAfter` assertion on `/users/me/work-history`:
  - `expect(dataAfter.entries).toHaveLength(2)`
  - `expect(dataAfter.cells).toBeUndefined()`
  - `expect(dataAfter.entries[0].status).toBeUndefined()`

In `app/backend/tests/schedules-and-history.integration.test.ts`:
- Update line 212: assert `histApiRes.body.data.entries.length >= 1`.
- Update lines 278-279: assert `todayEntriesBefore` (length 0).
- Update lines 304-309: assert `ctvHistAfter.body.data.entries` has matching entry for 2026-09-02 MORNING ROOM_1.

In `app/backend/tests/files-and-schedule.integration.test.ts`:
- Update lines 164-179: assert `ownHistory.body.data.entries` contains `workDate: '2024-01-08'`, `period: 'MORNING'`, `roomCode: 'ROOM_1'`.

- [ ] **Step 2: Run tests to verify failure on current backend**

Run: `npm test` in `app/backend`
Expected: FAIL because `getMyWorkHistory` still returns `cells` and `status`.

- [ ] **Step 3: Implement dedicated `getMyWorkHistory` in `schedule.service.ts`**

Replace `getMyWorkHistory` in `app/backend/src/modules/schedule/schedule.service.ts`:
```ts
export async function getMyWorkHistory(accountId: string, month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw Errors.badRequest('INVALID_MONTH', 'month must be YYYY-MM');
  }

  const range = monthRangeToUtcDates(month);
  const rows = await prisma.history.findMany({
    where: {
      accountId,
      workDate: { gte: range.from, lte: range.to },
    },
    orderBy: [{ workDate: 'asc' }, { period: 'asc' }],
  });

  const entries = rows.map((row) => ({
    id: row.id,
    workDate: formatUtcDateToYmd(row.workDate),
    period: row.period,
    roomCode: row.roomCode,
  }));

  return { month, entries };
}
```

- [ ] **Step 4: Run backend tests to verify pass**

Run: `npm test` in `app/backend`
Expected: PASS with all 10 test files passing.

---

### Task 2: Tests — Migrate Legacy `syncDailyHistory` Calls to `snapshotTodayWorkHistory`

**Files:**
- Modify: `app/backend/tests/schedules-and-history.integration.test.ts`
- Modify: `app/backend/tests/schedule-redesign.integration.test.ts`

- [ ] **Step 1: Replace legacy calls in `schedules-and-history.integration.test.ts`**

- Replace `syncDailyHistory` in imports with `snapshotTodayWorkHistory`.
- Replace calls `await syncDailyHistory()` and `await syncDailyHistory(...)` with `await snapshotTodayWorkHistory(...)`.

- [ ] **Step 2: Clean up imports in `schedule-redesign.integration.test.ts`**

- Remove unused `syncDailyHistory` from imports.

- [ ] **Step 3: Run backend test suite**

Run: `npm test` in `app/backend`
Expected: PASS (all tests pass without referencing legacy `syncDailyHistory`).

---

### Task 3: Frontend — Simplify Workspace Props & Consume Dedicated CTV DTO

**Files:**
- Modify: `app/frontend/src/shared/mappers.ts`
- Modify: `app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx`
- Modify: `app/frontend/src/components/Screens/ScheduleScreen.tsx`
- Modify: `app/frontend/e2e/ctv.spec.ts`

- [ ] **Step 1: Add `historyEntriesToSlots` and `ApiHistoryEntry` in `mappers.ts`**

Export `ApiHistoryEntry` and `historyEntriesToSlots` in `app/frontend/src/shared/mappers.ts`:
```ts
export interface ApiHistoryEntry {
  id: string;
  workDate: string;
  period: 'MORNING' | 'AFTERNOON' | string;
  roomCode: string;
}

export function historyEntriesToSlots(entries: ApiHistoryEntry[]): ShiftSlot[] {
  return (entries ?? []).map((entry) => {
    const shiftType = mapPeriodToShiftType(entry.period);
    const dayIndex = dayIndexFromYmd(entry.workDate);
    return {
      id: entry.id,
      dayIndex,
      dayName: DAY_NAMES[dayIndex] ?? '',
      dateStr: dateStrFromYmd(entry.workDate),
      shiftType,
      shiftTimeLabel: shiftTimeLabel(entry.period),
      status: 'Đã đăng ký',
      allowRegister: false,
      assignedCTVs: [],
      workDate: entry.workDate,
    };
  });
}
```

- [ ] **Step 2: Simplify `CTVScheduleWorkspace.tsx` props and read `entries`**

1. Remove `shifts` and `onUpdateShifts` from `CTVScheduleWorkspaceProps`.
2. Remove `shifts: _shifts` and `onUpdateShifts: _onUpdateShifts` from parameter destructuring.
3. Update history fetching:
```tsx
const entries: ApiHistoryEntry[] | undefined = response.data?.entries ?? response.entries;
if (Array.isArray(entries)) {
  setHistoryShifts(historyEntriesToSlots(entries));
} else {
  const cells: ApiSummaryCell[] = response.data?.cells ?? response.cells ?? [];
  setHistoryShifts(summaryToSlots(cells));
}
```

- [ ] **Step 3: Remove props from `ScheduleScreen.tsx` caller**

In `app/frontend/src/components/Screens/ScheduleScreen.tsx`:
Render `<CTVScheduleWorkspace currentUser={ctvUser} onShowToast={onShowToast} onReload={onReload} />` without `shifts` or `onUpdateShifts`.

- [ ] **Step 4: Update E2E test mock in `app/frontend/e2e/ctv.spec.ts`**

Update mocked response for `/users/me/work-history` to return `entries: [{ id: 'history-shift-1', workDate, period: 'MORNING', roomCode: 'ROOM_1' }]`.

- [ ] **Step 5: Typecheck & build frontend**

Run: `npm run typecheck` in `app/frontend`
Run: `npm run build` in `app/frontend`
Expected: PASS with 0 errors.

---

### Task 4: End-to-End Verification & Documentation

**Files:**
- Run: `npx playwright test` in `app/frontend`
- Modify: `docs/USE-CASE.md`

- [ ] **Step 1: Run full Playwright test suite**

Run: `npx playwright test` in `app/frontend`
Expected: PASS (all 17 tests pass).

- [ ] **Step 2: Update documentation**

Reflect dedicated CTV DTO (entries-only, status omitted) and cleaned workspace props in `docs/USE-CASE.md`.
