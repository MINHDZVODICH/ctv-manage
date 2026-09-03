# CTV Management System — Comprehensive Test Plan

**Document ID:** CTV-TP-001  
**Version:** 1.0  
**Prepared:** 2026-08-31  
**System under test:** `app/backend` and `app/frontend`  
**Primary references:** `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/USE-CASE.md`, `docs/sequence-diagrams/*`, `docs/report.md`, and the current application/test source

---

## 1. Purpose

This plan defines the verification and validation strategy for the CTV Management System. It covers public registration, authentication, account administration, profile and private-file management, recurring schedule registration, shift assignment, cancellation, aggregate schedules, and immutable work history.

The plan is designed to:

- Verify that business workflows work end to end for applicants, CTVs, and administrators.
- Prove authorization, ownership, session, and sensitive-data boundaries independently of frontend controls.
- Detect data-integrity failures across SQLite transactions and private filesystem storage.
- Validate schedule behavior across concurrency, timezone, date-boundary, and history-finalization conditions.
- Establish repeatable automated smoke, regression, compatibility, accessibility, security, and performance suites.
- Provide release gates and traceability from requirements and documented defects to executable tests.

---

## 2. Product and quality objectives

### 2.1 Product objectives

The system shall allow:

1. An applicant to submit a CTV account request and optional identity/application files.
2. An administrator to inspect, approve, or reject registration requests.
3. An approved user to authenticate through a secure server-side session.
4. An administrator to manage CTV status, profile data, documents, notes, and passwords.
5. A CTV to maintain their own profile, documents, password, recurring work pattern, current shifts, and work history.
6. An administrator to view aggregate current schedules, historical work, shift details, and CTV drill-down information.
7. The system to preserve finalized work history when accounts or future schedules change.

### 2.2 Quality objectives

The release shall prioritize:

- **Correctness:** workflows produce the intended account, file, schedule, and history state.
- **Security:** users cannot cross role, account, schedule, or file boundaries.
- **Integrity:** concurrent operations do not cause lost updates, duplicate active records, or disk/database divergence.
- **Recoverability:** failures produce controlled errors and leave recoverable state.
- **Usability:** all critical workflows can be completed with clear loading, empty, success, and error states.
- **Accessibility:** critical workflows are keyboard-operable and meet the agreed WCAG target.
- **Compatibility:** supported browsers, viewports, themes, languages, and timezones behave consistently.
- **Operability:** logs and reports support diagnosis without leaking passwords, tokens, or storage paths.

---

## 3. Test basis and acceptance baseline

### 3.1 Test basis

| Source | Test-planning use |
|---|---|
| `docs/ARCHITECTURE.md` | Layering, runtime, storage, logging, and security architecture |
| `docs/DATABASE.md` | Entities, lifecycle states, constraints, schedule/history rules |
| `docs/USE-CASE.md` | User-facing workflows and UI acceptance behavior |
| `docs/sequence-diagrams/*` | Request flows, transactions, authorization, concurrency, compensation |
| `docs/report.md` | Previous observations and named regression targets; not treated as a current pass/fail result |
| `app/backend/src` | Implemented API, middleware, services, validation, persistence, and storage behavior |
| `app/backend/tests` | Existing API integration coverage and fixtures |
| `app/frontend/src` | Reachable UI, state, forms, settings, API integration, and accessibility behavior |
| `app/frontend/e2e` | Existing Playwright coverage and acceptance harness |

### 3.2 Provisional acceptance baseline

For planning purposes, personal CTV scheduling is considered **in scope**, because it is represented in the database design, sequence diagrams, backend API, frontend implementation, and existing tests.

A specification conflict remains: `docs/USE-CASE.md` describes aggregate-only CTV scheduling in places, while the other sources describe personal registration, current shifts, recurring updates, and cancellation. Until the documents are reconciled:

- Test failures in implemented personal-schedule behavior are defects.
- Differences caused only by the stale aggregate-only use-case wording are marked **Requirements Blocked**, not automatically passed or failed.
- Final acceptance requires one authoritative schedule contract.

### 3.3 Other requirements requiring clarification

| ID | Open decision | Interim test treatment |
|---|---|---|
| RQ-01 | May Admin edit a CTV's identity/contact fields, or only status, notes, password, and files? | Test current API behavior and flag unauthorized or undocumented fields |
| RQ-02 | What happens when a soft-deleted account's email is registered again? | Require a controlled re-registration/reactivation outcome; unique-key failure is unacceptable |
| RQ-03 | Can a request be approved if an optional physical file is missing? | Require a recoverable outcome; permanent deadlock is unacceptable |
| RQ-04 | Is schedule materialization 30, 31, or 60 days? | Record actual dates and compare with the selected product rule |
| RQ-05 | Is a rejection reason required? | Test both current optional behavior and proposed required-policy behavior |
| RQ-06 | Must Admin-generated reset passwords force a change at next login? | Test API flag and UI enforcement separately |
| RQ-07 | Are settings per browser, per account, or cross-device? | Require current-session/reload persistence; record cross-device behavior as undefined |
| RQ-08 | Which browsers, mobile devices, WCAG level, and performance targets are contractual? | Use the provisional matrices and gates in this plan |

---

## 4. Scope

### 4.1 In scope

- Health and application startup behavior.
- Login, session restoration, logout, expiry, revocation, and password-driven session invalidation.
- Public registration, validation, file upload, duplicate detection, and failure compensation.
- Admin registration review, approval, rejection, concurrency, and attachment transfer.
- Account listing, search, pagination, detail, status, soft deletion, password reset, and notes.
- Own-profile and administrator profile views and updates.
- Avatar, CCCD, CV upload, replacement, streaming, authorization, and deletion.
- CTV recurring schedule registration and update.
- Shift materialization, current shifts, aggregate schedule, cancellation, and work-history finalization.
- Role, ownership, sensitive-field, CSRF/cookie, CORS, input-validation, and file-security testing.
- UI navigation, forms, dialogs, loading/error/empty states, keyboard behavior, accessibility, responsiveness, themes, contrast, accent, language, and timezone behavior.
- Database constraints, transaction rollback, filesystem consistency, migration readiness, logging, startup/shutdown, backup/restore rehearsal, and basic load/resilience.
- Automated unit, component, API integration, service integration, and Playwright E2E suites.

