# CTV Management System Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement reliable schedule snapshot runs with coordinator leasing and retries, PostgreSQL-backed shared rate limiting, constant-time auth and proxy handling, health/readiness probes, structured logging, safe guarded seeds, and automated CI workflows.

**Architecture:** 
- **Database**: Add `SnapshotRun` and `RateLimitWindow` models in Prisma with PostgreSQL indexes.
- **Snapshots**: Persistent coordinator running every 60s using database time, atomic leasing (2 min), exponential retry backoff, and admin audit API at `/api/v1/operations/snapshot-runs`.
- **Security & Protection**: Distributed fixed-window rate limiter with HMAC digests, CIDR proxy trust configuration, constant-time dummy password hashing for non-existent accounts, and strict multipart limits with HTTP 413/400 envelopes.
- **Operations & Seeds**: Dual health checks (`/live` vs `/ready` with 2s query timeout), JSON structured logging with request ID tracing, graceful 30s shutdown, and guarded scripts for `seed:demo`, `seed:acceptance`, and `admin:bootstrap`.
- **CI**: GitHub Actions workflow with Node 22, PostgreSQL 16, typecheck, boundary check, integration, and Playwright E2E suites.

**Tech Stack:** Express 4.21, TypeScript 5.8, Prisma 6.4, PostgreSQL 16, Argon2, Pino 9.6, Multer 2.2, Vitest 3.2, Playwright 1.55, GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-09-07-system-improvements-design.md`](file:///E:/CTV_Manage/docs/superpowers/specs/2026-09-07-system-improvements-design.md)

## Global Constraints

- Preserve the React / Express / PostgreSQL architecture.
- Retry snapshots within the same Bangkok calendar date; record missed dates without reconstructing historical schedules.
- Treat work history as recorded scheduled shifts ("Ca đã ghi nhận theo lịch"); exclude attendance verification, payroll, and backfill.
- Preserve existing API routes and response fields unless explicitly extended.
- Keep user-facing application messages in Vietnamese.
- Fail closed: If the rate-limit database store is unavailable, return HTTP 503 `SERVICE_UNAVAILABLE` on protected routes.
- Never log request bodies, passwords, cookies, tokens, or database connection strings.

---

## Tasks

### Task 1: Database Schema & Migrations for `SnapshotRun` and `RateLimitWindow`

**Files:**
- Modify: `app/backend/prisma/schema.prisma:150-171`
- Test: `app/backend/prisma/schema.prisma` (via `prisma generate` and test migrations)

**Interfaces:**
- Produces:
  ```prisma
  model SnapshotRun {
    id             String    @id @default(cuid())
    workDate       DateTime  @unique @db.Date
    status         String    // PENDING | RUNNING | SUCCEEDED | FAILED | MISSED
    attemptCount   Int       @default(0)
    nextAttemptAt  DateTime?
    leaseToken     String?
    leaseExpiresAt DateTime?
    startedAt      DateTime?
    completedAt    DateTime?
    insertedCount  Int       @default(0)
    errorCode      String?
    createdAt      DateTime  @default(now())
    updatedAt      DateTime  @updatedAt

    @@index([status, nextAttemptAt])
  }

  model RateLimitWindow {
    id             String   @id @default(cuid())
    scope          String   // LOGIN_IP | LOGIN_ACCOUNT | REGISTRATION_IP | UPLOAD_ACCOUNT
    identityDigest String
    windowStart    DateTime
    requestCount   Int      @default(1)
    expiresAt      DateTime

    @@unique([scope, identityDigest, windowStart])
    @@index([expiresAt])
  }
  ```

- [ ] **Step 1: Update `schema.prisma` with `SnapshotRun` and `RateLimitWindow`**

Add the two models to `app/backend/prisma/schema.prisma`.

- [ ] **Step 2: Generate Prisma client and create migration script**

Run:
```bash
npm run prisma:generate --workspace=app/backend
```
Verify generated types include `Prisma.SnapshotRunDelegate` and `Prisma.RateLimitWindowDelegate`.

- [ ] **Step 3: Verify test database synchronization**

Run:
```bash
npm run test:prepare --workspace=app/backend
```
Confirm Prisma deploys migrations or db push cleanly into the test database.

- [ ] **Step 4: Commit schema changes**

```bash
git add app/backend/prisma/schema.prisma
git commit -m "feat(db): add SnapshotRun and RateLimitWindow models"
```

---

### Task 2: Schedule Snapshot Persistent Coordinator, Leasing, and Retries (TDD)

**Files:**
- Create: `app/backend/src/modules/schedule/snapshot-coordinator.service.ts`
- Modify: `app/backend/src/jobs/schedule-snapshot.job.ts:1-78`
- Modify: `app/backend/src/config.ts:1-55`
- Test: `app/backend/tests/schedule-snapshot-coordinator.integration.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ClaimResult {
    claimed: boolean;
    run?: SnapshotRun;
    leaseToken?: string;
  }

  export class SnapshotCoordinatorService {
    async reconcilePass(now?: Date): Promise<void>;
    async claimRun(workDate: string, leaseToken: string, now?: Date): Promise<boolean>;
    async executeAttempt(workDate: string, leaseToken: string, now?: Date): Promise<{ insertedCount: number }>;
    async recordFailure(workDate: string, leaseToken: string, errorCode: string, now?: Date): Promise<void>;
    calculateNextAttemptAt(attemptCount: number, now?: Date): Date | null;
  }
  ```

- [ ] **Step 1: Write failing integration tests for snapshot coordinator leasing and retries**

Create `app/backend/tests/schedule-snapshot-coordinator.integration.test.ts`:
1. Test that reconcile creates a `PENDING` run for today once Bangkok time >= 17:30.
2. Test atomic claiming: first instance claims with leaseToken, second instance trying with different token fails to claim.
3. Test expired lease reclamation: if `leaseExpiresAt` is in the past, another instance can reclaim the run.
4. Test exponential backoff calculation: attempt 1 (+1m), attempt 2 (+5m), attempt 3 (+15m), attempt 4 (+30m), capped at Bangkok midnight.
5. Test transaction rollback: simulated database failure rolls back inserted history rows and leaves run in `FAILED` with retry timestamp.
6. Test zero-entry snapshot: when no accounts have active schedules, run completes as `SUCCEEDED` with `insertedCount: 0`.

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npx vitest run tests/schedule-snapshot-coordinator.integration.test.ts
```
Expected: FAIL (coordinator service not found).

