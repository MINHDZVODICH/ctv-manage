# CTV Manage Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild CTV Manage as a production-style full-stack application whose visual output matches `prototype/` and whose behavior matches `docs/`.

**Architecture:** Implement vertical slices through a React feature UI and hooks, a shared HTTP client, Express module controllers/services, and Prisma/SQLite. Business state lives only on the server; the prototype is a visual reference with no runtime dependency.

**Tech Stack:** TypeScript strict, React 19, Vite 6, Tailwind CSS 4, Node.js 22, Express 4, Zod, Prisma/SQLite, Argon2id, Pino, Vitest/Testing Library, Node test runner/Supertest, Playwright, Docker.

**Spec:** `docs/superpowers/specs/2026-08-25-ctv-manage-rebuild-design.md`

## Global Constraints

- `prototype/` is authoritative only for layout, colors, typography, spacing, modal behavior, responsive behavior, and visible states.
- `docs/` is authoritative for business behavior, authorization, API, persistence, security, and errors.
- `app/frontend` must not import from `prototype/` and must not store business state in localStorage.
- Remove demo role switching, meetings, frontend seed business state, and orphaned prototype actions.
- All API routes use `/api/v1`; all authenticated mutations require `X-CSRF-Token`.
- Backend dependency flow is middleware → controller → service → Prisma/private file storage; controllers never call Prisma directly.
- Rooms are fixed to `ROOM_1`–`ROOM_4`; periods are `MORNING` and `AFTERNOON`; there is no room administration.
- New behavior follows RED → GREEN → REFACTOR and ships with behavior-focused tests.
- Preserve all pre-existing uncommitted `docs/` changes and do not modify `prototype/`.

---

### Task 1: Workspace foundation, database, and HTTP pipeline

**Files:**
- Create: `app/backend/package.json`, `app/backend/tsconfig.json`, `app/backend/.env.example`
- Create: `app/backend/prisma/schema.prisma`, `app/backend/prisma/seed.ts`
- Create: `app/backend/src/config.ts`, `app/backend/src/app.ts`, `app/backend/src/server.ts`
- Create: `app/backend/src/shared/api-error.ts`, `app/backend/src/shared/prisma.ts`, `app/backend/src/shared/logger.ts`
- Create: `app/backend/src/middleware/request-id.middleware.ts`, `app/backend/src/middleware/error.middleware.ts`, `app/backend/src/middleware/origin.middleware.ts`
- Create: `app/backend/tests/app.integration.test.ts`, `app/backend/tests/prisma-schema.test.ts`, `app/backend/tests/test-database.ts`
- Create: `app/frontend/package.json`, `app/frontend/tsconfig.json`, `app/frontend/vite.config.ts`, `app/frontend/index.html`, `app/frontend/src/main.tsx`, `app/frontend/src/index.css`
- Modify: `package.json`, `package-lock.json`, `.gitignore`

**Interfaces:**
- Produces: `createApp(deps?: AppDependencies): Express`, `ApiError`, `prisma`, validated `config`, complete Prisma models/enums.
- Produces: npm scripts `test`, `typecheck`, `build`, `prisma:generate`, `prisma:migrate`, `prisma:seed` at workspace and root levels.
- Consumes: entity/constraint definitions from `docs/DATABASE.md` plus infrastructure-only `IdempotencyRecord`.

- [ ] **Step 1: Add locked workspace manifests and test configuration**

Use React `^19.0.1`, Vite `^6.2.3`, Tailwind `^4.1.14`, Express `^4.21.2`, Prisma `^6.4.1`, Zod `^3.24.2`, Pino `^9.6.0`, Argon2 `^0.45.1`, Vitest `^3.0.8`, Testing Library React `^16.2.0`, Supertest `^7.0.0`, and Playwright `^1.51.1`. Root commands must invoke both workspaces with `npm.cmd` compatibility on Windows.

- [ ] **Step 2: Write failing pipeline and schema tests**

```ts
test('unknown API routes return the standard request-id error envelope', async () => {
  const response = await request(createApp()).get('/api/v1/missing');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'RESOURCE_NOT_FOUND');
  assert.match(response.body.error.requestId, /^req_/);
});

test('schema rejects duplicate shared shifts for the same date and period', async () => {
  await prisma.shift.create({ data: { workDate: new Date('2026-08-25'), period: 'MORNING' } });
  await assert.rejects(() => prisma.shift.create({ data: { workDate: new Date('2026-08-25'), period: 'MORNING' } }));
});
```

