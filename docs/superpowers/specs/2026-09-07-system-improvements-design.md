# CTV Management System — Detailed Improvement Design

- **Date**: 2026-09-07
- **Status**: Approved Spec
- **Target**: Snapshot reliability, authentication protection, operational visibility, seed safety, and automated verification.

---

## 1. Scope and Accepted Decisions

Improve snapshot reliability, authentication protection, operational visibility, seed safety, and automated verification across the CTV Management System.

- **Architecture**: Preserve the React / Express / PostgreSQL architecture.
- **Snapshot Retries**: Retry snapshots within the same Bangkok calendar date.
- **Missed Dates**: Record missed dates without reconstructing historical schedules.
- **Work History Semantics**: Treat work history strictly as recorded scheduled shifts.
- **Exclusions**: Exclude attendance verification, payroll calculation, and historical schedule backfill.
- **API Stability**: Preserve existing API routes and response fields unless explicitly extended below.
- **Localization**: Keep user-facing application messages in Vietnamese.
- **Copy Consistency**: Product copy describes history records as "Recorded scheduled shift", localized into Vietnamese (e.g., *"Ca đã ghi nhận theo lịch"*), never claiming attendance verification.

---

## 2. Reliable Schedule Snapshots

### 2.1. Persistent Execution State (`SnapshotRun` Model)

Add a `SnapshotRun` model to `prisma/schema.prisma`:

