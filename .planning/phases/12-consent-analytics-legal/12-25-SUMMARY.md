---
phase: 12-consent-analytics-legal
plan: 25
subsystem: analytics
tags: [visitor-stats, trend, svg-chart, ef-core, linq, a11y, keyboard]
created: "2026-11-17T22:40:19-06:00"
updated: "2026-11-17T22:40:19-06:00"

requires:
  - phase: 12-21
    provides: "GetVisitorStatsHandler, VisitorStatsResponse, IVisitorStatsReader, VisitorStatsReader (totals)"
  - phase: 12-23
    provides: "VisitorStatsPage, VISITOR_STATS_COPY, visitorStatsService, the query hook"
  - phase: 12-04
    provides: "StatsBucket.For, StatsBucketKind"
provides:
  - "VisitorStatsResponse.Bucket ('day' | 'month') and Trend (TrendBucketDto: start, pageViews, uniqueVisitors)"
  - "IVisitorStatsReader.ReadTrendAsync(first, last, cut, bucket): sparse per-day or per-month counts"
  - "VisitorTrendChart (exported from @/components), TrendPoint, TrendBucketSize, VISITOR_TREND_COPY"
  - "VisitorTrendCard ('Visits over time', 'Per day' / 'Per month') on the Visitor Stats page"
affects: [12-26, 12-27, 12-28, visitor-stats, component-showcase]

actuals:
  tokens: 14900
  tasks: 3
  commits: 7

plan_head_before: fcbfcfda7664868e328da172c9b7b0796a2f7267
plan_head_after: b252a93b0d7ee7f0cdd0a1c56db8a04aefe50f23

tech-stack:
  added: []
  patterns:
    - "The reader returns only buckets with data; the handler fills every day or month of the range with zeros and applies the 13-month null rule"
    - "Month buckets are grouped by DateOnly Year and Month in LINQ (EF translates them on SQL Server); unique visitors are a distinct count per bucket, never a sum"
    - "One-tab-stop SVG chart: role group on the svg, arrow keys move an active index, a polite live text reads the tooltip rows"

key-files:
  created:
    - web/src/components/data/VisitorTrendChart.tsx
    - web/src/components/data/VisitorTrendChart.test.tsx
    - web/src/modules/admin/components/VisitorTrendCard.tsx
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
    - web/src/components/data/index.ts
    - web/src/components/data/copy.ts
    - web/src/components/data/data.recipe.ts
    - web/src/components/index.test.ts
    - web/src/modules/admin/pages/VisitorStatsPage.tsx
    - web/src/modules/admin/pages/VisitorStatsPage.test.tsx
    - web/src/modules/admin/visitorStatsCopy.ts
    - web/src/modules/admin/components/visitorStats.recipe.ts
    - web/src/modules/admin/services/visitorStatsService.ts
    - web/src/modules/admin/services/visitorStatsService.test.ts
    - web/src/modules/admin/routes.test.tsx

key-decisions:
  - "A month bucket starts on the range's first day when the range starts mid-month; later months start on the 1st"
  - "A bucket is null for unique visitors only when its last day inside the range is before the cut; a bucket that crosses the cut keeps the count from the cut"
  - "Day labels keep at least 44px apart (month labels 28px, every other under 28px as D-51), so labels never overlap (open question 2)"
  - "An odd axis top under 10 is raised by one, so the middle tick is a whole count (open question 3)"
  - "Focus starts on the first (oldest) bucket (open question 4)"

patterns-established:
  - "Trend contract: the server sends every bucket, oldest first, with real zeros and null only for D-27"

requirements-completed: [ANL-08]