- [ ] **Step 3: Run RED**

Run: `npm.cmd test --workspace=app/backend -- tests/app.integration.test.ts tests/prisma-schema.test.ts`

Expected: FAIL because `createApp`, the Prisma schema, and test database do not exist.

- [ ] **Step 4: Implement the minimal foundation and schema**

`createApp` installs JSON parsing, request IDs, safe Pino logging, origin checking for public mutations, `/api/v1/health`, and the central 404/error handlers. Prisma models must include every field and unique/index/check-compatible rule in `DATABASE.md`; SQLite startup executes `PRAGMA foreign_keys=ON`, `PRAGMA journal_mode=WAL`, and `PRAGMA busy_timeout=5000`.

- [ ] **Step 5: Run GREEN and workspace checks**

Run: `npm.cmd run prisma:generate && npm.cmd test --workspace=app/backend -- tests/app.integration.test.ts tests/prisma-schema.test.ts && npm.cmd run typecheck`

Expected: all commands exit 0.

- [ ] **Step 6: Commit only Task 1 files**

```powershell
git add package.json package-lock.json .gitignore app/backend app/frontend
git commit -m "build: establish full-stack workspace foundation"
```

### Task 2: Authentication and real role-based App Shell

**Files:**
- Create: `app/backend/src/shared/session.ts`, `app/backend/src/shared/security.ts`
- Create: `app/backend/src/middleware/auth.middleware.ts`, `app/backend/src/middleware/csrf.middleware.ts`, `app/backend/src/middleware/rate-limit.middleware.ts`
- Create: `app/backend/src/modules/auth/auth.schemas.ts`, `auth.service.ts`, `auth.controller.ts`, `auth.routes.ts`, `auth.dto.ts`, `index.ts`
- Create: `app/backend/tests/auth.integration.test.ts`, `app/backend/tests/auth.service.test.ts`
- Create: `app/frontend/src/shared/api/client.ts`, `contracts.ts`, `errors.ts`
- Create: `app/frontend/src/shared/context/SystemSettingsContext.tsx`, `app/frontend/src/shared/types.ts`
- Create: `app/frontend/src/features/auth/useAuth.ts`, `LoginScreen.tsx`, `auth.test.tsx`
- Create: `app/frontend/src/app/App.tsx`, `app/frontend/src/app/Sidebar.tsx`, `app/frontend/src/app/App.test.tsx`
- Modify: `app/backend/src/app.ts`, `app/frontend/src/main.tsx`, `app/frontend/src/index.css`

**Interfaces:**
- Produces: `requireSession`, `requireRole('ADMIN' | 'CTV')`, `requireCsrf`, `AuthService`, `apiClient`, `useAuth`.
- Produces API: create/current/delete session and CSRF token exactly as `docs/API_SPEC.md` section 2.
- Consumes: `Account`, `Session`, error envelope and `createApp` from Task 1.

- [ ] **Step 1: Write failing backend authentication tests**

```ts
test('login stores only a token hash and returns a secure session cookie', async () => {
  const response = await request(app).post('/api/v1/auth/sessions').set('Origin', allowedOrigin).send(validCredentials);
  assert.equal(response.status, 201);
  assert.match(response.headers['set-cookie'][0], /ctv_session=.*HttpOnly.*SameSite=Lax/);
  assert.equal(await prisma.session.count({ where: { tokenHash: { not: '' } } }), 1);
  assert.equal(JSON.stringify(response.body).includes('token'), false);
});

test('authenticated mutation rejects a missing CSRF token', async () => {
  const response = await request(app).delete('/api/v1/auth/sessions/current').set('Cookie', sessionCookie);
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'CSRF_INVALID');
});
```

- [ ] **Step 2: Run backend RED**

Run: `npm.cmd test --workspace=app/backend -- tests/auth.service.test.ts tests/auth.integration.test.ts`

Expected: FAIL with missing auth module.

- [ ] **Step 3: Implement backend auth and run GREEN**

Hash passwords with Argon2id, generate 32 random token bytes, store SHA-256 only, derive CSRF with HMAC-SHA256, compare constant-time, revoke sessions idempotently, and normalize invalid credentials.