- [ ] **Step 3: Implement `SnapshotCoordinatorService`**

In `app/backend/src/modules/schedule/snapshot-coordinator.service.ts`:
- Implement atomic update via `prisma.$executeRaw` or conditional update to claim run with 2-minute lease.
- In `executeAttempt`, wrap history snapshot inside transaction with 90s timeout. Lock and verify lease token, verify Bangkok date is still current.
- Insert shifts with `skipDuplicates: true`, mark run `SUCCEEDED`, and clear lease.
- In `schedule-snapshot.job.ts`, replace single `setTimeout` with a 60-second `setInterval` reconciliation loop, and run an initial pass on startup.

- [ ] **Step 4: Run test to verify pass**

Run:
```bash
npx vitest run tests/schedule-snapshot-coordinator.integration.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit coordinator implementation**

```bash
git add app/backend/src/modules/schedule/snapshot-coordinator.service.ts app/backend/src/jobs/schedule-snapshot.job.ts app/backend/src/config.ts app/backend/tests/schedule-snapshot-coordinator.integration.test.ts
git commit -m "feat(schedule): implement persistent snapshot coordinator with atomic leasing and retry"
```

---

### Task 3: Missed Date Tracking & Operations Snapshot Runs API (TDD)

**Files:**
- Modify: `app/backend/src/modules/schedule/snapshot-coordinator.service.ts`
- Create: `app/backend/src/modules/operations/operations.controller.ts`
- Create: `app/backend/src/modules/operations/operations.routes.ts`
- Modify: `app/backend/src/app.ts:40-62`
- Test: `app/backend/tests/operations-snapshot-runs.integration.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // GET /api/v1/operations/snapshot-runs?from=YYYY-MM-DD&to=YYYY-MM-DD
  export interface SnapshotRunResponseDto {
    id: string;
    workDate: string;
    status: string;
    attemptCount: number;
    nextAttemptAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    insertedCount: number;
    errorCode: string | null;
    createdAt: string;
    updatedAt: string;
  }
  ```

- [ ] **Step 1: Write failing integration tests for missed date tracking and operations API**

Create `app/backend/tests/operations-snapshot-runs.integration.test.ts`:
1. Set `SNAPSHOT_TRACKING_START_DATE` to 3 business days ago. Run reconciliation pass. Assert past weekdays with no run are created with `status = 'MISSED'` and `insertedCount = 0`.
2. Assert no `History` entries are inserted for `MISSED` dates.
3. Test `GET /api/v1/operations/snapshot-runs`:
   - Anonymous request returns 401.
   - CTV role returns 403.
   - ADMIN role returns 200 with list of runs.
   - Date range > 90 days returns 400.
   - Default date range returns last 30 Bangkok days.
   - Response payload does NOT include `leaseToken` or database connection strings.

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npx vitest run tests/operations-snapshot-runs.integration.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement missed date detection & operations controller**

- In `SnapshotCoordinatorService`: add `reconcileMissedDates(startDate: string, now: Date)`. Find all Monday-Friday dates between `startDate` and yesterday. If no run exists, create with `MISSED`. If a run exists with `PENDING` or `FAILED`, update to `MISSED`.
- Create `operations.controller.ts` and `operations.routes.ts` protected by `auth` and `requireRole('ADMIN')`.
- Mount at `/api/v1/operations` in `app/backend/src/app.ts`.

- [ ] **Step 4: Run test to verify pass**

Run:
```bash
npx vitest run tests/operations-snapshot-runs.integration.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit operations API and missed date detection**