| Field | Definition |
|---|---|
| `id` | Primary key (`String @id @default(cuid())`) |
| `workDate` | Unique PostgreSQL date (`DateTime @db.Date @unique`), interpreted in Asia/Bangkok |
| `status` | `SnapshotRunStatus` enum or string: `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `MISSED` |
| `attemptCount` | `Int @default(0)` |
| `nextAttemptAt` | `DateTime?` |
| `leaseToken` | `String?` (unique execution UUID) |
| `leaseExpiresAt` | `DateTime?` |
| `startedAt` | `DateTime?` |
| `completedAt` | `DateTime?` |
| `insertedCount` | `Int @default(0)` |
| `errorCode` | `String?` (sanitized stable error code) |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |

Add a composite index on `(status, nextAttemptAt)`:
```prisma
@@index([status, nextAttemptAt])
```

### 2.2. Scheduling and Recovery Coordinator

Replace the single in-memory timer (`setTimeout`) in `schedule-snapshot.job.ts` with a persistent coordinator:

1. **Reconciliation Loop**:
   - Executes a reconciliation pass at startup and every 60 seconds.
   - Evaluates cutoff and lease decisions strictly using database time (`SELECT NOW()`).
   - Identifies whether the current weekday has reached 17:30 Bangkok time (10:30 UTC).
   - If eligible and no `SnapshotRun` exists for today's Bangkok date, creates a new run with status `PENDING` and `nextAttemptAt = NOW()`.
2. **Lease & Concurrency**:
   - Acquires execution rights through an atomic conditional update:
     - Run matches target `workDate`.
     - Status is `PENDING` or `FAILED` (with `nextAttemptAt <= NOW()`), OR status is `RUNNING` with `leaseExpiresAt < NOW()` (reclaiming expired lease).
     - Updates: `status = 'RUNNING'`, `leaseToken = <uuid>`, `leaseExpiresAt = NOW() + INTERVAL '2 minutes'`, `attemptCount = attemptCount + 1`, `startedAt = NOW()`.
   - Allows peer instances to reclaim expired leases safely without collision.
3. **Execution & Idempotency**:
   - Skips dates already marked `SUCCEEDED`.
   - Records successful zero-entry snapshots (e.g. no active schedules configured) as `SUCCEEDED` with `insertedCount = 0`.
4. **Exponential Retry Delays**:
   - Failed attempts are scheduled for retry with exponential backoff:
     - Attempt 1: +1 minute
     - Attempt 2: +5 minutes
     - Attempt 3: +15 minutes
     - Attempt 4+: +30 minutes
   - Continues at 30-minute intervals until Bangkok midnight. Polling adds up to 60 seconds to these delays.
5. **Missed Date Tracking**:
   - At each reconciliation pass, marks unfinished previous weekdays as `MISSED`.
   - Creates `MISSED` records for weekdays omitted during prolonged downtime (e.g., server down for several days).
   - Evaluates missed dates starting from a configurable environment variable `SNAPSHOT_TRACKING_START_DATE` (YYYY-MM-DD).
   - Never inserts historical work entries for a `MISSED` date.

### 2.3. Transaction and Concurrency Rules

For each snapshot execution attempt:

1. **Claim the Run**: Acquire the lease token atomically and increment `attemptCount`.
2. **Begin Transaction**: Start an isolated database transaction with a transaction timeout strictly lower than the lease duration (e.g., 90s transaction timeout for a 120s lease).
3. **Verify Lease & Ownership**: In the transaction, lock and verify the run's `leaseToken` matches the claiming token.
4. **Date Guard**: Verify that the run's Bangkok date is still the current active date. If Bangkok midnight has passed, roll back and mark as `MISSED`.
5. **Snapshot Read**: Read eligible `ACTIVE` CTV accounts and their weekly schedules using a consistent transaction snapshot.
6. **History Insertion**: Insert records into `History` table using the existing unique constraint `(accountId, workDate, period)` (`skipDuplicates: true`).
7. **Complete Run**: Update `SnapshotRun` to `status = 'SUCCEEDED'`, `completedAt = NOW()`, `insertedCount = <count>`, clearing `leaseToken` and `leaseExpiresAt` in the exact same transaction.

**Failure Handling**:
- A failed transaction rolls back all history insertions and preserves the previous persistent state.
- After rollback, record failure metadata (`status = 'FAILED'`, `errorCode = <sanitized>`, `nextAttemptAt = <calculated>`) in a separate transaction, **only if** the attempt still owns the lease token.
- If failure reporting itself fails or network drops, the expired lease allows the next coordinator pass to trigger recovery.

### 2.4. Snapshot Semantics

- **Point-in-Time Reality**: A delayed attempt captures schedules as they exist at the time of the successful attempt's read. It does not attempt to reconstruct the exact 17:30 state.
- **Data Integrity**: Preserve all existing history entries and their recorded values.
- **Backward Compatibility**: Keep the existing `COMPLETED` enum/string value in `History.status` for compatibility with API consumers.
- **UI Copy**: Update product copy to describe these records as *"Ca đã ghi nhận theo lịch"* (Recorded scheduled shift). Do not present them as verified attendance or confirmed working hours.

### 2.5. Operational Interface

Add an administrator endpoint:
```http
GET /api/v1/operations/snapshot-runs?from=YYYY-MM-DD&to=YYYY-MM-DD
```

- **Authentication & Authorization**: Require valid authentication and `ADMIN` role.
- **Defaults & Limits**: Default `from` to 30 Bangkok calendar days ago and `to` to today. Enforce a maximum date range of 90 calendar days.
- **Response Payload**: Array of snapshot runs:
  ```json
  [
    {
      "id": "cuid...",
      "workDate": "2026-09-07",
      "status": "SUCCEEDED",
      "attemptCount": 1,
      "nextAttemptAt": null,
      "startedAt": "2026-09-07T10:30:00.123Z",
      "completedAt": "2026-09-07T10:30:01.456Z",
      "insertedCount": 14,
      "errorCode": null,
      "createdAt": "2026-09-07T10:30:00.000Z",
      "updatedAt": "2026-09-07T10:30:01.456Z"
    }
  ]
  ```
- **Security & Redaction**: Strictly exclude lease tokens, stack traces, raw SQL queries, and internal configuration values.
- **Replay Safety**: Provide no historical replay or manual backfill mutation endpoint.

---

## 3. Authentication and Request Protection

### 3.1. Shared Rate Limiting (PostgreSQL-Backed)

Implement a PostgreSQL-backed fixed-window rate limiter shared across backend cluster instances.

Add a `RateLimitWindow` model in `schema.prisma`:
```prisma
model RateLimitWindow {
  id             String   @id @default(cuid())
  scope          String   // LOGIN_IP | LOGIN_ACCOUNT | REGISTRATION_IP | UPLOAD_ACCOUNT
  identityDigest String   // HMAC-SHA256 of identity using RATE_LIMIT_KEY_SECRET
  windowStart    DateTime
  requestCount   Int      @default(1)
  expiresAt      DateTime

  @@unique([scope, identityDigest, windowStart])
  @@index([expiresAt])
}
```

- **Atomic Increment**: Use `INSERT ... ON CONFLICT (scope, identityDigest, windowStart) DO UPDATE SET requestCount = requestCount + 1 RETURNING requestCount, expiresAt`.
- **Maintenance**: An hourly maintenance routine deletes rows where `expiresAt < NOW()`.

**Initial Limits**:
| Operation | Scope Identity | Limit | Window |
|---|---|---|---|
| Login | Client IP | 60 requests | 15 minutes |
| Login | Client IP + normalized email | 10 requests | 15 minutes |
| Public registration | Client IP | 5 requests | 1 hour |
| Authenticated file upload | Account ID | 30 requests | 15 minutes |

**Enforcement Rules**:
- Count all attempts (both valid and invalid).
- **Execution Order**:
  - Apply login IP limit before JSON body parsing.
  - Apply registration limits before multipart stream parsing.
  - Apply upload limits after authentication verification, but before multipart stream parsing.
- **Responses**:
  - Exceeded limit: Return HTTP 429 with error code `RATE_LIMITED` and standard `Retry-After: <seconds>` header.
  - When multiple limits are exceeded, compute `Retry-After` using the latest reset timestamp.
  - If the database rate-limit store is unavailable or times out, fail closed: return HTTP 503 with `SERVICE_UNAVAILABLE` for protected routes.
- **Secret Hygiene**: Require `RATE_LIMIT_KEY_SECRET` in production. Never persist raw email addresses or cleartext IPs in the database.

### 3.2. Client IP Handling & Proxy Trust

- **Remove Direct Header Parsing**: Remove all direct reads of `req.headers['x-forwarded-for']` in `auth.controller.ts` or controllers.
- **Express Proxy Trust**: Configure Express `app.set('trust proxy', ...)` using explicit, validated CIDR ranges matching the cloud reverse proxy / ingress (e.g. Render, Cloudflare, AWS ALB).
- **Default Secure**: Default configuration has trust proxy disabled (0 hops / false). Never enable unrestricted trust proxy (`app.set('trust proxy', true)`).
- **Extraction**: Rely solely on `req.ip` resolved by Express.
- **Deployment Verification**: Verify forwarding behavior through the actual staging/production request path before enforcing IP-based blocks.

### 3.3. Hardened Login Behavior

- **Uniform Invalid Credentials**: Return identical HTTP 401 error response (`INVALID_CREDENTIALS`) for both nonexistent accounts and incorrect passwords.
- **Constant-Time Verification**: When an account does not exist, execute a dummy Argon2 password verification against a pre-computed constant hash to eliminate timing side-channels.
- **Disabled Account Disclosure Prevention**: Check whether the account is disabled (`status === 'DISABLED'`) **only after** verifying that the supplied password is correct. Return HTTP 403 `ACCOUNT_DISABLED`.
- **Session Hygiene**: Preserve existing session cookie settings (`httpOnly: true`, `sameSite: 'lax'`, `secure: process.env.NODE_ENV === 'production'`) and revocation mechanics.
- **Service Layer Responsibility**: Move current-user database query from `auth.controller.ts` into `auth.service.ts`.
- **DTO Typing**: Replace `any` types in authentication DTOs with strict, explicitly selected account fields.

### 3.4. Multipart Limits and Upload Guards

Retain the existing 5 MiB per-file limit.

1. **Public Registration (`/api/v1/registration`)**:
   - Maximum 3 files: exactly one each for fields `cccdFront`, `cccdBack`, and `cv`.
   - Maximum 7 text fields.
   - Maximum 10 multipart parts total.
   - Maximum 16 KiB per text field.
   - Reject unexpected file fields immediately before buffering.
   - Preserve MIME type inspection and magic-number file signature validation.
2. **Account File Uploads (`/api/v1/accounts/:id/files` / `/api/v1/files/upload`)**:
   - Maximum 1 file per request.
   - Reject unexpected file fields and unnecessary text fields.
   - Preserve existing allowed formats (PDF, PNG, JPEG).
3. **Consistent Error Envelope**:
   - Oversized files: HTTP 413, code `FILE_TOO_LARGE`.
   - Invalid multipart structure or excess fields/parts: HTTP 400, code `FILE_UPLOAD_ERROR`.
   - Unsupported file format or spoofed extension: HTTP 400, code `INVALID_FILE_TYPE`.

---

## 4. Operations, Monitoring, and Safe Initialization

### 4.1. Health Endpoints

| Endpoint | Access | Behavior |
|---|---|---|
| `GET /api/v1/health` | Public | Preserve existing response: HTTP 200 `{ "status": "ok" }` |
| `GET /api/v1/health/live` | Public | Return HTTP 200 `{ "status": "live" }` while the Node process is active |
| `GET /api/v1/health/ready` | Public | Verify database connectivity with 2s timeout; return HTTP 200 or 503 |

**Readiness Invariants**:
- Execute a lightweight database ping (`SELECT 1`) with a strict 2-second query deadline.
- Return only `{ "status": "ready" }` or `{ "status": "not_ready" }`.
- Never expose database connection strings, hostnames, credentials, or SQL exception messages in the response.
- Return HTTP 503 immediately after shutdown signal (SIGTERM/SIGINT) is received.
- Readiness must NOT depend on daily snapshot completion.

### 4.2. Structured Logging

- Default production logging format to structured JSON via Pino.
- Standard fields on every request log:
  - `timestamp`: ISO 8601 string
  - `level`: severity (`info`, `warn`, `error`, `debug`)
  - `requestId`: generated UUID v4, propagated to client via `X-Request-ID` header
  - `method`, `route`: matched Express route template (e.g. `/api/v1/accounts/:id`), never logging raw URLs containing sensitive tokens or query params
  - `status`, `durationMs`: HTTP status and execution duration
  - `actorId`: authenticated account ID (where available)
  - `errorCode`: stable error code on errors
- **Sanitization & Redaction**: Never log request bodies, passwords, session cookies, `Authorization` headers, file contents, or database connection strings.
- **Distinct Operational Events**:
  - `snapshot.succeeded`: date, attempt, insertedCount, durationMs
  - `snapshot.retry_scheduled`: date, attempt, nextAttemptAt, reason
  - `snapshot.missed`: date, reason
  - `ratelimit.rejected`: scope, retryAfter
  - `health.readiness_failed`: errorCategory
  - `request.unexpected_error`: requestId, route, status, errorCode
- Routine un-triggered snapshot checks log as `debug` level, never inflating `info` logs.

### 4.3. Monitoring, Alerts, and Graceful Shutdown

**Operational Alerts**:
- Alert if no successful snapshot is recorded by 18:00 Bangkok time on any tracked weekday.
- Alert on any `SnapshotRun` transition to `MISSED`.
- Alert on 3 consecutive readiness check failures (checked 1 minute apart).
- Alert if HTTP 5xx error rate exceeds 5% over a 5-minute sliding window (minimum sample 20 requests).

**Graceful Shutdown**:
1. Intercept `SIGTERM` and `SIGINT`.
2. Set readiness probe to return 503 immediately to shed ingress traffic.
3. Stop schedule reconciliation and maintenance interval timers.
4. Stop accepting new HTTP connections via `server.close()`.
5. Allow up to 30 seconds for active HTTP requests and ongoing snapshot transactions to finish.
6. Disconnect Prisma Client (`prisma.$disconnect()`).
7. Exit process with code 0 on clean shutdown; force exit with code 1 if 30-second deadline expires.

*Note*: Keep the existing wake-up endpoint/cron as a supplementary trigger. Its HTTP success must never be counted as snapshot completion.

### 4.4. Seed Scripts and Administrator Bootstrap

Separate initialization workflows into dedicated, guarded scripts:

1. **`seed:demo` (`scripts/seed-demo.ts`)**:
   - Exclusively for development environments.
   - Enforce `NODE_ENV === 'development'`.
   - Require the PostgreSQL database name in `DATABASE_URL` to contain a delimited `dev` or `demo` marker (e.g. `ctv_dev`, `ctv_demo`).
   - Require an explicit `--reset` CLI flag before truncating or clearing tables.
   - Reject production and unmarked databases before opening any database transaction.
   - Remove hardcoded shared passwords. Require `DEMO_PASSWORD` from the environment; never log the password value.
2. **`seed:acceptance` (`scripts/seed-acceptance.ts`)**:
   - Exclusively for automated test fixtures.
   - Enforce `NODE_ENV === 'test'`.
   - Reuse the existing test-database name guard (`_test`).
   - Reject execution against any database without the test marker.
3. **`admin:bootstrap` (`scripts/bootstrap-admin.ts`)**:
   - Non-destructive initial administrator setup.
   - Reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables.
   - Normalizes email, hashes password with Argon2.
   - Creates an `ACTIVE` administrator account with `mustChangePassword: true`.
   - If an account with `ADMIN_EMAIL` already exists, refuses to overwrite, modify, or promote it; exits safely with code 0.
   - Never deletes records, never truncates tables, and never prints credentials.
4. **Root `prisma:seed` Fix**:
   - Fix `package.json` in root: preserve `prisma:seed` as an alias forwarding to guarded `seed:demo`.

---

## 5. Verification, CI, and Rollout

### 5.1. Continuous Integration Pipeline (`.github/workflows/ci.yml`)

Required CI workflow running on all pull requests and pushes to `main`:

1. **Environment**: Node.js 22 and PostgreSQL 16 service container.
2. **Install**: Clean dependency install via `npm ci`.
3. **Prisma Generation**: `npm run prisma:generate`.
4. **Type Check**: `npm run typecheck` across backend and frontend workspaces.
5. **Boundary & Lint Checks**: Frontend boundary verification (no illegal imports).
6. **Build**: `npm run build` across all workspaces.
7. **Integration Tests**: Run backend integration suite against isolated PostgreSQL test database (`STORAGE_DRIVER=local`).
8. **End-to-End Tests**: Run Playwright suite against dedicated E2E test database with Playwright-managed Chromium.
9. **Artifacts & Reports**: Upload JUnit test reports and failure browser traces/screenshots, retained for 7 days.
10. **Deployment Gate**: Branch protection rule requires all CI steps to pass before merge.

### 5.2. Test Coverage Matrix

#### Schedule Snapshots
- Snapshot behavior before 17:30 cutoff, at 17:30 cutoff, on weekends, and at Bangkok midnight.
- Empty active schedules produce a successful zero-entry run (`insertedCount: 0`, status `SUCCEEDED`).
- Transient database error during snapshot is retried exponentially and succeeds same-day.
- Backend restart during snapshot run safely reclaims expired lease.
- Concurrency test: Two instances attempting the same date; exactly one acquires lease, second yields or reclaims safely.
- Transaction rollback: Induced failure during history insertion rolls back cleanly without partial rows or invalid success status.
- Idempotency: Multiple runs for the same date create no duplicate `History` rows.
- Midnight boundary: Incomplete runs crossing Bangkok midnight transition to `MISSED` without inserting yesterday's data.
- Multi-day downtime: Offline period over multiple weekdays generates proper `MISSED` run records up to `SNAPSHOT_TRACKING_START_DATE`.
- Delayed execution uses schedules valid at actual execution time.
- Existing historical entries remain unchanged.

#### Security & Request Protection
- Rate-limit thresholds, window increments, and window expiration.
- Multi-instance counter consistency in PostgreSQL.
- Spoofed forwarded headers from untrusted clients are ignored; trusted proxy CIDRs work as expected.
- HTTP 429 response structure and accurate `Retry-After` calculation.
- Rate-limit database failure gracefully returns HTTP 503 for protected endpoints.
- Uniform invalid credentials response and timing mitigation for non-existent users.
- Disabled account returns HTTP 403 only after password verification.
- Multipart limits: Rejection of oversized files, excess text fields, excess parts, and unexpected field names before file persistence.

#### Operations & Initialization
- Readiness probe returns 200 on healthy DB, 503 on DB timeout (>2s), and 503 during graceful shutdown.
- Request ID generation, propagation (`X-Request-ID`), and sensitive field redaction in JSON logs.
- Administrator role enforcement on `/api/v1/operations/snapshot-runs`.
- Seed scripts abort with error when executed against production or improperly marked database names.
- Bootstrap script safely skips existing administrator without mutation.
- All existing API and E2E regression tests remain green.

### 5.3. Rollout Strategy

1. **Database Migration**: Apply additive database migrations (`SnapshotRun`, `RateLimitWindow`) first; non-breaking to running services.
2. **Configuration**: Set `SNAPSHOT_TRACKING_START_DATE` to the first fully monitored business date after deployment. Configure `RATE_LIMIT_KEY_SECRET` and proxy trust CIDRs.
3. **Data Preservation**: Leave all existing `History` rows unchanged.
4. **Service Transition**: Deploy updated backend and start the new coordinator after previous instances have been gracefully drained.
5. **Staging Verification**: Validate one normal 17:30 snapshot and one simulated failure/retry cycle in staging environment.
6. **Production Cutover**: Release to production once CI and staging checks are verified.
7. **Rollback Safety**: If application rollback is needed, previous application code can safely run without dropping the newly added operational tables.
