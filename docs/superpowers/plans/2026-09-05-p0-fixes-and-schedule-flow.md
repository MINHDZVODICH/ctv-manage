# Phase 1 P0 Fixes and Schedule Flow Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical P0 security and behavior defects (auth middleware leak, schedule deletion on account disable, transactional session revocation, password leak) and standardize the CTV weekly schedule lifecycle (add/cancel/room update/delete) entirely within the weekly schedule modal form.

**Architecture:** Enforce defense-in-depth authentication in Express middleware by rejecting non-ACTIVE accounts with 403 `ACCOUNT_DISABLED`. Execute account status updates, soft deletes, and password resets transactionally with session revocation using `prisma.$transaction`, preserving `Schedule`, `Shift`, and `History`. Remove backend fake stubs (`cancelOne`, `cancelSeries`, `extendRecurringSchedules`) and legacy endpoints, introduce `DELETE /api/v1/users/me/schedule`, and rearchitect the CTV schedule frontend workspace to synchronize saved vs draft states.

**Tech Stack:** Node.js (v20+), Express, TypeScript, Prisma ORM, PostgreSQL, Vitest, Supertest, React 19, TailwindCSS, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-05-p0-fixes-and-schedule-flow-design.md`

## Global Constraints
- Node.js version >= 20.x, PostgreSQL 16.
- All backend database mutations affecting account status, soft-delete, and password reset must execute in a single atomic transaction with session revocation (`prisma.$transaction`).
- Account disabling or soft-deleting MUST NEVER delete `Schedule`, `Shift`, or `History` records.
- Protected authentication middleware (`auth.ts`) MUST reject non-ACTIVE accounts with HTTP 403 `ACCOUNT_DISABLED` (no logout exception needed inside `auth`). `optionalAuth` must treat non-ACTIVE accounts as anonymous.
- Public APIs must not return fake success for non-persisted schedule changes. Shift cancellation and room updating are managed exclusively as weekly slot modifications via `PUT /api/v1/users/me/schedule` or entire schedule removal via `DELETE /api/v1/users/me/schedule`.
- Plaintext passwords must never be stored in persistent frontend state (`selectedAccountDetail` or persistent toasts).

---

### Task 1: Auth Middleware Status Rejection & Optional Auth (TDD)

**Files:**
- Modify: `app/backend/src/middleware/auth.ts:25-77`
- Test: `app/backend/tests/auth-and-access.integration.test.ts`

**Interfaces:**
- Consumes: `req.cookies`, `prisma.session`, `prisma.account`, `Errors.forbidden('ACCOUNT_DISABLED', ...)`
- Produces: Strict 403 rejection for non-ACTIVE accounts on protected routes, anonymous bypass for optionalAuth.

- [ ] **Step 1: Write the failing test**

Add integration tests to `app/backend/tests/auth-and-access.integration.test.ts` verifying that:
1. A user whose session is valid but account is marked `DISABLED` directly in the database receives a 403 `ACCOUNT_DISABLED` on protected endpoints (`GET /api/v1/users/me`).
2. Calling an optional auth endpoint with a `DISABLED` account does not attach `req.user`.

```ts
  test('rejects non-ACTIVE account with 403 ACCOUNT_DISABLED even if session exists', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Directly disable account in DB without revoking session to test defense-in-depth
    await prisma.account.update({
      where: { id: ctv.id },
      data: { status: 'DISABLED' },
    });

    const res = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:integration -- tests/auth-and-access.integration.test.ts
```
Expected: FAIL because `auth.ts` lines 36-38 currently pass through without throwing.

- [ ] **Step 3: Write minimal implementation**

In `app/backend/src/middleware/auth.ts`:
Replace lines 36-38:
```ts
    if (account.status !== 'ACTIVE') {
      throw Errors.forbidden(
        'ACCOUNT_DISABLED',
        'Tài khoản đã bị vô hiệu hóa',
      );
    }
```
And in `optionalAuth` line 64:
```ts
    if (!account || account.deletedAt || account.status !== 'ACTIVE') return next();
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:integration -- tests/auth-and-access.integration.test.ts
```
Expected: PASS (all tests in `auth-and-access.integration.test.ts` pass).

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/middleware/auth.ts app/backend/tests/auth-and-access.integration.test.ts
git commit -m "fix(auth): enforce 403 ACCOUNT_DISABLED for non-active accounts in auth middleware"
```

---

### Task 2: Transactional Account Disabling & Soft Delete with Schedule Preservation (TDD)

**Files:**
- Modify: `app/backend/src/modules/accounts/accounts.service.ts:84-95, 225-277`
- Test: `app/backend/tests/accounts-and-profiles.integration.test.ts`

**Interfaces:**
- Consumes: `prisma.$transaction`, `assertVersionMatch`
- Produces: Transactional `changeStatus` and `softDelete` that preserve `Schedule`, `Shift`, and `History` while revoking active sessions.

- [ ] **Step 1: Write the failing test**

In `app/backend/tests/accounts-and-profiles.integration.test.ts`, add a test verifying that disabling or soft-deleting an account preserves its `Schedule` and `Shift` records and revokes all active sessions atomically:

```ts
  test('disabling and soft-deleting an account preserves schedule and shifts and revokes sessions', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Seed a schedule for this CTV
    await prisma.schedule.upsert({
      where: { accountId: ctv.id },
      create: {
        accountId: ctv.id,
        roomCode: 'ROOM_1',
        shifts: {
          create: [{ weekday: 1, period: 'MORNING' }, { weekday: 3, period: 'AFTERNOON' }],
        },
      },
      update: {},
    });

    // 1. Disable account
    const disableRes = await request(app)
      .patch(`/api/v1/accounts/${ctv.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'DISABLED', expectedVersion: ctv.version });
    expect(disableRes.status).toBe(200);

    // Verify schedule still exists
    const scheduleAfterDisable = await prisma.schedule.findUnique({
      where: { accountId: ctv.id },
      include: { shifts: true },
    });
    expect(scheduleAfterDisable).not.toBeNull();
    expect(scheduleAfterDisable?.shifts).toHaveLength(2);

    // Verify session revoked
    const postDisableReq = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(postDisableReq.status).toBe(401);

    // 2. Soft-delete account
    const delRes = await request(app).delete(`/api/v1/accounts/${ctv.id}`).set('Cookie', adminCookie);
    expect(delRes.status).toBe(200);

    // Verify schedule still exists after soft-delete
    const scheduleAfterDelete = await prisma.schedule.findUnique({
      where: { accountId: ctv.id },
      include: { shifts: true },
    });
    expect(scheduleAfterDelete).not.toBeNull();
    expect(scheduleAfterDelete?.shifts).toHaveLength(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:integration -- tests/accounts-and-profiles.integration.test.ts
```
Expected: FAIL because `disableSideEffects` deletes the schedule.

- [ ] **Step 3: Write minimal implementation**

In `app/backend/src/modules/accounts/accounts.service.ts`:
1. Remove `disableSideEffects` and `prisma.schedule.deleteMany`.
2. Refactor `changeStatus` to run inside `prisma.$transaction`:
```ts
export async function changeStatus(accountId: string, status: string, expectedVersion?: number) {
  return await prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({ where: { id: accountId, deletedAt: null } });
    if (!account) throw Errors.notFound('Không tìm thấy tài khoản');

    assertVersionMatch(account.version, expectedVersion);

    const updated = await tx.account.update({
      where: { id: accountId },
      data: { status, version: { increment: 1 } },
      include: {
        accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } },
      },
    });

    if (status === 'DISABLED') {
      await tx.session.updateMany({
        where: { accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return mapAccountDetail(updated);
  });
}
```
3. Refactor `softDelete` to run inside `prisma.$transaction`:
```ts
export async function softDelete(accountId: string) {
  return await prisma.$transaction(async (tx) => {
    const account = await tx.account.findUnique({ where: { id: accountId } });
    if (!account) throw Errors.notFound('Không tìm thấy tài khoản');

    if (account.deletedAt) {
      const withFiles = await tx.account.findUnique({
        where: { id: accountId },
        include: { accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } } },
      });
      return mapAccountDetail(withFiles!);
    }

    const now = new Date();
    const updated = await tx.account.update({
      where: { id: accountId },
      data: { deletedAt: now, status: 'DISABLED', version: { increment: 1 } },
      include: { accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } } },
    });

    await tx.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: now },
    });

    return mapAccountDetail(updated);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:integration -- tests/accounts-and-profiles.integration.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/modules/accounts/accounts.service.ts app/backend/tests/accounts-and-profiles.integration.test.ts
