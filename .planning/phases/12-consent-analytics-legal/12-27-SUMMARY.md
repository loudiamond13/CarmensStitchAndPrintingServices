---
phase: 12-consent-analytics-legal
plan: 27
subsystem: analytics
tags: [visitor-stats, web-vitals, nearest-rank, ef-core, linq, a11y, react, states]
created: "2026-11-18T02:45:00-06:00"
updated: "2026-11-18T02:45:00-06:00"

requires:
  - phase: 12-26
    provides: "VisitorStatsResponse with the ranked lists, StatBarList, DeviceBrowserCard and the list row slot for Page speed"
  - phase: 12-25
    provides: "bucket, trend and the 13-month null handling in the trend line"
  - phase: 12-14
    provides: "the AnalyticsVitalSamples table"
  - phase: 12-04
    provides: "NearestRank.Index, VitalRating.Rate, VitalGrade, VitalMetric"
provides:
  - "SpeedDto(Lcp, Cls, Inp, PageViews, Available) and VitalDto(P75, Rating, Samples) on VisitorStatsResponse.Speed"
  - "IVisitorStatsReader.ReadSpeedAsync(first, last, cut): nearest-rank p75 and sample count per metric (VisitorSpeed, VitalPercentile)"
  - "PageSpeedCard (admin module): three measures in plain words with rating badges, spoken values and the page view line"
  - "Visitor Stats page states: the 13-month Note, the no-visits EmptyState and the stale line after a failed refresh"
affects: [12-28, visitor-stats, component-showcase, ui-review]

actuals:
  tokens: 13800
  tasks: 3
  commits: 6

plan_head_before: 6b3f3745385c7cdc3048521e743df8389ad0ab32
plan_head_after: 51a3cad2e017d46d911cd46b341aefaa45130265

tech-stack:
  added: []
  patterns:
    - "Percentile without SQL: per metric one CountAsync, then OrderBy(Value).ThenBy(Id).Skip(NearestRank.Index(n, 0.75)).FirstOrDefaultAsync"
    - "Rating names on the wire are lower-case words ('good', 'needs-work', 'poor'); the client maps each to a word, tone and icon"
    - "A value shown to the eye is aria-hidden and paired with a visually hidden spoken form ('2.4 s' / '2.4 seconds')"

key-files:
  created:
    - web/src/modules/admin/components/PageSpeedCard.tsx
    - web/src/modules/admin/components/PageSpeedCard.test.tsx
  modified:
    - src/Csps.Application/Analytics/VisitorStatsResponse.cs
    - src/Csps.Application/Analytics/GetVisitorStatsHandler.cs
    - src/Csps.Application/Ports/IVisitorStatsReader.cs
    - src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs
    - tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs
    - tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsEndpointTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/components/visitorStats.recipe.ts
    - web/src/modules/admin/pages/VisitorStatsPage.tsx
    - web/src/modules/admin/pages/VisitorStatsPage.test.tsx
    - web/src/modules/admin/visitorStatsCopy.ts
    - web/src/modules/admin/services/visitorStatsService.ts
    - web/src/modules/admin/services/visitorStatsService.test.ts
    - web/src/modules/admin/routes.test.tsx

key-decisions:
  - "Samples are read only from the later of the range start and the 13-month cut, because samples are deleted with their visits"
  - "A range wholly before the cut answers speed with no figures and available false, whatever the reader returns"
  - "A measure with no sample while others have samples shows EmptyValue with the hidden text 'Not measured' (Safari sends no layout shift score); see open question 1"
  - "The no-visits EmptyState shows when total page views are 0, as the plan says; see open question 2"
  - "The stale line sits under the page subline, as on the Dashboard (P10 D-111), with its own copy in visitorStatsCopy.ts"

patterns-established:
  - "Speed contract: the server sends the percentile, the rating and the sample count; the client only formats and picks the badge look"

requirements-completed: [ANL-08]