Run: `npm.cmd test --workspace=app/backend -- tests/auth.service.test.ts tests/auth.integration.test.ts`

Expected: PASS.

- [ ] **Step 4: Write failing frontend auth/App Shell tests**

```tsx
it('renders the Admin navigation from the current server session without a role switcher', async () => {
  render(<App />);
  expect(await screen.findByRole('button', { name: /quản lý tài khoản/i })).toBeVisible();
  expect(screen.queryByText(/chuyển vai trò/i)).not.toBeInTheDocument();
});

it('clears authenticated UI only after logout succeeds', async () => {
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /đăng xuất/i }));
  expect(await screen.findByRole('heading', { name: /đăng nhập/i })).toBeVisible();
});
```

- [ ] **Step 5: Run frontend RED, implement, then run GREEN**

Run RED: `npm.cmd test --workspace=app/frontend -- src/features/auth/auth.test.tsx src/app/App.test.tsx`

Implement the prototype-shaped login page and shell, `credentials: include`, CSRF caching per session, session bootstrap loading state, ADMIN/CTV navigation, logout, and settings-only context.

Run GREEN: `npm.cmd test --workspace=app/frontend -- src/features/auth/auth.test.tsx src/app/App.test.tsx`

- [ ] **Step 6: Commit Task 2**

```powershell
git add app/backend/src app/backend/tests app/frontend/src
git commit -m "feat: add secure sessions and role-based app shell"
```

### Task 3: Registration submission and Admin decision vertical slice

**Files:**
- Create: `app/backend/src/shared/file-storage.ts`, `app/backend/src/shared/idempotency.ts`
- Create: `app/backend/src/modules/registration-requests/registration-requests.schemas.ts`, `registration-requests.service.ts`, `registration-requests.controller.ts`, `registration-requests.routes.ts`, `registration-requests.dto.ts`, `index.ts`
- Create: `app/backend/tests/registration-requests.integration.test.ts`, `app/backend/tests/file-storage.test.ts`
- Create: `app/frontend/src/features/registration-requests/useRegistrationRequests.ts`, `RegistrationScreen.tsx`, `RequestsScreen.tsx`, `ViewRequestModal.tsx`, `registration-requests.test.tsx`
- Modify: `app/backend/src/app.ts`, `app/frontend/src/app/App.tsx`, `app/frontend/src/index.css`

**Interfaces:**
- Produces: public multipart creation; Admin list/detail/decision endpoints; `FileStorage.stage/finalize/open/remove`; idempotent response replay.
- Consumes: auth guards, Prisma transaction layer, shared API client and prototype registration/request layouts.

- [ ] **Step 1: Write failing backend registration tests**

```ts
test('replays the same registration result for the same idempotency key and payload', async () => {
  const first = await submitRegistration('key-1', profile);
  const second = await submitRegistration('key-1', profile);
  assert.equal(first.status, 201);
  assert.deepEqual(second.body, first.body);
  assert.equal(await prisma.registrationRequest.count(), 1);
});

test('only one Admin can approve a pending request', async () => {
  const [a, b] = await Promise.all([approve(requestId, adminA), approve(requestId, adminB)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(await prisma.account.count({ where: { email: profile.email } }), 1);
});
```

- [ ] **Step 2: Run RED, implement service/controller/storage, run GREEN**

Run RED: `npm.cmd test --workspace=app/backend -- tests/file-storage.test.ts tests/registration-requests.integration.test.ts`

Implementation must validate multipart profile, optional CCCD/CV, byte limits and signatures; stage files outside public roots; hash password immediately; finalize or quarantine files; never return password hash/storage key; create a notification on approval.

Run GREEN: same command; expected PASS.

- [ ] **Step 3: Write failing frontend registration and request-list tests**

```tsx
it('does not send confirmPassword and clears sensitive fields after submission', async () => {
  render(<RegistrationScreen />);
  await fillAndSubmitValidRegistration();
  expect(capturedProfile).not.toHaveProperty('confirmPassword');
  expect(await screen.findByText(/đã gửi hồ sơ/i)).toBeVisible();
  expect(screen.getByLabelText(/mật khẩu$/i)).toHaveValue('');
});

it('reloads the pending page after an Admin approves a request', async () => {
  render(<RequestsScreen />);
  await user.click(await screen.findByRole('button', { name: /phê duyệt/i }));
  expect(await screen.findByText(/đã duyệt/i)).toBeVisible();
});
```