git commit -m "fix(accounts): preserve schedule on account disable/delete and revoke sessions atomically"
```

---

### Task 3: Transactional Password Reset & Secure Frontend Password Handling (TDD)

**Files:**
- Modify: `app/backend/src/modules/accounts/accounts.service.ts:280-307`
- Modify: `app/frontend/src/app/App.tsx:355-365`
- Test: `app/backend/tests/auth-and-passwords.integration.test.ts`

**Interfaces:**
- Consumes: `argon2.hash`, `prisma.$transaction`
- Produces: Atomic password reset and session revocation on backend; transient reset result state in frontend.

- [ ] **Step 1: Write the failing test**

In `app/backend/tests/auth-and-passwords.integration.test.ts`, add a test asserting that resetting a password updates the password hash and revokes all active sessions for that account in a single transaction:

```ts
  test('password reset revokes active sessions atomically', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    const resetRes = await request(app)
      .post(`/api/v1/accounts/${ctv.id}/password-resets`)
      .set('Cookie', adminCookie)
      .send({ newPassword: 'NewSecretPassword123!', mustChangePassword: true });
    expect(resetRes.status).toBe(200);

    // Existing session must be revoked
    const postResetReq = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(postResetReq.status).toBe(401);

    // Can log in with new password
    const newLogin = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.active@ctv.local', password: 'NewSecretPassword123!' });
    expect(newLogin.status).toBe(201);
    expect(newLogin.body.user.mustChangePassword).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails / passes**

Run:
```bash
npm run test:integration -- tests/auth-and-passwords.integration.test.ts
```

- [ ] **Step 3: Write minimal implementation**

In `app/backend/src/modules/accounts/accounts.service.ts`:
Refactor `resetPassword` to execute within `prisma.$transaction`:
```ts
export async function resetPassword(accountId: string, newPassword: string, mustChangePassword?: boolean) {
  const passwordHash = await argon2.hash(newPassword);
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({ where: { id: accountId, deletedAt: null } });
    if (!account) throw Errors.notFound('Không tìm thấy tài khoản');

    const updated = await tx.account.update({
      where: { id: accountId },
      data: {
        passwordHash,
        mustChangePassword: mustChangePassword ?? false,
        passwordChangedAt: now,
      },
      include: { accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } } },
    });

    await tx.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: now },
    });

    return mapAccountDetail(updated);
  });
}
```

In `app/frontend/src/app/App.tsx`:
1. Remove `{ ...prev, password: newPassword }` from `selectedAccountDetail`.
2. Introduce transient state `resetResultModal: { accountName: string; password: string } | null` and render a one-time dialog with copy button and close button. When closed, set state to `null`.
3. In `handleResetPassword`, do NOT include `newPassword` in the generic toast.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:integration -- tests/auth-and-passwords.integration.test.ts
cd ../frontend && npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/modules/accounts/accounts.service.ts app/backend/tests/auth-and-passwords.integration.test.ts app/frontend/src/app/App.tsx
git commit -m "fix(security): make password reset transactional and remove plaintext password from persistent frontend state"
```

---

### Task 4: Remove Fake Schedule Stubs & Add Real DELETE /users/me/schedule (TDD)

**Files:**
- Modify: `app/backend/src/modules/schedule/schedule.service.ts`
- Modify: `app/backend/src/modules/schedule/schedule.controller.ts`
- Modify: `app/backend/src/modules/schedule/schedule.routes.ts`
- Modify: `app/backend/tests/files-and-schedule.integration.test.ts`
- Test: `app/backend/tests/schedule-redesign.integration.test.ts`

**Interfaces:**
- Consumes: `prisma.schedule`, `prisma.shift`
- Produces: `DELETE /api/v1/users/me/schedule`, removed fake endpoints (`/shift-assignments/:assignmentId`, `/schedule-registrations/:id/assignments`, `/schedule-registrations/:id/series`) returning 404.

- [ ] **Step 1: Write the failing test**

In `app/backend/tests/schedule-redesign.integration.test.ts`, add tests for `DELETE /api/v1/users/me/schedule`:
1. Successfully deletes the CTV's weekly schedule and its shifts.
2. Returns 404 if schedule does not exist.
3. Supports optimistic concurrency with `expectedVersion`.
4. Asserts that removed endpoints (`DELETE /api/v1/users/me/shift-assignments/123`, `DELETE /api/v1/users/me/schedule-registrations/123/assignments`) return 404.

```ts
  test('DELETE /api/v1/users/me/schedule removes schedule and shifts with version check', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // Create schedule
    const putRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });
    expect(putRes.status).toBe(200);
    const version = putRes.body.data.version;

    // Delete with matching version
    const delRes = await request(app)
      .delete('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({ expectedVersion: version });
    expect(delRes.status).toBe(200);

    // Get schedule returns null
    const getRes = await request(app).get('/api/v1/users/me/schedule').set('Cookie', ctvCookie);
    expect(getRes.body.data).toBeNull();

    // Verify removed stub endpoints return 404
    const fakeAssignmentDel = await request(app)
      .delete('/api/v1/users/me/shift-assignments/any-id')
      .set('Cookie', ctvCookie);
    expect(fakeAssignmentDel.status).toBe(404);
  });
