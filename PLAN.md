# Clean Code Refactoring Plan

## Goal

Improve maintainability, type safety, testability, and separation of concerns without changing existing business behavior.

## Priority Order

1. Refactor the frontend `App.tsx` God Component.
2. Standardize frontend API contracts and remove unsafe `any` usage.
3. Improve error handling and observability.
4. Split oversized backend service responsibilities.
5. Centralize configuration access.
6. Remove incomplete or misleading feature handlers.
7. Add linting and formatting quality gates.
8. Strengthen tests around refactored boundaries.

---

## P0 — Refactor Frontend `App.tsx`

### Target

`app/frontend/src/app/App.tsx`

### Problems

- Too many responsibilities in one component.
- Authentication refresh logic is mixed with UI composition.
- Account management logic is mixed with registration requests.
- Schedule loading and refresh logic are mixed with navigation state.
- Pagination, debounce, request cancellation, toast handling, modal state, and browser visibility handling live in the same file.
- High coupling makes isolated testing difficult.
- Small feature changes can affect unrelated behavior.

### Actions

#### 1. Extract authentication state and refresh logic

Create:

```text
app/frontend/src/app/hooks/useCurrentUser.ts
```

Move:

- Current user loading.
- `/auth/me` request.
- User normalization.
- Authentication refresh.
- Authentication-related error handling.

Expected interface:

```ts
interface UseCurrentUserResult {
  user: UserAccount | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  clearUser: () => void;
}
```

#### 2. Extract account administration logic

Create:

```text
app/frontend/src/features/accounts/hooks/useAccountsAdmin.ts
```

Move:

- Account list loading.
- Search state.
- Debounce behavior.
- Pagination.
- Account detail loading.
- AbortController/request cancellation.
- Request sequence protection.
- Refresh behavior.

Keep presentation components free from API orchestration.

#### 3. Extract registration request logic

Create:

```text
app/frontend/src/features/registration/hooks/useRegistrationRequests.ts
```

Move:

- Registration request loading.
- Pagination.
- Approve/reject actions.
- Refresh logic.
- Related loading/error states.

#### 4. Extract schedule dashboard logic

Create:

```text
app/frontend/src/features/schedule/hooks/useScheduleDashboard.ts
```

Move:

- Schedule loading.
- Schedule refresh.
- Visibility/focus refresh logic.
- Snapshot-related refresh behavior.
- Schedule-specific state transitions.

#### 5. Reduce `App.tsx` to composition

`App.tsx` should mainly contain:

- Authentication boundary.
- Main layout.
- Navigation/tab selection.
- Feature composition.
- High-level routing decisions.

Target size:

```text
<= 200 LOC
```

Preferred target:

```text
100–150 LOC
```

### Acceptance Criteria

- `App.tsx` no longer directly implements feature-specific API orchestration.
- No duplicated request logic remains after extraction.
- Existing behavior remains unchanged.
- Existing frontend tests pass.
- New hooks can be tested independently.

---

## P0 — Standardize Frontend API Contracts

### Targets

```text
app/frontend/src/shared/api/types.ts
app/frontend/src/shared/api/*
app/frontend/src/app/App.tsx
app/frontend/src/features/**/*
```

### Problems

- `strict` TypeScript is enabled but weakened by `any`.
- Response parsing uses patterns such as:

```ts
res.user ?? res.data ?? res
```

- Generic API helpers are not consistently used with concrete response types.
- Optional fields in shared API response types make contracts ambiguous.

### Actions

#### 1. Remove generic catch-all API response shapes

Avoid broad structures such as:

```ts
interface ApiResponse<T> {
  data?: T;
  user?: T;
  request?: T;
  file?: T;
}
```

Use explicit endpoint contracts instead.

Example:

```ts
interface CurrentUserResponse {
  user: UserDto;
}

interface AccountsResponse {
  items: AccountDto[];
  page: number;
  pageSize: number;
  total: number;
}

interface RegistrationRequestsResponse {
  items: RegistrationRequestDto[];
  page: number;
  pageSize: number;
  total: number;
}
```

#### 2. Use API helper generics everywhere

Example:

```ts
const response = await apiGet<CurrentUserResponse>("/auth/me");
```

Do not use:

```ts
const response: any = ...;
```

#### 3. Remove unsafe casts

Search and reduce:

```text
:any
<any>
as any
unknown as
```

Only keep casts when runtime validation or framework boundaries make them unavoidable.

#### 4. Add DTO-to-domain mapping functions

Keep API DTOs separate from UI/domain models.

Example:

```text
features/accounts/mappers/account.mapper.ts
features/registration/mappers/registration-request.mapper.ts
features/schedule/mappers/schedule.mapper.ts
```

### Acceptance Criteria

- No `any` remains in normal API request/response flows.
- Each endpoint has an explicit response type.
- Type errors are caught during `tsc` instead of runtime.
- API parsing logic is centralized and predictable.

---

## P1 — Improve Error Handling

### Targets

Frontend and backend files containing:

```text
catch {}
catch (_)
catch without logging or classification
```

