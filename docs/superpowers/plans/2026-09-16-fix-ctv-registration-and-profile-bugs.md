# Implementation Plan: Fix Registration, DOB Fallback, Admin Tab Leak, and Long Name Overflow Bugs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 reported bugs: make CV mandatory on registration, eliminate hardcoded DOB fallbacks, prevent Admin summary schedule tab from leaking to CTV upon account switch, and handle long names with proper Vietnamese validation and responsive text wrapping.

**Architecture:**
- Frontend Auth: enforce required CV upload with clear error display and asterisk styling in `LoginScreen.tsx`.
- Modals & Detail Views: replace hardcoded `'14/05/1995'` and `'15/08/1998'` with `t('not_updated')` in `ViewRequestModal.tsx` and `ViewAccountDetailModal.tsx`; fix gender fallback to `t('not_updated')`.
- App Navigation & Session: sanitize active tab on role changes and logout in `App.tsx`; restrict `'meetings'` tab to `ADMIN` only in `AppContent.tsx`.
- Profile & Form Validation / UI Breakage: add Vietnamese validation messages for `displayName` (max 100 characters) in backend `users.controller.ts`, `registration.controller.ts`, and `accounts.controller.ts`. In frontend (`EditProfileModal.tsx`, `LoginScreen.tsx`), enforce `maxLength={100}` and add validation. In all affected UI components (`ProfileScreen`, `ViewAccountDetailModal`, `ViewRequestModal`, `AccountListScreen`, `RequestsScreen`, `App.tsx` toast), add `break-words`, `min-w-0`, `shrink-0`, and `max-w` constraints to eliminate layout overflow.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Zod, Vitest, Express, Prisma.

**Spec:** Bug report with 11 reference screenshots in `bug_images/`.

## Global Constraints
- Do not introduce hard-coded Vietnamese strings in frontend source files outside `shared/i18n/`; must pass `npm run check:i18n`.
- Preserve existing typecheck (`npm run typecheck`) and unit tests (`npm run test:unit:frontend`).
- Keep all existing comments and docstrings intact.

---

### Task 1: Make CV Field Mandatory on Registration (Issue 1)

**Files:**
- Modify: `app/frontend/src/shared/i18n/locales/auth.ts`
- Modify: `app/frontend/src/features/auth/components/LoginScreen.tsx:905-920, 226-275`
- Test: `app/frontend/tests/registration-validation.unit.test.ts` (create or add)

**Interfaces:**
- Consumes: `t('auth.error_cv_required')`
- Produces: Required CV field validation in `handleRegisterSubmit`

- [ ] **Step 1: Write unit test for CV mandatory validation**
Add unit test verifying that registration form requires CV before submission.

- [ ] **Step 2: Add i18n keys for CV required error**
In `app/frontend/src/shared/i18n/locales/auth.ts`:
- Vietnamese: `'auth.error_cv_required': 'Vui lòng tải lên hồ sơ ứng tuyển (CV)!',`
- English: `'auth.error_cv_required': 'Please upload your CV (resume)!',`

- [ ] **Step 3: Update `LoginScreen.tsx`**
1. Add `<span className="text-[#DC2626] font-bold">*</span>` next to `auth.cv` label.
2. In `handleRegisterSubmit`:
   ```tsx
   if (!cvFileObj) errors.cvFile = 'auth.error_cv_required';
   ```
3. In `handleCvFileChange`: call `clearRegError('cvFile')` when a file is chosen.

- [ ] **Step 4: Run unit tests and typecheck**
Run: `npm run test:unit:frontend && npm run check:i18n`

---

### Task 2: Remove Hardcoded DOB and Gender Fallbacks (Issue 2)

**Files:**
- Modify: `app/frontend/src/features/registration/components/ViewRequestModal.tsx:118-123`
- Modify: `app/frontend/src/features/accounts/components/ViewAccountDetailModal.tsx:426-442`
- Test: `app/frontend/tests/dob-fallback.unit.test.ts`

**Interfaces:**
- Consumes: `t('not_updated')`
- Produces: Empty/null DOB and gender cleanly display as "Chưa cập nhật" (or "Not updated") instead of fabricated dates ('14/05/1995', '15/08/1998') or fabricated gender ('Nam').