```

Update `app/backend/tests/files-and-schedule.integration.test.ts` lines 107-112 to assert that `DELETE /api/v1/users/me/shift-assignments/...` returns 404 (removed).

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:integration -- tests/schedule-redesign.integration.test.ts
```
Expected: FAIL because `DELETE /api/v1/users/me/schedule` is not implemented and old stub route still returns 200.

- [ ] **Step 3: Write minimal implementation**

1. In `app/backend/src/modules/schedule/schedule.service.ts`:
Add `deleteMySchedule`:
```ts
export async function deleteMySchedule(accountId: string, expectedVersion?: number) {
  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`;

    const existing = await tx.schedule.findUnique({
      where: { accountId },
    });

    if (!existing) {
      throw Errors.notFound('Không tìm thấy lịch làm việc');
    }

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw Errors.conflict(
        'VERSION_CONFLICT',
        'Lịch làm việc đã được cập nhật ở phiên khác. Vui lòng tải lại.',
      );
    }

    await tx.shift.deleteMany({
      where: { scheduleId: existing.id },
    });

    await tx.schedule.delete({
      where: { id: existing.id },
    });

    return { success: true };
  });
}
```
Remove fake stubs: `cancelOne`, `cancelSeries`, `extendRecurringSchedules`.

2. In `app/backend/src/modules/schedule/schedule.controller.ts`:
Add `deleteMySchedule`:
```ts
const deleteScheduleSchema = z.object({
  expectedVersion: z.number().int().optional(),
});

