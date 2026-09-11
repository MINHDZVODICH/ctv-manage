# Fix Registration Validation Error Display & English Translations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the issue where registration errors (such as password length) are incorrectly mapped to the "Họ và tên" input instead of the appropriate field, remove any format/length constraints on full name (only require it to not be empty), and translate all untranslated Vietnamese UI text in the four modals identified in the user's screenshots (Shift Schedule modal, Change Password modal, System Settings accent colors, and Edit Profile modal) when switching to English.

**Architecture:** 
1. Fix error dispatching and client-side password length checks in `LoginScreen.tsx` so errors from the backend/frontend map directly to their corresponding form fields (or a general alert banner) instead of arbitrarily defaulting to `regName`. Remove character/format constraints on `regName` / `displayName`.
2. Integrate `useSystemSettings` / `t` helper and `language` state across `CTVScheduleWorkspace.tsx`, `ChangePasswordModal.tsx`, `SettingsModal.tsx`, `EditProfileModal.tsx`, and `ProfileScreen.tsx`.
3. Add missing English/Vietnamese translation dictionary entries in `SystemSettingsContext.tsx` for accent colors and schedule modal labels.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite, Node/Express backend, Vitest, Playwright.

**Spec:** User feedback on registration name validation error and screenshot media items 0-5.

## Global Constraints
- Registration "Họ và tên" (full name) must be a required field, but must NOT have format, regex, or restrictive character count constraints.
- Any backend or frontend validation errors must be displayed under their respective field (e.g. password under password, email under email, phone under phone, dob under dob) or in a prominent general error banner, never defaulting unknown errors to "Họ và tên".
- When switching language to "Tiếng Anh" (English), all text in the modals (Update Shift Schedule, Change Password, System Settings accent colors, Edit Personal Information) must be cleanly and accurately translated without breaking existing Vietnamese text or layouts.

---

### Task 1: Fix Registration Form Name & Password Validation and Error Dispatching

**Files:**
- Modify: `app/frontend/src/features/auth/components/LoginScreen.tsx`
- Modify: `app/backend/src/modules/registration/registration.controller.ts`

**Interfaces:**
- `LoginScreen.tsx`: `handleRegisterSubmit` function and `regErrors` state
- `registration.controller.ts`: `createBodySchema.displayName`

- [ ] **Step 1: Check existing registration tests and write test asserting correct error mapping**
Ensure that when a password error occurs (e.g. < 6 chars), it maps to `regPassword`, NOT `regName`.

- [ ] **Step 2: Update `registration.controller.ts` for `displayName`**
In `createBodySchema`:
```typescript
displayName: z.string().trim().min(1, 'Họ và tên là bắt buộc'),
```
Remove any restrictive format or character limits on `displayName`.

- [ ] **Step 3: Update `LoginScreen.tsx` validation and error handling**
1. Add client-side password minimum length validation:
```typescript
if (!regPassword) {
  errors.regPassword = "Vui lòng nhập mật khẩu!";
} else if (regPassword.length < 6) {
  errors.regPassword = "Mật khẩu phải có ít nhất 6 ký tự!";
}
```
2. Keep `regName` strictly checking `!regName.trim()`:
```typescript
if (!regName.trim()) errors.regName = "Vui lòng nhập họ và tên!";
```
3. Add `regGeneralError` state:
```typescript
const [regGeneralError, setRegGeneralError] = useState("");
```
4. Fix the catch block in `handleRegisterSubmit`:
```typescript
} catch (err: any) {
  const msg: string = err.message || "Đăng ký thất bại";
  const lower = msg.toLowerCase();
  if (lower.includes("email")) {
    setRegErrors({ regEmail: msg });
  } else if (lower.includes("mật khẩu") || lower.includes("password")) {
    setRegErrors({ regPassword: msg });
  } else if (lower.includes("cccd") || lower.includes("ảnh")) {
    setRegErrors({ cccdFront: msg });
  } else if (lower.includes("cv") || lower.includes("pdf")) {
    setRegErrors({ cvFile: msg });
  } else if (lower.includes("điện thoại") || lower.includes("phone")) {
    setRegErrors({ regPhone: msg });
  } else if (lower.includes("ngày sinh") || lower.includes("birth")) {
    setRegErrors({ regDob: msg });
  } else if (lower.includes("họ và tên") || lower.includes("displayname") || lower.includes("tên")) {
    setRegErrors({ regName: msg });
  } else {
    setRegGeneralError(msg);
  }
}
```
5. In JSX for `mode === "register"`, render `regGeneralError` banner when non-empty, and clear `regGeneralError` upon typing in inputs.

