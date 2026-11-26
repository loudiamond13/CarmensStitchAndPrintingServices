---
phase: 13-quote-inquiries
plan: 24
subsystem: testing
tags: [playwright, axe, csp, cls, privacy, ef-migrations, schema-gate, lighthouse]
created: "2026-11-24T02:12:17-06:00"
updated: "2026-11-24T02:12:17-06:00"

requires:
  - phase: 13-quote-inquiries
    provides: "the quote form (13-12, 13-14), the inbox and request page (13-13, 13-17), Turn into Order (13-22), createQuoteRequest (13-15) and the seven Phase 13 migrations"
provides:
  - "CSPS_Dev carries the full Phase 13 schema: seven migrations applied, none pending"
  - "web/e2e/quote-sweep.spec.ts: the @quote sweep of Contact, the inbox, the request pages and the Spam and Delete dialogs in all five projects"
  - "Staff API helpers in testing-api.ts: changeQuoteStatus, addQuoteNote, convertQuoteRequest"
  - "The webkit rate-limit focus failure handed over from W5, fixed in the test (Safari does not focus a button on click)"
  - "quote-nav.spec.ts holds in every project (desktop window for the sidebar, waits for the dashboard before leaving it)"
affects: [13-verify-work, 13-secure-phase, 13-ui-review]

actuals:
  tokens: 6456
  tasks: 2
  commits: 4
plan_head_before: 2eb37c40f8d2489fe57361f8f50acb1bf66fd97a
plan_head_after: 5a66dfe284108f54e7a5cae6c3c04d07ad05c9d1

tech-stack:
  added: []
  patterns:
    - "Sweep collects every width's axe, h1, sideways-scroll and guard finding into one list, so one run shows every problem"
    - "Focus checks press buttons from the keyboard (helpers.ts press), because Safari does not focus a button on click"

key-files:
  created:
    - web/e2e/quote-sweep.spec.ts
  modified:
    - web/e2e/testing-api.ts
    - web/e2e/quote-form.spec.ts
    - web/e2e/quote-nav.spec.ts

key-decisions:
  - "The webkit rate-limit failure was the test, not the app: Safari never focuses a button on a mouse click, so the case now presses Send from the keyboard, as the other focus-return specs do. The check that focus stays on Send is unchanged."
  - "The empty-pill case uses Closed: no spec closes a request and each e2e run starts from a fresh CSPS_E2E."
  - "CLS is asserted where the engine reports layout shifts (Chromium desktop and Pixel); the test fails if Chromium stops reporting them."
  - "The Lighthouse performance miss is recorded as a gap for the owner, not worked around; the gate was not changed."

patterns-established:
  - "Staff-state seeding for sweeps through the real staff API (status, notes, convert) with a fresh Idempotency-Key"

requirements-completed: [INQ-01, INQ-02, INQ-03, INQ-05, INQ-06, INQ-08]

coverage:
  - id: D1
    description: "Every Phase 13 migration applied to CSPS_Dev, none pending; MigrationScriptTests and TriggerInventoryTests pass"
    requirement: INQ-01
    verification:
      - kind: integration
        ref: "dotnet ef migrations list (0 Pending); dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class *MigrationScriptTests --filter-class *TriggerInventoryTests"
        status: pass
    human_judgment: false
  - id: D2
    description: "Contact at rest, with every field error, with a refused photo and after a send: zero axe findings, one h1, no sideways scroll at 320 to 1920 px, no console or CSP finding, CLS under 0.05, beacon path only"
    requirement: INQ-01
    verification:
      - kind: e2e
        ref: "web/e2e/quote-sweep.spec.ts (4 public cases x 5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Inbox (Open, All, empty Closed pill, no-match search), request pages (New with photos and notes, missing photos, Spam, Converted) and the Spam and Delete dialogs in Blush and Espresso pass the same checks; the title has no customer name and the inbox URL holds the name only in q"
    requirement: INQ-05
    verification:
      - kind: e2e
        ref: "web/e2e/quote-sweep.spec.ts (6 staff cases x 5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Lighthouse at or above 95 on mobile for the public pages"
    verification:
      - kind: other
        ref: "npm --prefix web run lighthouse"
        status: fail
    human_judgment: true
    rationale: "Performance scores 0.92 to 0.94 on all four pages in two runs (LCP 2.5 to 3.0 s, report-only under D-29). The same miss is on record since plans 11-36 and 12-24; the owner decides how to treat it."

