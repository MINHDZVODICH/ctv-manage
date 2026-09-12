# Test Plan: Verification of http://localhost:4000/ Against docs/USE-CASE.md

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test the live deployment at `http://localhost:4000/` (Schedulo container) against all specifications and acceptance criteria defined in `docs/USE-CASE.md` (Use Cases 1.1–1.11 and 2.1–2.5).

**Architecture:** Automated test harness comprising:
1. Playwright browser automation test suite targeting `http://localhost:4000/` to test UI flows, form validations, modal behaviors, and visual elements.
2. REST API verification script testing all backend endpoints on port 4000 (`/api/*` vs `/api/v1/*`, status codes, response schemas, security behaviors, and error messages).
3. Detailed gap and compliance matrix comparing each requirement in `docs/USE-CASE.md` with observed behavior at `http://localhost:4000/`.

**Tech Stack:** Playwright, Node.js (fetch / test runner), Docker (mysql inspect / logs).

**Spec:** `docs/USE-CASE.md`

## Global Constraints
- Target URL: `http://localhost:4000/`
- Spec Source of Truth: `docs/USE-CASE.md`
- Evidence Requirement: All assertions must be backed by live execution output (HTTP responses, DOM queries, Playwright screenshots/traces).

---

### Task 1: Environment & Discovery Check
**Files:**
- Test: `scripts/test-port4000-discovery.mjs`

- [ ] **Step 1: Check server availability and identify API structure**
  - Verify `http://localhost:4000/` HTML root, assets, and health checks.
  - Discover exposed routes in `Back_end/index.js` inside container.
- [ ] **Step 2: Document accounts and test credentials**
  - Admin: `admin@gmail.com` / `123456`
  - Active CTV: `nva@gmail.com` / `123456`
  - Pending CTV: `tk@gmail.com` / `123456`
  - Disabled CTV: `lta@gmail.com`
- [ ] **Step 3: Run discovery script and capture outputs**

---

### Task 2: Automated Verification of Subsystem 1 (Account & Profile Management, UC 1.1 - 1.11)
**Files:**
- Test: `scripts/test-port4000-subsystem1.mjs`

- [ ] **Step 1: Implement test script for Use Cases 1.1 - 1.3**
  - UC 1.1: Đăng nhập (Empty validation, invalid credentials, disabled account, pending account, success response).
  - UC 1.2: Đăng xuất (Session revocation, cookie handling, navigation).
  - UC 1.3: Đăng ký tài khoản (Form fields, validation, duplicate email, pending request creation).
- [ ] **Step 2: Implement test script for Use Cases 1.4 - 1.6**
  - UC 1.4: Quản lý danh sách tài khoản (Pagination, search by name/email/phone, reset button, 5 items per page limit).
  - UC 1.5: Kích hoạt / Vô hiệu hóa tài khoản (Status toggle, session revocation, confirmation modal).
  - UC 1.6: Xóa tài khoản (Soft delete, modal warning, browser confirm, immediate table removal).
- [ ] **Step 3: Implement test script for Use Cases 1.7 - 1.11**
  - UC 1.7: Xem thông tin tài khoản (Contextual modal for Admin vs Self).
  - UC 1.8: Cập nhật thông tin hồ sơ (Allowed fields, file uploads for avatar/CCCD/CV).
  - UC 1.9: Đổi / đặt lại mật khẩu (Change own password, Admin reset password with generated code).
  - UC 1.10: Duyệt yêu cầu đăng ký (Pending list, Approve -> Active Account, Reject -> Rejected status).
  - UC 1.11: Cài đặt hệ thống (Theme, contrast, accent, language).
- [ ] **Step 4: Execute Subsystem 1 tests against http://localhost:4000/ and record evidence**

---

### Task 3: Automated Verification of Subsystem 2 (Schedule Management, UC 2.1 - 2.5)
**Files:**
- Test: `scripts/test-port4000-subsystem2.mjs`

- [ ] **Step 1: Implement test script for Use Cases 2.1 - 2.2**
  - UC 2.1: Đăng ký / cập nhật lịch làm việc của CTV (Room code, 0-10 shifts, Monday-Friday, repeating pattern, optimistic lock / version).
  - UC 2.2: Xem lịch tuần và lịch sử làm việc của CTV (Read-only weekly grid, month history with 17:30 cutoff, month navigation).
- [ ] **Step 2: Implement test script for Use Cases 2.3 - 2.5**
  - UC 2.3: Chốt lịch sử làm việc tự động vào 17:30 (Auto snapshot mechanism, weekend skip, idempotent behavior, no backfill).
  - UC 2.4: Xem lịch làm việc tổng hợp (Admin view of today's CTVs, weekly summary counts, monthly history summary).
  - UC 2.5: Xem chi tiết ca và hồ sơ CTV (Modal with shift details, CTV list, admin notes).
- [ ] **Step 3: Execute Subsystem 2 tests against http://localhost:4000/ and record evidence**

---

### Task 4: Playwright UI End-to-End Walkthrough on http://localhost:4000/
**Files:**
- Test: `scripts/test-port4000-playwright.mjs`

- [ ] **Step 1: Run UI E2E test covering Admin and CTV flows in headless Chromium**
- [ ] **Step 2: Capture screenshots and DOM assertions for UI requirements in docs/USE-CASE.md**
  - Organization branding (Military Institute / Academy of Military Science and Technology)
  - Pending approval notification on login
  - Read-only shift badges
  - 5 rows per page pagination
  - Contributor Management / Contributor Mgmt label

---

### Task 5: Comprehensive Evaluation Report Generation
**Files:**
- Output: Test report summarizing Pass/Fail status for each Use Case (1.1 - 2.5), specific discrepancies found between `http://localhost:4000/` and `docs/USE-CASE.md`, and technical recommendations.