### Problems

- Some exceptions are silently ignored.
- Expected failures and unexpected failures are not clearly separated.
- Silent failures make debugging production issues difficult.

### Actions

#### 1. Classify expected errors

Examples:

- 401 during optional authentication.
- Aborted fetch requests.
- User-triggered cancellation.

Handle these explicitly.

#### 2. Log unexpected failures

Use a small shared logging abstraction where needed.

Frontend example:

```ts
if (!isAbortError(error)) {
  logger.warn("Failed to refresh account details", { error });
}
```

Backend example:

```ts
logger.error("Snapshot reconciliation failed", {
  error,
  snapshotId,
});
```

#### 3. Standardize user-facing errors

Use one error-normalization path for:

- JSON API requests.
- Uploads.
- Downloads.
- Authentication failures.

Create or extend:

```text
app/frontend/src/shared/api/errors.ts
```

### Acceptance Criteria

- Empty `catch {}` blocks are removed unless explicitly documented.
- Abort/cancel cases do not produce unnecessary user errors.
- Unexpected failures are observable.
- User-facing messages are consistent.

---

## P1 — Split `SnapshotCoordinatorService`

### Target

```text
app/backend/src/modules/schedule/snapshot-coordinator.service.ts
```

### Problems

The service currently combines several concerns:

- Snapshot orchestration.
- Retry policy.
- Lease/claim handling.
- Persistence.
- Raw SQL.
- Reconciliation.
- Scheduling-related decision logic.

### Actions

#### 1. Extract repository responsibilities

Create:

```text
app/backend/src/modules/schedule/snapshot.repository.ts
```

Move:

- Snapshot persistence.
- Lease acquisition/release.
- Run state queries.
- Raw SQL related to snapshot storage.

#### 2. Extract retry policy

Create:

```text
app/backend/src/modules/schedule/snapshot-retry-policy.ts
```

Responsibilities:

- Retry eligibility.
- Retry delay/backoff.
- Max attempts.
- Retryable vs non-retryable failures.

#### 3. Extract reconciliation logic

Create if the logic is substantial:

```text
app/backend/src/modules/schedule/snapshot-reconciliation.service.ts
```

Responsibilities:

- Detect inconsistent snapshot state.
- Repair/reconcile stale runs.
- Return reconciliation results to coordinator.

#### 4. Keep coordinator as orchestrator

Final coordinator responsibilities:

- Start snapshot workflow.
- Call repository/policy/reconciliation dependencies.
- Coordinate transaction boundaries if needed.
- Return domain-level result.

### Acceptance Criteria

- Coordinator contains orchestration, not persistence details.
- Raw SQL is isolated from high-level business flow.
- Retry policy is independently testable.
- Existing snapshot behavior remains unchanged.

---

## P1 — Centralize Configuration Access

### Targets

```text
app/backend/src/config.ts
app/backend/src/modules/schedule/**/*
```

### Problems

Some business/service code accesses `process.env` directly despite having a validated config module.

### Actions

#### 1. Remove direct `process.env` access from services

Do not use:

```ts
process.env.SOME_VALUE
```

inside business services.

#### 2. Use validated config only

Preferred:

```ts
config.schedule.trackingStartDate
```

or inject configuration through constructor dependencies.

#### 3. Make test overrides explicit

For services requiring configurable values:

```ts
constructor(
  private readonly repository: SnapshotRepository,
  private readonly options: SnapshotCoordinatorOptions,
) {}
```

### Acceptance Criteria

- `process.env` is restricted to configuration/bootstrap code.
- Invalid environment configuration fails during startup.
- Services are easier to test without mutating global environment variables.

---

## P1 — Remove Incomplete Feature Handlers

### Target

Frontend handlers such as incomplete schedule-ending behavior.

### Problems

- Function names imply supported behavior.
- Implementation only shows a toast or placeholder message.
- Dead/incomplete handlers increase maintenance cost.

### Actions

Choose one option per incomplete feature:

1. Implement the feature completely.
2. Remove the handler and related UI.
3. Disable the UI based on an explicit capability flag.

Do not leave placeholder handlers in production paths.

### Acceptance Criteria

- No active UI action points to placeholder logic.
- Function names accurately describe implemented behavior.
- Unsupported functionality is visibly disabled or absent.

---

## P2 — Add ESLint and Formatting Gates

### Targets

```text
app/frontend/package.json
app/backend/package.json
package.json
```

### Actions

#### 1. Add ESLint

Recommended rule coverage:

```text
@typescript-eslint/no-explicit-any
@typescript-eslint/no-unused-vars
@typescript-eslint/consistent-type-imports
react-hooks/rules-of-hooks
react-hooks/exhaustive-deps
no-empty
no-console where appropriate
```

#### 2. Add Prettier or equivalent formatter

Add scripts:

