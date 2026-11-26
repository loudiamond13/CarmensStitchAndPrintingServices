---
phase: 13-quote-inquiries
created: 2026-11-25T09:00:00-06:00
updated: 2026-11-25T10:50:00-06:00
fixed_at: 2026-11-25T09:00:00-06:00
review_path: .planning/phases/13-quote-inquiries/13-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 20
fixed: 19
skipped: 1
status: partial
---

# Phase 13: Code Review Fix Report (whole-phase review)

*Created: 2026-11-25T09:00:00-06:00 · Updated: 2026-11-25T10:50:00-06:00*

Fixes for the Critical and Warning findings of `13-REVIEW.md` (1 critical, 19 warnings). Info findings were not in scope. Three fixers worked on separate files: the .NET backend in its own worktree (merged in `b91734d4`), then the web app and the Playwright tests in the main checkout. Their detailed reports, with the red and green evidence for each fix, are:

- `13-REVIEW-FIX-BACKEND.md`
- `13-REVIEW-FIX-WEB.md`
- `13-REVIEW-FIX-E2E.md`

## Outcome per finding

| Finding | Outcome | Commit | Note |
|---|---|---|---|
| G2A-CR-01 | skipped: already fixed | e8de223d | Fixed by gap plan 13-27 (G-13-11) |
| G1-WR-01 | fixed: requires human verification | d9766207 | A cut-off photo upload is now queued for removal; changes upload behavior (owner check in the 999.9 backlog) |
| G3-WR-01 | fixed | 25b8dc7e | Test only |
| G3-WR-02 | fixed | 2c65e641 | Test only |
| G4-WR-01 | fixed | 50c3e53b | Test only |
| G4-WR-02 | fixed | c3b7e3fc | Test only; `TwoCreatesAtOnceAreBothSaved` is gated but cannot prove a race |
| G4-WR-03 | fixed | 97e3efae | Test only |
| G4-WR-04 | fixed | 8fcbf6c6 | Test only |
| G5-WR-01 | fixed | 1a0afca9 | |
| G5-WR-02 | fixed | 7a165d66 | |
| G5-WR-03 | fixed | 927a4ac1, 40ce1b49 | Focus moves only while Choose Photos still holds it |
| G6-WR-01 | fixed | 9c22deb9 | |
| G6-WR-02 | fixed | d68f43c1 | Owner wording from ruling D-48 (the first pass missed the ruling) |
| G7A-WR-01 | fixed | 8a589018 | Async timeout 5 s in the jsdom setup |
| G7A-WR-02 | fixed | 4e50549b | Sending tests hold the create call by hand |
| G7A-WR-03 | fixed | f0a624a2 | |
| G7B-WR-01 | fixed | 0eee6e26 | |
| G7B-WR-02 | fixed | 4b52245b | |
| G7B-WR-03 | fixed | 2a9b3a11 | |
| G7B-WR-04 | fixed | 79f337ad | |

## Verification after all fixes

Run by the orchestrator on the merged branch (HEAD 7e58f159 plus this report), after preflight showed ports 5180, 5115, 7028 and 5199 free and no other test runs.

- `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors.
- .NET tests, all 0 failed: Domain 2237, Application 3517, Architecture 290, HostProbe 9, LegacyFitCheck 276 (1 skipped), Infrastructure integration 1341 (1 skipped), Server integration 3235 (`CSPS_TEST_SQL=localdb`).
- Web: `npm run lint` (max warnings 0) and `npm run typecheck` clean.
- Web full suite with coverage: 456 files, 12,214 of 12,214 passed, no test needed its retry, coverage thresholds met (statements 95.49, branches 90.17, functions 97.61, lines 98.12; `src/core/api` held at 100 by the threshold).
- Two earlier full runs on the same code failed a different set of tests each time (11, then 5), mostly 5 s per-test timeouts in `OrderFormPage.test.tsx`; every one passed alone. Recorded in `deferred-items.md` with a follow-up.
- Playwright: the fixer ran the changed specs in all 5 projects (quote form and Contact sweep 65 passed; quote request, nav and sweep 90 of 90). The whole e2e suite was not re-run.
