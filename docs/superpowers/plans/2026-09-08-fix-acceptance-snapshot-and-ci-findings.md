# Fix Acceptance Seeding, Snapshot Coordination, Shutdown, Logging, CI, and Operations Range Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Resolve all 7 identified issues across acceptance seed database validation, snapshot execution timing, transaction row locking & repeatable read isolation, graceful shutdown background task awaiting, request log sanitization & operational event emission, Playwright browser & CI database isolation, and operations API date range calculation.

**Architecture:** 
- Backend: TypeScript + Express 4.21 + Prisma 6.4 + PostgreSQL.
- Coordinator: `SnapshotCoordinatorService` with PostgreSQL row locks (`FOR UPDATE`), `RepeatableRead` transaction isolation, lease ownership verification, dynamic DB time evaluation, and standardized error codes.
- Lifecycle: `main.ts` graceful shutdown waiting for active HTTP connections, snapshot coordinator, and rate-limit cleanup before disconnecting Prisma.
- Observability: Pino structured logging with query sanitization, route templates, and distinct operational events (`snapshot.succeeded`, `snapshot.retry_scheduled`, `snapshot.missed`, `ratelimit.rejected`).
- Testing & CI: Playwright Chromium browser configuration, isolated test databases (`ctv_manage_test` for API, `ctv_manage_e2e_test` for E2E) in GitHub Actions.

**Tech Stack:** Node.js 22, Express, Prisma, PostgreSQL, Vitest, Playwright, Pino.

---

## Tasks

### Task 1: Fix Acceptance Seed Database URL Guard (Issue 1)

**Files:**
- Modify: `app/backend/scripts/seed-acceptance.ts:13-60`
- Test: `app/backend/tests/seed-guards.unit.test.ts`

**Interfaces:**
- Consumes: `process.env.DATABASE_TEST_URL`, `process.env.DATABASE_URL`
- Produces: `validateAcceptanceSeedEnvironment(env)` returning `{ databaseName: string, databaseUrl: string }`, `runAcceptanceSeed(options)` passing verified `databaseUrl` to `new PrismaClient({ datasources: { db: { url: databaseUrl } } })`.

- [x] **Step 1: Write failing test in `seed-guards.unit.test.ts`**

Add unit test verifying:
1. `validateAcceptanceSeedEnvironment` returns `databaseUrl`.
2. When `DATABASE_TEST_URL` is a test database and `DATABASE_URL` points to a non-test/production database, `validateAcceptanceSeedEnvironment` selects and returns the validated test database URL.

- [x] **Step 2: Run unit test to verify failure**

Run: `npx vitest run tests/seed-guards.unit.test.ts`
Expected: FAIL (missing `databaseUrl` property or behavior).

- [x] **Step 3: Update `seed-acceptance.ts` implementation**

In `app/backend/scripts/seed-acceptance.ts`:
1. Update `validateAcceptanceSeedEnvironment` to return `{ databaseName, databaseUrl }`.
2. In `runAcceptanceSeed`:
   ```ts
   const { databaseUrl } = validateAcceptanceSeedEnvironment(options);
   process.env.DATABASE_URL = databaseUrl;
   const isInternalClient = !options.prisma;
   const prisma =
     options.prisma ??
     new PrismaClient({
       datasources: {
         db: {
           url: databaseUrl,
         },
       },
     });
   ```

- [x] **Step 4: Run unit tests to verify pass**

Run: `npx vitest run tests/seed-guards.unit.test.ts`
Expected: PASS.

---

### Task 2: Snapshot Execution Timing and Mid-Flight Midnight Detection (Issue 2)

**Files:**
- Modify: `app/backend/src/modules/schedule/snapshot-coordinator.service.ts:415-427`
- Test: `app/backend/tests/schedule-snapshot-coordinator.integration.test.ts`

**Interfaces:**
- Consumes: `reconcilePass(now?: Date)`
- Produces: `executeAttempt(todayStr, leaseToken, now)` and `recordFailure(todayStr, leaseToken, errorCode, now)` where dynamic DB time is fetched when `now` is undefined.

- [x] **Step 1: Write failing integration test in `schedule-snapshot-coordinator.integration.test.ts`**

Add a test simulating a reconcile pass where claim happens before midnight, but `executeAttempt` executes when database time has crossed into the next Bangkok calendar day:
Verify:
1. `executeAttempt` marks the run as `MISSED` with `errorCode = 'DATE_PASSED'`.
2. Zero history rows are inserted.