### 4.2 Conditionally in scope

The following implemented but unreachable or incompletely connected behavior shall be tested after the product owner classifies it as intended functionality:

- CTV single-shift cancellation controls.
- CTV recurring cancellation controls.
- CTV shift-level room change controls.
- Account-detail end-schedule action.
- Disconnected meeting, notification, create-user, and prototype screens/modals.

### 4.3 Out of scope unless requirements are added

- Email, SMS, webhook, or push delivery; no delivery integration is currently defined.
- External identity providers.
- Cloud object storage.
- Native mobile applications.
- Payroll, attendance scoring, room-capacity optimization, or meeting management not connected to the production application.
- Penetration testing against infrastructure outside the authorized local/test environment.

---

## 5. System inventory

### 5.1 Actors

| Actor | State | Primary capabilities |
|---|---|---|
| Applicant | Unauthenticated | Submit registration and optional documents |
| Active CTV | Authenticated | Own profile/files/password, recurring schedule, shifts, history |
| Disabled CTV | Existing account without access | Must be unable to log in or continue an existing session |
| Soft-deleted CTV | Retained historical identity | Excluded from normal operations; history remains referentially valid |
| Administrator | Authenticated | Review applications, manage CTV accounts, inspect schedules/history/files |
| Concurrent administrator | Authenticated in another session | Exercises optimistic concurrency and idempotency |
| Background history synchronizer | System process | Materializes immutable historical snapshots |

### 5.2 Backend modules

- Health
- Authentication and session middleware
- Users/profile/password
- Accounts administration
- Registration requests
- Private files and local storage
- Schedule registration, shifts, assignments, summaries, and work history
- Prisma/SQLite persistence
- Error handling, logging, and hourly synchronization

### 5.3 Frontend surfaces

- Login and public registration
- Admin account list and account detail
- Admin registration requests and request detail
- Admin aggregate schedule and work history
- CTV schedule workspace and registration dialog
- Shared personal profile and document views
- Change password, edit profile, reset password, and settings dialogs
- Role-specific sidebar, user menu, responsive navigation, global toast

---

## 6. Risk-based priorities

### 6.1 Priority definitions

| Priority | Meaning | Release treatment |
|---|---|---|
| P0 | Security, privacy, irreversible data corruption, authentication bypass, or core workflow unavailable | Must pass; any confirmed defect blocks release |
| P1 | Major business rule, common workflow, accessibility barrier, or recoverability failure | Must pass unless formally waived with mitigation |
| P2 | Compatibility, usability depth, performance hardening, low-frequency edge case | May be deferred with documented risk and owner |
| P3 | Exploratory enhancement or future functionality | Informational unless promoted |

### 6.2 Highest-risk targets

| Risk ID | Priority | Target |
|---|---:|---|
| RISK-01 | P0 | Shift detail must return only the requested shift's active assignments and must enforce ownership/role boundaries |
| RISK-02 | P0 | An already-authenticated account must lose access immediately after disable/delete/reset conditions that revoke sessions |
| RISK-03 | P0 | CTV responses must not expose `adminNotes`, password hashes, token hashes, storage keys, or physical paths |
| RISK-04 | P0 | Soft-delete followed by same-email registration/approval must not fail on a unique constraint or create duplicate identity state |
| RISK-05 | P0 | Concurrent approvals and versioned updates must produce one winner and controlled `409` conflicts |
| RISK-06 | P0 | File IDs, staged attachments, deleted links, and missing physical files must not bypass authorization or leak data |
| RISK-07 | P0 | Schedule updates/cancellations must not modify finalized history or unrelated users' assignments |
| RISK-08 | P0 | Database and filesystem failures must not leave a visible record pointing to missing/corrupt storage |
| RISK-09 | P1 | Malformed JSON, Multer errors, CORS denials, and Prisma failures must return stable non-secret error responses |
| RISK-10 | P1 | Bangkok midnight, month/year boundaries, leap day, and remote browser timezones must not shift work dates |
| RISK-11 | P1 | Mobile navigation must not render overlapping permanent and drawer sidebars |
| RISK-12 | P1 | Critical dialogs must be keyboard-operable with correct focus and accessible semantics |
| RISK-13 | P1 | UI must not fabricate DOB, gender, join date, CV, avatar, or other personal data when API fields are absent |
| RISK-14 | P1 | Playwright retries must start from isolated, deterministic data and file state |
| RISK-15 | P2 | Theme, contrast, accent, language, external-resource failure, and cross-browser behavior require pairwise coverage |

---

## 7. Test strategy and levels

### 7.1 Static verification

Review code and configuration for:

- Route and role-guard completeness.
- Zod schemas and DTO field allowlists.
- Prisma constraints and transaction boundaries.
- File allowlists, magic-byte detection, storage-key construction, and cleanup.
- Date/time conversion and Bangkok timezone consistency.
- Logging redaction.
- Dialog semantics, labels, focus patterns, and responsive CSS.
- Dead/unreachable production branches.
- Dependency vulnerabilities and license/security advisories.

### 7.2 Unit tests

Target pure or isolated logic:

**Backend**

- Session token generation/hash and cookie options.
- Email normalization and DTO mapping.
- File signature detection, path validation, filename/header safety, and storage-key generation.
- Schedule start/end calculation, weekday filtering, date ranges, period/room validation, and expiry rules.
- Work-history eligibility and idempotent snapshot mapping.
- Validation helpers and error mapping.

**Frontend**

- `formatPhoneNumber`, `formatDateOnly`, room label/code conversion.
- `dayIndexFromYmd`, date formatting, month/week selectors.
- API-to-view model mappers.
- Shift deduplication and schedule selectors.
- Settings initialization from valid, invalid, and unavailable local storage.

### 7.3 Component integration tests

Use React Testing Library with a controlled API mock layer for:

- Login and registration validation.
- File selection, replacement, preview, and error states.
- Account/request tables under loading, empty, success, conflict, and failure responses.
- Edit profile, change password, reset password, and settings dialogs.
- CTV schedule registration dialog and stale-version behavior.
- Dialog focus, Escape, backdrop, focus restoration, and live announcements.
- Auth/session context transitions and ordinary request `401` handling.

