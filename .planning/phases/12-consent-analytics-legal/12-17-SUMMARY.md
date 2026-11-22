---
phase: 12-consent-analytics-legal
plan: 17
subsystem: api
tags: [analytics, consent, privacy, clear-data, rate-limit, idor, react, confirm-dialog, anonymous-endpoint]
created: "2026-11-17T10:30:00-06:00"
updated: "2026-11-17T10:30:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-08 ConsentRecord.Decide, ConsentSource.Clear, IConsentRecords, ConsentOutcome, AnalyticsCookies.SetConsent and ExpireVisitor; 12-14 IAnalyticsVisits, AnalyticsVisits, VisitorKey.HashVisitor; 12-10 AnalyticsController and the rate-limit pattern; 12-13 CookieSettingsDialog, CONSENT_COPY, the consent store"
provides:
  - "POST /api/v1/analytics/clear (ClearVisitorData): anonymous, anti-CSRF header, own analytics-clear limit, idempotency exempt, always 200 ConsentDecisionResponse"
  - "ClearVisitorDataHandler and ClearCallContext; IAnalyticsVisits.DeleteForVisitorAsync (one ExecuteDelete by VisitorHash, cascade to page views and samples)"
  - "RateLimitPolicies.AnalyticsClear, AnalyticsClearRateLimit (RateLimits:AnalyticsClear, 5 a minute) and its own 429 detail"
  - "consentService.clear, consentStore.clearData (server first, then browser storage), ClearDataDialog (CS2), the Clear section in CS1"
affects: [12-18, 12-24, 12-25]

actuals:
  tokens: 25800
  tasks: 3
  commits: 4
plan_head_before: 52b60601acb82dd22565b4a1dea440424ec4a51b
plan_head_after: 11ea09970e77f5388b3fa77d907f65c15b179cda
commits: 4

tech-stack:
  added: []
  patterns:
    - "A destructive anonymous call is selected only by an HttpOnly cookie, never by an id in the URL or body, and answers the same either way"
    - "Per-policy 429 detail in the rate-limit rejection writer"
    - "Browser state is cleared only after the server answers 2xx"

key-files:
  created:
    - src/Csps.Application/Analytics/ClearVisitorDataHandler.cs
    - tests/Csps.Application.UnitTests/Analytics/ClearVisitorDataHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Analytics/AnalyticsClearTests.cs
    - web/src/modules/public/components/ClearDataDialog.tsx
    - web/src/modules/public/components/ClearDataDialog.test.tsx
  modified:
    - src/Csps.Application/Ports/IAnalyticsVisits.cs
    - src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs
    - src/Csps.Server/Controllers/AnalyticsController.cs
    - src/Csps.Server/Security/RateLimitSettings.cs
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - src/Csps.Server/Composition/AnalyticsApplicationRegistration.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsVisitsTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/playwright.config.ts
    - web/src/modules/public/services/consentService.ts
    - web/src/modules/public/hooks/useConsent.ts
    - web/src/modules/public/consentCopy.ts
    - web/src/modules/public/components/CookieSettingsDialog.tsx
    - web/src/modules/public/components/consent.recipe.ts

key-decisions:
  - "Clear always expires the visitor id cookie and always logs a reset decision, even with no cookie or nothing to delete, so the answer never tells a caller whether anything existed (CWE-639)"
  - "The 429 line 'Too many tries. Wait a minute and try again.' is a client constant equal to the server's detail; the store only reports 'rate-limited' for any 429"
  - "ClearDataDialog is a sibling of the CS1 Modal, not inside it, so the fixed layer is not held by the window's own box"
  - "clearData lives in useConsent.ts (about 0.28 KB gzip in the first download); the heavy parts (service, dialog) stay in lazy chunks"

requirements-completed: [ANL-04]

coverage:
  - id: D1
    description: "Server Clear deletes only the cookie holder's visits, page views and samples; expires only the visitor id cookie with its own path; logs a reset decision; sets the consent cookie; leaves daily counts, staff marker, refresh cookie and other visitors alone"
    requirement: "ANL-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Analytics/AnalyticsClearTests.cs (10 tests)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/ClearVisitorDataHandlerTests.cs (8 tests)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsVisitsTests.cs#DeletingAVisitor*"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clear endpoint is covered by the authorization matrix, the idempotency allow-list, the OpenAPI snapshot and the clear rate limit (sixth call in a minute is a 429 with its own message)"
    requirement: "ANL-04"
    verification:
      - kind: integration
        ref: "AuthorizationMatrixTests, AuthorizationCoverageTests, IdempotencyCoverageTests, OpenApiSnapshotTests, AnalyticsRateLimitTests (630 tests in the six classes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Browser: server call first, then storage cleared and the consent cookie kept; failure and 429 change nothing; CS1 Clear section, CS2 dialog, Done note, focus rules"
    requirement: "ANL-04"
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/useConsent.test.tsx#clearData; ClearDataDialog.test.tsx; CookieSettingsDialog.test.tsx#Clear my cookies & data; consentService.test.ts#consentService.clear"
        status: pass
    human_judgment: false
  - id: D4
    description: "Look of the Clear section and CS2 at real phone widths, and the 44px stacked buttons at 320px in a real browser"
    requirement: "ANL-04"
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout; the 320px test checks the wrap and fill classes and the h-11 button height only. Plan 12-24 repeats it in Playwright."