duration: 2h 15m
completed: 2026-11-24
status: complete
---

# Phase 13 Plan 24: Quote journey schema, accessibility, CSP and layout gate Summary

*Created: 2026-11-24T02:12:17-06:00 · Updated: 2026-11-24T02:12:17-06:00*

**The seven Phase 13 migrations are on CSPS_Dev with none pending. A new `@quote` sweep proves Contact, the inbox, the request pages and both dialogs clean at five widths in all five browser projects (150 of 150 `@quote` tests passed). The webkit focus failure handed over from W5 is fixed. The .NET suite, `verify`, format, OpenAPI types and budgets are green, except two known flakes. Lighthouse still misses the 0.95 performance score, as it has since Phase 11.**

## Performance

- **Duration:** about 2h 15m
- **Started:** about 2026-11-23T23:55-06:00
- **Completed:** 2026-11-24T02:12:17-06:00
- **Tasks:** 2 of 2
- **Files modified:** 4 (1 new)

## Schema gate (Task 1, BLOCKING)

Target confirmed by `dotnet ef dbcontext info`: `Database name: CSPS_Dev`, `Data source: (localdb)\MSSQLLocalDB`.

Before: `dotnet ef migrations list` showed seven Phase 13 migrations `(Pending)`. `dotnet ef database update` printed:

```
Applying migration '20261122221314_AddQuoteRequests'.
Applying migration '20261122233823_AddQuoteRequestPhotos'.
Applying migration '20261123013252_AddQuoteRequestsLock'.
Applying migration '20261123031035_AddQuoteAlertsEmail'.
Applying migration '20261123184951_AddQuoteRequestStatusChanges'.
Applying migration '20261123212018_AddQuoteRequestNotes'.
Applying migration '20261124001102_AddQuoteRequestOrderLink'.
Done.
```

After: `dotnet ef migrations list` ends with the same seven names with no `(Pending)` mark (`grep -c Pending` = 0). `MigrationScriptTests` + `TriggerInventoryTests` (LocalDB): total 8, failed 0, succeeded 8. No schema was added, dropped or renamed. Only CSPS_Dev was migrated by hand; CSPS_E2E was reset by the e2e script's guarded seed.

## Results quoted

| Check | Result |
|---|---|
| `npm --prefix web run e2e -- --grep "@quote"` (final run, committed code) | **150 passed (12.0m)**, 0 failed: chromium 30, firefox 30, webkit 30, pixel 30, iphone 30 |
| Of those, `quote-sweep.spec.ts` | 10 cases x 5 projects, all passed (first run too: 50 of 50) |
| `CSPS_TEST_SQL=localdb dotnet test Csps.slnx` | total 10874, succeeded 10870, failed 2, skipped 2. Both failures are known flakes and passed alone (below) |
| `dotnet format Csps.slnx --verify-no-changes --no-restore` | exit 0 |
| `npm --prefix web run verify` (second run) | exit 0: 454 of 454 test files, 12187 of 12187 tests, coverage, build, build:budget, license and notices all passed. First run: 2 flakes (below) |
| `npm --prefix tools/openapi-gen run check` | "Generated API types match tools/openapi-gen/openapi.v1.json." |
| Budgets (`build`, then `build:budget`) | public JS (contact) 148.26 / 148.32 KB of 150; Quote form 43.82 / 44.39 KB of 45; admin JS 225.11 / 226.10 KB of 250; CSS 20.55 KB of 35; all ok. Chunks: ContactPage 4.27 KB gz, QuoteForm 5.62 KB gz |
| `npm --prefix web run lighthouse` (run 1) | **exit 1**: performance `/` 0.93, `/products` 0.94, `/gallery` 0.92, `/contact` 0.93; accessibility, best-practices, SEO and agentic-browsing 1 everywhere; CLS `/contact` 0.043 (ok), TBT 0 to 22 ms (ok); LCP `/` 2574, `/products` 2560, `/gallery` 3042, `/contact` 2612 ms (report only, D-29) |
| `npm --prefix web run lighthouse` (run 2) | **exit 1**: performance `/` 0.93, `/products` 0.94, `/gallery` 0.94, `/contact` 0.94; the other 16 category scores at 1; LCP 2573 / 2563 / 2731 / 2575 ms |