coverage:
  - id: D1
    description: "The stats answer has bucket 'day' and one trend entry per day for ranges of 62 days or fewer, zeros for empty days"
    requirement: ANL-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsEndpointTests.cs#TheLastThirtyDaysAnswerOneDayBucketPerDayWithZerosForEmptyDays"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs#ADayTrendHasEachDaysPageViewsAndDistinctVisitorsAndOnlyDaysWithData"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs#ADayRangeHasOneBucketPerDayWithTheStoreCountsOnTheirDaysAndZerosElsewhere"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ranges over 62 days are month buckets; unique visitors are a distinct count per month; buckets wholly before the 13-month cut are null; a crossing bucket counts from the cut"
    requirement: ANL-08
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs#AMonthTrendSumsPageViewsPerMonthAndCountsAVisitorOnTwoDaysOfAMonthOnce"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs#MonthsWhollyBeforeTheCutHaveNoUniqueVisitorsAndKeepTheirPageViews"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs#A365DayRangeIsThirteenMonthBucketsAndTheFirstStartsOnTheRangeStart"
        status: pass
    human_judgment: false
  - id: D3
    description: "VisitorTrendChart draws page-view bars, the unique-visitor line with halo and points (broken at null), three count ticks, day or month labels thinned on narrow frames, and the legend"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/components/data/VisitorTrendChart.test.tsx#VisitorTrendChart: 30 day buckets"
        status: pass
      - kind: unit
        ref: "web/src/components/data/VisitorTrendChart.test.tsx#VisitorTrendChart: month buckets and the 13-month line"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Trend card on the page says 'Visits over time' with 'Per day' or 'Per month' and shows the chart"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 the Trend card"
        status: pass
    human_judgment: false
  - id: D5
    description: "Keyboard: one tab stop, arrows, Home, End, Escape; tooltip follows focus and pointer; a polite live text reads each bucket"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/components/data/VisitorTrendChart.test.tsx#VisitorTrendChart: keyboard and tooltip (SPEC-DEVIATION A11Y-CHART)"
        status: pass
    human_judgment: true
    rationale: "jsdom proves focus, keys and the live text; how NVDA, VoiceOver and TalkBack read a focusable SVG group with a live region needs a person with a screen reader"
  - id: D6
    description: "The chart's look: colours, halo, bar width, label spacing and tooltip placement in Blush and Espresso at 320 to 1920px"
    verification: []
    human_judgment: true
    rationale: "No parity or screenshot test covers the new chart; the look needs the UI review"

duration: 54min
completed: 2026-11-17
status: complete
---

# Phase 12 Plan 25: Visits over time (trend chart) Summary

*Created: 2026-11-17T22:40:19-06:00 · Updated: 2026-11-17T22:40:19-06:00*

**The stats answer now carries a per-day (up to 62 days) or per-month trend of page views and unique visitors, built with LINQ on the server, and the Visitor Stats page draws it as a hand-rolled SVG bar-and-line chart that is one tab stop with arrow keys.**

## Performance

- **Duration:** 54 min
- **Started:** 2026-11-18T03:46:05Z
- **Completed:** 2026-11-18T04:40:19Z
- **Tasks:** 3 (all TDD: RED then GREEN)
- **Files modified:** 22 (3 created)

## Accomplishments

- **Server:** `GetVisitorStatsHandler` picks the bucket with `StatsBucket.For`, asks `ReadTrendAsync` for the buckets that have data, and fills every day or month of the range. Empty buckets are real zeros. A bucket whose last day in the range is before the 13-month cut has `uniqueVisitors: null`. A bucket that crosses the cut counts from the cut.
- **Reader:** page views are summed from `DailyPageCounts`. Unique visitors are `Select(VisitorHash).Distinct().Count()` per bucket, from the cut on. Month buckets group by `BusinessDay.Year` and `BusinessDay.Month`. EF translated both on SQL Server, so research assumption A4 is confirmed by the reader tests.
- **Chart (`VisitorTrendChart`, exported from `@/components`):** it uses the IncomeExpenseChart geometry (52/28/12 margins, 220 high, `fitWidth` through ResizeObserver) and the data.recipe looks:
  - page-view bars in `--chart-income` with 4px rounded tops;
  - the unique-visitor line in `--chart-expense` with the surface halo and points, broken at null buckets (no point there, no zero);
  - three gridlines with count ticks;
  - "Nov 3" or "Oct" labels, thinned on narrow frames;
  - the legend;
  - a tooltip with the full date and both counts, or "Unique visitors: not available".
- **Keyboard (SPEC-DEVIATION A11Y-CHART):** the plot is one tab stop (`role="group"`, named "Page views and unique visitors, Oct 17 to Nov 15, 2026"). Left and Right move between buckets, and Home and End jump to the ends. The tooltip follows focus and the pointer. Escape and blur hide it. A polite live text reads the same rows as the tooltip.
- **Page:** `VisitorTrendCard` ("Visits over time", sub "Per day" or "Per month") sits under the KPI row in the same `LoadingRegion`. It shows a 220px skeleton until the first answer, and its chart body dims (by colour only) while a new range loads.

## Task Commits