```json
{
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

#### 3. Add root quality command

Example:

```json
{
  "check": "npm run typecheck && npm run lint && npm run format:check && npm run test:acceptance"
}
```

Adjust commands to match workspace setup.

### Acceptance Criteria

- Lint runs in CI/acceptance flow.
- New explicit `any` usage is blocked.
- Empty catch blocks are blocked.
- Formatting is deterministic.

---

## P2 — Strengthen Test Coverage Around Refactored Boundaries

### Frontend Tests

Add tests for:

```text
useCurrentUser
useAccountsAdmin
useRegistrationRequests
useScheduleDashboard
API error normalization
DTO mappers
```

Test cases:

- Successful loading.
- Loading states.
- API failures.
- Request cancellation.
- Rapid search updates.
- Pagination changes.
- Stale request protection.
- Authentication expiration.
- Visibility/focus refresh.

### Backend Tests

Add tests for:

```text
SnapshotCoordinatorService
SnapshotRetryPolicy
SnapshotRepository
SnapshotReconciliationService
```

Test cases:

- Successful snapshot run.
- Lease conflict.
- Retryable failure.
- Non-retryable failure.
- Max retry reached.
- Reconciliation of stale runs.
- Database failure.
- Duplicate execution protection.

### Acceptance Criteria

- Refactoring does not reduce existing coverage.
- New extracted modules have focused unit tests.
- Acceptance tests continue to verify end-to-end behavior.

---

## Recommended Frontend Structure

```text
app/frontend/src/
  app/
    App.tsx
    hooks/
      useCurrentUser.ts

  features/
    accounts/
      api/
        accounts.api.ts
      hooks/
        useAccountsAdmin.ts
      mappers/
        account.mapper.ts
      types/
        account.dto.ts

    registration/
      api/
        registration.api.ts
      hooks/
        useRegistrationRequests.ts
      mappers/
        registration-request.mapper.ts
      types/
        registration-request.dto.ts

    schedule/
      api/
        schedule.api.ts
      hooks/
        useScheduleDashboard.ts
      mappers/
        schedule.mapper.ts
      types/
        schedule.dto.ts

  shared/
    api/
      client.ts
      errors.ts
    hooks/
    ui/
    types/
```

---

## Recommended Backend Structure

```text
app/backend/src/modules/schedule/
  schedule.controller.ts
  schedule.routes.ts
  schedule.service.ts

  snapshot/
    snapshot-coordinator.service.ts
    snapshot-reconciliation.service.ts
    snapshot-retry-policy.ts
    snapshot.repository.ts
    snapshot.types.ts
```

If moving files would create unnecessary churn, keep the current folder layout and apply the same responsibility split without introducing the `snapshot/` subfolder.

---

## Refactoring Rules

- Do not change API behavior unless explicitly planned.
- Do not combine structural refactoring with unrelated UI redesign.
- Keep commits small and independently testable.
- Extract behavior before rewriting it.
- Prefer dependency injection over global access.
- Prefer explicit types over broad shared response types.
- Keep feature code inside the owning feature.
- Keep `shared` independent from `features` and `app`.
- Preserve the existing boundary-checking rules.
- Run typecheck and tests after every major extraction.

---

## Suggested Execution Sequence

### Phase 1 — Safety Baseline

- Run existing typecheck.
- Run backend tests.
- Run frontend E2E tests.
- Run boundary checks.
- Record current failures before refactoring.

### Phase 2 — API Type Cleanup

- Define endpoint response DTOs.
- Replace `any` in authentication flow.
- Replace `any` in account flow.
- Replace `any` in registration flow.
- Replace `any` in schedule flow.
- Add DTO mappers.

### Phase 3 — `App.tsx` Extraction

- Extract `useCurrentUser`.
- Extract `useAccountsAdmin`.
- Extract `useRegistrationRequests`.
- Extract `useScheduleDashboard`.
- Remove unused local state and duplicated callbacks.
- Reduce `App.tsx` to composition logic.

### Phase 4 — Error Handling

- Find all empty/silent catches.
- Classify expected failures.
- Normalize frontend API errors.
- Add logging for unexpected backend failures.

### Phase 5 — Backend Snapshot Refactor

- Extract repository.
- Extract retry policy.
- Extract reconciliation logic.
- Simplify coordinator.
- Add focused unit tests.

### Phase 6 — Configuration Cleanup

- Remove direct service-level `process.env` access.
- Route configuration through validated config or injected options.

### Phase 7 — Tooling

- Add ESLint.
- Add formatter checks.
- Add lint/format to quality gate.

### Phase 8 — Final Verification

Run:

```text
TypeScript typecheck
Frontend build
Backend tests
Frontend E2E tests
Boundary checks
Lint
Format check
Acceptance suite
```

---

## Definition of Done

The refactor is complete when:

- `App.tsx` is primarily a composition component.
- Feature-specific async logic lives inside feature hooks/services.
- API responses have explicit TypeScript contracts.
- Normal application code no longer depends on `any` for API data.
- Empty silent catch blocks are eliminated or explicitly justified.
- Snapshot orchestration is separated from persistence and retry policy.
- Business services do not read `process.env` directly.
- Placeholder feature handlers are removed, disabled, or fully implemented.
- Lint and format checks run automatically.
- Existing behavior remains stable.
- All automated checks pass.