### 7.4 Service integration tests

Run backend services against isolated SQLite databases and temporary storage directories. Use controllable clocks and fault-injectable storage/database adapters for:

- Multi-record transactions.
- Approval and account-code generation concurrency.
- Account status/delete side effects.
- File write/finalize/replace/delete rollback.
- Schedule reconciliation and cancellation.
- Work-history synchronization and expiration.
- Database unique/cascade constraints.

### 7.5 API integration tests

Use Supertest against the real Express app for:

- All routes, status codes, schemas, cookies, headers, role matrix, ownership, idempotency, errors, and sensitive-field omission.
- Real SQLite and local private storage for representative success and failure workflows.
- Malformed JSON, multipart limits, CORS, and middleware ordering.

### 7.6 End-to-end tests

Use Playwright against a seeded backend and production-equivalent frontend for:

- Complete applicant, Admin, and CTV journeys.
- Session reload/revocation and role navigation.
- Real file upload/download and schedule persistence.
- Mobile, keyboard, accessibility, theme, locale, timezone, and cross-browser smoke.
- Release-critical regression cases.

### 7.7 Exploratory testing

Use risk-charter sessions for:

- Concurrent Admin operations.
- Long Vietnamese data and Unicode normalization.
- Date/time travel around Bangkok midnight.
- Broken storage/database/network conditions.
- Mobile and keyboard-only usage.
- Theme/accent/contrast combinations.
- Attempts to access another actor's IDs and files.

---

## 8. Test environment strategy

### 8.1 Environment matrix

| Environment | Purpose | Data/storage | Required controls |
|---|---|---|---|
| Local unit/component | Fast developer feedback | In-memory/mocked | Deterministic clock and network |
| Backend integration | Service/API verification | Per-test SQLite + temp uploads | Reset/rollback per test; no shared production paths |
| E2E acceptance | Real browser workflows | Worker/test-specific SQLite + upload root | Seed per test or scenario; retry-safe |
| CI smoke | Every pull request | Ephemeral | Chromium, API tests, axe smoke, artifacts |
| Nightly regression | Broad matrix | Ephemeral isolated workers | Firefox, WebKit, mobile, timezone, visual, load subsets |
| Release candidate | Production-like build | Sanitized representative data | HTTPS/cookie/CORS configuration, backup/restore rehearsal |

### 8.2 Runtime configuration to verify

- Node and package-lock versions used by CI match the supported runtime.
- Prisma client is generated from the committed schema.
- SQLite foreign keys, WAL mode, and busy timeout are active.
- Cookie `Secure` behavior is validated behind HTTPS in release-candidate testing.
- Allowed CORS origins are explicit and environment-specific.
- Upload roots are private and outside public frontend assets.
- Test commands never reset or delete developer/production databases or upload directories.

### 8.3 Browser and viewport matrix

| Tier | Browser/device | Viewport |
|---|---|---:|
| PR smoke | Bundled Chromium | 1440×900 |
| PR responsive smoke | Mobile Chrome emulation | 375×667 |
| Nightly | Firefox desktop | 1440×900 |
| Nightly | WebKit desktop | 1440×900 |
| Nightly | Mobile Safari emulation | 390×844 |
| Nightly | Small mobile | 320×568 |
| Nightly | Tablet portrait | 768×1024 |
| Release | Laptop | 1280×720 |
| Release | Wide desktop | 1920×1080 |

### 8.4 Locale and timezone matrix

- Languages: Vietnamese and English.
- Browser timezones: `Asia/Bangkok`, `UTC`, `America/Los_Angeles`.
- Test dates: weekday, weekend, Bangkok midnight, month end, year end, leap day, and registration-window end.

---

## 9. Test data strategy

### 9.1 Core actors and records

Create deterministic factories/fixtures for:

- Active Admin with two active sessions.
- Second Admin for concurrent review.
- Active CTV with no optional data.
- Active CTV with all files and a schedule.
- Active CTV with finalized history.
- Disabled CTV with a previously valid session.
- Soft-deleted CTV.
- Two CTVs with identical display names.
- Pending registration without files.
- Pending registration with all valid files.
- Pending registration with a missing/quarantined file.
- Approved and rejected requests.
- Case-variant and Unicode-normalization duplicate emails/names.
- Active, cancelled, past, today, and future assignments.
- Stale/current account and schedule versions.

### 9.2 File corpus

Maintain versioned test fixtures for:

- Valid PNG, JPEG, WebP.
- Valid PDF and supported document formats.
- Exactly 5 MiB and 5 MiB + 1 byte.
- Empty files.
- Extension/MIME/signature mismatches.
- Generic ZIP declared as DOCX.
- Corrupt image/PDF/document.
- Long Unicode filenames.
- Filenames containing quotes, CR/LF, traversal sequences, and reserved Windows characters.
- Duplicate content with different names.

### 9.3 Schedule/date corpus

- Monday-created and non-Monday-created registrations.
- One-slot and all-slot patterns.
- Duplicate input slots.
- Morning/afternoon across rooms 1–4.
- Month/year transitions and leap day.
- Past/today/future cancellation dates.
- Concurrent updates with the same expected version.
- History synchronization before and after cancellation.

### 9.4 Isolation rules

- No fixed email may be shared by tests that mutate state.
- Every retry must receive fresh or restored database and upload state.
- Upload cleanup is verified, not assumed.
- Parallel workers receive separate databases and storage directories.
- Time-dependent tests use a controlled clock where possible.
- Test data must contain no real personal information.

---

## 10. Functional test coverage

### 10.1 Authentication and sessions