## Accomplishments

- The Phase 13 schema is live on CSPS_Dev with nothing pending, and the migration script and trigger inventory tests pass.
- `quote-sweep.spec.ts` (`@quote`) checks each state at 320, 390, 820, 1440 and 1920 px for axe (target-size included), exactly one h1 and no sideways scroll, and collects every console, page and CSP finding of the guard per state:
  - Public: Contact at rest (CLS while the form piece loads under 0.05, measured with a buffered PerformanceObserver), every field error (4 invalid fields, focus on Your name, no request sent), a refused photo (one good photo listed, the text file named in the alert), and after a send.
  - Staff, in Blush and Espresso: the inbox on Open, All (searched), the empty Closed pill and a no-match search; request pages New with a photo and a note, with two missing photos, Spam, and Converted (with the Open Order link); the Spam confirm (a request with photos) and the Delete confirm, both opened and cancelled.
  - Privacy: the request page title is exactly "Quote Request · CSPS Admin" and never holds the name; the address never holds the name. Searching from the box puts the name only in `q`, never in the path, hash or another parameter. Every page-view beacon body on /contact is exactly `{"path":"/contact"}`, also after a send, and never holds the typed name or number.
- The `@quote` cases from 13-12 that had run only on chromium now pass in every project.

## Task Commits

1. **Webkit focus fix (handed over from W5)**: `50a280de` (fix)
2. **Task 1: schema gate and the public sweep**: `9be5d59c` (test)
3. **quote-nav fix found by running in every project**: `b9f85cf0` (fix)
4. **Task 2: the staff sweep, privacy checks and API helpers**: `5a66dfe2` (test)

## Files Created/Modified

- `web/e2e/quote-sweep.spec.ts`: the Phase 13 sweep (new).
- `web/e2e/testing-api.ts`: `changeQuoteStatus`, `addQuoteNote`, `convertQuoteRequest` through the staff API with a fresh Idempotency-Key.
- `web/e2e/quote-form.spec.ts`: the rate-limit case presses Send from the keyboard.
- `web/e2e/quote-nav.spec.ts`: a desktop window for the sidebar case, and a wait for the dashboard figures and fonts before leaving the dashboard.

## Decisions Made

See key-decisions in the frontmatter. No owner ruling was needed for these changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Webkit rate-limit focus failure (handed over in deferred-items.md)**
- **Found during:** before Task 1 (handed to this plan).
- **Issue:** on webkit, `@quote the rate limit keeps what the visitor typed` failed `toBeFocused()` on Send with "Received: inactive". Safari does not focus a button on a mouse click, so focus was never on Send. The project already records this in `helpers.ts press` and in several specs.
- **Fix:** the case presses Send from the keyboard (`press(page, send)`). The check that focus stays on Send after the 429 is unchanged; the app was not changed.
- **Verification:** red alone on webkit before; green in all five projects after (and again in the final run).
- **Committed in:** `50a280de`

**2. [Rule 1 - Bug] `quote-nav.spec.ts` "the nav shows the new count" failed in 3 of 5 projects when the `@quote` set first ran everywhere**
- **Found during:** Task 1 verification (first all-project run).
- **Issue:** (a) pixel and iphone: the case looks for the desktop sidebar link, which phones hide ("element(s) not found"). (b) firefox: a console error "downloadable font: download failed ... archivo-latin-ext ... status=2152398850". The trace showed the dashboard asked for the peso-sign font at 06:32:41.642 and the test's own `page.goto('/admin')` started at 41.658, cancelling the download. It failed the same way when run alone (3 of 5), so it is not a flake.
- **Fix:** the case sets a 1280 x 900 window (the phone tab bar has its own 320 px case in the same file). It also waits for the dashboard greeting, no `aria-busy` region in main and `document.fonts.ready` before each navigation away from the dashboard. A first attempt with `waitForLoadState('networkidle')` did not hold on chromium: sign-in moves to the dashboard inside the same document, so that load state had already been reached. It was replaced before commit. No assertion was removed or loosened.
- **Verification:** 10 of 10 over `--repeat-each 2` in all five projects; 30 of 30 per project in the final `@quote` run.
- **Committed in:** `b9f85cf0`

