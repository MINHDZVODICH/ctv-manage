# Pending Account Approval Notice & Organization Name Update Plan

> **Goal:** Update the English branding name to "Academy of Military Science and Technology" and show a clear notice ("Tài khoản đang được chờ duyệt" / "The account is awaiting approval") when attempting to log in with a pending account using the correct password.

---

## User Requirements
1. Change `"Military Institute of Science and Technology"` to `"Academy of Military Science and Technology"` on the login screen / branding in English.
2. For pending accounts, when attempting login, display `'Tài khoản đang được chờ duyệt'` (VI) or `'The account is awaiting approval'` (EN).

---

## Proposed Changes

### 1. Frontend i18n Translations
- **File:** `app/frontend/src/shared/i18n/locales/auth.ts`
  - Update `en`:
    - `"auth.logo_alt"`: `"Academy of Military Science and Technology Logo"`
    - `"auth.org_name"`: `"Academy of Military Science and Technology"`
    - `"auth.account_pending_approval"`: `"The account is awaiting approval"`
  - Update `vi`:
    - `"auth.account_pending_approval"`: `"Tài khoản đang được chờ duyệt"`

### 2. Backend Error Definitions & Authentication Logic
- **File:** `app/backend/src/shared/errors.ts`
  - Add `Errors.pendingApproval()` returning `new AppError(403, 'ACCOUNT_PENDING_APPROVAL', 'Tài khoản đang được chờ duyệt')`.
- **File:** `app/backend/src/modules/auth/auth.service.ts`
  - In `authenticate(emailRaw, password, ...)`:
    - If `!account`, query `prisma.registrationRequest.findFirst({ where: { email, status: 'PENDING' } })`.
    - If pending request exists and has `passwordHash`:
      - Verify `argon2.verify(pendingRequest.passwordHash, password)`.
      - If password is correct, throw `Errors.pendingApproval()`.
    - If not matching or not found, fall back to dummy argon2 verify and throw `Errors.invalidCredentials()`.

### 3. Frontend Login Screen Handling
- **File:** `app/frontend/src/features/auth/components/LoginScreen.tsx`
  - In `handleLoginSubmit`:
    - Catch error code `ACCOUNT_PENDING_APPROVAL` or message containing `"chờ duyệt"` / `"awaiting approval"`.
    - Set `loginError` to `"auth.account_pending_approval"`.

### 4. Automated Tests
- **File:** `app/backend/tests/auth-security.integration.test.ts`
  - Add tests:
    - Pending account login with correct password returns 403 `ACCOUNT_PENDING_APPROVAL`.
    - Pending account login with incorrect password returns 401 `INVALID_CREDENTIALS`.
- **File:** `app/frontend/src/features/auth/components/__tests__/LoginScreen.test.tsx` (or e2e test)
  - Verify error handling and translation mapping.

### 5. Verification & Docker Release
- Run backend integration tests (`npm test`).
- Run frontend typecheck, i18n check, and build (`npm run check:i18n`, `npm run typecheck`, `npm run build`).
- Build Docker images for frontend and backend.
- Recreate local release containers on port 8080 and verify in browser.
- Push images to Docker Hub (`minhdz163/ctv-backend` and `minhdz163/ctv-frontend`).

---

## Tasks

- [ ] **Task 1: Backend pending account authentication & tests**
  - Add `Errors.pendingApproval()` in `errors.ts`.
  - Update `auth.service.ts` to check pending registration requests when account not found.
  - Add integration tests in `auth-security.integration.test.ts`.
  - Run backend tests to ensure all pass.

- [ ] **Task 2: Frontend organization name & pending error handling**
  - Update `auth.ts` i18n locales for `en` org name and pending approval keys in `vi` and `en`.
  - Update `LoginScreen.tsx` to handle `ACCOUNT_PENDING_APPROVAL` and map to `auth.account_pending_approval`.
  - Run `npm run check:i18n`, `npm run test:i18n`, `npm run typecheck`, `npm run build`.

- [ ] **Task 3: Live verification and container recreation**
  - Rebuild backend and frontend images.
  - Recreate docker containers (`ctv-release-backend-1` and `ctv-release-frontend-1`).
  - Test login with `pending.ctv01@gmail.com` + `12345678` via API and UI.
  - Push updated images to Docker Hub.