coverage:
  - id: D1
    description: "Server page speed: per metric the nearest-rank 75th percentile over samples from the cut on and inside the range, rated by Google's thresholds, page views as the largest sample count, null for a metric with no sample, unavailable for a wholly old range"
    requirement: ANL-08
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs#TheSeventyFifthPercentileIsTheNearestRankSampleInAscendingOrder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs#SamplesAreReadOnlyForDaysInsideTheRangeAndFromTheCutDayOn"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsEndpointTests.cs#PageSpeedIsTheNearestRankSeventyFifthPercentileOfEachMetricWithItsRating"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs#EachVitalIsRatedByGooglesThresholdsAndPageViewsIsTheLargestSampleCount"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs#ARangeWhollyBeforeTheCutHasNoSpeedAndSaysItIsNotAvailable"
        status: pass
    human_judgment: false
  - id: D2
    description: "PageSpeedCard: Loading speed, Layout shifting and Response to taps with Good/Needs work/Poor badges (word and icon), meaning lines, '2.4 s' / '0.30' / '180 ms' with spoken forms, 'From 412 page views' / 'From 1 page view', empty values with no badge, 'No speed data for these dates yet.' and 'Not available for dates over 13 months ago'; zero axe violations in Blush and Espresso"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PageSpeedCard.test.tsx#PageSpeedCard: ratings and values"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/PageSpeedCard.test.tsx#PageSpeedCard: no samples and old ranges"
        status: pass
    human_judgment: false
  - id: D3
    description: "Page states: the 13-month info Note with the cut date, the partial hints and the trend line gap on a crossing range; Not available on a wholly old range; one no-visits EmptyState with real zero KPIs; the first-read ErrorState with Try Again; the stale line after a failed refresh; one loading region; axe in Blush and Espresso"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 ranges over 13 months (D-27)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 states: no visits"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 states: loading and a failed first read"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 states: a failed later refresh (P10 D-111)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The look of the Page speed card and of the page states: badge placement, row spacing, the EmptyState on a card surface, the stale line in the head, in Blush and Espresso at 320 to 1920px"
    verification: []
    human_judgment: true
    rationale: "jsdom checks class names and axe only; real layout, wrapping and contrast need the UI review or a browser"
  - id: D5
    description: "ANL-08 prohibition: no partial or unavailable figure shown as if complete"
    verification: []
    human_judgment: true
    rationale: "The plan flags this prohibition as judgment; the tests cover each case, but the owner should confirm the wording reads honestly"

duration: 77min
completed: 2026-11-18
status: complete
---

# Phase 12 Plan 27: Page speed in plain words, and honest old, empty and failed states Summary

*Created: 2026-11-18T02:45:00-06:00 · Updated: 2026-11-18T02:45:00-06:00*

**The stats answer now carries `speed`: for each Core Web Vital the server reads the nearest-rank 75th percentile of the visitors' samples with two LINQ queries (count, then skip to `NearestRank.Index`) and rates it with `VitalRating`. The new admin-only `PageSpeedCard` shows "Loading speed", "Layout shifting" and "Response to taps" in plain words. The Visitor Stats page now has the 13-month Note, a no-visits EmptyState and the stale line after a failed refresh.**

## Performance

- **Duration:** 77 min
- **Started:** 2026-11-18T07:26:21Z
- **Completed:** 2026-11-18T08:43:42Z
- **Tasks:** 3 (all TDD: RED then GREEN; Task 1 was the tracer)
- **Files modified:** 18 (2 created)

## Accomplishments

- **Server read (`ReadSpeedAsync`):** samples are read for the business days from the later of the range start and the cut, to the range end. For each metric it counts the samples, then reads the value at `NearestRank.Index(n, 0.75)` in ascending order (ties broken by row id). No `PERCENTILE_CONT` and no inline SQL. A metric with no sample is null.
- **Handler:** each percentile is rated by `VitalRating` as `good`, `needs-work` or `poor`. `pageViews` is the largest sample count of the three. A range wholly before the cut answers `{ lcp: null, cls: null, inp: null, pageViews: 0, available: false }`.
- **Answer:** `speed { lcp, cls, inp, pageViews, available }`, each metric `{ p75, rating, samples }` or null. Snapshot and generated types updated. The endpoint test's allowed-name list now includes the eight new names.
- **PageSpeedCard (`modules/admin/components`, SPEC-GAP: PageSpeedCard):** three rows. Each row has the name, the rating `Badge` (Good: success, circle-check; Needs work: warning, triangle-alert; Poor: danger, circle-x), the meaning line, and the value with a hidden spoken form: LCP "2.4 s" ("2.4 seconds"), CLS "0.30" ("score 0.30"), INP "180 ms" ("180 milliseconds"). Under the rows: "From 412 page views" ("From 1 page view" for one), "No speed data for these dates yet." when no measure has a sample, or "Not available for dates over 13 months ago" for an old range. A missing measure is `EmptyValue` with no badge, never 0 or Good.
- **Page:** Page speed sits beside Devices and browsers. When the range starts before the cut, an info `Note` reads "Unique visitors and visits are kept for 13 months. Before Oct 15, 2025, this range shows page views, pages, referrers and devices only." With 0 page views the KPI zeros stay, and one `EmptyState` (chart-column, level 2, no button) "No visits in these dates" replaces the trend, lists and speed. A failed first read keeps its ErrorState with Try Again. A failed later refresh keeps the figures and shows "Showing figures from 9:41 AM. Couldn't refresh." with Try Again (P10 D-111).