**3. [Plan structure] The plan's two tasks share one spec file**
- The public part was committed first (`9be5d59c`) and the staff part second (`5a66dfe2`), so each task has its own commit.

**Total deviations:** 2 auto-fixed (Rule 1), 1 structural note.
**Impact on plan:** both fixes are test-only and inside Phase 13 files. No app code, schema, package or budget changed.

## Flakes (each passed when re-run alone; for deferred-items.md)

| Seen | Test | What happened | Re-run alone |
|---|---|---|---|
| 2026-11-24, plan 13-24 | `quote-nav.spec.ts` "the dashboard strip shows the new count..." (webkit) | sign-in stuck clicking Verify Code until the 120 s timeout, during a 30-test repeat run | webkit alone, `--repeat-each 3`: 3 of 3 |
| 2026-11-24, plan 13-24 | `TrialImportTests.ADuplicateNumberIsImportedOnceAndThenReportedAsNumberTaken` (LegacyFitCheck) | LocalDB "Connection Timeout Expired" in the post-login phase (14 s) in the full .NET suite | the class alone: 7 of 7 |
| 2026-11-24, plan 13-24 | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` (fifth time) | 500 instead of 204 in the full .NET suite | the class alone: 599 of 599 |
| 2026-11-24, plan 13-24 | `QuoteRequestPage.test.tsx` "deletes with the version, shows Deleting, then opens the inbox..." | the cached request was still defined when checked, in the full vitest run | both files alone, twice: 88 of 88 each; second full verify: 12187 of 12187 |
| 2026-11-24, plan 13-24 | `GalleryPage.test.tsx` "asks for the lightbox chunk only when a tile is first pressed..." (not the known focus case) | "Close viewer" not found in time, in the full vitest run | as above: passed alone twice and in the second full verify |

The known GalleryPage "puts focus back on the tile..." flake did not appear, so it was not changed.

## Issues Encountered

- **Lighthouse gate not green (plan truth not met).** Two runs, all four public pages at performance 0.92 to 0.94 (needs 0.95). Every other category is at 1 and CLS and TBT are within limits. The score is pulled down by LCP of 2.5 to 3.0 s, which is report-only under D-29. The same miss is on record in 11-36 (0.94) and 12-24 (0.91 to 0.94). Before this plan, `/contact` passed in some runs, and it now scores 0.93 and 0.94. The gate was not changed. Owner item below.
- The first run of `npm run e2e` was started with `; echo "exit $?"`, which printed 0 although Playwright failed. The results above are read from the Playwright summary lines, not from that echo.

## Owner items (parked: the owner is away)

**P13-24-1: Lighthouse performance below 0.95 on mobile (all four public pages).**
- **A (built):** the gate stays as it is and keeps failing, recorded here and in 11-36 and 12-24 as a known gap until LCP work is planned.
- **B (alternative):** plan a quick task on LCP for the public pages (the LCP element per page is in `docs/web/budgets.md` from 12-24). The aim is performance at or above 0.95 again, and `/contact` back to the score it had before Phase 13.

No human checkpoint is in this plan; nothing was approved on the owner's behalf.

## User Setup Required

None.

## Next Phase Readiness

- Ready for `/gsd-verify-work 13`: the schema is applied and the `@quote` sweep is green in every project.
- Open: the Lighthouse item above, and the flakes for deferred-items.md.

## Self-Check: PASSED

- FOUND: web/e2e/quote-sweep.spec.ts (`grep -c "@quote"` = 7 lines, 10 tests from the theme loop; `grep -c "toHaveTitle"` = 2; `grep -c "createQuoteRequest"` = 7)
- FOUND: 50a280de, 9be5d59c, b9f85cf0, 5a66dfe2 (all ancestors of HEAD)
- Commits measured: `git rev-list --count 2eb37c40..HEAD` = 4