duration: 55min
completed: 2026-11-17
---

# Phase 12 Plan 17: Clear my cookies and data Summary

**A visitor can press "Clear My Cookies & Data" in Cookie Settings: the server deletes the visit rows tied to their HttpOnly visitor id (by hash, cascade to page views and speed samples), expires only that cookie, logs a stats-off map-off reset decision and sets the consent cookie; only after that 2xx does the browser clear its own storage.**

## Performance

- **Duration:** about 55 min
- **Tasks:** 3 (Task 3 was folded into Tasks 1 and 2, see Deviations)
- **Files modified:** 28 (5 created)
- **Commits:** 4 (RED server, GREEN server, RED web, GREEN web)

## Accomplishments

- Server: `POST /api/v1/analytics/clear` with the handler, store delete, rate limit, snapshot, generated types, matrix row, allow-list entry and idempotency entry. No id in the URL or body (a body is ignored; a test sends another visitor's id in the body and it is not used).
- Web: `consentService.clear`, `clearData` in the store, `ClearDataDialog` (CS2), the Clear section in CS1, copy from the UI-SPEC word for word.
- Public JS budget kept: tightest row is Privacy at 149.06 KB of 150 KB (was 148.78 KB before this plan).

## Task Commits

1. **Task 1: server clear** - RED `42d00c41` (test), GREEN `83c4c7d0` (feat)
2. **Task 2: Clear section and confirmation** - RED `77b5bc5e` (test), GREEN `11ea0997` (feat)
3. **Task 3: failed or throttled clear** - its tests are in the Task 1 and Task 2 commits (see Deviations)

**Plan metadata:** the docs commit that adds this file.

## TDD evidence

### RED (what failed and why)

- Handler (`ClearVisitorDataHandlerTests`), stubs throwing `NotImplementedException` so the tests compile: `total: 8, failed: 8, succeeded: 0`. Semantic assessment: every test reached the handler and failed because the behavior is not there (not a syntax or load fault).
- Store (`AnalyticsVisitsTests`): `total: 17, failed: 2, succeeded: 15`; the two new delete tests failed on the stub.
- Server (`AnalyticsClearTests`, matrix, coverage, idempotency coverage): `total: 601, failed: 16, succeeded: 585`; the endpoint did not exist (404), the matrix and the two coverage tests flagged the missing row and entry.
- Rate limit tests (`AnalyticsRateLimitTests`): seen failing as a build error (`error CS0103: The name 'AnalyticsClearRateLimit' does not exist in the current context`, `error CS0117: 'RateLimitPolicies' does not contain a definition for 'AnalyticsClear'`), committed together with the GREEN code so no commit leaves the test project uncompiled. This is an INVALID_RED by the strict classifier (build failure); recorded honestly.
- Web: `Tests  14 failed | 72 passed (86)` plus `ClearDataDialog.test.tsx` failing to load (module missing). `consentService.clear is not a function`, `clearData` missing, no Clear section.

### GREEN

- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ClearVisitorDataHandlerTests"`: `total: 8, failed: 0, succeeded: 8`.
- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AnalyticsVisitsTests"`: `total: 17, failed: 0, succeeded: 17`.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AnalyticsClearTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests" --filter-class "*IdempotencyCoverageTests" --filter-class "*OpenApiSnapshotTests" --filter-class "*AnalyticsRateLimitTests"`: `total: 630, failed: 0, succeeded: 630` (final run, after the commits).
- Whole Application unit project: `total: 3219, failed: 0`. Architecture tests: `total: 290, failed: 0`.
- Web: `consentService.test.ts`, `useConsent.test.tsx`, `ClearDataDialog.test.tsx`, `CookieSettingsDialog.test.tsx`, `no-long-dash.node.test.ts`, `source-layout.node.test.ts`: `Test Files 6 passed (6), Tests 105 passed (105)`.
- `npm --prefix web run typecheck`: no output, exit 0. `npm --prefix web run lint` (`--max-warnings 0`): no output, exit 0. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."

### Acceptance greps

All pass: allow-list entry 1, `DeleteForVisitorAsync` in `AnalyticsVisits.cs` 1, `ClearVisitorData` in `api.generated.ts` 2, `Keep My Data` in `consentCopy.ts` 1, `localStorage.clear()` in `useConsent.ts` 1, `cancelLabel` in `ClearDataDialog.tsx` 1, the 429 line in `RateLimitingRegistration.cs` 1, `RateLimits__AnalyticsClear__PermitLimit` in `playwright.config.ts` 1.

## Public JS budget (D-42), `npm --prefix web run build:budget` (exit 0), gzip KB, limit 150

| Page | KB |
|---|---|
| home | 147.52 |
| products | 144.22 |
| gallery | 145.57 |
| contact | 147.59 |
| privacy | 149.06 |
| cookies | 146.99 |
| terms | 148.17 |
| accessibility | 147.73 |
| notFound | 140.29 |
| admin JS | 220.31 (limit 250) |
| CSS | 20.42 (limit 35) |

The limit was not touched. Privacy is the tightest at 0.94 KB of room. This plan added about 0.28 KB to the entry (the `clearData` action and its helpers in `useConsent.ts`); the service call, the dialog and the Clear section load only with CS1. **Warning for the merge:** sibling plans 12-16 and 12-19 also add to public pages, so the combined result must be rebuilt with `build:budget` after the wave is merged. If Privacy goes over, the cheapest fix is to move `clearData` into a lazy module (the criterion `grep -c "localStorage.clear()" useConsent.ts` would then need the owner's plan edit).

## Decisions Made

- Clear always answers 200 with the same cookies, with or without a visitor cookie (CWE-639, T-12-47).
- A malformed visitor cookie value is treated as no cookie (`AnalyticsCookies.IsVisitorId`), so it never reaches the hash.
- The wait-a-minute line is a client constant that equals the server's text; any 429 maps to it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test host default limit for the new policy**
- **Found during:** Task 1
- **Issue:** `tests/Csps.Testing/CspsApiFactory.cs` sets every limit to 100000 so suites never throttle themselves, and `RealLimitsFactory.cs` restores the real numbers. The new policy (5 a minute) would have throttled the matrix and other suites, and the real-limit test needed the 5.
- **Fix:** added `RateLimits:AnalyticsClear:PermitLimit` to both factories. These two files are not in the plan's `files_modified`.
- **Files modified:** `tests/Csps.Testing/CspsApiFactory.cs`, `tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs`
- **Commit:** `83c4c7d0`

**2. [Rule 3 - Blocking] Existing store tests need the new service method**
- **Found during:** Task 2 (`tsc`)
- **Issue:** `ConsentService` now has `clear`, so the six `loadService` doubles in `useConsent.test.tsx` that returned `{ record }` no longer type-check.
- **Fix:** added `clear: unusedClear` to each double.
- **Commit:** `11ea0997`

**3. Task order [Plan structure]**
- The plan puts the rate-limit rule class, the 429 detail and the Playwright line in Task 3, but the controller attribute needs `RateLimitPolicies.AnalyticsClear` to compile, so they went into Task 1 (as the Task 1 action text itself lists). Task 3's web tests (failure keeps storage, 429 line, pending state, 320px classes, axe in open, pending and failed states) were written with the Task 2 RED tests because they share the files. Task 3 therefore has no commits of its own.
- The server-side RED step used compile-only stubs (handler and store delete throw `NotImplementedException`) so the first RED run reached assertions instead of a build error.

**Total deviations:** 2 auto-fixed (Rule 3), 1 structural. **Impact:** none on behavior.

### Test flakes (recorded, not hidden)

- `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` failed twice with `GET /api/v1/orders` answering 500 for the Admin caller (once inside the six-class run, once run alone), then passed alone, and passed inside the final six-class run (630 of 630). The failing call is not Clear. Other agents were using LocalDB and CPU at the time. Not investigated further; worth watching.
- `PublicLayout.test.tsx` (2), `ProductsPage.test.tsx` (1) and `GalleryPage.test.tsx` (2) failed once in a broad `src/modules/public src/layouts` run while `dotnet test` ran at the same time (MSW and 5 s timeouts); the three files passed alone: `Test Files 3 passed (3), Tests 113 passed (113)`.

## Known Stubs

- `NON_ESSENTIAL_COOKIES` in `web/src/modules/public/hooks/useConsent.ts` is an empty list on purpose (the plan says "a today empty list"; the map's cookies are Google's and cannot be expired from this site). It does not block the plan's goal. No WINDOWS.md entry was added.

## Authentication Gates

None.

## Threat Flags

None beyond the plan's threat model (T-12-47 to T-12-50 are all mitigated and tested: no id in the request, the CSRF header, the 5 a minute limit, and one cookie expired by name and path with the refresh cookie, staff marker and another visitor's rows proven untouched).

## Open items for the owner or later plans

- **Plan 12-24 (Playwright):** repeat the 320px check in a real browser. The jsdom test here only checks classes.
- **Merge order:** re-run `build:budget` after the wave merge (see the budget section).
- **Cookie Policy text (plan 12-19):** the policy says a staff member's admin theme and orders view reset on a clear (D-41); `localStorage.clear()` does that, so the text and the behavior agree.

## Self-Check

Files checked on disk: the five created files and `.planning/phases/12-consent-analytics-legal/12-17-SUMMARY.md`. Commits `42d00c41`, `83c4c7d0`, `77b5bc5e`, `11ea0997` are ancestors of HEAD.

## Self-Check: PASSED
