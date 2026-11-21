---
phase: 12-consent-analytics-legal
created: 2026-11-20T21:00:00-06:00
updated: 2026-11-21T09:00:00-06:00
fixed_at: 2026-11-20T21:00:00-06:00
review_path: .planning/phases/12-consent-analytics-legal/12-REVIEW.md
iteration: 1
findings_in_scope: 37
fixed: 36
skipped: 1
status: partial
---

# Phase 12 and 12.1: Code Review Fix Report, second pass (D-81)

*Created: 2026-11-20T21:00:00-06:00 · Updated: 2026-11-21T09:00:00-06:00*

**Source review:** `12-REVIEW.md` (second pass, D-81). Fix scope: all findings, Info included.
**Slice reports:** `12-REVIEW-FIX-R2-BACKEND.md` (19 commits) and `12-REVIEW-FIX-R2-WEB.md` (16 commits). They hold the commit for each finding and the test output. The D-79 fix report this file replaces is in git at `21e4448c`.

## Outcome of every finding

| Finding | Outcome | Note |
|---|---|---|
| R2B-WR-01, R2B-WR-02, R2B-WR-03 | fixed | Backend slice |
| R2B-IN-01 to R2B-IN-07 | fixed | Backend slice |
| G1-IN-01 to G1-IN-04 | fixed | Backend slice. G1-IN-01 raises the beacon body cap from 2048 to 4096 bytes: needs an owner look. |
| G2-IN-01 to G2-IN-04 | fixed | Backend slice |
| G5-IN-02 | fixed | Docs and C# XML in the backend slice; the web comment in the web slice. Contract files regenerated. |
| R2W-WR-01, R2W-WR-02 | fixed | Web slice, one commit. R2W-WR-02 changes how many month labels show: visual check wanted. |
| R2W-WR-03 | fixed | Web slice |
| R2W-IN-01 to R2W-IN-03 | fixed | Web slice |
| R2W-IN-04 | fixed (code part) | `baseURL` from the fixture. The five-engine `@no-cookies` run is a ship check. |
| G3-IN-01 to G3-IN-03, G3-IN-05 | fixed | Web slice. G3-IN-01 disables Export CSV until the dates resolve: a visible change. |
| G4-IN-01 to G4-IN-04 | fixed | Web slice |
| G5-IN-03 | fixed | Web slice |
| G3-IN-04 | fixed | Owner ruling D-82 (2026-11-21): the five quote-request lines come off the Privacy Policy and are held in `PRIVACY_QUOTE_REQUEST_LINES` for Phase 13. Test first: `PrivacyPolicyPage.test.tsx`. The Terms page still mentions quote requests; D-82 does not cover it. |
| G5-IN-01 | skipped: already fixed | `docs/web/e2e.md` already matches the spec. |

## Checks seen

- Backend: `dotnet build --no-incremental` 0 warnings, 0 errors. Domain 2018, Application 3161, Architecture 290 passed. Infrastructure Analytics 45 passed. Server Analytics 82, RateLimiting 86, Http 389, Testing 92, Maintenance 33 passed. OpenAPI snapshot 11 passed. No pending model changes.
- Web: typecheck, lint (`--max-warnings 0`) and Prettier clean. The 23 affected test files passed in the main checkout (1,017 tests).
- D-82 change: Prettier, lint and typecheck clean. `PrivacyPolicyPage.test.tsx` 22 passed. Related tests 384 passed, and `src/test` 308 passed.
- Flake seen once: `LegalPages.test.tsx` "the old Cookie Policy address (D-72) shows the normal page not found" failed in the related run (15 parallel files). It passed alone (19 of 19) and in a full rerun of the related set (384 of 384).

## Not run (ship checks)

- The full Server integration suite and Infrastructure tests outside Analytics.
- Playwright: `@no-cookies` in all five projects, and the edited `@visitor-stats`, `@contact` and `@link-preview` specs.