- [ ] **Step 1: Write unit test for DOB & gender fallbacks**
Test that `ViewRequestModal` and `ViewAccountDetailModal` render `t('not_updated')` when `dob` is null/empty, and gender renders `t('not_updated')` when empty.

- [ ] **Step 2: Fix `ViewRequestModal.tsx`**
Replace:
```tsx
<span className="font-semibold text-[#1a1b1e] dark:text-slate-100">
  {request.dob || '14/05/1995'}
</span>
```
with:
```tsx
<span className="font-semibold text-[#1a1b1e] dark:text-slate-100 break-words text-right min-w-0">
  {request.dob || t('not_updated')}
</span>
```

- [ ] **Step 3: Fix `ViewAccountDetailModal.tsx`**
Replace:
```tsx
<span className="font-semibold text-[#1b365d] dark:text-white">
  {account.dob || '15/08/1998'}
</span>
```
with:
```tsx
<span className="font-semibold text-[#1b365d] dark:text-white break-words text-right min-w-0">
  {account.dob || t('not_updated')}
</span>
```
And for gender (lines 434-441):
```tsx
<span className="font-semibold text-[#1b365d] dark:text-white break-words text-right min-w-0">
  {account.gender === 'Nam'
    ? t('gender_male')
    : account.gender === 'Nữ'
      ? t('gender_female')
      : account.gender
        ? t('gender_other')
        : t('not_updated')}
</span>
```

- [ ] **Step 4: Run unit tests and typecheck**
Run: `npm run test:unit:frontend && npm run check:i18n`

---

### Task 3: Fix Admin Tab Leak on Account Switch / Logout (Issue 3)

**Files:**
- Modify: `app/frontend/src/app/App.tsx:73-88`
- Modify: `app/frontend/src/app/components/AppContent.tsx:93-101`
- Test: `app/frontend/tests/tab-access.unit.test.ts`

**Interfaces:**
- Consumes: `authUser.role`, `currentTab`
- Produces: CTV cannot see or remain on `meetings`, `accounts`, or `requests` tabs.

- [ ] **Step 1: Write unit test for tab routing by role**
Verify that switching authUser from ADMIN to CTV forces `currentTab` to `'schedule'` when on `'meetings'`.

- [ ] **Step 2: Update tab effect and logout handler in `App.tsx`**
In `App.tsx`:
```tsx
  useEffect(() => {
    if (!authUser) return;
    if (authUser.role === 'ADMIN' && currentTab === 'schedule') {
      setCurrentTab('accounts');
    }
    if (authUser.role !== 'ADMIN' && currentTab !== 'schedule' && currentTab !== 'profile') {
      setCurrentTab('schedule');
    }
  }, [authUser, currentTab]);
```
In `handleLogout`:
```tsx
  const handleLogout = async () => {
    await logout();
    accountsAdmin.clearAccounts();
    regRequests.clearRequests();
    scheduleDash.clearShifts();
    clearUser();
    setCurrentTab('accounts');
    showToast(t('app.logout_success'));
  };
```

- [ ] **Step 3: Add defense-in-depth guard in `AppContent.tsx`**
In `AppContent.tsx`:
```tsx
      {currentTab === 'meetings' && effectiveUser.role === 'ADMIN' && (
        <SummaryScheduleScreen ... />
      )}
```

- [ ] **Step 4: Run tests and typecheck**
Run: `npm run test:unit:frontend`

---

### Task 4: Fix Name Length Validation and Prevent UI Breakage on Long Strings (Issue 4)

**Files:**
- Modify: `app/backend/src/modules/users/users.controller.ts:51-58`
- Modify: `app/backend/src/modules/registration/registration.controller.ts:37`
- Modify: `app/backend/src/modules/accounts/accounts.controller.ts:21`
- Modify: `app/frontend/src/shared/i18n/locales/auth.ts`
- Modify: `app/frontend/src/shared/i18n/locales/profile.ts`
- Modify: `app/frontend/src/features/auth/components/LoginScreen.tsx`
- Modify: `app/frontend/src/features/profile/components/EditProfileModal.tsx`
- Modify: `app/frontend/src/features/profile/components/ProfileScreen.tsx`
- Modify: `app/frontend/src/features/accounts/components/ViewAccountDetailModal.tsx`
- Modify: `app/frontend/src/features/registration/components/ViewRequestModal.tsx`
- Modify: `app/frontend/src/features/accounts/components/AccountListScreen.tsx`
- Modify: `app/frontend/src/features/registration/components/RequestsScreen.tsx`
- Modify: `app/frontend/src/app/App.tsx:127-135`