- [ ] **Step 4: Run frontend RED, implement prototype-parity screens, run GREEN**

Run: `npm.cmd test --workspace=app/frontend -- src/features/registration-requests/registration-requests.test.tsx`

Expected before/after: FAIL for missing UI, then PASS after implementation.

- [ ] **Step 5: Commit Task 3**

```powershell
git add app/backend/src app/backend/tests app/frontend/src
git commit -m "feat: implement registration and approval workflow"
```

### Task 4: Accounts, profiles, passwords, and private files vertical slice

**Files:**
- Create: `app/backend/src/modules/accounts/accounts.schemas.ts`, `accounts.service.ts`, `accounts.controller.ts`, `accounts.routes.ts`, `users.routes.ts`, `accounts.dto.ts`, `index.ts`
- Create: `app/backend/src/modules/files/files.controller.ts`, `files.routes.ts`, `index.ts`
- Create: `app/backend/tests/accounts.integration.test.ts`, `app/backend/tests/files.integration.test.ts`
- Create: `app/frontend/src/features/accounts/useAccounts.ts`, `AccountListScreen.tsx`, `ViewAccountDetailModal.tsx`, `ResetPasswordModal.tsx`, `accounts.test.tsx`
- Create: `app/frontend/src/features/profile/useProfile.ts`, `ProfileScreen.tsx`, `EditProfileModal.tsx`, `ChangePasswordModal.tsx`, `profile.test.tsx`
- Modify: `app/backend/src/app.ts`, `app/frontend/src/app/App.tsx`, `app/frontend/src/index.css`

**Interfaces:**
- Produces every endpoint in API sections 4 and 5, including pagination, version conflicts, notes, self/admin file operations, and password session revocation.
- Consumes `FileStorage`, `AuthActor`, Prisma models, shared frontend API client.

- [ ] **Step 1: Write failing account/security integration tests**

```ts
test('disabling an account revokes sessions and cancels only future assignments atomically', async () => {
  const response = await adminPatchStatus(ctv.id, { status: 'DISABLED', version: ctv.version });
  assert.equal(response.status, 200);
  assert.equal(await activeSessionCount(ctv.id), 0);
  assert.equal(await futureActiveAssignmentCount(ctv.id), 0);
  assert.equal(await pastActiveAssignmentCount(ctv.id), 1);
});

test('a CTV cannot download another CTV file while Admin can', async () => {
  assert.equal((await downloadAs(ctvB, ctvAFile.id)).status, 404);
  assert.equal((await downloadAs(admin, ctvAFile.id)).status, 200);
});
```

- [ ] **Step 2: Run backend RED, implement endpoints, run GREEN**

Run: `npm.cmd test --workspace=app/backend -- tests/accounts.integration.test.ts tests/files.integration.test.ts`

Expected before/after: FAIL for missing modules, then PASS. Include `CURRENT_PASSWORD_INVALID`, idempotent soft delete, Admin password reset without password echo, and safe download headers.

- [ ] **Step 3: Write failing frontend account/profile tests**

```tsx
it('keeps server pagination and search when an account status changes', async () => {
  render(<AccountListScreen />);
  await user.type(screen.getByPlaceholderText(/họ tên/i), 'An');
  await user.click(await screen.findByTitle(/vô hiệu hóa/i));
  expect(lastAccountsQuery).toMatchObject({ q: 'An', page: 1, pageSize: 5 });
});

it('updates a profile file through the authorized endpoint and reloads metadata', async () => {
  render(<ProfileScreen />);
  await user.upload(screen.getByLabelText(/ảnh đại diện/i), avatarFile);
  expect(await screen.findByText(/thay đổi ảnh đại diện thành công/i)).toBeVisible();
});
```

- [ ] **Step 4: Run frontend RED, implement prototype-parity UI, run GREEN**

Run: `npm.cmd test --workspace=app/frontend -- src/features/accounts/accounts.test.tsx src/features/profile/profile.test.tsx`

- [ ] **Step 5: Commit Task 4**

```powershell
git add app/backend/src app/backend/tests app/frontend/src
git commit -m "feat: implement account profile and file management"
```

### Task 5: CTV schedule registration, personal calendar, and cancellation

