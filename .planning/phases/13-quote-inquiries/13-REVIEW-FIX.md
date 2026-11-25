---
phase: 13-quote-inquiries
created: 2026-11-25T09:00:00-06:00
updated: 2026-11-25T09:00:00-06:00
fixed_at: 2026-11-25T09:00:00-06:00
review_path: .planning/phases/13-quote-inquiries/13-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 20
fixed: 18
skipped: 2
status: partial
---

# Phase 13: Code Review Fix Report (whole-phase review)

*Created: 2026-11-25T09:00:00-06:00 · Updated: 2026-11-25T09:00:00-06:00*

Fixes for the Critical and Warning findings of `13-REVIEW.md` (1 critical, 19 warnings). Info findings were not in scope. Three fixers worked on separate files: the .NET backend in its own worktree (merged in `5ee06a9a`), then the web app and the Playwright tests in the main checkout. Their detailed reports, with the red and green evidence for each fix, are:

- `13-REVIEW-FIX-BACKEND.md`
- `13-REVIEW-FIX-WEB.md`
- `13-REVIEW-FIX-E2E.md`

## Outcome per finding

| Finding | Outcome | Commit | Note |
|---|---|---|---|
| G2A-CR-01 | skipped: already fixed | 262c0f15 | Fixed by gap plan 13-27 (G-13-11) |
| G1-WR-01 | fixed: requires human verification | fa72525b | A cut-off photo upload is now queued for removal; changes upload behavior (owner check in the 999.9 backlog) |
| G3-WR-01 | fixed | 5b6d180f | Test only |
| G3-WR-02 | fixed | c3c77ff9 | Test only |
| G4-WR-01 | fixed | 6828ea3f | Test only |
| G4-WR-02 | fixed | 9d0c3c9e | Test only; `TwoCreatesAtOnceAreBothSaved` is gated but cannot prove a race |
| G4-WR-03 | fixed | c5ce3fb5 | Test only |
| G4-WR-04 | fixed | d77451bf | Test only |
| G5-WR-01 | fixed | 684c7e2b | |
| G5-WR-02 | fixed | 6eafc8f7 | |
| G5-WR-03 | fixed | 1513c1d4, 20cc8d3e | Focus moves only while Choose Photos still holds it |
| G6-WR-01 | fixed | 59ba992f | |
| G6-WR-02 | skipped: needs owner decision | none | New error wording; parked as P13-BL-38 |
| G7A-WR-01 | fixed | 3a7b689e | Async timeout 5 s in the jsdom setup |
| G7A-WR-02 | fixed | 7ffb785e | Sending tests hold the create call by hand |
| G7A-WR-03 | fixed | eafc2f46 | |
| G7B-WR-01 | fixed | 89f5331f | |
| G7B-WR-02 | fixed | 155fe9e1 | |
| G7B-WR-03 | fixed | bff55627 | |
| G7B-WR-04 | fixed | ec633a50 | |

## Verification after all fixes

Run by the orchestrator on the merged branch (HEAD f699bf13 plus this report), after preflight showed ports 5180, 5115, 7028 and 5199 free and no other test runs.

- `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors.
- .NET tests, all 0 failed: Domain 2237, Application 3517, Architecture 290, HostProbe 9, LegacyFitCheck 276 (1 skipped), Infrastructure integration 1341 (1 skipped), Server integration 3235 (`CSPS_TEST_SQL=localdb`).
- Web: `npm run lint` (max warnings 0) and `npm run typecheck` clean.
- Web full suite with coverage: 456 files, 12,214 of 12,214 passed, no test needed its retry, coverage thresholds met (statements 95.49, branches 90.17, functions 97.61, lines 98.12; `src/core/api` held at 100 by the threshold).
- Two earlier full runs on the same code failed a different set of tests each time (11, then 5), mostly 5 s per-test timeouts in `OrderFormPage.test.tsx`; every one passed alone. Recorded in `deferred-items.md` with a follow-up.
- Playwright: the fixer ran the changed specs in all 5 projects (quote form and Contact sweep 65 passed; quote request, nav and sweep 90 of 90). The whole e2e suite was not re-run.
