# Task 5 Report: CTV schedule workflows

## Scope delivered

- Added the `/api/v1` CTV schedule vertical slice: current registration, optimistic create/update, personal shifts, owner-safe shift detail, single cancellation, and recurring cancellation.
- Added a live-API CTV schedule workspace with a weekly grid, monthly history, registration dialog, detail dialog, cancellation confirmations, and four fixed room choices.
- Registered the backend router and the CTV application view. No prototype module, localStorage business state, Prisma data schema, or migration was changed.

## Contract and safety audit

- Validation limits schedule weekdays to Monday-Friday, periods to `MORNING`/`AFTERNOON`, rooms to `ROOM_1`-`ROOM_4`, registrations to 180 days, and enforces unique pattern slots, valid ISO dates, and `Asia/Bangkok`.
- Registration writes use a Prisma transaction and version compare-and-swap. A stale version returns `409 VERSION_CONFLICT` before assignments are changed.
- Shared shifts are keyed by date plus period; each CTV owns a separate assignment with its room and work content. Updates preserve past assignments, CTV-initiated cancellation, and cancel only removed future assignments.
- CTV-only mutations require session, CTV role, allowed origin, and CSRF. Detail access is restricted to an assigned CTV or an Admin. Cancellation endpoints require assignment/registration ownership and remain idempotent.
- Date expansion is UTC-date based for deterministic `YYYY-MM-DD` values and derives the current business day in `Asia/Bangkok`.
- The frontend uses the shared cookie/CSRF API client; it does not fabricate schedule data. The history and weekly views load the same server assignment data.

## RED/GREEN evidence

### Inherited cycles

- Backend feature RED was recorded before this continuation; the focused backend suite had already reached GREEN.
- Frontend feature RED was recorded before this continuation; the initial focused frontend suite was GREEN at 4/4 on takeover.

### Regression found during continuation

The `VERSION_CONFLICT` handler reloaded the registration into the hook, but the open registration dialog retained its initial local form state. A new focused assertion required the room, work content, and pattern slot to refresh from the reloaded version.

- RED: focused frontend test failed with expected select value `ROOM_3`, received `ROOM_1`.
- GREEN: keyed the dialog by registration ID and version, remounting its draft only when the authoritative registration changes. Focused frontend suite then passed 4/4 and frontend typecheck passed.

### Independent review follow-up

The first independent read-only review found three important defects. Each received a regression test that failed before the minimal fix:

- Saving an unrelated registration update reactivated assignments cancelled by the CTV. The sync now preserves every cancellation except `SCHEDULE_UPDATED`; focused backend tests cover both one-off and series cancellation.
- History navigation added 31 days, which skipped February from 31 January. It now moves by calendar month; the UI test verifies the February request.
- A CTV could submit an unbounded range, expanding every day in one transaction. The schema now rejects a range longer than 180 days before any assignment is created.

## Verification

| Check | Result |
|---|---|
| Focused backend schedule tests | 15/15 passed |
| Focused frontend schedule tests | 5/5 passed |
| Full backend tests | 80/80 passed |
| Full frontend tests | 30/30 passed |
| Full suite | 110/110 passed |
| `npm.cmd run typecheck` | Passed for backend and frontend |
| `npm.cmd run build` | Passed for backend and frontend |
| `git diff --check` | Passed; no whitespace errors |
| Prisma drift | Not applicable: Task 5 changed no Prisma schema or migration |

## Known concern

Prisma emits its existing `package.json#prisma` deprecation warning during backend tests. It does not fail the suite and is outside Task 5 scope.