- [x] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/schedule-snapshot-coordinator.integration.test.ts`
Expected: FAIL.

- [x] **Step 3: Update `reconcilePass` in `snapshot-coordinator.service.ts`**

In `reconcilePass(now?: Date)`:
Change:
```ts
if (claimed) {
  try {
    await this.executeAttempt(todayStr, leaseToken, now);
  } catch (err: any) {
    const errorCode = this.standardizeErrorCode(err);
    await this.recordFailure(todayStr, leaseToken, errorCode, now);
  }
}
```
Do not pass `nowTime` (the stale pre-reconcile timestamp) to `executeAttempt` or `recordFailure`. Passing `now` allows test overrides when provided, while ensuring production calls (`now === undefined`) fetch fresh DB time at execution and failure recording.

- [x] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/schedule-snapshot-coordinator.integration.test.ts`
Expected: PASS.

---

### Task 3: Transaction Row Locking, Repeatable Read Isolation & Lease Ownership Protection (Issue 3)

**Files:**
- Modify: `app/backend/src/modules/schedule/snapshot-coordinator.service.ts:140-238`
- Test: `app/backend/tests/schedule-snapshot-coordinator.integration.test.ts`

**Interfaces:**
- Produces: `executeAttempt` running inside `RepeatableRead` transaction, locking `SnapshotRun` with `FOR UPDATE`, and protecting status updates via `updateMany({ where: { id: run.id, leaseToken, status: 'RUNNING' } })`.

- [x] **Step 1: Write integration test for lease loss protection during transaction**

Add test asserting that if another instance revokes or changes `leaseToken` while a transaction is running, the update fails and throws `LEASE_LOST`.

- [x] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/schedule-snapshot-coordinator.integration.test.ts`
Expected: FAIL.

- [x] **Step 3: Update `executeAttempt` in `snapshot-coordinator.service.ts`**

1. Configure transaction with:
   ```ts
   {
     timeout: 90_000,
     isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
   }
   ```
2. Replace `tx.snapshotRun.findUnique` with explicit `FOR UPDATE` query:
   ```ts
   const runs = await tx.$queryRaw<
     Array<{
       id: string;
       workDate: Date;
       status: string;
       leaseToken: string | null;
     }>
   >`
     SELECT "id", "workDate", "status", "leaseToken"
     FROM "SnapshotRun"
     WHERE "workDate" = ${targetDate}::date
     FOR UPDATE
   `;
   const run = runs[0];
   if (!run || run.leaseToken !== leaseToken || run.status !== 'RUNNING') {
     throw new Error('LEASE_LOST');
   }
   ```
3. In date guard and completion updates, protect ownership with `updateMany`:
   ```ts
   const updated = await tx.snapshotRun.updateMany({
     where: {
       id: run.id,
       leaseToken,
       status: 'RUNNING',
     },
     data: {
       status: 'SUCCEEDED',
       completedAt: nowTime,
       insertedCount,
       leaseToken: null,
       leaseExpiresAt: null,
       errorCode: null,
     },
   });
   if (updated.count === 0) {
     throw new Error('LEASE_LOST');
   }
   ```

- [x] **Step 4: Run integration tests to verify pass**

Run: `npx vitest run tests/schedule-snapshot-coordinator.integration.test.ts`
Expected: PASS.

---

### Task 4: Graceful Shutdown Awaiting Active Snapshot and Background Tasks (Issue 4)

**Files:**
- Modify: `app/backend/src/jobs/schedule-snapshot.job.ts`
- Modify: `app/backend/src/main.ts`

**Interfaces:**
- Produces: `startScheduleSnapshotJob().stop()` returns `Promise<void>` awaiting any active reconciliation pass; `main.ts` awaits both server close, snapshot completion, and rate limit cleanup before disconnecting Prisma.

- [x] **Step 1: Update `schedule-snapshot.job.ts`**

1. Track `activeReconcilePromise: Promise<void> | null`.
2. Update `stop: () => Promise<void>`:
   ```ts
   stop: async () => {
     isStopped = true;
     if (timer) {
       clearInterval(timer);
       timer = null;
     }
     logger.info('Schedule snapshot background job stopped');
     if (activeReconcilePromise) {
       await activeReconcilePromise;
     }
   }
   ```

- [x] **Step 2: Update `main.ts` shutdown logic**

1. Track `activeCleanupPromise`.
2. In `shutdown()`, await `server.close()`, `snapshotJob.stop()`, and `activeCleanupPromise` concurrently before invoking `prisma.$disconnect()`.

- [x] **Step 3: Run backend typecheck and health tests**

Run: `npm run typecheck` and `npx vitest run tests/health-and-ops.integration.test.ts`
Expected: PASS.

---

### Task 5: Request Logger URL Sanitization, Standardized Snapshot Errors & Events (Issue 5)

**Files:**
- Modify: `app/backend/src/middleware/requestLogger.ts`
- Modify: `app/backend/src/modules/schedule/snapshot-coordinator.service.ts`
- Modify: `app/backend/src/middleware/rateLimiter.ts`
- Modify: `app/backend/src/modules/operations/operations.controller.ts`
- Test: `app/backend/tests/health-and-ops.integration.test.ts`

**Interfaces:**
- Produces: Sanitized request logs without query strings, standardized snapshot error codes, and operational events:
  - `snapshot.succeeded`
  - `snapshot.retry_scheduled`
  - `snapshot.missed`
  - `ratelimit.rejected`

- [x] **Step 1: Write tests in `health-and-ops.integration.test.ts`**

Add tests asserting:
1. Request logger does not log query strings (e.g. `?q=sensitive`).
2. Snapshot operational events and error code standardization.

- [x] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/health-and-ops.integration.test.ts`
Expected: FAIL.