| ID | Priority | Scenario | Expected result |
|---|---:|---|---|
| AUTH-001 | P1 | Submit blank/invalid login fields | Field errors are visible and focusable; no request when client validation blocks |
| AUTH-002 | P0 | Unknown email and wrong password | Same public error; no account-enumeration detail |
| AUTH-003 | P0 | Disabled or soft-deleted account login | No session or authenticated cookie is created |
| AUTH-004 | P0 | Successful login | Session is created, cookie attributes are correct, `lastLoginAt` updates |
| AUTH-005 | P0 | Restore valid session after reload | Correct role/user state is restored without exposing token data |
| AUTH-006 | P0 | Missing, malformed, expired, revoked cookie | Controlled `401`; protected data is absent |
| AUTH-007 | P0 | Disable account while session is active | Next protected request fails and frontend returns to login |
| AUTH-008 | P1 | Logout once and repeatedly | Current session is revoked; cookie cleared; repeated logout remains successful |
| AUTH-009 | P0 | Self password change | Current session stays valid; all other sessions are revoked |
| AUTH-010 | P0 | Admin password reset | All target sessions are revoked; API/log/toast does not echo cleartext password |
| AUTH-011 | P1 | `mustChangePassword=true` | User is forced into the agreed password-change workflow before normal navigation |
| AUTH-012 | P1 | Ordinary API call receives `401` | Auth state is cleared consistently and user receives a controlled transition |

### 10.2 Public registration

| ID | Priority | Scenario | Expected result |
|---|---:|---|---|
| REG-001 | P1 | Required field and phone/password/confirmation boundaries | Accurate client and server validation |
| REG-002 | P1 | Valid request without optional files | One normalized `PENDING` request is created |
| REG-003 | P1 | Valid request with all files | Files are private, active, and associated with the request |
| REG-004 | P0 | Existing active account or pending request email | Duplicate is rejected consistently, including case variants |
| REG-005 | P0 | Same email as soft-deleted account | Defined re-registration/reactivation outcome; no raw unique-key failure |
| REG-006 | P0 | Two simultaneous submissions for same email | At most one pending identity is accepted |
| REG-007 | P1 | File type, signature, size, field-count matrix | Unsupported/oversized/spoofed input is rejected safely |
| REG-008 | P0 | Disk write, finalization, or DB failure | No visible broken request; staged data is cleaned/quarantined deterministically |
| REG-009 | P1 | Submission failure then retry | Entered non-sensitive state is handled as specified; retry creates one request |
| REG-010 | P1 | Successful countdown/manual return | Sensitive state clears; redirect duration matches the agreed requirement |

### 10.3 Registration review

| ID | Priority | Scenario | Expected result |
|---|---:|---|---|
| REV-001 | P0 | Anonymous/CTV access review endpoints | Controlled `401/403`; no request data leakage |
| REV-002 | P1 | Pending list search/pagination/order | Stable results, counts, loading, empty, and error states |
| REV-003 | P1 | View request and attachments | Only authorized files stream with safe headers |
| REV-004 | P0 | Approve valid request | One active CTV account is created; files transfer; request hash clears |
| REV-005 | P1 | Reject request | No account is created; reviewer/time/reason policy is enforced; hash clears |
| REV-006 | P0 | Two Admins decide simultaneously | Exactly one transition succeeds; other receives controlled conflict |
| REV-007 | P0 | Approve request with missing/quarantined file | Recoverable defined outcome; no partial account/request/file state |
| REV-008 | P1 | Mutation failure in UI | Dialog/row state remains truthful and retryable |
| REV-009 | P1 | Pending badge before visiting Requests screen | Count follows the agreed freshness contract |

### 10.4 Account administration

| ID | Priority | Scenario | Expected result |
|---|---:|---|---|
| ACC-001 | P0 | Role matrix for account routes | Only Admin succeeds |
| ACC-002 | P1 | Search by name/email/phone, Unicode/case/spacing | Defined normalized results and stable pagination |
| ACC-003 | P1 | First/last/empty page and deletion of final row | Page index and total remain valid |
| ACC-004 | P0 | Disable active CTV | Status/version update; sessions and active registration/future assignments cancelled; history preserved |
| ACC-005 | P1 | Reactivate disabled CTV | Status changes; schedule restoration behavior matches selected requirement |
| ACC-006 | P0 | Soft-delete and repeat delete | Idempotent hidden account; sessions/future assignments cancelled; history retained |
| ACC-007 | P1 | Cancel confirmations | No server-side change |
| ACC-008 | P1 | UI delete confirmation flow | Exactly the agreed number/type of confirmations occurs |
| ACC-009 | P0 | Two updates using same account version | One succeeds; stale update receives `409`; no lost update |
| ACC-010 | P0 | Reset password | Hash/timestamps/version/flag update; all target sessions revoked; secret not echoed |
| ACC-011 | P0 | CTV requests another account detail/notes | Access denied without data leakage |
| ACC-012 | P1 | Save Admin notes | Length/HTML/script handling, version policy, and visibility boundaries are correct |

### 10.5 Profiles and private files

| ID | Priority | Scenario | Expected result |
|---|---:|---|---|
| PROF-001 | P0 | Own and Admin-authorized profile read | Only permitted fields are returned; CTV never receives Admin-only notes |
| PROF-002 | P1 | Edit valid profile | Allowed fields update and version increments |
| PROF-003 | P1 | Empty update, invalid lengths, impossible DOB | Controlled validation; invalid DOB is not silently stored as null |
| PROF-004 | P0 | Stale profile update | `409` with no overwrite |
| PROF-005 | P1 | Missing optional personal data | UI shows truthful empty/not-updated state, never fabricated data |
| FILE-001 | P0 | File authorization matrix | Owner/Admin rules hold for guessed IDs, staged files, deleted links, and unattached assets |
| FILE-002 | P1 | Upload each category and valid type | Correct metadata, content, and safe download headers |
| FILE-003 | P1 | Type/signature/size/empty/filename matrix | Invalid input is rejected without partial state |
| FILE-004 | P0 | Replace same category, including concurrent replacement | Exactly one active association remains; old asset lifecycle is deterministic |
| FILE-005 | P1 | Delete same category repeatedly | Link disappears idempotently; physical/asset retention matches policy |
| FILE-006 | P0 | DB failure after physical write or cleanup failure | Disk/database consistency is restored or quarantined and logged safely |
| FILE-007 | P1 | DB row exists but file is missing | Controlled `404/409`; no stack/path leak; repair path is documented |
| FILE-008 | P1 | Stream error before/after headers | Response and logs are controlled; no process crash |

### 10.6 Password management