## Task Commits

1. **Task 1: page speed from real samples (tracer):** RED `bfec7847`, GREEN `83a57089`. The tracer gate re-ran all three `<verify>` commands on the committed code (reader 24 of 24, endpoint and snapshot 31 of 31, card 12 of 12), then moved on to expansion.
2. **Task 2: old ranges and no speed data:** RED `6bf9bedd`, GREEN `118028f8`.
3. **Task 3: no visits, failed read, failed refresh, loading:** RED `0d8d6e33`, GREEN `51a3cad2`.

## TDD Gate Compliance

| Task | RED | GREEN | RED evidence (`gsd check tdd-red-evidence`) |
|------|-----|-------|----------------------------------------------|
| 1 | bfec7847 | 83a57089 | Six records were `RED_EVIDENCE_OK`. JUnit: reader `TheSeventyFifthPercentileIsTheNearestRankSampleInAscendingOrder` (4 of 24 failed, "Lcp ... but was null"); endpoint `PageSpeedIsTheNearestRank...` (1 of 20, "JsonValueKind.Object but was Null"); handler `EachVitalIsRatedByGooglesThresholds...` (1 of 38). TAP: card "shows "Page speed" with its sub line ...", page "shows "Page speed" beside Devices and browsers ...", service "narrows page speed to plain numbers ...". |
| 2 | 6bf9bedd | 118028f8 | Three records were `RED_EVIDENCE_OK`: handler `ARangeWhollyBeforeTheCutHasNoSpeedAndSaysItIsNotAvailable` (JUnit, 1 of 40 failed, "Available = False but was ..."); card "says "No speed data for these dates yet." ..." (TAP); page "shows the 13-month Note ..." (TAP). |
| 3 | 0d8d6e33 | 51a3cad2 | Two records were `RED_EVIDENCE_OK` (TAP): "keeps the real zero KPIs and shows one "No visits in these dates" EmptyState ..." and "keeps the last figures and shows the stale line with Try Again". |

**Semantic assessment:** each target ran and failed on its planned assertion against a stub. The stubs were a reader that answered no speed, a handler that sent empty speed, a card that drew nothing, a service that did not read speed, and a page with no Note, EmptyState or stale line. None failed on a build, load or fixture fault.
- **Three records needed a first assertion that fails on one line:**
  - The endpoint test first failed on a JSON access, not an assertion. I added `lcp ValueKind is Object` as its first check.
  - The service test's deep-equal diff, and a `waitFor` that dumps the DOM, both broke TAP (`invalid_record`). I added a one-line first assertion, and waited on the request count instead.
  - The behaviour each test checks did not change.
- **Tests that passed during RED (pins):**
  - The reader's "wholly before the cut or no samples" case and the handler's "no samples" case: the stubs already answered nulls.
  - The card's axe cases.
  - Task 3's loading-region test and its first-read ErrorState test: both states existed from 12-23.
- **Records:** in the ignored `TestResults/` folder. They were deleted afterwards because the reports name local paths.

## Verification (quoted)