```bash
git add app/backend/src/modules/operations/ app/backend/src/modules/schedule/snapshot-coordinator.service.ts app/backend/src/app.ts app/backend/tests/operations-snapshot-runs.integration.test.ts
git commit -m "feat(ops): add missed snapshot detection and operations audit endpoint"
```

---

### Task 4: PostgreSQL-Backed Shared Rate Limiting (TDD)

**Files:**
- Create: `app/backend/src/shared/rateLimitStore.ts`
- Create: `app/backend/src/middleware/rateLimiter.ts`
- Modify: `app/backend/src/config.ts`
- Test: `app/backend/tests/rate-limiter.integration.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RateLimitOptions {
    scope: 'LOGIN_IP' | 'LOGIN_ACCOUNT' | 'REGISTRATION_IP' | 'UPLOAD_ACCOUNT';
    maxRequests: number;
    windowSeconds: number;
    keyGenerator: (req: Request) => string;
  }
  export function createRateLimiter(options: RateLimitOptions): RequestHandler;
  export async function cleanupExpiredRateLimits(): Promise<number>;
  ```

- [ ] **Step 1: Write failing integration tests for rate limiting**

Create `app/backend/tests/rate-limiter.integration.test.ts`:
1. Test atomic increment: Multiple concurrent requests within window increment count correctly.
2. Test threshold exceeded: Request exceeding limit returns HTTP 429 with `{ error: { code: 'RATE_LIMITED', message: ... } }` and header `Retry-After`.
3. Test window expiration: After window seconds, subsequent request starts new window and succeeds.
4. Test secret hashing: Raw IP or email does not appear in `RateLimitWindow` table (stored as HMAC-SHA256).
5. Test fail closed: When database query rejects, returns HTTP 503 with code `SERVICE_UNAVAILABLE`.
6. Test cleanup routine: Rows older than expiration are deleted.

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npx vitest run tests/rate-limiter.integration.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement rate limit store and middleware**

- In `rateLimitStore.ts`:
  - Calculate `windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs)`.
  - Calculate `identityDigest = crypto.createHmac('sha256', secret).update(identity).digest('hex')`.
  - Execute PostgreSQL upsert:
    ```sql
    INSERT INTO "RateLimitWindow" ("id", "scope", "identityDigest", "windowStart", "requestCount", "expiresAt")
    VALUES ($1, $2, $3, $4, 1, $5)
    ON CONFLICT ("scope", "identityDigest", "windowStart")
    DO UPDATE SET "requestCount" = "RateLimitWindow"."requestCount" + 1
    RETURNING "requestCount", "expiresAt";
    ```
- In `rateLimiter.ts`:
  - Return HTTP 429 with `Retry-After` header when `requestCount > maxRequests`.
  - In catch block, return HTTP 503 `SERVICE_UNAVAILABLE`.

- [ ] **Step 4: Run test to verify pass**