**Files:**
- Create: `app/backend/src/modules/schedules/schedule.schemas.ts`, `schedule.service.ts`, `schedule.controller.ts`, `schedule.routes.ts`, `schedule.dto.ts`, `index.ts`
- Create: `app/backend/tests/schedules.service.test.ts`, `app/backend/tests/schedules.integration.test.ts`
- Create: `app/frontend/src/shared/utils/scheduleSelectors.ts`, `formatters.ts`
- Create: `app/frontend/src/features/schedules/useMySchedule.ts`, `CTVScheduleWorkspace.tsx`, `ScheduleScreen.tsx`, `ShiftDetailModal.tsx`, `my-schedule.test.tsx`
- Modify: `app/backend/src/app.ts`, `app/frontend/src/app/App.tsx`, `app/frontend/src/index.css`

**Interfaces:**
- Produces: current registration get/put, personal shifts, shift detail, cancel-one and cancel-series endpoints.
- Produces: `expandPattern({startDate,endDate,slots,timeZone})` with deterministic `YYYY-MM-DD` dates and no weekend slots.
- Consumes fixed room/period enums and account/session authorization.

- [ ] **Step 1: Write failing schedule expansion and version tests**

```ts
test('expands only selected weekdays and periods in Asia/Bangkok', () => {
  assert.deepEqual(expandPattern({ startDate: '2026-08-24', endDate: '2026-08-28', slots: [{ weekday: 1, period: 'MORNING' }] }), [
    { workDate: '2026-08-24', period: 'MORNING' },
  ]);
});

test('rejects a stale schedule version without changing assignments', async () => {
  const before = await snapshotAssignments(ctv.id);
  const response = await putSchedule(ctv, { ...payload, version: currentVersion - 1 });
  assert.equal(response.status, 409);
  assert.deepEqual(await snapshotAssignments(ctv.id), before);
});
```

- [ ] **Step 2: Run backend RED, implement transaction logic, run GREEN**

Run: `npm.cmd test --workspace=app/backend -- tests/schedules.service.test.ts tests/schedules.integration.test.ts`

Implementation creates shared shifts by date+period, individual assignments with room/content, cancels removed/future assignments safely, and returns affectedCount 0 for repeated cancellation.

- [ ] **Step 3: Write failing CTV schedule UI tests**

```tsx
it('requires one of the four fixed rooms and at least one slot before saving', async () => {
  render(<CTVScheduleWorkspace />);
  await user.click(screen.getByRole('button', { name: /lưu lịch/i }));
  expect(await screen.findByText(/chọn buồng làm việc/i)).toBeVisible();
  expect(screen.getByText(/chọn ít nhất một ca/i)).toBeVisible();
});

it('reloads the registration after VERSION_CONFLICT instead of overwriting', async () => {
  render(<CTVScheduleWorkspace />);
  await submitStaleSchedule();
  expect(await screen.findByText(/dữ liệu đã được cập nhật/i)).toBeVisible();
  expect(getRegistrationCalls).toBe(2);
});
```

- [ ] **Step 4: Run frontend RED, implement weekly/history/cancel UI, run GREEN**

Run: `npm.cmd test --workspace=app/frontend -- src/features/schedules/my-schedule.test.tsx`

- [ ] **Step 5: Commit Task 5**

```powershell
git add app/backend/src app/backend/tests app/frontend/src
git commit -m "feat: implement CTV schedule workflows"
```

### Task 6: Admin schedule summary and notifications vertical slice

**Files:**
- Create: `app/backend/src/modules/notifications/notifications.service.ts`, `notifications.controller.ts`, `notifications.routes.ts`, `notifications.dto.ts`, `index.ts`
- Create: `app/backend/tests/schedule-summary.integration.test.ts`, `app/backend/tests/notifications.integration.test.ts`
- Create: `app/frontend/src/features/schedules/useScheduleSummary.ts`, `SummaryScheduleScreen.tsx`, `ShiftRosterModal.tsx`, `schedule-summary.test.tsx`
- Create: `app/frontend/src/features/notifications/useNotifications.ts`, `NotificationsPopover.tsx`, `notifications.test.tsx`
- Modify: `app/backend/src/modules/schedules/schedule.service.ts`, `app/backend/src/modules/schedules/schedule.controller.ts`, `app/backend/src/modules/schedules/schedule.dto.ts`, `app/backend/src/app.ts`, `app/frontend/src/app/App.tsx`, `app/frontend/src/app/Sidebar.tsx`, `app/frontend/src/index.css`

