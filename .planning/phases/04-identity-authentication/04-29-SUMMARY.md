---
phase: 04-identity-authentication
plan: 29
subsystem: auth
tags: [web, sessions, signed-in-devices, s7, sign-out-others, responsive-table, tanstack-query, e2e, playwright, auth-06, d-43, d-44, d-05, a11y-03]
status: complete
created: "2026-10-15T04:30:00-05:00"
updated: "2026-10-15T04:30:00-05:00"

requires: ["04-28", "04-16", "04-25", "04-26"]
provides:
  - "modules/admin/pages/SessionsPage.tsx: SessionsRoute, the S7 'Signed-in devices' page at /admin/sessions (ResponsiveTable, this device first, no button on it, per-device confirm, always-enabled 'Sign Out Other Devices' header button, only-this-device note, focus after removal)"
  - "modules/admin/components/SignOutOthersDialog.tsx: the 'Sign out of other devices?' dialog, exported for the user menu (plan 04-30)"
  - "modules/admin/components/SignOutDialog.tsx: the shared Keep / Sign Out confirm shell (pending lock, failure line, focus rules); SignOutDeviceDialog.tsx wraps it for one device"
  - "modules/admin/services/sessionsService.ts: createSessionsService and sessionsService (list, revoke with the id as one encoded path segment)"
  - "modules/admin/hooks/useSessionsQuery.ts and lib/query/keys.ts sessionsListKey: stale-at-once query in display order"
  - "modules/admin/components/deviceSummary.ts: deviceLabel, signedInText, lastActiveText, rowSignOutName, orderDevices"
  - "utils/format.ts formatBusinessDateTime ('Oct 12, 2026, 3:42 PM' in Asia/Manila, null for bad input)"
  - "components/lists RowAction accepts a ref"
  - "e2e/sessions.spec.ts (@sessions) in all five projects"
affects: [04-30, 04-32]

requirements-completed: []

actuals:
  tokens: 22000
  tasks: 2
  commits: 4
plan_head_before: 2b9e00adf6ef9838368db88e17ba65e3a3896efb
plan_head_after: 7946793706cdeef27b54962f59cfd1760a0a15bb

tech-stack:
  added: []
  patterns:
    - "A list that can lose a row optimistically: setQueryData removes the row and chooses the focus target in the same batch as the dialog closing, then invalidateQueries refetches; a no-deps effect reads a ref and moves focus once"
    - "A 'gone' answer is success: alreadySignedOut true and a 404 both remove the row and show the info toast; any other failure returns { ok: false, error } so the dialog stays open"
    - "'Last active' is read against the query's dataUpdatedAt, so the same data always reads the same and render stays pure"
    - "Dialogs stay in the page root, never in a ResponsiveTable cell (the frame's paint containment traps a fixed scrim)"

key-files:
  created:
    - web/src/modules/admin/pages/SessionsPage.tsx
    - web/src/modules/admin/pages/SessionsPage.test.tsx
    - web/src/modules/admin/components/SignOutDialog.tsx
    - web/src/modules/admin/components/SignOutDeviceDialog.tsx
    - web/src/modules/admin/components/SignOutDeviceDialog.test.tsx
    - web/src/modules/admin/components/SignOutOthersDialog.tsx
    - web/src/modules/admin/components/SignOutOthersDialog.test.tsx
    - web/src/modules/admin/components/deviceSummary.ts
    - web/src/modules/admin/components/deviceSummary.test.ts
    - web/src/modules/admin/hooks/useSessionsQuery.ts
    - web/src/modules/admin/services/sessionsService.ts
    - web/src/modules/admin/services/sessionsService.test.ts
    - web/e2e/sessions.spec.ts
  modified:
    - web/src/utils/format.ts
    - web/src/utils/format.test.ts
    - web/src/lib/query/keys.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/authCopy.ts
    - web/src/components/lists/cells.tsx
    - web/src/components/lists/ResponsiveTable.test.tsx
    - docs/web/e2e.md

key-decisions:
  - "A 404 from DELETE /sessions/{id} is 'already signed out' (info toast, row removed), per the 04-16 note and UI-SPEC S7, not a dialog failure; a network error or 5xx keeps the dialog open"
  - "The sessions query is stale at once (staleTime 0) so window focus and every page open refetch; the shared 30 s default would skip a focus inside 30 s"
  - "'Last active' text is computed from the query's dataUpdatedAt, not the render clock"
  - "One shared SignOutDialog behind both confirms instead of two copies of the ConfirmDialog failure logic"

patterns-established:
  - "The user menu (plan 04-30) opens <SignOutOthersDialog onClose onSignedOut /> from its own state; the dialog owns the request, the toast and the focus return"

