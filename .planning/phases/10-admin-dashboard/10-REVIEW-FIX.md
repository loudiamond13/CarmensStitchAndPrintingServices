---
phase: 10-admin-dashboard
fixed_at: 2026-11-10T06:35:00-06:00
created: 2026-11-10T06:35:00-06:00
updated: 2026-11-10T06:35:00-06:00
review_path: .planning/phases/10-admin-dashboard/10-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 10: Code Review Fix Report

*Created: 2026-11-10T06:35:00-06:00 · Updated: 2026-11-10T06:35:00-06:00*

**Fixed at:** 2026-11-10T06:35:00-06:00
**Source review:** `.planning/phases/10-admin-dashboard/10-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (fix scope: all)
- Fixed: 4
- Skipped: 1 (IN-03, deferred within the D-111 scope, optional)

**Where the work ran:** in the main checkout, on branch `gsd/phase-10-admin-dashboard`, not in a separate worktree. A fresh worktree has no `node_modules`, so the unit tests, lint and type check could not run there. The only uncommitted file at the start (`auditCopy.test.ts`) also held a finding's edit, which a worktree fast-forward would have collided with. The checks below ran in this checkout. Nothing was pushed or merged.

## Fixed Issues

### WR-01: The Transfer window shows a loading skeleton forever when the business date cannot be read

**Files modified:** `web/src/modules/admin/components/TransferModal.tsx`, `web/src/modules/admin/moneyCopy.ts`, `web/src/modules/admin/components/TransferModal.test.tsx`
**Commit:** 5f12c822
**Applied fix:** Per owner ruling D-112. The window now reads `useBusinessTodayState` and, when the date cannot be read, shows `ErrorState` with "Couldn't load the transfer form." over the usual reassurance line and a Try Again button that asks again. The loading region is marked failed, so its status says nothing (no "Loading"). The noun `failedThings: 'the transfer form'` sits in `moneyCopy.ts` beside the existing transfer copy. The loading noun is unchanged, so the normal loading line still reads "Loading staff…".
**Test first:** the new test (business-today read answers 500, no held answer: alert with the failure line and the reassurance line, status not "Loading", no `aria-busy`, no axe violations, Try Again recovers and the Date is filled) was run before the fix and failed with the skeleton and "Loading staff…" on screen. It passes after the fix.
**Status:** fixed (a logic change; the owner's ruling fixes the wording, so a quick look at the window with a failing date read is still worthwhile).

### IN-01: A test title said 100 codes while it asserted 101

**Files modified:** `web/src/modules/admin/auditCopy.test.ts`
**Commit:** 20722663
**Applied fix:** Renamed to `'mirrors every code of the API'`. The commit holds that one line only. No line-ending change was committed.

### IN-02: The money e2e helper accepted an earlier transfer's toast

**Files modified:** `web/e2e/money.spec.ts`, `web/e2e/money-sweep.spec.ts`
**Commit:** aaf930cd
**Applied fix:** `recordTransfer` now waits (up to 10 s, the toast lasts 4.5 s) for any earlier "Transfer recorded" toast to leave, then expects exactly one such toast, so the check is this transfer's own and strict mode is still safe. Counting toasts before and after was rejected because an earlier toast can time out between the two counts. The money sweep spec had the same helper with a `.last()` shortcut, so it got the same change.
**Note:** e2e was not run (shared machine). Type check and lint only.

### IN-04: The Newest sort breaks ties on a GUID (Phase 16 note, no code change)

**Files modified:** `.planning/ROADMAP.md` (Phase 16 "Owner decisions to close at discuss step"; Phase 16 has no directory yet, so the ROADMAP entry was used)
**Commit:** 925a66d8
**Applied fix:** Added one bullet saying imported orders that share a created time sort in a stable but arbitrary order by GUID id under "Newest first", so the import should give distinct created times (for example a per-row offset in import order) or the owner should accept that order. The `Updated:` stamp was changed, the `Created:` stamp left alone.
**Not done:** the reviewer's optional rewording of the `sort` row in `docs/api/orders.md` ("then by id, which only keeps pages from overlapping") was outside the instruction ("no code change", Phase 16 note only). It is still open if the owner wants it.

## Skipped Issues

### IN-03: The WebKit cancelled-request guard is matched on wording only

**File:** `web/e2e/fixtures.ts:77-82`, `:140-149`, `:177-179`
**Reason:** deferred: within D-111 scope, optional. The hardening needs a WebKit page error to arrive after the matching cancelled `requestfailed` event, and that order cannot be confirmed without running the WebKit e2e, which this run may not do. If the order is the other way round, the guard would raise false findings and break the ruled behavior. The reviewer also said to leave it as is if the order is unreliable. The fixture self-tests would need new cases too. Better done in a run that can execute the WebKit e2e.
**Original issue:** WebKit uses the same sentence for any access-control-rejected fetch, not only a cancelled one, so a real fault in the app's own `/api/` fetch could be swallowed.

## Verification (run in the main checkout, `web/`)

- `npx vitest run src/modules/admin/components/TransferModal.test.tsx src/modules/admin/auditCopy.test.ts`: 2 files passed, 105 tests passed (the first run of the new test failed before the fix, as intended).
- `npm run typecheck` (app, node and reference configs): no errors.
- `npx eslint --max-warnings 0` on the changed `src` and `e2e` files: clean.
- `npm run lint` (whole project, `--max-warnings 0`): no errors or warnings, exit code 0.
- Playwright e2e, dev servers and the .NET suite were not run.
- Before each commit: `gitleaks git --staged --no-banner --redact` found no leaks. No em or en dash, local path or email was added.

---

_Fixed: 2026-11-10T06:35:00-06:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