---

### Task 2: Translate Shift Schedule Registration Modal (Image 2)

**Files:**
- Modify: `app/frontend/src/features/schedule/components/CTVScheduleWorkspace.tsx`
- Modify: `app/frontend/src/shared/context/SystemSettingsContext.tsx`

**Interfaces:**
- `CTVScheduleWorkspace.tsx`: modal JSX lines 760-915

- [ ] **Step 1: Add schedule modal translation keys in `SystemSettingsContext.tsx`**
In `translations["Tiếng Việt"]`:
```typescript
workroom_label: "Buồng làm việc",
weekly_shift_pattern: "Mẫu ca làm việc theo tuần",
shift_day_header: "Ca / Thứ",
room_prefix: "Buồng",
```
In `translations["Tiếng Anh"]`:
```typescript
workroom_label: "Workroom",
weekly_shift_pattern: "Weekly Shift Schedule Pattern",
shift_day_header: "Shift / Day",
room_prefix: "Room",
```

- [ ] **Step 2: Update `CTVScheduleWorkspace.tsx` modal**
1. Translate room label:
`<label htmlFor="modal-room-select">{language === "Tiếng Anh" ? "Workroom" : "Buồng làm việc"}</label>`
2. Translate room option labels:
`{ROOM_OPTIONS.map((r) => (<option key={r} value={r}>{language === "Tiếng Anh" ? r.replace("Buồng", "Room") : r}</option>))}`
3. Translate header badge room display:
`{language === "Tiếng Anh" ? room.replace("Buồng", "Room") : room}`
4. Translate pattern section legend:
`{language === "Tiếng Anh" ? "Weekly Shift Schedule Pattern" : "Mẫu ca làm việc theo tuần"}`
5. Translate table header:
`{language === "Tiếng Anh" ? "Shift / Day" : "Ca / Thứ"}`
6. Translate table day headers:
`{language === "Tiếng Anh" ? ["Mon", "Tue", "Wed", "Thu", "Fri"][day.index] : day.short}`
7. Translate shift labels in rows:
`{language === "Tiếng Anh" ? (shiftOption.type === "MORNING" ? "Morning" : "Afternoon") : shiftOption.label}`
8. Translate close button and toggle buttons `aria-label` text when `language === "Tiếng Anh"`.

---

### Task 3: Translate Change Password Modal (Image 3)

**Files:**
- Modify: `app/frontend/src/features/profile/components/ChangePasswordModal.tsx`

**Interfaces:**
- `ChangePasswordModal.tsx`: Consume `useSystemSettings` (`t`, `language`)

- [ ] **Step 1: Import `useSystemSettings` in `ChangePasswordModal.tsx`**
```typescript
import { useSystemSettings } from '../../../shared/context/SystemSettingsContext';
```

- [ ] **Step 2: Replace hardcoded strings with `t(...)` and localized messages**
1. Modal title: `{t('change_password')}`
2. Field labels: `{t('current_password')}`, `{t('new_password')}`, `{t('confirm_new_password')}`
3. Visibility toggles: `title={showOldPassword ? t('hide_password') : t('show_password')}`
4. Submit button: `{isSubmitting ? t('updating') : t('change_password')}`
5. Localize client-side validation errors:
- "Please enter current password" / "Vui lòng nhập mật khẩu hiện tại"
- "New password must be at least 8 characters" / "Mật khẩu mới phải có ít nhất 8 ký tự"
- "Password confirmation does not match" / "Mật khẩu xác nhận không khớp"
6. Localize catch block error messages when `language === "Tiếng Anh"`.