Run:
```bash
npx vitest run tests/rate-limiter.integration.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit rate limiter implementation**

```bash
git add app/backend/src/shared/rateLimitStore.ts app/backend/src/middleware/rateLimiter.ts app/backend/src/config.ts app/backend/tests/rate-limiter.integration.test.ts
git commit -m "feat(security): implement PostgreSQL-backed shared rate limiter with HMAC digests"
```

---

### Task 5: Client IP Proxy Trust, Auth Timing Protection & DTO Cleanups (TDD)

**Files:**
- Modify: `app/backend/src/app.ts:20-42`
- Modify: `app/backend/src/modules/auth/auth.service.ts:1-75`
- Modify: `app/backend/src/modules/auth/auth.controller.ts:1-93`
- Modify: `app/backend/src/modules/auth/auth.routes.ts:1-25`
- Test: `app/backend/tests/auth-security.integration.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AuthUserDto {
    id: string;
    email: string;
    displayName: string;
    phone: string | null;
    role: string;
    status: string;
    version: number;
    mustChangePassword: boolean;
    ctvCode: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
    address: string | null;
    adminNotes: string | null;
    joinedAt: Date;
    lastLoginAt: Date | null;
    createdAt: Date;
  }
  export async function getAccountProfile(accountId: string): Promise<AuthUserDto>;
  ```

- [ ] **Step 1: Write failing integration tests for proxy trust and auth timing protection**

Create `app/backend/tests/auth-security.integration.test.ts`:
1. Test spoofed `X-Forwarded-For` without trusted proxy config: `req.ip` ignores spoofed header and uses socket IP.
2. Test non-existent account login: Executes dummy Argon2 verify, returns HTTP 401 `INVALID_CREDENTIALS` (timing matches existent account).
3. Test disabled account with WRONG password: Returns HTTP 401 `INVALID_CREDENTIALS` (does NOT leak disabled status).
4. Test disabled account with CORRECT password: Returns HTTP 403 `ACCOUNT_DISABLED`.
5. Test login rate limit: 60 req / 15 min per IP; 10 req / 15 min per IP + normalized email.
6. Test IP rate limit triggers before JSON body parsing for login route.

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npx vitest run tests/auth-security.integration.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement auth timing protection, proxy trust, and rate limiting on login**

- In `app.ts`: Configure `app.set('trust proxy', config.TRUSTED_PROXY_IPS ? config.TRUSTED_PROXY_IPS.split(',') : false)`.
- In `auth.service.ts`:
  - Pre-generate constant dummy Argon2 hash (`DUMMY_HASH`).
  - If account not found: await `argon2.verify(DUMMY_HASH, password)` then throw `Errors.invalidCredentials()`.
  - If account found: verify password first. If invalid, throw `Errors.invalidCredentials()`. Then if `status !== 'ACTIVE'`, throw `Errors.accountDisabled()`.
  - Add `getAccountProfile(accountId: string)` in `auth.service.ts` to replace controller direct DB access.
- In `auth.controller.ts`:
  - Remove direct `req.headers['x-forwarded-for']`, use `req.ip`.
  - Type `toUserDto(account: Account)` explicitly without `any`.
- In `auth.routes.ts`:
  - Mount login rate limiters (IP limiter before `express.json()`, and IP+email limiter on handler).

- [ ] **Step 4: Run test to verify pass**

Run:
```bash
npx vitest run tests/auth-security.integration.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit auth security improvements**

```bash
git add app/backend/src/modules/auth/ app/backend/src/app.ts app/backend/tests/auth-security.integration.test.ts
git commit -m "feat(auth): add proxy trust, timing-safe login, and disabled account disclosure guards"
```

---

### Task 6: Multipart Upload Constraints & Custom Error Envelopes (TDD)

**Files:**
- Modify: `app/backend/src/modules/registration/registration.controller.ts:1-60`
- Modify: `app/backend/src/modules/registration/registration.routes.ts:1-18`
- Modify: `app/backend/src/modules/files/files.controller.ts`
- Modify: `app/backend/src/modules/files/files.routes.ts`
- Modify: `app/backend/src/middleware/errorHandler.ts:1-25`
- Test: `app/backend/tests/multipart-limits.integration.test.ts`

**Interfaces:**
- Produces:
  - Registration limits: max 3 files (`cccdFront`, `cccdBack`, `cv`), max 7 text fields, max 10 parts, max 16 KiB per text field.
  - Account file limits: max 1 file, 0 excess fields.
  - Error responses: 413 `FILE_TOO_LARGE`, 400 `FILE_UPLOAD_ERROR`, 400 `INVALID_FILE_TYPE`.

- [ ] **Step 1: Write failing integration tests for multipart constraints**

Create `app/backend/tests/multipart-limits.integration.test.ts`:
1. Upload file > 5 MiB: returns HTTP 413 `{ error: { code: 'FILE_TOO_LARGE', message: ... } }`.
2. Public registration with unexpected file field (e.g. `extraFile`): returns HTTP 400 `FILE_UPLOAD_ERROR`.
3. Public registration with text field > 16 KiB: returns HTTP 400 `FILE_UPLOAD_ERROR`.
4. Public registration with > 7 text fields: returns HTTP 400 `FILE_UPLOAD_ERROR`.
5. Public registration rate limit: 5 requests / 1 hour per client IP applied before multipart parsing.
6. Account file upload rate limit: 30 requests / 15 min per account ID applied after auth and before multipart parsing.

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npx vitest run tests/multipart-limits.integration.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement multipart limits and error mapping**