coverage:
  - id: C1
    description: "D-43: the page lists the caller's own devices, this device first with 'This device' and no sign-out button, others by newest last active; signed-in and last-active times in Asia/Manila inside <time dateTime>; session kind badge or 'Until browser closes'; 'Unknown browser' for a blank label"
    requirement: "AUTH-06"
    verification:
      - "SessionsPage.test.tsx 'S7 the list' (8 tests), deviceSummary.test.ts (19 tests), format.test.ts formatBusinessDateTime (12 tests)"
      - "e2e/sessions.spec.ts @sessions passes in chromium, firefox, webkit, pixel and iphone"
  - id: C2
    description: "D-43: per-device sign-out through a confirm with 'Keep Signed In' focused; success removes the row, toasts 'Device signed out', refetches and moves focus to the next row's button, else the previous row's, else the h1; failure keeps the dialog open with the mapper line and focus on 'Sign Out Device'; pending ignores Esc, scrim, Close and Keep"
    requirement: "AUTH-06"
    verification:
      - "SessionsPage.test.tsx 'S7 sign out one device' (9 tests) and SignOutDeviceDialog.test.tsx (7 tests)"
      - "e2e/sessions.spec.ts: second browser context loses its session (S1 shown at its next /admin/sessions visit), this session still works after reload"
  - id: C3
    description: "UI-SPEC S7 already gone: alreadySignedOut true and a 404 are treated as success with the 'Already signed out' info toast"
    requirement: "AUTH-06"
    verification:
      - "SessionsPage.test.tsx 'treats an answer of alreadySignedOut as success' and 'treats a 404 ... as already signed out'"
  - id: C4
    description: "D-44 and D-05: 'Sign Out Other Devices' is always enabled (also while loading, after a load error and with only this device), opens a dialog that says 'other devices', focuses 'Keep Others Signed In', counts no sessions first, shows the same toast whether or not anything was revoked, and returns focus to its opener"
    requirement: "AUTH-06"
    verification:
      - "SignOutOthersDialog.test.tsx (7 tests) and SessionsPage.test.tsx 'S7 Sign Out Other Devices' (3 tests)"
  - id: C5
    description: "S7 states: skeleton table with 'Loading signed-in devices…' then 'Signed-in devices loaded.' (header at once), ErrorState with Try Again and the reference, only-this-device Note, refetch dims the rows by colour after 200 ms without removing them, refetch on window focus and never on a timer"
    requirement: "AUTH-06"
    verification:
      - "SessionsPage.test.tsx 'S7 states' (4 tests); zero axe violations in Blush and Espresso (loaded, only this device, dialog open, loading, failed)"
      - "e2e/sessions.spec.ts: page-level axe in Blush, Espresso, with the dialog open and after the removal; scrollWidth <= innerWidth in all five projects"
---

# Phase 4 Plan 29: Signed-in Devices Page Summary

Staff can open "Signed-in devices" in the admin shell, see every device signed in to their account (this one first, with a "This device" badge and no button), sign out any other device after a confirm, and sign out every other device at any time from the page header.

## What was built

- **Tracer (Task 1):** `formatBusinessDateTime`, the row strings (`deviceSummary`), `sessionsService`, the sessions query, `SignOutDialog` and `SignOutDeviceDialog`, `SessionsRoute` at `/admin/sessions` (a lazy child of the guarded admin layout), `RowAction` with a ref, and the `@sessions` E2E: one staff member signed in on two browser contexts (the second with an Edge-on-Windows User-Agent so the rows differ), the page listing both, the other row signed out through the confirm, the other browser sent back to sign-in.
- **Behaviour (Task 2):** the already-gone cases, `SignOutOthersDialog` opened by the always-enabled header button, and the unit and component tests for every S7 state, name, focus rule and theme.

Tracer gate: interactive mode, `human_verify_mode` end-of-phase, automated-only `<verify>`. After GREEN the `@sessions` E2E (all five projects) and the lint, typecheck and format checks were re-run and passed before the Task 2 work began.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | List my signed-in devices and sign one out, end to end in two browser contexts | f0f653c (RED), 437c6dd |
| 2 | S7 states, accessible names and focus, the already-gone case, and Sign Out Other Devices (D-44, D-05) | ebe2767 (RED), 7946793 |

`commits: 4` is measured from the plan ledger (`plan_head_before`).

## RED / GREEN evidence

- Task 1 RED: `format.test.ts` (12 failures, `formatBusinessDateTime` missing), `deviceSummary.test.ts` and `sessionsService.test.ts` failed to load (modules missing); the E2E had no route. GREEN: all pass, and `@sessions` passes in all five projects.
- Task 2 RED: `SignOutOthersDialog.test.tsx` failed to load and 4 `SessionsPage` tests failed (two already-gone cases, two sign-out-others cases). The other 26 page tests and the `SignOutDeviceDialog` tests passed on the tracer: it already carried the focus rules, the only-this-device note, the states and the failure rule, because the tracer E2E needs them (the E2E asserts the note and the heading focus). GREEN: 350 admin tests pass.

