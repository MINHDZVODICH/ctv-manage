# Technical Plan — Phase 1

**Date:** 2026-09-05  
**Status:** Proposed

## Goal

Fix all current P0 behavioral issues and normalize schedule management around the real domain model currently implemented in the system.

This phase intentionally treats a schedule as a **recurring weekly template**.

> Removing a shift means removing that weekday/period from the recurring weekly schedule.  
> This phase does **not** support cancelling one occurrence on a specific calendar date.

---

## 1. Fix Account Disabling

### Problem

`disableSideEffects()` currently deletes the collaborator's schedule:

```ts
await prisma.schedule.deleteMany({ where: { accountId } });
```

This permanently removes the current weekly schedule and all related shifts.

Session revocation is also executed separately from the account status update, which allows partial failure.

### Changes

**File:** `app/backend/src/modules/accounts/accounts.service.ts`

- Remove all schedule deletion from:
  - `changeStatus`
  - `softDelete`
- Preserve `Schedule`, `Shift`, and `History`.
- Update account state and revoke sessions in the same transaction.
- Preserve optimistic concurrency inside the transaction.

Target behavior:

```text
BEGIN

verify expected account version
update account status/deletedAt
revoke all active sessions

COMMIT
```

### Acceptance Criteria

- Disabling or soft-deleting an account does not remove its schedule.
- Existing `History` remains unchanged.
- All active sessions are revoked atomically with the account update.
- Concurrent updates still produce a version conflict instead of silently overwriting data.

---

## 2. Fix Authentication for Disabled Accounts

### Problem

`auth.ts` contains an empty status check, so a non-`ACTIVE` account can still be attached to `req.user` if a valid session exists.

`optionalAuth` has the same conceptual problem.

### Changes

**File:** `app/backend/src/middleware/auth.ts`

For protected authentication:

```ts
if (account.status !== 'ACTIVE') {
  throw Errors.forbidden(
    'ACCOUNT_DISABLED',
    'Tài khoản đã bị vô hiệu hóa'
  );
}
```

Do not add a logout exception inside `auth`.

`DELETE /api/v1/auth/sessions/current` does not require this middleware and can handle logout independently.

For `optionalAuth`:

- If the session belongs to a non-`ACTIVE` account, treat the request as unauthenticated.
- Do not populate `req.user`.

### Acceptance Criteria

#### Revoked session

```text
login
→ admin disables account
→ old session is revoked
→ protected API request
→ 401 Unauthorized
```

#### Defense in depth

```text
valid non-revoked session exists
→ account is directly marked DISABLED in DB
→ protected API request
→ 403 ACCOUNT_DISABLED
```

#### Optional auth

```text
session belongs to DISABLED account
→ optionalAuth
→ request continues as anonymous
```

---

## 3. Remove Fake Schedule APIs

### Problem

The following service methods return fake success without persisting changes:

- `cancelOne`
- `cancelSeries`
- `extendRecurringSchedules`

The associated routes expose concepts that no longer exist in the current Prisma model.

### Changes

**Files:**

- `app/backend/src/modules/schedule/schedule.routes.ts`
- `app/backend/src/modules/schedule/schedule.controller.ts`
- `app/backend/src/modules/schedule/schedule.service.ts`

Remove:

```text
DELETE /api/v1/users/me/shift-assignments/:assignmentId
DELETE /api/v1/users/me/schedule-registrations/:id/assignments
DELETE /api/v1/users/me/schedule-registrations/:id/series
```

Remove the related stub controller/service methods.

Also review and remove or explicitly deprecate legacy aliases and synthetic identifiers that emulate old entities.

Examples:

```text
schedule-registration
shift-assignment
runtime-generated assignment IDs
```

### Acceptance Criteria

- Removed endpoints return `404`.
- No public API returns success for a schedule mutation without writing to the database.
- Backend terminology matches the current Prisma domain.

---

## 4. Standardize Schedule Management

### Domain Rule

The current domain is:

```text
Account
  └── Schedule
        └── Shift(weekday, period)
```

A `Shift` represents a recurring weekly slot.

Example:

```text
Wednesday + MORNING
```

means:

```text
Every Wednesday morning
```

It does not represent a specific date.

### APIs

Use one write model:

```text
GET    /api/v1/users/me/schedule
PUT    /api/v1/users/me/schedule
DELETE /api/v1/users/me/schedule
```

#### PUT `/schedule`

Creates or replaces the complete weekly schedule.

Payload:

```json
{
  "roomCode": "ROOM_A",
  "slots": [
    { "weekday": 1, "period": "MORNING" },
    { "weekday": 3, "period": "AFTERNOON" }
  ],
  "expectedVersion": 4
}
```

Behavior:

```text
lock current schedule
verify expectedVersion
replace weekly slots
increment version
commit
```

#### DELETE `/schedule`

Deletes the complete current weekly schedule.

Use `expectedVersion` to avoid concurrent overwrite.

This endpoint is for:

```text
remove the entire recurring weekly schedule
```

It is not the legacy "cancel assignment" behavior.

### Non-goal

The following is not supported in Phase 1:

```text
Cancel only 2026-09-09 MORNING
while keeping future Wednesday MORNING shifts.
```

That requires date-specific schedule exceptions and belongs to a future phase only if the product requires it.

### Acceptance Criteria

- Add one weekly slot through `PUT` and it persists after refresh.
- Remove one weekly slot through `PUT` and it stays removed after refresh.
- Replace `roomCode` and it persists after refresh.
- Delete the entire schedule through `DELETE`.
- Version conflicts return the existing conflict response.
- No synthetic assignment ID is required for mutations.

---

## 5. Make the Schedule Form the Single Editing UI

