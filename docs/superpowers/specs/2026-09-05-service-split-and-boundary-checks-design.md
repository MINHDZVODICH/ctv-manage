# Design Specification: Schedule Service Split and Frontend Architectural Boundaries

**Date:** 2026-09-05  
**Scope:** Backend Service Modularization (`modules/schedule`), Frontend Import-Boundary Enforcement, and Documentation Alignment.  
**Constraint:** Absolute Database Schema Invariance — No changes to `schema.prisma` or PostgreSQL tables.

---

## 1. Problem Statement & Motivation

1. **Monolithic Schedule Service:**  
   `app/backend/src/modules/schedule/schedule.service.ts` currently aggregates 586 lines (~17 KB) combining multiple disparate responsibilities:
   - Command mutations with PostgreSQL advisory locks and optimistic locking (`upsertSchedule`).
   - CTV and Admin query lookups, weekly matrix summaries, and legacy shift detail resolution (`getMySchedule`, `getAccountSchedule`, `getWeeklySummary`, `listMyShifts`, `getShiftForUser`).
   - 17:30 Asia/Bangkok cutoff work-history snapshot execution (`snapshotTodayWorkHistory`).
   - Historical work-history monthly queries and cell aggregation (`getMyWorkHistory`, `getWorkHistory`).

2. **Frontend Boundary Governance:**  
   While Phase 4 structured the frontend into `src/features/*`, `src/shared/*`, and `src/app/*`, there is no automated lint/guard ensuring that `src/shared` never imports from feature modules or that features do not bypass public index contracts.

3. **Technical Alignment:**  
   Technical documentation (`ARCHITECTURE.md`, `TRACEABILITY.md`) should explicitly record the modular service topology and boundary validation tools.

---

## 2. Architecture & Design

### 2.1 Backend Schedule Service Decomposition

The schedule module is refactored into focused single-responsibility files while preserving `schedule.service.ts` as a transparent facade:

```
app/backend/src/modules/schedule/
├── schedule.types.ts             <-- Constants (ROOM_CODES, PERIODS), DTOs, Date/Slot helpers
├── schedule.command.service.ts   <-- upsertSchedule, advisory lock, optimistic lock, slot deduplication
├── schedule.query.service.ts     <-- getMySchedule, getAccountSchedule, getWeeklySummary, getShiftForUser, listMyShifts
├── work-history.service.ts       <-- snapshotTodayWorkHistory (17:30 Asia/Bangkok), getMyWorkHistory, getWorkHistory
├── schedule.service.ts           <-- Facade re-exporting all functions/types (zero-breakage contract)
├── schedule.controller.ts        <-- HTTP layer (Express handlers)
└── schedule.routes.ts            <-- Router bindings
```

#### Responsibilities & Invariants:
- **`schedule.types.ts`**: Holds domain types (`RoomCode`, `Period`, `UpsertScheduleInput`), room and period constants, and pure validation functions (`validateScheduleInput`, `dedupeSlots`, `monthRangeToUtcDates`).
- **`schedule.command.service.ts`**:
  - Encapsulates database mutations.
  - Acquires `pg_advisory_xact_lock(hashtext(accountId))`.
  - Enforces version concurrency (`expectedVersion`).
  - Executes atomic schedule and shift replacements inside a Prisma transaction.
- **`schedule.query.service.ts`**:
  - Read-only data queries with Prisma queries optimized with relations and sorting.
  - Generates weekly summary grid cells for Admin dashboard.
  - Provides ownership checks for shift inspection.
- **`work-history.service.ts`**:
  - Encapsulates 17:30 Asia/Bangkok cutoff snapshot logic, skipping weekends and before-cutoff calls.
  - Performs idempotent batch inserts into `History` with `skipDuplicates: true`.
  - Queries historical work records and aggregates monthly shift assignments.
- **`schedule.service.ts` (Facade)**:
  - Re-exports everything for seamless backward compatibility across background jobs, controllers, and tests.

### 2.2 Frontend Import-Boundary Checker

A dedicated script `app/frontend/scripts/check-boundaries.mjs` is introduced and wired to `npm run check:boundaries`:
- **Rule 1 (`SHARED_ISOLATION`):** Files under `src/shared/` must never import from `src/features/` or `src/app/`.
- **Rule 2 (`FEATURE_ENCAPSULATION`):** Cross-feature imports must use top-level feature index (e.g. `../accounts` or `src/features/accounts`), prohibiting direct deep imports into other features' private subfolders (e.g. `../accounts/components/PrivateModal.tsx`).
- **Rule 3 (`APP_IS_ROOT`):** `src/app/` coordinates features and providers, and can import from `src/features/*` and `src/shared/*`.

### 2.3 Documentation Updates
- Update `docs/ARCHITECTURE.md` Section 3 (Service Layer) documenting the modularized schedule services.
- Update `docs/TRACEABILITY.md` tracing endpoints to their dedicated query/command/history services.

---

## 3. Verification & Acceptance Criteria

1. **Database Unchanged:** `git status` shows no modifications to `schema.prisma` or migration files.
2. **Type Safety:** `npm run typecheck` passes with 0 errors in both `app/backend` and `app/frontend`.
3. **Boundary Integrity:** `npm run check:boundaries` passes with 0 violations in `app/frontend`.
4. **Integration Parity:** All 76 backend tests pass in `app/backend`.
5. **E2E Parity:** All 19 Playwright tests pass in `app/frontend`.