**Interfaces:**
- Produces: Admin monthly summary, Admin shift roster, user notification list and read-state patch.
- Consumes: shared `Shift`/`ShiftAssignment`, Account detail flow from Task 4, notification rows created by source services.

- [ ] **Step 1: Write failing Admin summary and ownership tests**

```ts
test('groups a monthly summary by shared date and period rather than room', async () => {
  const response = await getSummary(admin, '2026-08');
  assert.equal(response.body.data.days[0].slots[0].count, 2);
  assert.equal(response.body.data.days[0].slots.length, 1);
});

test('a user cannot change another account notification', async () => {
  const response = await patchNotification(ctvB, ctvANotification.id, true);
  assert.equal(response.status, 404);
});
```

- [ ] **Step 2: Run backend RED, implement modules, run GREEN**

Run: `npm.cmd test --workspace=app/backend -- tests/schedule-summary.integration.test.ts tests/notifications.integration.test.ts`

- [ ] **Step 3: Write failing Admin calendar and notification UI tests**

```tsx
it('opens the shared shift roster and then the selected CTV profile', async () => {
  render(<SummaryScheduleScreen />);
  await user.click(await screen.findByRole('button', { name: /2 cộng tác viên/i }));
  await user.click(await screen.findByText('Nguyễn Văn A'));
  expect(await screen.findByRole('heading', { name: /hồ sơ.*nguyễn văn a/i })).toBeVisible();
});

it('marks only the selected notification as read', async () => {
  render(<NotificationsPopover />);
  await user.click(await screen.findByText('Hồ sơ đã được duyệt'));
  expect(patchBody).toEqual({ read: true });
});
```

- [ ] **Step 4: Run frontend RED, implement prototype-parity UI, run GREEN**

Run: `npm.cmd test --workspace=app/frontend -- src/features/schedules/schedule-summary.test.tsx src/features/notifications/notifications.test.tsx`

- [ ] **Step 5: Commit Task 6**

```powershell
git add app/backend/src app/backend/tests app/frontend/src
git commit -m "feat: add Admin schedule summary and notifications"
```

### Task 7: Visual parity, responsive behavior, and complete contract coverage

**Files:**
- Create: `app/frontend/playwright.config.ts`, `app/frontend/e2e/auth.spec.ts`, `admin.spec.ts`, `ctv.spec.ts`, `visual-parity.spec.ts`
- Create: `app/frontend/src/shared/ui/LoadingState.tsx`, `ErrorState.tsx`, `Toast.tsx`, `Modal.tsx`
- Create: `app/backend/tests/api-contract.integration.test.ts`
- Modify: `app/frontend/src/features/auth/LoginScreen.tsx`, `app/frontend/src/features/registration-requests/RegistrationScreen.tsx`, `app/frontend/src/features/registration-requests/RequestsScreen.tsx`, `app/frontend/src/features/registration-requests/ViewRequestModal.tsx`, `app/frontend/src/features/accounts/AccountListScreen.tsx`, `app/frontend/src/features/accounts/ViewAccountDetailModal.tsx`, `app/frontend/src/features/accounts/ResetPasswordModal.tsx`, `app/frontend/src/features/profile/ProfileScreen.tsx`, `app/frontend/src/features/profile/EditProfileModal.tsx`, `app/frontend/src/features/profile/ChangePasswordModal.tsx`, `app/frontend/src/features/schedules/CTVScheduleWorkspace.tsx`, `app/frontend/src/features/schedules/ScheduleScreen.tsx`, `app/frontend/src/features/schedules/ShiftDetailModal.tsx`, `app/frontend/src/features/schedules/SummaryScheduleScreen.tsx`, `app/frontend/src/features/schedules/ShiftRosterModal.tsx`, `app/frontend/src/features/notifications/NotificationsPopover.tsx`, `app/frontend/src/app/App.tsx`, `app/frontend/src/app/Sidebar.tsx`, `app/frontend/src/index.css`

**Interfaces:**
- Produces: deterministic E2E seed/reset command for test only, Playwright desktop 1440×900 and mobile 390×844 projects.
- Consumes: all API routes and feature UI from Tasks 2–6; prototype screenshots as the visual reference.

- [ ] **Step 1: Write failing API contract coverage test**

