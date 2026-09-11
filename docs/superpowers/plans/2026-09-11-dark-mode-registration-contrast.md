# Dark Mode Registration Contrast Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix sunken/low-contrast text ("Đăng ký tài khoản", "Tải ảnh lên", "Tải file CV lên", etc.) in dark mode on the registration and login screens, and establish global CSS fallback contrast rules for `#002046` and `#1b365d`.

**Architecture:** 
1. Add WCAG contrast E2E tests for the registration view in dark mode.
2. Update `app/frontend/src/features/auth/components/LoginScreen.tsx` with proper Tailwind dark mode classes (`dark:text-white`, `dark:text-blue-300`, `dark:text-slate-400`, `dark:border-slate-700`, `dark:bg-[#181920]`, etc.).
3. Update `app/frontend/src/index.css` with global dark mode fallback overrides for `.text-[#002046]` and `.text-[#1b365d]` to guarantee defense-in-depth across the application.
4. Run all typechecks, boundary checks, and Playwright tests.
5. Rebuild Docker images for frontend and push to Docker Hub.

**Tech Stack:** React 19, Tailwind CSS v4, Playwright E2E testing, Docker.

---

### Task 1: Write failing E2E test for Dark Mode Registration Contrast (TDD RED)

**Files:**
- Modify: `app/frontend/e2e/registration.spec.ts`

- [ ] **Step 1: Add contrast calculation helper and failing test to `e2e/registration.spec.ts`**
- [ ] **Step 2: Run `npx playwright test e2e/registration.spec.ts` to verify failure**

---

### Task 2: Implement Tailwind Dark Mode Classes & CSS Fallbacks (TDD GREEN)

**Files:**
- Modify: `app/frontend/src/features/auth/components/LoginScreen.tsx`
- Modify: `app/frontend/src/index.css`

- [ ] **Step 1: Add global fallbacks in `src/index.css` for `.text-[#002046]` and `.text-[#1b365d]`**
- [ ] **Step 2: Add explicit dark classes to `LoginScreen.tsx` for titles, upload buttons, icons, hints, and toggle buttons**
- [ ] **Step 3: Run `npx playwright test e2e/registration.spec.ts` to verify tests pass**

---

### Task 3: Full Verification, Docker Rebuild & Push

**Files:**
- Docker: `docker/frontend.Dockerfile`
- Git commit & push

- [ ] **Step 1: Run workspace typecheck and check boundaries**
- [ ] **Step 2: Run full E2E suite (`registration.spec.ts`, `auth.spec.ts`, `ctv.spec.ts`, `admin.spec.ts`)**
- [ ] **Step 3: Rebuild `minhdz163/ctv-frontend:1.0.0` Docker image and push to Docker Hub**
- [ ] **Step 4: Commit changes to Git and push to origin/main**