- In `registration.controller.ts`:
  - Configure multer with `limits: { fileSize: 5 * 1024 * 1024, files: 3, fields: 7, parts: 10, fieldSize: 16 * 1024 }`.
  - In `fileFilter`, reject any fieldname not in `['cccdFront', 'cccdBack', 'cv']`.
- In `files.controller.ts`:
  - Configure multer with `limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 2 }`.
- In `errorHandler.ts`:
  - Inspect `errorObj?.name === 'MulterError'`:
    - If `errorObj.code === 'LIMIT_FILE_SIZE'`, return HTTP 413 with `code: 'FILE_TOO_LARGE'`.
    - Otherwise return HTTP 400 with `code: 'FILE_UPLOAD_ERROR'`.
- Mount registration IP rate limiter on `registration.routes.ts` before multer.
- Mount upload account rate limiter on `files.routes.ts` after `auth` and before multer.

- [ ] **Step 4: Run test to verify pass**

Run:
```bash
npx vitest run tests/multipart-limits.integration.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit multipart limits**

```bash
git add app/backend/src/modules/registration/ app/backend/src/modules/files/ app/backend/src/middleware/errorHandler.ts app/backend/tests/multipart-limits.integration.test.ts
git commit -m "feat(files): enforce strict multipart limits and standardized upload error envelopes"
```

---

### Task 7: Health Endpoints, Structured JSON Logging, and Graceful Shutdown (TDD)

**Files:**
- Create: `app/backend/src/modules/health/health.controller.ts`
- Create: `app/backend/src/modules/health/health.routes.ts`
- Modify: `app/backend/src/shared/logger.ts:1-45`
- Modify: `app/backend/src/middleware/requestLogger.ts` (new)
- Modify: `app/backend/src/app.ts`
- Modify: `app/backend/src/main.ts:1-34`
- Test: `app/backend/tests/health-and-ops.integration.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/v1/health` -> HTTP 200 `{ "status": "ok" }`
  - `GET /api/v1/health/live` -> HTTP 200 `{ "status": "live" }`
  - `GET /api/v1/health/ready` -> HTTP 200 `{ "status": "ready" }` or HTTP 503 `{ "status": "not_ready" }` (max 2s query timeout)
  - `X-Request-ID` response header on all requests

- [ ] **Step 1: Write failing integration tests for health and logging**

Create `app/backend/tests/health-and-ops.integration.test.ts`:
1. `GET /api/v1/health` returns 200 `{ status: 'ok' }`.
2. `GET /api/v1/health/live` returns 200 `{ status: 'live' }`.
3. `GET /api/v1/health/ready` returns 200 `{ status: 'ready' }` when DB responds within 2 seconds.
4. When DB query hangs or rejects, `GET /api/v1/health/ready` returns 503 `{ status: 'not_ready' }` without exposing internal SQL or error message.
5. All requests include `X-Request-ID` response header matching UUID format.
6. After graceful shutdown initiated, `GET /api/v1/health/ready` immediately returns 503 `{ status: 'not_ready' }`.

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npx vitest run tests/health-and-ops.integration.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement health endpoints, request logger, and graceful shutdown**

- Create `health.controller.ts` with readiness query `SELECT 1` wrapped in `Promise.race` with 2000ms timeout.
- Maintain process shutdown flag (`isShuttingDown`). If `isShuttingDown`, return 503.
- Create `requestLogger.ts`: generate `crypto.randomUUID()`, set `X-Request-ID`, log request start/end with route template, status, duration, and actor ID (redacting bodies/passwords/cookies).
- Update `logger.ts` to output standard JSON when `NODE_ENV === 'production'`.
- In `main.ts`, handle `SIGTERM`/`SIGINT`: mark `isShuttingDown = true`, stop coordinator interval timer, call `server.close()`, wait up to 30s before `prisma.$disconnect()` and exit.

- [ ] **Step 4: Run test to verify pass**

Run:
```bash
npx vitest run tests/health-and-ops.integration.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit health and operational logging**