Create a table-driven test that calls every endpoint row in `docs/API_SPEC.md` with an authorized happy-path fixture and at least one unauthorized actor. Assert success status/envelope and `401`/`403`/`404` behavior, not Express internals.

Run RED: `npm.cmd test --workspace=app/backend -- tests/api-contract.integration.test.ts`

Expected: FAIL on any missing route or incompatible response.

- [ ] **Step 2: Fill only contract gaps and run GREEN**

Run: `npm.cmd test --workspace=app/backend -- tests/api-contract.integration.test.ts`

Expected: PASS for all documented routes.

- [ ] **Step 3: Write failing end-to-end flows**

```ts
test('Admin approves a registration and sees the account', async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: /yêu cầu đăng ký/i }).click();
  await page.getByRole('button', { name: /phê duyệt/i }).first().click();
  await page.getByRole('button', { name: /quản lý tài khoản/i }).click();
  await expect(page.getByText('Nguyễn Văn A')).toBeVisible();
});

test('CTV registers a weekly schedule and cancels one assignment', async ({ page }) => {
  await loginAsCtv(page);
  await chooseRoomAndMondayMorning(page);
  await page.getByRole('button', { name: /lưu lịch/i }).click();
  await expect(page.getByText(/lưu.*thành công/i)).toBeVisible();
  await cancelFirstVisibleAssignment(page);
  await expect(page.getByText(/đã hủy 1 ca/i)).toBeVisible();
});
```

- [ ] **Step 4: Run E2E RED, fix only missing integration, run GREEN**

Run: `npm.cmd run test:e2e --workspace=app/frontend`

Expected: both roles pass on desktop and responsive navigation passes on mobile.

- [ ] **Step 5: Capture reference/app screenshots and correct visual diffs**

Use deterministic data and compare login, Admin accounts/requests/summary/profile, and CTV schedule/profile at 1440×900 and 390×844. Preserve production-only differences named in the spec; correct component/CSS differences until the visual test threshold passes.

Run: `npm.cmd run test:visual --workspace=app/frontend`

Expected: PASS with no unreviewed snapshot changes.

- [ ] **Step 6: Commit Task 7**

```powershell
git add app/backend/tests app/frontend
git commit -m "test: verify API coverage and prototype visual parity"
```

### Task 8: Docker, CI, operational docs, and final verification

**Files:**
- Create: `app/backend/Dockerfile`, `app/frontend/Dockerfile`, `app/frontend/nginx.conf`, `docker-compose.yml`
- Create: `.gitlab-ci.yml`, `README.md`, `scripts/docker-smoke.mjs`
- Modify: `app/backend/.env.example`, `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `docker compose up --build`, persistent SQLite/upload volumes, documented seed/start workflow, CI verification pipeline.
- Consumes: complete application from Tasks 1–7.

- [ ] **Step 1: Add Docker smoke test before Docker implementation**

Create a script-level smoke test that starts the built compose services, waits for `/api/v1/health`, fetches the frontend root, and always tears down its named test project. Assert HTTP 200 and valid JSON/HTML outputs.

Run RED: `npm.cmd run test:docker`

Expected: FAIL because Docker assets do not exist.

- [ ] **Step 2: Implement production Docker/CI configuration and run GREEN**

Backend image runs Prisma migration before server start, uses a non-root user, and mounts `/data` plus `/uploads`. Frontend image serves static assets and proxies `/api/v1`. CI runs `npm ci`, Prisma validate/generate, test, typecheck, build, and Docker build.

Run: `npm.cmd run test:docker`

Expected: PASS and teardown leaves no running test service.

- [ ] **Step 3: Write complete runbook**

README must contain exact Windows commands (`npm.cmd`), environment variables, migration/seed commands, default ports, how to create the bootstrap Admin through env, file limits, test commands, Docker commands, and the statement that `prototype/` is reference-only.

- [ ] **Step 4: Run fresh full verification**

```powershell
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e --workspace=app/frontend
npm.cmd run test:visual --workspace=app/frontend
npm.cmd run test:docker
git status --short
```

Expected: every command exits 0; no generated database, upload, secret or build artifact is tracked.

- [ ] **Step 5: Commit Task 8**

```powershell
git add .gitlab-ci.yml README.md docker-compose.yml package.json package-lock.json app/backend app/frontend
git commit -m "chore: add deployment and verification pipeline"
```