- [x] **Step 3: Update `requestLogger.ts`, `snapshot-coordinator.service.ts`, and `rateLimiter.ts`**

1. In `requestLogger.ts`:
   - Strip query strings from logged URLs and log messages. Use `req.baseUrl || req.path` and route templates.
2. In `snapshot-coordinator.service.ts`:
   - Add `standardizeErrorCode(err: unknown): string`.
   - Log `snapshot.succeeded` on success.
   - Log `snapshot.retry_scheduled` on failure recording.
   - Log `snapshot.missed` on missed runs.
3. In `rateLimiter.ts`:
   - Log `ratelimit.rejected` on 429 response.
4. In `operations.controller.ts`:
   - Ensure sanitized `errorCode` is formatted in response.

- [x] **Step 4: Run test to verify pass**

Run: `npx vitest run tests/health-and-ops.integration.test.ts`
Expected: PASS.

---

### Task 6: Playwright Chromium Browser Configuration and CI Database Isolation (Issue 6)

**Files:**
- Modify: `app/frontend/playwright.config.ts:27-29`
- Modify: `.github/workflows/ci.yml:15-76`

**Interfaces:**
- Produces: Playwright uses standard Chromium matching `playwright install --with-deps chromium`. GitHub Actions creates and uses isolated `ctv_manage_e2e_test` for E2E tests, distinct from `ctv_manage_test` for API tests.

- [x] **Step 1: Update `playwright.config.ts`**

Remove `channel: 'chrome'` under `projects[0].use`.

- [x] **Step 2: Update `.github/workflows/ci.yml`**

1. Add step to create dedicated `ctv_manage_e2e_test` database in postgres container.
2. Configure `Run Playwright E2E tests` to pass `DATABASE_URL` and `DATABASE_TEST_URL` pointing to `ctv_manage_e2e_test`.

---

### Task 7: Operations API Date Range Calculation (Issue 7)

**Files:**
- Modify: `app/backend/src/modules/operations/operations.controller.ts:35-59`
- Modify: `app/backend/tests/operations-snapshot-runs.integration.test.ts:233-280`

**Interfaces:**
- Produces: Default date range of 30 calendar days inclusive (`addDays(toStr, -29)`). Maximum range check `totalDays > 90` rejecting 91 calendar days inclusive.

- [x] **Step 1: Update test in `operations-snapshot-runs.integration.test.ts`**

Update / add tests:
1. Verify default range covers exactly 30 calendar days inclusive (`addDays(todayStr, -29)`).
2. Verify range of 91 days inclusive returns 400 `DATE_RANGE_EXCEEDED`.
3. Verify range of 90 days inclusive returns 200 OK.

- [x] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/operations-snapshot-runs.integration.test.ts`
Expected: FAIL.

- [x] **Step 3: Update `operations.controller.ts`**

1. Change `fromStr = rawFrom ?? addDays(toStr, -29)`.
2. Change range check:
   ```ts
   const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 3600 * 1000));
   const totalDays = diffDays + 1;
   if (totalDays > 90) {
     throw Errors.badRequest('DATE_RANGE_EXCEEDED', 'Date range cannot exceed 90 days');
   }
   ```

- [x] **Step 4: Run test to verify pass**

Run: `npx vitest run tests/operations-snapshot-runs.integration.test.ts`
Expected: PASS.

---

### Task 8: Full Verification and Regression Test Suite

- [x] Run full typecheck across backend and frontend: `npm run typecheck --workspaces`
- [x] Run backend test suite: `npm run test --workspace=app/backend`
- [x] Verify clean build: `npm run build --workspaces`