- `dotnet build Csps.slnx`: "0 Warning(s) 0 Error(s)".
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*GetVisitorStatsHandlerTests"`: total 40, failed 0. Full Application suite: total 3282, failed 0.
- `dotnet test --project tests/Csps.ArchitectureTests`: total 290, failed 0.
- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests"` (LocalDB, `CSPS_TEST_SQL=localdb` for that process only): total 24, failed 0. With `*AnalyticsRetention*`: total 54, failed 0.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*VisitorStatsEndpointTests" --filter-class "*OpenApiSnapshotTests"`: total 31, failed 0. With `*AuthorizationMatrixTests`: total 600, failed 0. No endpoint was added or changed (same route, same policy), so the matrix rows are unchanged.
- The snapshot was written once with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for that one process. Then `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- `dotnet format whitespace --verify-no-changes` on every changed C# file: exit 0.
- `npm --prefix web run test -- --run` on the seven touched web test files (card, page, service, routes, StatBarList, no-long-dash, source-layout): 7 files, 203 tests passed.
- `npm --prefix web run lint`: the first run found 2 errors (`non-nullable-type-assertion-style`) in my new page test. I fixed them; `eslint src/modules/admin --max-warnings 0` then exited 0, and the full lint inside `verify` passed. `npm --prefix web run typecheck`: exit 0.
- **Full web `verify`, first run:** `test:coverage` had 1 failure out of 11428: `GalleryPage.test.tsx` "asks for the lightbox chunk only when a tile is first pressed". Run alone it passed (1 file, 28 tests). This is the known load flake; this plan does not touch the public Gallery.
- **Full web `verify`, second run:** exit 0. 426 files and 11428 tests passed. Coverage over all files: 95.62% statements, 90.33% branches, 97.78% functions, 98.15% lines. typecheck, lint, format:check, build, build:budget, license:check and notices:check all passed.
- **`build:budget` (inside `verify`):** every row is within its limit, and no limit was changed (D-42).

| Measure | Size | Limit | Result |
|---|---|---|---|
| public JS (home) | 147.86 KB | 150.00 KB | ok |
| public JS (products) | 144.57 KB | 150.00 KB | ok |
| public JS (gallery) | 145.91 KB | 150.00 KB | ok |
| public JS (contact) | 149.41 KB | 150.00 KB | ok |
| public JS (privacy) | 149.60 KB | 150.00 KB | ok |
| public JS (cookies) | 149.50 KB | 150.00 KB | ok |
| public JS (terms) | 148.71 KB | 150.00 KB | ok |
| public JS (accessibility) | 148.27 KB | 150.00 KB | ok |
| public JS (notFound) | 140.63 KB | 150.00 KB | ok |
| admin JS | 223.22 KB | 250.00 KB | ok |
| CSS | 20.50 KB | 35.00 KB | ok |

- **Budget notes:**
  - Public rows are the same as at the base: Privacy 149.60 KB, so 0.40 KB is left. Unlike 12-25 and 12-26, there was no 0.02 KB growth.
  - Admin JS went from 223.25 to 223.22 KB.
  - The new UI lives in an admin-only module, and nothing was added to `@/components`.
- **Acceptance greps:**
  - `NearestRank.Index` in the reader: 1.
  - In visitorStatsCopy.ts: "Response to taps" 1, "No speed data for these dates yet." 1, "Unique visitors and visits are kept for 13 months." 1, "No visits in these dates" 1, "Couldn't load the visitor stats." 1.
  - Key links: `circle-x` in PageSpeedCard.tsx 1; `SPEC-GAP: PageSpeedCard` 1.
  - `PERCENTILE_CONT` or raw SQL in the reader: 0.

## Files Created/Modified

- `src/Csps.Application/Analytics/VisitorStatsResponse.cs`: `VitalDto`, `SpeedDto` and `VisitorStatsResponse.Speed`.
- `src/Csps.Application/Ports/IVisitorStatsReader.cs`: `ReadSpeedAsync`, `VisitorSpeed`, `VitalPercentile`.
- `src/Csps.Application/Analytics/GetVisitorStatsHandler.cs`: `Speed`, `Vital`, `RatingName`.
- `src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs`: `ReadSpeedAsync` and `PercentileAsync`.
- `web/src/modules/admin/components/PageSpeedCard.tsx` and its test: the card.
- `visitorStats.recipe.ts` holds the card's looks.
- `web/src/modules/admin/pages/VisitorStatsPage.tsx`: the card slot, the Note, the EmptyState and the stale line. The test harness can now wrap the page in a theme.
- `web/src/modules/admin/visitorStatsCopy.ts`: the Page speed words, the Note, the stale line and the no-visits words.
- `web/src/modules/admin/services/visitorStatsService.ts`: `PageSpeed`, `Vital` and `VitalRatingName`. Each figure is narrowed to a number. An unknown rating or a non-number refuses the whole answer.
- Snapshot and types: `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts`.

## Decisions Made

These are the frontmatter `key-decisions`. Each is an implementation choice inside the plan's contract. The open questions below list the ones you may want to change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files outside the plan's list**
- **Found during:** Task 1.
- **Issue:** speed had to reach the page through the service, and the routes test's fake answer lacked the new field. 12-25 and 12-26 hit the same thing.
- **Fix:** I changed `visitorStatsService.ts` and `visitorStatsService.test.ts` (with tests) and `routes.test.tsx`.
- **Commits:** bfec7847, 83a57089.

