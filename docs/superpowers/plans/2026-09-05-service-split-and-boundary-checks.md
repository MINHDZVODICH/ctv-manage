# Schedule Service Split and Frontend Boundary Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modularize the 586-line backend `schedule.service.ts` into single-responsibility domain services (`schedule.types.ts`, `schedule.command.service.ts`, `schedule.query.service.ts`, `work-history.service.ts`), implement automated frontend import-boundary validation, and align technical documentation, with zero changes to the database schema.

**Architecture:** Facade-backed modular backend services preserving backward-compatibility, AST/regex-based architectural linting script for the frontend, and 1:1 documentation synchronization.

**Tech Stack:** Node.js 22 LTS, TypeScript 5.8, Express 4, Prisma 6, Vitest/Integration test runner, Playwright 1.55.

**Spec:** [docs/superpowers/specs/2026-09-05-service-split-and-boundary-checks-design.md](file:///E:/CTV_Manage/docs/superpowers/specs/2026-09-05-service-split-and-boundary-checks-design.md)

## Global Constraints
- Database schema (`app/backend/prisma/schema.prisma`) MUST NOT BE MODIFIED.
- No new database migrations or table modifications.
- All existing 76 backend integration tests must pass at every step.
- All 19 frontend Playwright tests must pass at every step.
- Backward compatibility: `modules/schedule/schedule.service.ts` re-exports all members so external imports remain functional.

---

### Task 1: Create `schedule.types.ts` and Domain Helpers

**Files:**
- Create: `app/backend/src/modules/schedule/schedule.types.ts`
- Modify: `app/backend/src/modules/schedule/schedule.service.ts:1-93`
- Test: `app/backend/tests/schedules-and-history.integration.test.ts`

**Interfaces:**
- Produces:
  - `ROOM_CODES: readonly ['ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4']`
  - `RoomCode: 'ROOM_1' | 'ROOM_2' | 'ROOM_3' | 'ROOM_4'`
  - `PERIODS: readonly ['MORNING', 'AFTERNOON']`
  - `Period: 'MORNING' | 'AFTERNOON'`
  - `UpsertScheduleInput: { roomCode: string; slots: { weekday: number; period: string }[]; expectedVersion?: number }`
  - `UpsertRegistrationInput: UpsertScheduleInput`
  - `isValidYmd(s: string): boolean`
  - `monthRangeToUtcDates(month: string): { from: Date; to: Date }`
  - `validateScheduleInput(input: UpsertScheduleInput): void`
  - `dedupeSlots(slots: { weekday: number; period: string }[]): { weekday: number; period: string }[]`

- [ ] **Step 1: Create `schedule.types.ts`**
Extract types, constants, and pure validation/helper functions from `schedule.service.ts`.

- [ ] **Step 2: Update `schedule.service.ts` to import and re-export `schedule.types.ts`**
Ensure all existing consumers of `schedule.service.ts` continue to see `ROOM_CODES`, `RoomCode`, `PERIODS`, `Period`, `UpsertScheduleInput`, `monthRangeToUtcDates`, etc.

- [ ] **Step 3: Run backend typecheck and tests**
Run: `npm --prefix app/backend run typecheck && npm --prefix app/backend test`
Expected: PASS (76 passed).

- [ ] **Step 4: Commit Task 1**
```bash
git add app/backend/src/modules/schedule/schedule.types.ts app/backend/src/modules/schedule/schedule.service.ts
git commit -m "refactor(schedule): extract schedule types and domain validation helpers"
```

---

### Task 2: Extract `schedule.command.service.ts`

**Files:**
- Create: `app/backend/src/modules/schedule/schedule.command.service.ts`
- Modify: `app/backend/src/modules/schedule/schedule.service.ts`
- Test: `app/backend/tests/schedule-redesign.integration.test.ts`

**Interfaces:**
- Consumes: `UpsertScheduleInput`, `validateScheduleInput`, `dedupeSlots` from `./schedule.types.js`, `prisma` from `../../shared/prisma.js`, `Errors` from `../../shared/errors.js`.
- Produces:
  - `upsertSchedule(accountId: string, input: UpsertScheduleInput): Promise<ScheduleDto>`
  - `upsertRegistration(accountId: string, input: UpsertRegistrationInput): Promise<ScheduleDto>`

- [ ] **Step 1: Create `schedule.command.service.ts`**
Move `upsertSchedule` and `upsertRegistration` into `schedule.command.service.ts`, keeping PostgreSQL advisory lock (`pg_advisory_xact_lock`), version checks, and slot replacement transactions intact.

- [ ] **Step 2: Re-export command methods from `schedule.service.ts`**
Re-export `upsertSchedule` and `upsertRegistration` in `schedule.service.ts`.

- [ ] **Step 3: Run backend typecheck and tests**
Run: `npm --prefix app/backend run typecheck && npm --prefix app/backend test`
Expected: PASS (76 passed).

- [ ] **Step 4: Commit Task 2**
```bash
git add app/backend/src/modules/schedule/schedule.command.service.ts app/backend/src/modules/schedule/schedule.service.ts
git commit -m "refactor(schedule): extract schedule.command.service with advisory locking"
```

---

### Task 3: Extract `schedule.query.service.ts`

**Files:**
- Create: `app/backend/src/modules/schedule/schedule.query.service.ts`
- Modify: `app/backend/src/modules/schedule/schedule.service.ts`
- Test: `app/backend/tests/schedules-and-history.integration.test.ts`
- Test: `app/backend/tests/p0-security-and-regression.integration.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../../shared/prisma.js`, `Errors` from `../../shared/errors.js`, timezone helpers from `../../shared/timezone.js`.
- Produces:
  - `getMySchedule(accountId: string)`
  - `getMyRegistration(accountId: string)`
  - `getAccountSchedule(accountId: string)`
  - `getWeeklySummary()`
  - `getScheduleSummary(_params?: { month?: string })`
  - `listMyShifts(accountId: string, _params?: { month?: string; from?: string; to?: string })`
  - `getShiftForUser(shiftId: string, accountId: string, isAdmin: boolean)`

- [ ] **Step 1: Create `schedule.query.service.ts`**
Move read-only schedule lookup methods, weekly summary calculation, and shift queries into `schedule.query.service.ts`.

- [ ] **Step 2: Re-export query methods from `schedule.service.ts`**
Re-export all query methods in `schedule.service.ts`.

- [ ] **Step 3: Run backend typecheck and tests**
Run: `npm --prefix app/backend run typecheck && npm --prefix app/backend test`
Expected: PASS (76 passed).

- [ ] **Step 4: Commit Task 3**
```bash
git add app/backend/src/modules/schedule/schedule.query.service.ts app/backend/src/modules/schedule/schedule.service.ts
git commit -m "refactor(schedule): extract schedule.query.service for schedule lookups and summaries"
```

---

### Task 4: Extract `work-history.service.ts`

**Files:**
- Create: `app/backend/src/modules/schedule/work-history.service.ts`
- Modify: `app/backend/src/modules/schedule/schedule.service.ts`
- Modify: `app/backend/src/jobs/schedule-snapshot.job.ts:1`
- Test: `app/backend/tests/jobs-and-files.integration.test.ts`
- Test: `app/backend/tests/schedules-and-history.integration.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../../shared/prisma.js`, `Errors` from `../../shared/errors.js`, timezone helpers, `monthRangeToUtcDates` from `./schedule.types.js`.
- Produces:
  - `snapshotTodayWorkHistory(now?: Date): Promise<{ processedCount: number; skipped?: boolean; reason?: string }>`
  - `getMyWorkHistory(accountId: string, month: string): Promise<MyWorkHistoryDto>`
  - `getWorkHistory(params: { month: string; accountId?: string }): Promise<WorkHistoryResponseDto>`

- [ ] **Step 1: Create `work-history.service.ts`**
Move 17:30 Asia/Bangkok snapshot calculation and monthly history queries into `work-history.service.ts`.

- [ ] **Step 2: Re-export work-history methods from `schedule.service.ts`**
Re-export `snapshotTodayWorkHistory`, `getMyWorkHistory`, `getWorkHistory` in `schedule.service.ts`.

- [ ] **Step 3: Update `schedule-snapshot.job.ts` import**
Import `snapshotTodayWorkHistory` directly from `./work-history.service.js` (or via `schedule.service.js`).

- [ ] **Step 4: Run backend typecheck and tests**
Run: `npm --prefix app/backend run typecheck && npm --prefix app/backend test`
Expected: PASS (76 passed).

- [ ] **Step 5: Commit Task 4**
```bash
git add app/backend/src/modules/schedule/work-history.service.ts app/backend/src/modules/schedule/schedule.service.ts app/backend/src/jobs/schedule-snapshot.job.ts
git commit -m "refactor(schedule): extract work-history service and decouple snapshot job"
```

---

### Task 5: Implement Frontend Import-Boundary Checker

**Files:**
- Create: `app/frontend/scripts/check-boundaries.mjs`
- Modify: `app/frontend/package.json`
- Test: `npm --prefix app/frontend run check:boundaries`

**Rules Enforced:**
1. Files in `src/shared/**` must NEVER import from `src/features/**` or `src/app/**`.
2. Cross-feature imports between `src/features/featureA` and `src/features/featureB` must ONLY use the feature root index (`../featureB` or `@features/featureB`), forbidding deep internal imports into private directories (`../featureB/components/InternalComp`).

- [ ] **Step 1: Create `check-boundaries.mjs`**
Write ESM script using Node.js filesystem APIs to scan all `.ts` and `.tsx` files in `app/frontend/src`. Detect any boundary violations and output offending file paths and imported specifiers.

- [ ] **Step 2: Add npm script in `package.json`**
Add `"check:boundaries": "node scripts/check-boundaries.mjs"` to `app/frontend/package.json`.

- [ ] **Step 3: Run boundary check script**
Run: `npm --prefix app/frontend run check:boundaries`
Expected: 0 violations reported.

- [ ] **Step 4: Commit Task 5**
```bash
git add app/frontend/scripts/check-boundaries.mjs app/frontend/package.json
git commit -m "feat(frontend): add automated architectural import-boundary checker"
```

---

### Task 6: Synchronize Documentation and Final Verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/TRACEABILITY.md`

- [ ] **Step 1: Update `docs/ARCHITECTURE.md`**
Document the modular schedule services in the Service Layer section (`schedule.command.service.ts`, `schedule.query.service.ts`, `work-history.service.ts`, `schedule.types.ts`) and document the `npm run check:boundaries` enforcement in Frontend Architecture.

- [ ] **Step 2: Update `docs/TRACEABILITY.md`**
Update traceability rows linking endpoints to the newly partitioned service files.

- [ ] **Step 3: Run comprehensive verification gate**
- Backend: `npm --prefix app/backend run typecheck && npm --prefix app/backend run build && npm --prefix app/backend test`
- Frontend: `npm --prefix app/frontend run typecheck && npm --prefix app/frontend run check:boundaries && npm --prefix app/frontend run build && npm --prefix app/frontend test`
- Schema check: `git diff app/backend/prisma/schema.prisma` -> empty.

- [ ] **Step 4: Commit Task 6**
```bash
git add docs/ARCHITECTURE.md docs/TRACEABILITY.md
git commit -m "docs: synchronize architecture and traceability with modularized schedule services"
```