| ID | Priority | Scenario | Expected result |
|---|---:|---|---|
| PWD-001 | P1 | Missing/wrong current password | No update; controlled validation/authentication error |
| PWD-002 | P1 | New password boundaries and confirmation mismatch | Client/server policies agree |
| PWD-003 | P0 | Successful self-change with multiple sessions | New hash works; old password fails; other sessions revoked |
| PWD-004 | P0 | Admin reset submission | New password works as specified; API response/logs omit cleartext |
| PWD-005 | P1 | Clipboard unavailable/denied | Modal remains usable and explains manual copy behavior |
| PWD-006 | P1 | Close/cancel/reopen dialogs | Sensitive values and errors are cleared |
| PWD-007 | P0 | Rate-limit/abuse behavior | Matches the selected security policy; absence is recorded as an open control |

### 10.7 CTV schedule registration and shifts

| ID | Priority | Scenario | Expected result |
|---|---:|---|---|
| SCH-001 | P0 | Role/ownership matrix for CTV schedule routes | Account identity derives from session; cross-account access is denied |
| SCH-002 | P1 | Create one-slot and multi-slot patterns | Valid registration and expected assignments are created |
| SCH-003 | P1 | Invalid room, weekday, period, empty or duplicate slots | Controlled validation and deduplication |
| SCH-004 | P1 | Monday vs non-Monday creation | Start date follows the selected rule |
| SCH-005 | P1 | Materialization horizon/end-date boundaries | Exact expected dates match the approved 30/31/60-day contract |
| SCH-006 | P0 | Update with current/stale version | Current update reconciles assignments; stale update receives `409` |
| SCH-007 | P0 | Two simultaneous schedule upserts | At most one version transition; no duplicate active registration/assignment |
| SCH-008 | P0 | Remove slots/change room | Future assignments reconcile; past/history state is preserved |
| SCH-009 | P0 | Shift detail by ID | Only requested shift's active assignments are returned |
| SCH-010 | P0 | CTV requests unrelated shift | Access denied or scoped response according to contract; no unrelated assignment list |
| SCH-011 | P1 | Empty/loading/error/retry and rapid month changes | UI remains truthful; stale requests cannot overwrite newer results |
| SCH-012 | P1 | Reload after create/update | Server state is restored correctly |

### 10.8 Cancellation, aggregate schedule, and work history

| ID | Priority | Scenario | Expected result |
|---|---:|---|---|
| CAN-001 | P0 | Cancel owned active today/future assignment | Status and cancellation metadata update; assignment is not deleted |
| CAN-002 | P0 | Cancel past, cancelled, or another CTV's assignment | No unauthorized/historical mutation |
| CAN-003 | P1 | Repeat identical cancellation | Success/idempotent result with zero additional changes |
| CAN-004 | P0 | Recurring cancellation from date | Only matching registration/weekday/period/date assignments change |
| CAN-005 | P0 | Historical `fromDate` | Finalized/past assignments remain immutable |
| SUM-001 | P1 | Today and weekly Admin summary | Counts, rooms, names, phones, duplicate names, and shift grouping are correct |
| SUM-002 | P1 | Month vs range vs account filters | Valid combinations succeed; mutually exclusive/oversized ranges fail cleanly |
| SUM-003 | P1 | History tab while today card is visible | Today card still derives from current assignments |
| HIST-001 | P0 | Startup/hourly/pre-query synchronization | Eligible past active assignments are snapshot exactly once |
| HIST-002 | P0 | Repeated synchronization | No duplicate history rows; immutable values remain stable |
| HIST-003 | P0 | Cancel/update after finalization | Existing history is unchanged |
| HIST-004 | P1 | Synchronization error | Startup remains controlled; failure is observable without leaking data |
| HIST-005 | P1 | Expiration before/on/after end date | Registration status and assignments follow the approved rule |

### 10.9 Settings, localization, and navigation

| ID | Priority | Scenario | Expected result |
|---|---:|---|---|
| SET-001 | P1 | Valid/invalid local-storage settings | Valid settings restore; corrupt/unsupported values fall back safely |
| SET-002 | P1 | Light/dark, low/medium/high contrast, seven accents | Selected state persists and all critical text/control states remain distinguishable |
| SET-003 | P1 | Vietnamese/English | Reachable UI, errors, labels, and `html lang` follow the selected language policy |
| SET-004 | P2 | Reload/logout/login/new browser | Persistence matches the selected per-browser/per-user contract |
| NAV-001 | P0 | Admin/CTV menu visibility and direct API access | UI and backend both enforce role boundaries |
| NAV-002 | P1 | Back/forward, refresh, and deep-link expectations | Behavior matches the explicitly accepted state-based navigation contract |
| NAV-003 | P1 | Pending count freshness | Badge follows the approved refresh behavior |

---

## 11. API authorization matrix

Every operation shall be represented by at least one allowed and one denied test.

| Area | Operation group | Applicant | CTV | Admin |
|---|---|---:|---:|---:|
| Health | `GET /health` | Allow | Allow | Allow |
| Sessions | Create/delete current session | Allow | Allow | Allow |
| Sessions | Read current session | Deny without session | Own | Own |
| Registration | Submit request | Allow | Allow only if product permits authenticated submission | Allow only if product permits |
| Registration | List/decide requests | Deny | Deny | Allow |
| Users | Read/update own profile; change own password | Deny | Own | Own |
| Accounts | List/detail/update/status/delete/reset/notes | Deny | Deny | Allow |
| Files | Stream content | Deny | Authorized own | Authorized Admin |
| Files | Manage own categories | Deny | Own | Own profile only through own route |
| Files | Manage account categories | Deny | Deny | Allow |
| Schedule | Own registration/shifts/history/cancellation | Deny | Own | Deny or explicitly defined |
| Schedule | Shift detail | Deny | Authorized scope only | Allow |
| Schedule | Summary/global history | Deny | Deny | Allow |

Additional matrix dimensions:

- Active vs disabled vs soft-deleted account.
- Valid vs expired vs revoked session.
- Own vs other account/assignment/file/registration ID.
- Existing vs deleted/staged/unattached/missing file.
- Current vs stale optimistic version.

---

## 12. Security test plan

### 12.1 Authentication and session security