**Interfaces:**
- Backend schemas: `displayName: z.string().trim().min(1, '...').max(100, 'Họ và tên không được vượt quá 100 ký tự')`
- Frontend: `maxLength={100}`, validation errors, and CSS `break-words`/`min-w-0`/`truncate`

- [ ] **Step 1: Backend schema validation & Vietnamese messages**
In `app/backend/src/modules/users/users.controller.ts`:
```ts
const patchMeSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Họ và tên không được để trống')
    .max(100, 'Họ và tên không được vượt quá 100 ký tự')
    .optional(),
  phone: z.string().max(20, 'Số điện thoại không được vượt quá 20 ký tự').nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  address: z.string().max(255, 'Địa chỉ không được vượt quá 255 ký tự').nullable().optional(),
  expectedVersion: z.number().int().optional(),
});
```
In `app/backend/src/modules/registration/registration.controller.ts`:
```ts
displayName: z.string().trim().min(1, 'Họ và tên là bắt buộc').max(100, 'Họ và tên không được vượt quá 100 ký tự'),
```
In `app/backend/src/modules/accounts/accounts.controller.ts`:
```ts
displayName: z.string().trim().min(1, 'Họ và tên không được để trống').max(100, 'Họ và tên không được vượt quá 100 ký tự').optional(),
```

- [ ] **Step 2: Frontend validation in `EditProfileModal.tsx` and `LoginScreen.tsx`**
In `auth.ts`:
- `'auth.error_name_max_length': 'Họ và tên không được vượt quá 100 ký tự!',`
- `'auth.error_name_max_length': 'Full name must not exceed 100 characters!',`
In `profile.ts`:
- `'profile.error_name_max_length': 'Họ và tên không được vượt quá 100 ký tự!',`
- `'profile.error_name_max_length': 'Full name must not exceed 100 characters!',`

In `LoginScreen.tsx`:
- Add `maxLength={100}` on `regName` input.
- In `handleRegisterSubmit`: `if (regName.trim().length > 100) errors.regName = 'auth.error_name_max_length';`

In `EditProfileModal.tsx`:
- Add `maxLength={100}` on `name` input.
- Add error state if name length > 100.

- [ ] **Step 3: Fix layout wrapping and prevent overflow in UI components**
1. `App.tsx`:
   Ensure toast container has `max-w-[calc(100vw-3rem)] sm:max-w-md` and `break-words min-w-0 line-clamp-3`.
2. `ProfileScreen.tsx`:
   - Avatar header name: `<h3 className="text-xl font-bold text-[#1a1b1e] dark:text-white break-words max-w-full text-center">`
   - Details grid: add `min-w-0` to column containers and `break-words` to values.
3. `ViewAccountDetailModal.tsx`:
   - Header name: add `min-w-0` and `break-words`.
   - Key-value list: add `shrink-0` to label spans and `break-words text-right min-w-0` to value spans.
4. `ViewRequestModal.tsx`:
   - Header name: add `min-w-0` and `break-words`.
   - Key-value list: add `shrink-0` to label spans and `break-words text-right min-w-0` to value spans.
5. `AccountListScreen.tsx` & `RequestsScreen.tsx`:
   - Action confirmation modals: add `break-all` / `break-words` to name and email spans.
   - Table rows: wrap user name in `min-w-0 max-w-[200px] sm:max-w-[300px]` with `truncate`.

- [ ] **Step 4: Run typecheck, i18n check, unit tests**
Run: `npm run typecheck && npm run check:i18n && npm run test:unit:frontend`

---

### Task 5: End-to-End Verification

**Verification Checklist:**
- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run check:i18n` passes with zero errors.
- [ ] `npm run test:unit:frontend` passes.
- [ ] Verify CV field is required on registration with red asterisk and error message.
- [ ] Verify unselected DOB displays "Chưa cập nhật" in both pending modal and account modal.
- [ ] Verify switching from Admin (on summary tab) to CTV redirects to CTV's schedule tab.
- [ ] Verify long names (up to 100 chars, or long uninterrupted strings) wrap properly without overflowing dialogs, cards, or toasts.