```bash
git add app/backend/src/modules/health/ app/backend/src/shared/logger.ts app/backend/src/middleware/requestLogger.ts app/backend/src/app.ts app/backend/src/main.ts app/backend/tests/health-and-ops.integration.test.ts
git commit -m "feat(ops): add dual health probes, JSON request logger, and 30s graceful shutdown"
```

---

### Task 8: Safe Seed Guards, Admin Bootstrap & Root Seed Alias (TDD)

**Files:**
- Create: `app/backend/scripts/seed-demo.ts`
- Create: `app/backend/scripts/seed-acceptance.ts`
- Create: `app/backend/scripts/bootstrap-admin.ts`
- Modify: `app/backend/package.json`
- Modify: `package.json:20-25`
- Test: `app/backend/tests/seed-guards.unit.test.ts`

**Interfaces:**
- Produces scripts:
  - `npm run seed:demo --workspace=app/backend -- [--reset]`
  - `npm run seed:acceptance --workspace=app/backend`
  - `npm run admin:bootstrap --workspace=app/backend`
  - Root `npm run prisma:seed` forwarding to guarded demo seed

- [ ] **Step 1: Write failing unit tests for seed safety guards**

Create `app/backend/tests/seed-guards.unit.test.ts`:
1. Assert demo seed rejects `NODE_ENV !== 'development'`.
2. Assert demo seed rejects database name lacking `dev` or `demo` marker.
3. Assert demo seed rejects truncate/delete if `--reset` flag is not passed.
4. Assert demo seed requires `DEMO_PASSWORD` environment variable.
5. Assert acceptance seed rejects `NODE_ENV !== 'test'`.
6. Assert admin bootstrap creates active admin with `mustChangePassword = true` when email does not exist.
7. Assert admin bootstrap refuses to overwrite or mutate if administrator email already exists.

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npx vitest run tests/seed-guards.unit.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement seed guards and bootstrap scripts**

- In `seed-demo.ts`:
  - Check `process.env.NODE_ENV === 'development'`.
  - Validate DB URL contains `/(^|[_-])(dev|demo)($|[_-])/`.
  - Check `process.argv.includes('--reset')` before any deletion.
  - Require `process.env.DEMO_PASSWORD`.
- In `seed-acceptance.ts`:
  - Check `process.env.NODE_ENV === 'test'`.
  - Validate DB URL contains `/(^|[_-])test($|[_-])/`.
- In `bootstrap-admin.ts`:
  - Read `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
  - Normalize email. Check existing account: if exists, log notice and exit 0 without updating.
  - Hash password with Argon2, create active ADMIN with `mustChangePassword: true`.
- Update `package.json` in `app/backend` and root to wire `seed:demo`, `seed:acceptance`, `admin:bootstrap`, and fix `prisma:seed`.

- [ ] **Step 4: Run test to verify pass**

Run:
```bash
npx vitest run tests/seed-guards.unit.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit seed guards and bootstrap**

```bash
git add app/backend/scripts/ app/backend/package.json package.json app/backend/tests/seed-guards.unit.test.ts
git commit -m "feat(seeds): add guarded demo seed, acceptance seed, admin bootstrap, and root alias"
```

---

### Task 9: Continuous Integration Workflow & Full Acceptance Verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Test: Local verification of full test suites and CI script steps

**Interfaces:**
- Produces:
  - GitHub Actions CI pipeline running on PRs and pushes to `main`.
  - Verification: Node 22, PostgreSQL 16, typecheck, boundary check, build, backend integration tests, frontend Playwright tests.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

Configure GitHub Actions with:
- Runs on `ubuntu-latest`.
- Service container: `postgres:16` with healthcheck.
- Steps:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with Node `22` and cache `npm`.
  3. `npm ci`
  4. `npm run prisma:generate`
  5. `npm run typecheck`
  6. Frontend boundary check: `npm run lint` or custom import boundary check.
  7. `npm run build`
  8. Run backend tests: `npm run test:api` with `STORAGE_DRIVER=local`.
  9. Install Playwright browsers: `npx playwright install --with-deps chromium`.
  10. Run E2E tests: `npm run test:e2e`.
  11. Upload test results & Playwright traces (retention: 7 days).

- [ ] **Step 2: Run full backend integration test suite locally**

Run:
```bash
npm run test:api
```
Confirm all existing and newly added backend integration tests pass.

- [ ] **Step 3: Run full typecheck and build**

Run:
```bash
npm run typecheck
npm run build
```
Verify 0 type errors across both backend and frontend workspaces.

- [ ] **Step 4: Commit CI workflow**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for full integration and E2E verification"
```