- Verify password hashes use the configured Argon2 policy.
- Verify raw session tokens never enter the database, logs, URLs, API bodies, or frontend-readable storage.
- Verify cookie name, path, `HttpOnly`, `SameSite`, expiry, and production `Secure` attributes.
- Attempt session replay after logout, password change, password reset, account disable, and deletion.
- Test fixation by supplying a preexisting token before login.
- Test malformed and oversized cookies.
- Verify login responses resist account enumeration.
- Define and test rate limits/lockout; report the current absence as an open control.

### 12.2 Authorization

- Build a complete anonymous/CTV/Admin endpoint matrix.
- Modify IDs in account, file, shift, assignment, registration, and history requests.
- Bypass hidden/disabled frontend controls with direct API calls.
- Verify all account identity for own routes derives from the session, not a caller-provided parameter.
- Verify disabled and deleted sessions cannot continue.

### 12.3 Input and injection

- Test SQL metacharacters, Unicode controls, HTML/script, template syntax, CR/LF, long strings, and null bytes in search, names, phones, addresses, notes, rejection reasons, and filenames.
- Verify stored values render as text, not executable markup.
- Test unknown JSON fields, prototype-like keys, empty PATCH bodies, malformed JSON, oversized bodies, and invalid dates/months/ranges.

### 12.4 CSRF, CORS, and browser controls

- Verify the selected CSRF contract for every mutating cookie-authenticated route.
- Test missing/invalid CSRF headers if CSRF is required by the architecture.
- Test allowed, disallowed, missing, and `null` origins.
- Verify credentialed CORS never uses wildcard origin.
- Add security-header checks for CSP, frame protection, MIME sniffing, referrer policy, and HSTS in HTTPS environments.

### 12.5 File security

- MIME/signature mismatch, polyglot, malformed, generic ZIP-as-DOCX, oversized, empty, and decompression-risk inputs.
- Path traversal and header injection through filenames.
- Unauthorized and guessed file IDs.
- Access after link deletion or account disable/delete.
- Missing physical file and storage-permission failures.
- Verify private files are not served by frontend/static routes.

### 12.6 Sensitive-data and logging checks

Prohibit in responses, logs, toasts, screenshots, traces, and reports:

- Passwords and password hashes.
- Raw session tokens and cookie values.
- Storage keys and absolute filesystem paths.
- Internal stack traces in client responses.
- Administrative notes in CTV DTOs.
- Unnecessary identity/document content in logs.

---

## 13. Database, transaction, and storage integrity

### 13.1 Constraint tests

- Unique account email and CTV code.
- Unique session token hash.
- One request-file category per request.
- One active visible account-file category according to the selected policy.
- Unique shift per date/period.
- Unique assignment per shift/account and registration/shift.
- Unique history per account/date/period and source assignment.
- Foreign-key and soft-delete behavior.

### 13.2 Transaction rollback tests

Inject failure at each step of:

- Login session creation and `lastLoginAt` update.
- Registration request and file metadata creation.
- Registration approval and attachment transfer.
- Account disable/delete side effects.
- Password change/reset and session revocation.
- File replacement and cleanup.
- Schedule update/reconciliation.
- History synchronization.

Expected outcome: either the whole business operation commits, or state is rolled back/compensated into a documented recoverable state.

### 13.3 Migration and upgrade tests

The current project uses `prisma db push --force-reset` in tests and has no versioned migration history. Before production release:

- Establish versioned migrations.
- Apply migrations to a copy of the previous release database.
- Verify records, constraints, timestamps, file associations, schedules, and history survive.
- Verify rollback/restore procedure from backup.
- Prohibit destructive reset commands outside isolated test databases.

---

## 14. Accessibility test plan

Target: **WCAG 2.2 AA** provisionally, pending formal acceptance.

### 14.1 Automated checks

Run `@axe-core/playwright` on:

- Login and registration.
- Admin account list, requests, summary, and profile.
- CTV schedule and profile.
- Every reachable dialog/lightbox.
- Light and dark mode.
- At least one non-blue accent and high contrast.

### 14.2 Manual/interaction checks

- Complete every P0/P1 journey using keyboard only.
- Every input has an accessible name and associated error.
- Invalid fields expose `aria-invalid` and error descriptions.
- Dialogs have role, accessible title, initial focus, trap, Escape, backdrop policy, and focus restoration.
- Non-button clickable rows/cards are replaced or exposed as keyboard-operable controls.
- Sidebar active state, menu expansion, tab selection, pending counts, and custom selects are programmatically exposed.
- Toasts use suitable live regions and distinguish success from failure.
- Content remains usable at 200% zoom and with browser text scaling.
- Reduced-motion preference removes nonessential animation without removing state feedback.
- Color is not the only carrier of status or selection.

---

## 15. Responsive, visual, and compatibility testing

### 15.1 Responsive priorities

- At 320px and 375px, the desktop fixed sidebar must be hidden and only the mobile drawer may appear.
- Drawer opening, focus containment, backdrop, navigation close, and background scroll lock.
- Account/request tables remain operable through contained horizontal scroll.
- Schedule calendars preserve date/shift association and reachable controls.
- Dialog headers/footers and primary actions remain visible.
- Touch targets are approximately 44×44 CSS pixels where practical.
- No page-level horizontal overflow.

### 15.2 Theme pairwise matrix

At minimum:

1. Light + blue + medium contrast.
2. Dark + blue + medium contrast.
3. Light + white accent.
4. Dark + white accent.
5. Light + yellow accent + high contrast.
6. Dark + red/purple accent + high contrast.
7. Low contrast in both themes, with explicit accessibility-risk evaluation.

Validate text, focus rings, links, primary/secondary/destructive buttons, disabled state, errors, selected navigation, tables, calendars, and dialogs.

### 15.3 External resource failure

Block Google Fonts, Material Symbols, and remote avatar requests. Verify:

- Core actions remain understandable.
- Icon ligature text does not replace meaningful controls.
- Layout shift is acceptable.
- Missing avatars use a truthful local fallback, not an unrelated remote person.
- Private application behavior does not depend on third-party availability.

---

## 16. Performance, reliability, and operability

Formal non-functional requirements are not documented. The following are provisional release-candidate gates and must be approved or replaced.

### 16.1 Provisional performance gates