1. **Task 1: day trend (tracer):** RED `e4e87625`, GREEN `750be5c3`. The tracer gate re-ran all three `<verify>` commands, which passed, then moved on to expansion.
2. **Task 2: month buckets and the 13-month line:** RED `4785a603`, GREEN `b426e69f`
3. **Task 3: keyboard and tooltip:** RED `2e0989d8`, GREEN `9a8e6c47`
4. **Fix found by the full web run:** `b252a93b` (routes test fixture)

## TDD Gate Compliance

| Task | RED | GREEN | RED evidence (`gsd check tdd-red-evidence`) |
|------|-----|-------|----------------------------------------------|
| 1 | e4e87625 | 750be5c3 | All four were `RED_EVIDENCE_OK`: (1) handler `ADayRangeHasOneBucketPerDay...`, "result.Value.Bucket should be "day" but was """; (2) reader `ADayTrendHasEachDaysPageViews...` (JUnit); (3) endpoint `TheLastThirtyDaysAnswerOneDayBucketPerDay...`, "bucket should be "day" but was """; (4) chart `draws one bucket per day...` (TAP), "expected [] to have a length of 30 but got +0". |
| 2 | 4785a603 | b426e69f | Both were `RED_EVIDENCE_OK`: (1) handler `MonthsWhollyBeforeTheCut...`, "trend.Count should be 35 but was 1050" (day buckets); (2) reader `AMonthTrendSumsPageViewsPerMonth...`; and chart `breaks the line into one run...` (TAP), "expected [ 'M' ] to have a length of 2 but got 1". |
| 3 | 2e0989d8 | 9a8e6c47 | `RED_EVIDENCE_OK`: chart `is one tab stop...` (TAP), "expected to have a length of 1 but got +0" (no tabindex yet). |

**Semantic assessment:** each target ran and failed on its planned assertion against a stub. The stubs were an empty trend, an empty bucket string, a figure with no drawing, and no keyboard handling. None failed on a build, load or fixture fault.
- **How the .NET evidence was captured:** xunit.v3 `--report-xunit-junit` reports with full `Namespace.Class.Method` target names.
- **How the web evidence was captured:** single-test vitest `tap-flat` runs. A multi-test TAP run is rejected ("Non-TAP data") because of DOM dumps, the same as in 12-23.
- **Where the records are:** they were written to the ignored `TestResults/` folder and deleted afterwards, because the JUnit reports name the machine.
- **Tests that passed during RED:**
  - In Task 2, "stops the line ... no point and no zero" and "draws nothing for the line ..." already passed, because Task 1 already skipped null points.
  - In Task 3, "hides the tooltip when the plot loses focus" and the axe case passed trivially, because the stub had no tooltip.
  - The "Per month" page case was added in the Task 2 GREEN commit as a pin, since the card already had that logic.

## Verification (quoted)