export async function deleteMySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const bodyVersion = req.body?.expectedVersion;
    const queryVersion = req.query?.expectedVersion ? Number(req.query.expectedVersion) : undefined;
    const expectedVersion = bodyVersion !== undefined ? bodyVersion : queryVersion;
    const parsed = deleteScheduleSchema.parse({ expectedVersion });
    const data = await service.deleteMySchedule(user.id, parsed.expectedVersion);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}
```
Remove `deleteAssignment` and `deleteSeries`.

3. In `app/backend/src/modules/schedule/schedule.routes.ts`:
Add:
```ts
myScheduleRouter.delete('/schedule', ctrl.deleteMySchedule);
```
Remove:
```ts
myScheduleRouter.delete('/shift-assignments/:assignmentId', ctrl.deleteAssignment);
myScheduleRouter.delete('/schedule-registrations/:registrationId/assignments', ctrl.deleteSeries);
myScheduleRouter.delete('/schedule-registrations/:registrationId/series', ctrl.deleteSeries);
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:integration -- tests/schedule-redesign.integration.test.ts tests/files-and-schedule.integration.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/modules/schedule/ app/backend/tests/
git commit -m "feat(schedule): add DELETE /schedule and remove fake shift assignment deletion stubs"
```

---

### Task 5: Centralize CTV Weekly Schedule Flow in Form Modal (Saved & Draft State)

**Files:**
- Modify: `app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/users/me/schedule`, `PUT /api/v1/users/me/schedule`, `DELETE /api/v1/users/me/schedule`
- Produces: Pre-populated registration/edit modal, adding shifts (+ -> checked), removing shifts (checked -> +), room updating, and explicit schedule deletion.

- [ ] **Step 1: Implement Saved vs Draft State**

In `app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx`:
1. In `openRegistration`:
```tsx
  const openRegistration = () => {
    // Clone saved pattern and room into draft state
    setRegistrationPattern({ ...weeklyPattern });
    setIsRegistrationOpen(true);
  };