### Problem

`CTVScheduleWorkspace.tsx` currently has multiple inconsistent editing paths:

- fake "cancel shift" actions;
- fake recurring cancellation;
- room changes that only update local state;
- registration form that opens with an empty pattern instead of the saved schedule.

### Changes

**File:** `app/frontend/src/components/Screens/CTVScheduleWorkspace.tsx`

Use explicit saved and draft state:

```text
savedPattern
savedRoom
scheduleVersion

draftPattern
draftRoom
```

### Open editor

When opening the schedule editor:

```text
load current schedule
→ savedPattern / savedRoom / version
→ clone into draftPattern / draftRoom
```

Existing shifts must already appear selected.

### Editing

User actions:

- select an empty slot → add it to the weekly schedule;
- deselect an existing slot → remove it from the weekly schedule;
- change room → update `draftRoom`;
- save → send the complete draft through `PUT /schedule`;
- remove all schedule → call `DELETE /schedule`.

Use UI wording such as:

```text
Edit weekly schedule
Remove from weekly schedule
Update weekly schedule
Delete weekly schedule
```

Avoid wording that implies date-specific cancellation.

### Cleanup

Remove:

- `handleCancelShift`
- `handleCancelRecurringShift`
- RAM-only room update behavior
- legacy schedule-registration mutation flows

Clicking a schedule card should either:

- show read-only details; or
- open the weekly schedule editor.

### Acceptance Criteria

- Existing schedule is preloaded when the editor opens.
- Closing without saving discards draft changes.
- Changing room persists through backend API.
- Removing a slot persists after refresh.
- Removing the last slot is handled through explicit schedule deletion.
- UI contains no fake cancel actions.

---

## 6. Fix Password Reset Handling

### Backend

**File:** `app/backend/src/modules/accounts/accounts.service.ts`

Password update and session revocation must be atomic:

```text
BEGIN

update password hash
update password metadata
revoke all active sessions

COMMIT
```

### Frontend

**File:** `app/frontend/src/app/App.tsx`

Remove:

```ts
{ ...prev, password: newPassword }
```

Do not store plaintext passwords in `selectedAccountDetail` or other long-lived account state.

Use short-lived reset-result state only.

Recommended flow:

```text
reset succeeds
→ show one-time result dialog
→ allow reveal/copy
→ close dialog
→ clear plaintext password from memory
```

Avoid placing the plaintext password in a persistent toast.

### Acceptance Criteria

- Password is never stored inside account detail state.
- Password update and session revocation are transactional.
- Old sessions cannot remain active after a successful reset.
- Plaintext reset password is cleared when the one-time result UI closes.

---

## 7. Backend Tests

Add or update integration tests for:

### Account disabling

- schedule remains after `DISABLED`;
- schedule remains after soft delete;
- all sessions are revoked;
- optimistic version conflicts are preserved.

### Authentication

- revoked old session → `401`;
- disabled account with non-revoked session → `403 ACCOUNT_DISABLED`;
- `optionalAuth` treats disabled accounts as anonymous.

### Schedule

- removed legacy DELETE routes → `404`;
- add weekly slot with `PUT`;
- remove weekly slot with `PUT`;
- update room with `PUT`;
- delete entire schedule with `DELETE`;
- version conflict behavior;
- persistence survives reload.

### Password reset

- password hash changes;
- all sessions are revoked in the same successful operation;
- transaction rollback leaves no partial password/session state.

---

## 8. Frontend Verification

Verify manually and through E2E where appropriate:

1. Open "Edit weekly schedule".
2. Existing slots are preselected.
3. Existing room is preselected.
4. Add a slot and save.
5. Refresh: slot still exists.
6. Remove a slot and save.
7. Refresh: slot is still removed.
8. Change room and save.
9. Refresh: room remains changed.
10. Delete the full schedule.
11. Refresh: no active weekly schedule exists.
12. Reset a password.
13. Plaintext password appears only in the one-time result UI.
14. Closing the result removes it from frontend state.

---

## 9. Documentation Updates

Update the following after implementation:

- `ARCHITECTURE.md`
- `DATABASE.md`
- `USE-CASE.md`
- schedule sequence diagrams
- API documentation

Remove concepts that are no longer part of the implementation:

```text
ScheduleRegistration
ShiftAssignment
cancelOne
cancelSeries
extendRecurringSchedules
```

Document the actual Phase 1 model:

```text
Schedule
└── recurring weekly Shift slots
```

Explicitly document that date-specific cancellation is unsupported.

---

## Execution Order

```text
1. Fix auth middleware and optionalAuth
2. Make account disable/soft-delete transactional
3. Make password reset transactional
4. Remove fake schedule endpoints and stubs
5. Add DELETE /users/me/schedule
6. Normalize PUT /users/me/schedule as the only weekly schedule update path
7. Refactor CTVScheduleWorkspace to saved/draft state
8. Remove fake frontend cancellation and RAM-only mutations
9. Add backend regression tests
10. Add/update frontend E2E tests
11. Update documentation and sequence diagrams
12. Remove remaining legacy terminology and compatibility code
```

## Definition of Done

Phase 1 is complete when:

- disabling an account never deletes schedule or history data;
- all active sessions are revoked atomically when disabling or resetting passwords;
- disabled accounts cannot authenticate through valid stale sessions;
- no schedule mutation endpoint returns fake success;
- weekly schedule changes are persisted only through real backend APIs;
- removing a shift clearly means removing a recurring weekly slot;
- deleting the final schedule is handled explicitly;
- frontend edits use saved/draft state and survive refresh;
- plaintext reset passwords are short-lived;
- documentation, API names, Prisma entities, services, and UI terminology describe the same domain.