---

### Task 4: Translate Accent Color Dropdown in System Settings (Image 4)

**Files:**
- Modify: `app/frontend/src/shared/context/SystemSettingsContext.tsx`
- Modify: `app/frontend/src/shared/ui/SettingsModal.tsx`

**Interfaces:**
- `SettingsModal.tsx`: CustomSelect for AccentColorOption

- [ ] **Step 1: Add color translation keys to `SystemSettingsContext.tsx`**
In `translations["Tiếng Việt"]`:
```typescript
color_gray: "Xám",
color_green: "Lục",
color_blue: "Lam",
color_yellow: "Vàng",
color_red: "Đỏ",
color_orange: "Cam",
color_purple: "Tím",
```
In `translations["Tiếng Anh"]`:
```typescript
color_gray: "Gray",
color_green: "Green",
color_blue: "Blue",
color_yellow: "Yellow",
color_red: "Red",
color_orange: "Orange",
color_purple: "Purple",
```

- [ ] **Step 2: Update `SettingsModal.tsx` to map accent colors to localized labels**
Define `colorI18nKeys`:
```typescript
const colorI18nKeys: Record<AccentColorOption, string> = {
  Xám: 'color_gray',
  Lục: 'color_green',
  Lam: 'color_blue',
  Vàng: 'color_yellow',
  Đỏ: 'color_red',
  Cam: 'color_orange',
  Tím: 'color_purple',
};
```
And pass `label: t(colorI18nKeys[key])` in the `options` prop of `CustomSelect<AccentColorOption>`.

---

### Task 5: Translate Edit Profile Modal and Profile Screen Details (Image 5)

**Files:**
- Modify: `app/frontend/src/features/profile/components/EditProfileModal.tsx`
- Modify: `app/frontend/src/features/profile/components/ProfileScreen.tsx`

**Interfaces:**
- `EditProfileModal.tsx`: Consume `useSystemSettings` (`t`, `language`)

- [ ] **Step 1: Connect `useSystemSettings` in `EditProfileModal.tsx`**
1. Modal header: `{language === "Tiếng Anh" ? "Edit Personal Information" : "Chỉnh sửa thông tin cá nhân"}`
2. Field labels: `{t("full_name")}`, `{t("phone_number")}`, `{t("date_of_birth")}`, `{t("gender")}`, `{t("address")}`
3. Date dropdown titles: `{language === "Tiếng Anh" ? "Day" : "Ngày"}`, etc.
4. Gender options:
   - `<option value="">{t("not_updated")}</option>`
   - `<option value="Nam">{t("gender_male")}</option>`
   - `<option value="Nữ">{t("gender_female")}</option>`
   - `<option value="Khác">{t("gender_other")}</option>`
5. Address placeholder: `{language === "Tiếng Anh" ? "e.g. Ho Chi Minh City" : "TP. Hồ Chí Minh"}`
6. Buttons: Cancel -> `{t("cancel")}`, Save -> `{t("save")}`

- [ ] **Step 2: Update `ProfileScreen.tsx` gender display**
Translate gender display when viewing profile in English ("Nam" -> "Male", "Nữ" -> "Female", "Khác" -> "Other", empty -> "Not updated").

---

### Task 6: Comprehensive Verification & Automated Tests

**Files:**
- Test: `app/backend/tests/...`
- Test: `app/frontend/e2e/...`

- [ ] **Step 1: Run typechecks**
Run `npm run typecheck` across workspaces to ensure zero TypeScript errors.

- [ ] **Step 2: Run backend tests**
Run `npm run test:api`.

- [ ] **Step 3: Run frontend tests and E2E tests**
Run `npm run test:e2e` (or relevant specs).
