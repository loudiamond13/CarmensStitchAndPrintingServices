---
phase: 14-hardening-release-readiness
created: 2026-11-28T02:25:27-06:00
updated: 2026-11-28T02:25:27-06:00
fixed_at: 2026-11-28T02:25:27-06:00
review_path: .planning/phases/14-hardening-release-readiness/14-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report (wave 1)

*Created: 2026-11-28T02:25:27-06:00 · Updated: 2026-11-28T02:25:27-06:00*

**Fixed at:** 2026-11-28
**Source review:** `.planning/phases/14-hardening-release-readiness/14-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (WR-01 to WR-05, IN-01 to IN-06)
- Fixed: 11
- Skipped: 0

Work ran in the p14 phase worktree on `gsd/phase-14-hardening-release-readiness`, with no extra worktree, so the main checkout was never touched. Each fix has a test that failed first (a doc or script text test, a unit test, or the existing e2e spec for a refactor), except where noted. Only the focused test commands were run, never the full suite. All tests ran in the p14 worktree, after the shared-machine preflight (ports free).

## Fixed Issues

### WR-01: Restore drill dies without a receipt when the backup has no migration history table

**Status:** fixed: requires human verification (the script's restore path has never run live; 14-17 is the first live run)
**Files modified:** `tools/scripts/Restore-BackupDrill.ps1`, `tests/Csps.ArchitectureTests/RestoreDrillScriptTests.cs`
**Commit:** 39ab60e4
**Applied fix:** The three reads after DBCC CHECKDB (server version, table row counts, latest migration id) each sit in their own try and catch. A failure is noted in a list, printed to the console, and the script carries on to the receipt. The receipt has a new "Reads after the restore" row ("All read" or "Failed: ..."), and a failed read sets the "Needs attention" result and exit code 3. Three tests (one per read) failed first. The script parses cleanly in PowerShell; the live restore path was not run.

### WR-02: The "no links" check looks only at the file and the `_local` folder, not folders between them

**Status:** fixed (the refusal path was run for real)
**Files modified:** `tools/scripts/Restore-BackupDrill.ps1`, `tests/Csps.ArchitectureTests/RestoreDrillScriptTests.cs`
**Commit:** 39ab60e4 (same commit as WR-01)
**Applied fix:** After the file check, a loop walks every folder from the `.bak` up to `_local` and refuses if any has the link attribute. I proved it with a throwaway copy of the script in the scratchpad: a `.bak` under a junction folder inside `_local` was refused with the new message (exit 1, before any connection), and a plain subfolder got past the link check. The scratch folders and the junction were removed (the junction first, so nothing outside was touched).

### WR-03: The AllowUnsafeBlocks scan misses the attribute form and a trailing-comment form

**Status:** fixed
**Files modified:** `tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs`
**Commit:** 5c9c5310 (same commit as WR-04)
**Applied fix:** XML comments (also across lines) are removed first, then the element is matched with or without attributes such as `Condition`. New sample rows cover the conditional form, a comment followed by the setting on one line, a multi-line comment, and a commented-out setting that must stay ignored.

### WR-04: The outbound-call scan is narrower than the CWE-918 row that cites it

**Status:** fixed
**Files modified:** `tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs`, `tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs`, `docs/operations/security-review.md`
**Commit:** 5c9c5310
**Applied fix:** The outbound token list gains `UdpClient`, `new Socket(`, `SocketsHttpHandler`, `DelegatingHandler`, `Dns.`, `SmtpClient`, `ImapClient`, `Pop3Client` and `RestClient`. I did not add the bare word `Socket` or `MailKit.Net`, because those match harmless lines (`using System.Net.Sockets;`, `SecureSocketOptions`, the mail error mapper); the tests pin that those lines stay clean. `MailKitTransport.cs` (the only file that creates the SMTP client) is allow-listed. The CWE-918 row now says "the mail host from settings", and a new doc test requires all three targets in that row. The real scan found no other offender. The app's outbound calls are unchanged.

### WR-05: `a11y-manual-passes.md` warns about the wrong lock rule for wrong codes

**Status:** fixed (docs only, the code is unchanged)
**Files modified:** `docs/operations/lockout.md`, `docs/operations/a11y-manual-passes.md`, `docs/operations/audit-log.md`, `docs/operations/security-review.md`, `tests/Csps.ArchitectureTests/OperationsRunbookTests.cs`
**Commit:** 24df057b
**Applied fix:** What the code does (read from `AuthSettings`, `TwoFactorSettings` and `VerifyCodeHandler`):
- Ten wrong codes inside one hour (`AccountFailureCap` 10, `AccountFailureWindow` 1 hour), counted across every sign-in try, pause the account for 15 minutes (`CodeLockoutDuration`). Passwords: five in a row, 15 minutes (`IdentityRegistration`, `PasswordLockoutDuration`).
- One emailed code allows five wrong tries (`CodeAttempts`), then says "This code can't be used anymore" with no pause.

So the 15-minute figure was right, but the count was missing, and the two limits were blurred. The four docs now say "ten wrong codes in an hour ... 15 minutes" in the same words; `lockout.md` has a new row for the used-up code. A new theory test requires that phrase in all four docs. The code and docs/api/auth.md already agreed with each other, so there is no code bug and nothing needs the owner.

### IN-01: `measureRegion` and `settleRegion` repeat the same region lookup

**Status:** fixed
**Files modified:** `web/e2e/deleteOrderDialog.ts`
**Commit:** 4efe0206
**Applied fix:** One page function, `readOverlayRegion`, takes `{ name, settle }`. With `settle` it waits for the region's animations before measuring. Both callers use it, and the name still reaches the page as an `evaluate` argument (the CodeQL fix is kept). No new unit test: this is a behavior-neutral refactor, so the existing `dialog-fit.spec.ts` is the test. It passes on Chromium (11 passed, 3 phone-only cases skipped). Typecheck, ESLint and Prettier are clean. `dialog-scrollbars.spec.ts` is not in the Chromium project, so it was not run; it uses the same helper.

### IN-02: Restore drill receipt row counts come from `sys.partitions`

**Status:** fixed (runbook option)
**Files modified:** `docs/operations/backup-restore.md`, `tests/Csps.ArchitectureTests/RestoreDrillScriptTests.cs`
**Commit:** aa6cd4da
**Applied fix:** I kept `sys.partitions` (the script's test pins it, and it avoids reading user rows) and took the review's runbook option: the "Check it" section now says the counts are catalog counts, exact on a fresh restore but documented as approximate, and that a small Mismatch after a clean CHECKDB is confirmed in the admin first. It also lists the new "Reads after the restore" row. A new runbook test pins both.

### IN-03: A `CHECKDB` error of any kind is recorded as "Failed"

**Status:** fixed
**Files modified:** `tools/scripts/Restore-BackupDrill.ps1`, `tests/Csps.ArchitectureTests/RestoreDrillScriptTests.cs`
**Commit:** 39ab60e4 (same commit as WR-01)
**Applied fix:** The catch around CHECKDB still records "Failed", and now also prints the error text to the console only. It never goes into the receipt. A test pins that.

### IN-04: The invite-token pattern can take trailing punctuation

**Status:** fixed
**Files modified:** `tools/Csps.CiMailbox/OutboxReader.cs`, `tests/Csps.CiMailbox.Tests/OutboxReaderTests.cs`
**Commit:** c0202e64
**Applied fix:** The token now takes only letters, digits and `- . _ ~ %` (what `Uri.EscapeDataString` writes in `AppLinksOptions`), and a final full stop is dropped. Six new rows (brackets, angle brackets, quotes, a sentence end, a comma, a dot inside the token) failed first and pass now; the whole CiMailbox test project passes (56 tests). Note: gitleaks flagged my first version of the test data (a literal link with `token=` and a fake value on one line, rule generic-api-key). I did not bypass it. The test now builds the link from a variable, so no such line exists, and the scan is clean.

### IN-05: `GITHUB_ACTIONS` is a soft gate

**Status:** fixed (comment only)
**Files modified:** `tools/Csps.CiMailbox/CiMailboxTargetGuard.cs`
**Commit:** e325d6bb
**Applied fix:** The doc comment now says the loopback host and the `CSPS_Zap` name are the real gate, and `GITHUB_ACTIONS` only guards against a mistake. The refusal text and the guard's behavior are unchanged. No test (comment only); the CiMailbox tests pass.

### IN-06: `guardViewTransitions` wraps `document.startViewTransition` again on every hot reload

**Status:** fixed
**Files modified:** `web/src/core/routes/viewTransitionGuard.ts`, `web/src/core/routes/viewTransitionGuard.test.ts`
**Commit:** 5fafe4ec
**Applied fix:** In development only (behind `import.meta.env.DEV`), the wrapper keeps the browser's own call as `original`, and a second guard call starts from that instead of from the old wrapper, so wrappers do not stack and the new router decides. A new test (a second guard call with a new router) failed first. Because the code is development-only, the production bundle is unchanged. `npm --prefix web run build:budget` before and after: every row identical, public JS (privacy) 149.90 KB of 150.00 KB. The four `core/routes` test files pass (41 tests). Typecheck, ESLint and Prettier are clean.

## Skipped Issues

None. No finding needed the owner. Nothing here changes UI copy, schema or security posture.

## Notes for the orchestrator and the review pack

- WR-01 and WR-02 change the drill script's logic. The refusal path was run for real in a scratch copy, but the restore, CHECKDB, receipt and `-Drop` paths still have not run. Plan 14-17's first live run, on a small backup, is still the real test.
- Commit grouping: WR-01, WR-02 and IN-03 share one commit (same function and test file), as do WR-03 and WR-04.
- A pre-commit gitleaks run caught a fake-token test line once (IN-04). It was fixed in the test, not bypassed.
- Verification ran in the p14 worktree (not the main checkout). The worktree is clean apart from this report.

---

_Fixed: 2026-11-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