| Measure | Provisional target |
|---|---:|
| Authenticated read API p95 under representative data | ≤ 500 ms |
| Normal mutation API p95 excluding large upload transfer | ≤ 1,000 ms |
| Login response p95 under 25 concurrent users | ≤ 1,500 ms |
| Main screen usable after navigation on standard test hardware | ≤ 3 s |
| Search response after debounce | Latest query displayed within 1 s |
| Error rate during 15-minute 50-user mixed workload | < 1%, excluding intentional validation responses |

### 16.2 Workload scenarios

- Login and session restoration burst.
- Account/request list search and pagination.
- Concurrent registration submissions.
- Concurrent approval attempts.
- Schedule summary reads while CTVs update schedules.
- File upload/download within configured size limits.
- Hourly history synchronization with representative historical volume.

### 16.3 Reliability and recovery

- SQLite busy/locked behavior and concurrent writes.
- Database unavailable at startup and during request handling.
- Upload directory missing, read-only, or full.
- Graceful shutdown with active requests and background synchronization.
- Restart after interrupted file finalization.
- Backup and restore of database plus private files as one consistent unit.
- Log rotation/retention and disk-capacity alarms once operational requirements exist.

---

## 17. Existing automation baseline

### 17.1 Backend

Current baseline:

- 3 Vitest integration suites.
- 12 integration tests and approximately 89 assertions.
- Real Express routing, SQLite, Argon2, sessions, and local filesystem.
- Serial execution.
- No unit tests, service-test layer, coverage report, threshold, fault injection, or migration test.

Existing suites:

- `app/backend/tests/auth-and-access.integration.test.ts`
- `app/backend/tests/registration-and-accounts.integration.test.ts`
- `app/backend/tests/files-and-schedule.integration.test.ts`

### 17.2 Frontend

Current baseline:

- 12 Playwright tests.
- Desktop Google Chrome only at 1440×900.
- One worker; one CI retry.
- Real seeded backend and database.
- No unit/component tests, axe integration, visual regression, mobile, Firefox, WebKit, or coverage.

Existing suites:

- `app/frontend/e2e/auth.spec.ts`
- `app/frontend/e2e/registration.spec.ts`
- `app/frontend/e2e/admin.spec.ts`
- `app/frontend/e2e/ctv.spec.ts`

### 17.3 Immediate harness improvements

1. Reset/restore data per mutation test or use worker-specific databases.
2. Use unique generated registration emails.
3. Isolate and clean upload storage per test/worker.
4. Add Admin and CTV authenticated fixtures.
5. Fail on unexpected page errors, console errors, failed requests, and unplanned 4xx/5xx responses.
6. Prefer semantic locators and page objects for stable workflows.
7. Add unit/component/coverage scripts.
8. Run bundled Chromium in CI; retain installed Chrome as an optional compatibility project.

---

## 18. Automation roadmap

### Phase A — P0 regression protection

- Shift detail scoping and ownership.
- Disabled-session enforcement.
- Sensitive-field omission.
- Soft-delete/re-registration approval.
- Approval/account/schedule concurrency.
- File authorization and lifecycle consistency.
- Historical immutability.
- Malformed body/upload error mapping.
- Mobile sidebar smoke.
- Role navigation/API matrix.
- Retry-safe test data isolation.

### Phase B — Core functional depth

- Full auth/session/password suite.
- Registration validation and file matrix.
- Account search/pagination/status/delete/reset/notes.
- Request rejection/detail/conflict/failure.
- Profile validation and truthful empty states.
- Schedule create/edit/version/date-boundary/history.
- Dialog focus and keyboard coverage.
- Axe smoke.

### Phase C — Compatibility and hardening

- Firefox, WebKit, mobile, tablet.
- Timezone and locale suites.
- Theme/accent/contrast pairwise matrix.
- Visual regression.
- Load/resilience and backup/restore.
- Migration validation.
- Reduced motion, external-resource failure, and 200% zoom.

### Suggested quality thresholds

After a stable baseline is established:

- Backend statements ≥ 85%, branches ≥ 80%.
- Authentication, registration decisions, file authorization, and schedule services ≥ 90% statement coverage.
- Frontend utility/state modules ≥ 85% statements and ≥ 80% branches.
- Every API operation represented in the role matrix.
- Every transaction has at least one rollback/failure test.
- No test may depend on execution order.
- Flaky-test rate below 1% over 30 CI runs; release smoke must have zero retries consumed.

Coverage percentages are supporting metrics, not substitutes for risk and requirement coverage.

---

## 19. Execution suites and cadence

| Suite | Trigger | Maximum intended duration | Contents |
|---|---|---:|---|
| Developer fast | Local change | 2 min | Unit tests and targeted component/service tests |
| PR verification | Every pull request | 15 min | Typecheck, build, unit, API integration, Chromium E2E smoke, axe smoke |
| Main-branch regression | Every merge | 30 min | Full backend integration and expanded Chromium E2E |
| Nightly | Daily | 90 min | Firefox/WebKit/mobile/timezone/theme/visual and extended negative tests |
| Security/dependency | Daily and before release | 30 min | Dependency scan, static checks, authorization/security regression |
| Performance/resilience | Weekly and release candidate | 60 min | Mixed load, concurrency, storage/database failure scenarios |
| Release acceptance | Each candidate | As required | Full P0/P1 matrix, backup/restore, migration, exploratory charters |

---

## 20. Entry, suspension, resumption, and exit criteria

### 20.1 Entry criteria

Testing may begin when:

- The build and typecheck succeed.
- The target revision and environment configuration are recorded.
- Prisma schema/client and seed are synchronized.
- Isolated database and upload storage are available.
- Required test accounts/data/files exist.
- Testable acceptance behavior is defined or marked Requirements Blocked.
- No unrelated environment outage prevents meaningful results.

### 20.2 Suspension criteria

Suspend the affected suite when:

- Data reset or cleanup can touch non-test resources.
- More than 20% of tests fail from one confirmed environment defect.
- Authentication, database, or file storage is unavailable for the entire suite.
- Test data is contaminated and retries cannot restore a known state.
- Requirements conflict prevents objective pass/fail classification.

### 20.3 Resumption criteria

Resume after:

- The environment defect is fixed and a health check passes.
- Test data/storage is restored to a known baseline.
- The blocking requirement has an approved interpretation.
- A failed test harness change is verified with a focused self-test.