```
2. Determine button label dynamically based on whether any weekly pattern slots currently exist:
- If slots exist: `"Cập nhật lịch làm việc"`
- If no slots exist: `"Đăng ký lịch làm việc"`

- [ ] **Step 2: Implement Shift Adding & Deselecting in Weekly Form**

In `togglePattern`:
- Selecting an empty slot adds it to `registrationPattern`.
- Clicking an already-selected slot unchecks it (reverts to `+`), removing it from `registrationPattern`.

In `handleRegisterSchedule`:
- If `slots.length === 0`:
  - If a schedule already exists on the backend, offer or confirm calling `DELETE /api/v1/users/me/schedule` to clear the entire weekly schedule.
  - Or show toast: `"Vui lòng chọn ít nhất một ca trong tuần hoặc xóa lịch làm việc."`
- Add an explicit button in the modal footer when schedule exists: `"Xóa toàn bộ lịch"`. When clicked, call `DELETE /api/v1/users/me/schedule`, clear `weeklyPattern`, and show toast `"Đã xóa lịch làm việc thành công"`.

- [ ] **Step 3: Remove Fake Actions from Shift Cards & Modal**

1. Remove:
- `handleCancelShift` (fake single cancel)
- `handleCancelRecurringShift` (fake recurring cancel)
- `handleRoomChange` (local memory only)
2. Shift card clicking in the calendar:
- Open a clean read-only detail popup showing shift info, room, and a direct button `"Chỉnh sửa lịch tuần"` that opens the registration modal.
- Remove fake "Hủy ca" and "Hủy ca định kỳ" buttons completely.

- [ ] **Step 4: Verify Frontend Types and Build**

Run:
```bash
cd app/frontend
npm run typecheck
npm run build
```
Expected: Build succeeds with 0 TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx
git commit -m "feat(frontend): consolidate schedule creation, updating, and cancellation in weekly schedule modal"
```

---

### Task 6: Comprehensive Verification & E2E Test Synchronization

**Files:**
- Modify: `app/frontend/e2e/ctv.spec.ts`
- Verify: Full backend and frontend test suites

- [ ] **Step 1: Update E2E test to match pre-populated modal behavior**

In `app/frontend/e2e/ctv.spec.ts`:
Update test `Mẫu ca làm việc theo tuần mặc định rỗng mỗi khi mở đăng ký` to instead verify:
- When no schedule exists, modal opens empty.
- When a schedule exists, modal opens with existing registered shifts pre-selected.
- Unchecking a shift and saving persists the update.

- [ ] **Step 2: Run backend tests**

In `app/backend`:
```bash
npm run typecheck
npm test
```
Expected: All test suites pass.

- [ ] **Step 3: Run frontend typecheck and build**

In `app/frontend`:
```bash
npm run typecheck
npm run build
```
Expected: 0 errors, build succeeds.

- [ ] **Step 4: Commit verification updates**

```bash
git add app/frontend/e2e/ctv.spec.ts
git commit -m "test: sync E2E tests with weekly schedule form pre-population and cancellation flow"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - 1. Fix account disabling (schedule preservation, transactional revoke) -> Covered in Task 2.
  - 2. Fix auth middleware & optionalAuth (403 ACCOUNT_DISABLED) -> Covered in Task 1.
  - 3. Remove fake schedule APIs (`cancelOne`, `cancelSeries`, `extendRecurringSchedules`) -> Covered in Task 4.
  - 4. Standardize schedule write model (`PUT` & `DELETE /users/me/schedule`) -> Covered in Task 4.
  - 5. Single editing UI via schedule form modal -> Covered in Task 5.
  - 6. Password reset transactional & no plaintext in persistent state -> Covered in Task 3.
  - 7. Regression & E2E verification -> Covered in Task 6.
- **Placeholder scan:** No TBD, TODO, or generic placeholders exist. Every step has exact code blocks, commands, and expected results.
- **Type consistency:** All endpoint paths, method names, and payload shapes match between backend controller, service, routes, and frontend calls.