- `dotnet build`: "0 Warning(s) 0 Error(s)".
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*GetVisitorStatsHandlerTests"`: total 26, failed 0. The full Application suite: total 3268, failed 0.
- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests"` (LocalDB, `CSPS_TEST_SQL=localdb` for that process only): total 13, failed 0.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*VisitorStatsEndpointTests" --filter-class "*OpenApiSnapshotTests"`: total 28, failed 0.
- `dotnet test --project tests/Csps.ArchitectureTests`: total 290, failed 0.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- `npm --prefix web run test -- --run src/components/data/VisitorTrendChart.test.tsx src/modules/admin/pages/VisitorStatsPage.test.tsx src/components/index.test.ts`: 3 files, 114 tests passed (before Task 2 and 3 were added). After Task 3, `VisitorTrendChart.test.tsx` plus `src/test/no-long-dash.node.test.ts`: 24 passed.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0. `npm --prefix web run typecheck`: exit 0. `prettier --check src`: "All matched files use Prettier code style!"
- **Full web run** (`npm --prefix web run test -- --run`): 10 failed and 11341 passed in 424 files. How each failure was handled:
  - `routes.test.tsx` (1) was a real failure caused by this plan. It is fixed in `b252a93b`.
  - PublicLayout (3), EditUserPanel (1), OrderFormPage (2) and GalleryPage (2) passed when re-run alone: 3 files and 231 tests passed, then 2 files and 112 tests passed. They are recorded as load flakes below.
  - `scripts/third-party-notices.test.ts` (1) fails alone too, and that is environmental (see Issues).
- `npm --prefix web run build:budget`: exit 0. Every row is within its limit, and no limit was changed (D-42):

| Measure | Size | Limit | Result |
|---|---|---|---|
| public JS (home) | 147.84 KB | 150.00 KB | ok |
| public JS (products) | 144.55 KB | 150.00 KB | ok |
| public JS (gallery) | 145.89 KB | 150.00 KB | ok |
| public JS (contact) | 149.38 KB | 150.00 KB | ok |
| public JS (privacy) | 149.58 KB | 150.00 KB | ok |
| public JS (cookies) | 149.48 KB | 150.00 KB | ok |
| public JS (terms) | 148.69 KB | 150.00 KB | ok |
| public JS (accessibility) | 148.25 KB | 150.00 KB | ok |
| public JS (notFound) | 140.61 KB | 150.00 KB | ok |
| admin JS | 223.21 KB | 250.00 KB | ok |
| CSS | 20.49 KB | 35.00 KB | ok |

**Where the chart lands in the bundle:**
- The chart code ("Unique visitors: not available", `stroke-chart-expense`) is only in one shared admin chunk.
- Every chunk that imports that chunk is an admin page, the admin `routes` chunk or `devRoutes`.
- No public page chunk (Home, Contact, Gallery, Privacy, Cookies, Terms, the legal loaders, the consent dialog) imports it, and neither does the entry.
- Public pages grew by 0.02 KB each. Privacy is now 149.58 KB, leaving 0.42 KB. CSS grew 0.04 KB from the new utility classes.

## Files Created/Modified

- `src/Csps.Application/Analytics/VisitorStatsResponse.cs`: `TrendBucketDto`, `Bucket`, `Trend`.
- `src/Csps.Application/Ports/IVisitorStatsReader.cs`: `ReadTrendAsync`, `TrendCount`.
- `src/Csps.Application/Analytics/GetVisitorStatsHandler.cs`: bucket choice, fill and the D-27 null rule.
- `src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs`: per-day and per-month LINQ aggregates.
- `web/src/components/data/VisitorTrendChart.tsx`: the chart. `copy.ts` has `VISITOR_TREND_COPY`, and `data.recipe.ts` has the line, point and swatch looks.
- `web/src/modules/admin/components/VisitorTrendCard.tsx`: the card. `VisitorStatsPage.tsx` mounts it, `visitorStatsCopy.ts` holds its words, and `visitorStats.recipe.ts` adds the 24px gap and the dimmed chart body.
- `web/src/modules/admin/services/visitorStatsService.ts`: narrows `bucket` and `trend`. An unknown bucket or a count that is not a number refuses the whole answer.
- Snapshot and types: `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts`.

## Decisions Made

These are the frontmatter `key-decisions`. They are implementation choices inside the plan's contract, and the open questions below list the ones the owner may want to change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files outside the plan's list**
- **Found during:** Tasks 1 and 3.
- **Issue:** the trend had to reach the page through files the plan did not list:
  - the service and its test (`visitorStatsService.ts`, `visitorStatsService.test.ts`);
  - the chart looks (`data.recipe.ts`);
  - the page body spacing and dimming (`visitorStats.recipe.ts`);
  - a route test whose fake answer lacked the new fields (`routes.test.tsx`).
- **Fix:** I changed them, each with tests.
- **Commits:** e4e87625, 750be5c3, b252a93b.

**2. [Rule 1 - Bug] Mistakes in my own RED tests**
- **Found during:** the Task 1 and Task 2 GREEN steps.
- **Issue:** three mistakes in tests I had just written:
  - a CSS selector built from class tokens that contain `[...]`;
  - the legend found through one `parentElement` too many;
  - a month test that used the 30-day `plot()` name.
- **Fix:** the tests now compare class token lists, use the right parent, and read the group's name directly.
- **Commits:** 750be5c3, b426e69f.

**3. [Rule 1 - Bug] A month cut short by the range end**
- **Found during:** Task 2 GREEN.
- **Issue:** a month bucket's end must be the earlier of the month end and the range end. Otherwise a range ending the day before the cut would show 0 unique visitors for its last month instead of null.
- **Fix:** I clamped the end and added `AMonthCutShortByARangeEndingTheDayBeforeTheCutHasNoUniqueVisitors`.
- **Commit:** b426e69f.

**4. [Rule 1 - Bug] Overlapping day labels (SPEC-DEVIATION D-51 note in the chart)**
- **Issue:** "every other label under 28px" fits month labels ("Oct"). Day labels ("Nov 15", about 33px) would still overlap on a phone with 30 days, and even at 28px per day on desktop.
- **Fix:** month labels follow D-51 exactly. Day labels keep every nth one, counting back from the last, so they are at least 44px apart. This is open question 2.
- **Commit:** b426e69f.

**5. Chart copy placed in Task 1**
- `VISITOR_TREND_COPY` went into `components/data/copy.ts` in Task 1, not Task 3, because the legend needed it first. There is no behaviour change.

---

**Total deviations:** 4 auto-fixed (1 blocking, 3 bugs) and 1 ordering note.
**Impact:** each change was needed to carry the contract or to fix a bug. There is no scope creep, and no package, schema or endpoint change.

## Open Questions (owner; nothing here was decided for you)

1. **Card title "Visits over time".** The chart shows page views and unique visitors, not visits. Wave note 12-18 says "Visits" means visit rows. Options:
   - **(A, recommended)** Retitle the card "Page views over time", so no label says "visits" for figures that are not visits.
   - (B) Keep "Visits over time" as the UI-SPEC says.
   - (C) Add a third series for visits.
2. **Day label spacing.** Options:
   - **(A, recommended)** Keep day labels at least 44px apart, so they never overlap.
   - (B) Follow D-51 strictly (every other label under 28px). Labels then overlap on phones for 30 days or more.
3. **Axis top for small counts.** Options:
   - **(A, recommended)** Raise an odd top under 10 to the next even number (1 becomes 2, 3 becomes 4), so the middle tick is a whole count.
   - (B) Allow half ticks such as "0.5".
4. **Where keyboard focus starts.** Options:
   - **(A, recommended)** The first (oldest) bucket, as most keyboard widgets do.
   - (B) The newest bucket.

## Issues Encountered

- **`scripts/third-party-notices.test.ts` fails, and the cause is the environment.** The worktree's `web/node_modules` is a junction to the main checkout's install. The notices script then builds a tree without `@remix-run/route-pattern@0.22.1`, so `npm --prefix web run notices:check` reports the committed file as out of date at that package. This plan changes no package, lockfile, script or notices file (`git diff --stat` of those paths is empty). It should pass with a real `npm ci` install, as in the wave 7 gate. Recorded, not fixed.
- **Load flakes in the full web run:** PublicLayout (3), EditUserPanel "posts the line and the trimmed name when they are set" (1, 5 s timeout), OrderFormPage (2) and GalleryPage lightbox (2). All of them passed when re-run alone. EditUserPanel is new to the flake list. The others are known.
- **Plan ledger:** as in 12-23, the plan base `fcbfcfda` was recorded in the session scratchpad, not the git dir. `commits: 7` is measured with `git rev-list --count fcbfcfda..b252a93b`.
- **REQUIREMENTS.md not touched:** ANL-08 is also declared by 12-26 to 12-28. The orchestrator marks it when the last of those plans is done.

## Known Stubs

None. The empty state "No visits in these dates", the error states and the Component Showcase demos of VisitorTrendChart (30 days, 12 months, a 13-month gap) belong to 12-28 and the UI review. They were not in this plan's file list.

## User Setup Required

None.

## Next Phase Readiness

- 12-26 to 12-28 can add the lists, speed card, states and export under the Trend card, inside the same `LoadingRegion`.
- `IVisitorStatsReader` now has two reads.
- The endpoint's allowed-name list now includes `bucket`, `trend` and `start`.
- The `node_modules` junctions in this worktree are removed before handback. No background shell was left running.

---
*Phase: 12-consent-analytics-legal*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Files: `web/src/components/data/VisitorTrendChart.tsx`, `web/src/components/data/VisitorTrendChart.test.tsx` and `web/src/modules/admin/components/VisitorTrendCard.tsx` were FOUND.
- Commits: e4e87625, 750be5c3, 4785a603, b426e69f, 2e0989d8, 9a8e6c47 and b252a93b were FOUND on HEAD.
- Acceptance greps: `TrendBucketDto` in VisitorStatsResponse.cs = 2; `VisitorTrendChart` in data/index.ts = 2; `StatsBucket.For` in the handler = 2; `SPEC-DEVIATION: A11Y-CHART` in the chart = 1; `ArrowLeft\|ArrowRight` in the chart = 2.