### 20.4 Release exit criteria

- 100% of P0 tests executed and passed.
- At least 95% of P1 tests passed; any remainder has an approved waiver, owner, mitigation, and target date.
- No open Critical or High security, privacy, authorization, or data-integrity defect.
- No unresolved defect that can alter another user's account, files, schedule, or history.
- No unresolved defect that exposes password/token/storage/admin-only data.
- Migration and backup/restore pass for a production release.
- Chromium desktop/mobile smoke passes without retry.
- Firefox and WebKit critical journeys pass for a release candidate.
- Accessibility: no Critical axe violations; no keyboard blocker in a critical workflow.
- Performance/resilience meets approved targets or has a formal waiver.
- All 13 report-derived regressions are rerun against the candidate.
- Test summary, defect list, coverage, residual risks, and requirements blockers are published.

---

## 21. Defect management

### 21.1 Severity

| Severity | Definition | Example |
|---|---|---|
| Critical | Unauthorized access, secret exposure, unrecoverable corruption, or system-wide outage | CTV reads another user's private file; disabled session remains valid |
| High | Core workflow blocked or major incorrect state without safe workaround | Approval creates partial account; history is modified by future update |
| Medium | Significant behavior/UX issue with workaround | Search race shows stale results; dialog closes before failed save is known |
| Low | Cosmetic, minor text, or low-impact inconsistency | Noncritical spacing or translation issue |

### 21.2 Defect record

Each defect shall include:

- Build/commit and environment.
- Actor, preconditions, and test data identifiers.
- Exact reproduction steps.
- Expected and actual results.
- API request/response identifiers where safe.
- Screenshot/trace/log excerpt with secrets removed.
- Severity, priority, requirement/test IDs, and affected data.
- Reproducibility and workaround.
- Regression-test status.

### 21.3 Triage rules

- Critical defects receive immediate isolation and release block.
- Security/privacy findings are shared only with authorized project members.
- A fix is not closed until the original case and adjacent regression tests pass.
- Requirements disagreements are tracked separately from implementation defects.
- Flaky tests are defects in the test system and may not be silently retried indefinitely.

---

## 22. Metrics and reporting

Report by suite and release candidate:

- Planned, executed, passed, failed, blocked, and not-run tests by priority.
- Requirement coverage by module and priority.
- API operation/role-matrix coverage.
- Open defects by severity, age, module, and root-cause class.
- Defect discovery and reopen rate.
- Automated coverage and changed-code coverage.
- Flaky tests and retries consumed.
- Test duration and slowest tests.
- Accessibility violations by severity.
- Browser/viewport/timezone/theme coverage.
- Performance p50/p95/p99, throughput, and error rate.
- Residual risks, waivers, and requirements blockers.

A release summary shall state a clear recommendation: **Go**, **Go with accepted risk**, or **No-Go**.

---

## 23. Regression catalogue from prior documentation

| ID | Priority | Regression |
|---|---:|---|
| RGR-01 | P0 | Approve registration using the email of a soft-deleted account |
| RGR-02 | P1 | Current-shifts behavior when optional filters are omitted |
| RGR-03 | P1 | Registration-success redirect countdown matches the approved duration |
| RGR-04 | P0 | Schedule dates do not shift outside UTC+7 |
| RGR-05 | P0 | Missing optional physical file during approval has a recoverable outcome |
| RGR-06 | P0 | UI, API, and requirements agree on personal CTV scheduling |
| RGR-07 | P1 | Oversized/invalid profile files are rejected safely |
| RGR-08 | P1 | Vietnamese search handles defined case/diacritic behavior |
| RGR-09 | P1 | Contrast settings materially affect the complete UI without making it unusable |
| RGR-10 | P1 | Same-name CTVs remain distinct in aggregate shifts |
| RGR-11 | P0 | Reset passwords do not appear in API responses, logs, traces, or generic toasts |
| RGR-12 | P1 | English translation is complete or follows a defined fallback |
| RGR-13 | P1 | Impossible DOB is rejected rather than silently normalized/nullified |

---

## 24. Deliverables

- Approved test plan and requirements decisions.
- Requirement-to-test traceability matrix.
- Test data and file fixture catalogue.
- Automated unit, component, service, API, and E2E suites.
- Manual exploratory charters and accessibility checklist.
- CI test reports, traces, screenshots, coverage, and performance results.
- Defect register and regression-test links.
- Release test summary and residual-risk statement.
- Backup/restore and migration evidence for production releases.

---

## 25. Ownership model

| Role | Responsibility |
|---|---|
| Product owner/domain representative | Resolve requirements conflicts and accept residual business risk |
| Engineering lead | Approve technical quality gates, environment, observability, and release readiness |
| Backend engineer | Unit/service/API tests, database/storage integrity, security fixes |
| Frontend engineer | Component/E2E tests, accessibility, responsive, locale/theme behavior |
| QA/test lead | Plan, traceability, risk prioritization, execution, reporting, exploratory testing |
| Security reviewer | Authorization, session, file, input, dependency, and secret-handling review |
| Operations owner | Production-like configuration, backup/restore, monitoring, retention, incident readiness |

In a small team, one person may hold multiple roles, but approval of waived P0/P1 risks should not be implicit.

---

## 26. Final release checklist

- [ ] Schedule specification conflict resolved.
- [ ] Admin profile-edit authority resolved.
- [ ] Soft-delete/re-registration policy implemented and tested.
- [ ] Missing-file approval recovery implemented and tested.
- [ ] Schedule horizon and start-date rules approved.
- [ ] Complete role/ownership matrix passes.
- [ ] Disabled/deleted sessions are rejected.
- [ ] Sensitive-field and secret-leak tests pass.
- [ ] File lifecycle and rollback tests pass.
- [ ] Schedule/history concurrency and immutability tests pass.
- [ ] E2E data and upload storage are retry-safe.
- [ ] Mobile sidebar and critical responsive tests pass.
- [ ] Keyboard/dialog and axe critical checks pass.
- [ ] Browser/timezone/locale/theme release matrix passes.
- [ ] Migration and backup/restore evidence is available.
- [ ] No Critical/High unaccepted defects remain.
- [ ] Release test summary and residual risks are approved.