## Verification

- `npm --prefix web run verify` exit 0 after the preflight: typecheck, ESLint (0 warnings), Prettier, 135 test files and 3581 tests with coverage (statements 97.39%, branches 94.73%, functions 98.72%, lines 99.58%), production build, budget build, license gate, notices check. No-long-dash (OR-4) and class gate pass inside it.
- Bundles (gzip): production public JS 132.46 KB (limit 150), dev-route public JS 134.24 KB, admin JS 165.49 KB (limit 250). `SessionsPage` is its own lazy chunk (6.83 KB gzip). No limit was raised.
- E2E: `--grep @sessions` 5 passed (chromium, firefox, webkit, pixel, iphone), run twice (after the tracer and after Task 2). The full 30-minute suite was not re-run: outside the new files the changes are one optional `RowAction` prop, one `ResponsiveTable` test and additive copy functions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two lint rules forbid both `as` and `!` on a possibly-null element**
- **Found during:** Task 2 `verify` (ESLint).
- **Issue:** `non-nullable-type-assertion-style` rejects `x as HTMLElement` and `no-non-null-assertion` rejects `x!`, so the scrim lookup in the new tests had no allowed one-liner.
- **Fix:** a `scrimOf(dialog)` helper that throws when there is no parent, and a `textContent` list assertion for the three-row order; `no-useless-assignment` fixes in the page and one test; `useSubmission<undefined, undefined>` instead of `void`.
- **Files modified:** the three test files, `SignOutOthersDialog.tsx`, `SessionsPage.tsx`.
- **Commit:** 7946793

### Plan interpretation

- **404 on a per-row sign-out:** the plan's Task 2 behaviour says "a 404 or network failure keeps the dialog open". The orchestrator note from plan 04-16 and UI-SPEC S7 ("treat as already gone") say a 404 means the device is no longer in the list. I followed the note and the UI-SPEC: a 404 removes the row with the "Already signed out" info toast; a network error or 5xx keeps the dialog open. Say so if you want the plan's literal reading.
- **The other browser in the E2E:** the plan says context B is sent to sign in "with 'Your session ended. Sign in again.'". As in 04-28, a fresh page load whose refresh cookie is dead is a plain first visit, so the notice only shows in a live tab whose session ends in the page. The E2E asserts the Sign in screen and the `/admin/login` URL, not the notice.
- **Extra files:** `SignOutDialog.tsx` (shared by both confirms, so the ConfirmDialog failure logic exists once), `RowAction`'s `ref` prop plus its test in `ResponsiveTable.test.tsx`, and additive changes to `authCopy.ts` (a nullable sign-in time in `rowAction` and `deviceDialog.body`, and `deviceDialog.pending`). None were in the plan's file list.
- **Tracer scope:** the only-this-device note, the focus rules and the loading and error states are in the tracer commit, not Task 2, because the tracer E2E asserts them. Task 2 therefore added tests more than code for those.

## Decisions for the owner

- **404 reads as "Already signed out"** (see above). It is also the reading in UI-SPEC S7.
- **The devices list refetches on every page open and window focus** (`staleTime 0`), not after the shared 30 seconds. A device someone signs in on elsewhere then shows up as soon as you come back to the tab. Say so if you prefer the shared default.
- **"Last active" counts from the moment the list was fetched.** A tab left open for 20 minutes without refocusing keeps saying "Just now" until the next refetch. The UI-SPEC already calls these times approximate.
- **Wording that is mine (SPEC-GAP, for the D-06 review):** none new; every string comes from the UI-SPEC copy table already in `AUTH_COPY`. One addition: a row whose sign-in time cannot be read is named "Sign out {device}" with no time.
- **Requirement not ticked:** AUTH-06 also covers "sign out of all devices" from the user menu, which plan 04-30 adds. I left it pending for the phase verification.

## Known Stubs

None. The header button, the row buttons and both dialogs are wired to the real endpoints.

## Threat Flags

None beyond the plan's register. T-04-100 stays with the server (404 for foreign ids; the page only renders the caller's own list); T-04-101 is mitigated by the confirm dialog with the safe action focused, names that include the sign-in time and no button on the current row (tests assert all three). No installs.

## Self-Check: PASSED

Created files exist (`SessionsPage.tsx`, `SessionsPage.test.tsx`, `SignOutDialog.tsx`, `SignOutDeviceDialog.tsx`, `SignOutOthersDialog.tsx`, their tests, `deviceSummary.ts`, `deviceSummary.test.ts`, `useSessionsQuery.ts`, `sessionsService.ts`, `sessionsService.test.ts`, `sessions.spec.ts`), and commits f0f653c, 437c6dd, ebe2767 and 7946793 are ancestors of HEAD.