**2. [Rule 3 - Blocking] "SkeletonText 5 lines per list"**
- **Found during:** Task 1 (typecheck) and Task 3.
- **Issue:** the shared `SkeletonText` takes 1 to 3 lines only.
- **Fix:** the lists and Page speed keep 3 lines. Widening `SkeletonText` would change a shared component in `@/components`, which the wave notes ask me not to touch. See open question 3.

**3. [Rule 1 - Bug] Mistakes in my own tests**
- A jsdom `> *` selector did not match, so the loading pin now checks the skeleton's `--sk-h` size.
- Lint flagged two `as HTMLElement` casts, now replaced by a null guard.
- **Commit:** 51a3cad2.

---

**Total deviations:** 3 (2 blocking, 1 test bug).
**Impact:** each change was needed to carry the contract or fix a test. There was no scope creep, and no package, schema, endpoint or limit change.

## Open Questions (owner; nothing here was decided for you)

1. **What a screen reader hears for one missing measure.** iPhones send no layout shift score, so a range can have loading speed but no layout shifting. The empty value is read as "Not measured". The wave notes asked for that, but the UI-SPEC does not name it. Options:
   - **(A, recommended)** Keep "Not measured".
   - (B) Use the default "Not set".
   - (C) Show the words "Not measured" on screen instead of the minus icon.
2. **When the no-visits EmptyState shows.** The plan says "page views 0". A visit saved after its day was rolled up (12-18 item 1) could give Visits 1 and Page views 0, and the page would then say "No visits in these dates" under a Visits card that reads 1. Options:
   - **(A, recommended)** Show it only when both page views and visits are 0.
   - (B) Keep the plan's rule (what the code does now).
3. **Skeleton lines.** The plan asks for 5 lines per list; the shared SkeletonText draws at most 3. Options:
   - **(A, recommended)** Keep 3 lines (what the code does).
   - (B) Let SkeletonText draw 5. This touches a shared component and could add bytes to public pages, where Privacy has 0.40 KB left.
4. **Overlap with the 12-26 empty line question.** With no page views, the EmptyState now replaces every list card. So "Most viewed pages" can no longer show its empty line, because its rows come from the same page view counts. The 12-26 question 1 now matters only for the visitor lists ("Where visitors came from", Device, Browser), where the current line is accurate. No change was made.
5. **Page views behind speed.** "From {412} page views" is the largest sample count of the three measures, as the plan says. It counts page views that sent speed figures, not all page views. Recommended: keep it, since the card's sub line already says "Measured on visitors' own phones and computers".

## Issues Encountered

- **Load flake:** `GalleryPage.test.tsx` lightbox test failed once in the first full `verify` and passed alone (28 of 28) and in the second full run. It is already on the flake list.
- **Packages:** none added or bumped. `npm ci` in `web` and `tools/openapi-gen` installed the locked versions only, and no `node_modules` link was used.
- **Line endings:** the C# files were saved with LF in the worktree. Git normalizes them on commit, so the commits are unchanged.
- **REQUIREMENTS.md not touched:** ANL-08 is also declared by 12-28. The orchestrator marks it when that plan is done.
- **Still open from 12-23:** with a custom range, if the business-day call fails, the cards stay loading. Planned for 12-28; not touched here.

## Known Stubs

None. The Component Showcase demos of PageSpeedCard are not in this plan's file list.

## Threat Flags

None. No endpoint, auth path or schema changed. The answer gains only aggregate figures: a percentile, a rating word and a count per metric. No sample, visit or page key is listed (T-12-68). No package was added (T-12-SC).

## User Setup Required

None.

## Next Phase Readiness

- 12-28 (CSV export) can extend `IVisitorStatsReader`, which now has four reads.
- The stale line and the EmptyState are in place, and that plan's own states can follow the same pattern.
- No background shell was left running. The RED records and JUnit reports were deleted.

---
*Phase: 12-consent-analytics-legal*
*Completed: 2026-11-18*

## Self-Check: PASSED

- Files: `web/src/modules/admin/components/PageSpeedCard.tsx` and `PageSpeedCard.test.tsx` were FOUND.
- Commits: bfec7847, 83a57089, 6bf9bedd, 118028f8, 0d8d6e33 and 51a3cad2 were FOUND on HEAD (`git rev-list --count 6b3f3745..HEAD` = 6 before this SUMMARY commit).
- Each RED `test(12-27)` commit comes before its GREEN `feat(12-27)` commit.
