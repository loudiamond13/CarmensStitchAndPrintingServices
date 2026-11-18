---
phase: 12-consent-analytics-legal
plan: 26
subsystem: analytics
tags: [visitor-stats, ranked-lists, shares, ef-core, linq, a11y, react]
created: "2026-11-18T00:10:00-06:00"
updated: "2026-11-18T00:10:00-06:00"

requires:
  - phase: 12-25
    provides: "GetVisitorStatsHandler, VisitorStatsResponse with bucket and trend, VisitorStatsReader, VisitorStatsPage"
  - phase: 12-18
    provides: "DailyReferrerCount, DailyDeviceCount, DeviceDimension (the rolled-up daily rows)"
  - phase: 12-04
    provides: "Shares.LargestRemainder"
provides:
  - "RankedItemDto(Name, Count, Share) and TopPages, Referrers, Devices, Browsers on VisitorStatsResponse"
  - "IVisitorStatsReader.ReadListsAsync(first, last, cut): grouped counts per name (VisitorLists, NamedCount)"
  - "StatBarList (admin module): an ol of name, '412 · 38%' and a --bar-w bar; empty line when no rows"
  - "DeviceBrowserCard: h3 Device and Browser lists, side by side at 1280px and up"
  - "'Most viewed pages' and 'Where visitors came from' cards on the Visitor Stats page"
affects: [12-27, 12-28, visitor-stats, component-showcase]

actuals:
  tokens: 13400
  tasks: 3
  commits: 6

plan_head_before: ebbc0e9a178acd5318782264c56aed5056052039
plan_head_after: 8852ff115efdeaf4f658c8b40f667d22600c4aa7

tech-stack:
  added: []
  patterns:
    - "The reader returns grouped counts in no order; the handler orders (count desc, then name ordinal), shares over the full list, then trims"
    - "D-27 lists: raw visits on days from the cut on, rolled-up daily rows on days before it, added per name in memory after two LINQ group-bys"
    - "Browsers keep the top 5 named families; the rest and any stored 'Other' fold into one 'Other' row, placed last"

key-files:
  created:
    - web/src/modules/admin/components/StatBarList.tsx
    - web/src/modules/admin/components/StatBarList.test.tsx
    - web/src/modules/admin/components/DeviceBrowserCard.tsx
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
  - "One row type for all four lists: RankedItemDto(name, count, share), as the plan's interfaces contract says (the must-have truths name the fields key/views and name/visits; the wire uses name/count/share)"
  - "Shares are taken over the full ordered list, then the list is cut to 10, so a source list longer than 10 shows shares that add up to less than 100"
  - "The browser 'Other' row always comes last, after the top 5, even when it is larger than some of them"
  - "Rows with a count of 0 are left out; a device with no visits is not listed"
  - "Most viewed pages uses the same empty line as the other lists, as the plan says (see open question 1)"

patterns-established:
  - "Ranked list contract: the server sends every list ordered and shared; the client only formats '{count} · {share}%'"

requirements-completed: [ANL-08]

coverage:
  - id: D1
    description: "topPages: page views per page key from the daily counts for any range, ordered by count then name, up to 10, whole-percent shares that add up to 100"
    requirement: ANL-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsEndpointTests.cs#TopPagesAreOrderedByViewsWithWholeSharesThatAddUpTo100"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs#TopPagesSumEachPagesViewsOverTheRangeOnly"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs#TopPagesAreOrderedByViewsThenNameWithSharesThatAddUpTo100"
        status: pass
    human_judgment: false
  - id: D2
    description: "referrers, devices and browsers add raw visits from the cut on to the rolled-up daily rows before it (D-27); names as stored (D-28); browsers are the top 5 plus Other; equal counts in name order"
    requirement: ANL-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsEndpointTests.cs#ARangeCrossingTheCutListsSourcesDevicesAndBrowsersFromBothSidesNamedAsStored"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs#ReferrersAddRawVisitsFromTheCutOnToTheDailyRowsBeforeIt"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs#DevicesAndBrowsersAddRawVisitsFromTheCutOnToTheDailyRowsBeforeIt"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs#SevenBrowsersAreTheTopFiveThenOtherWithSharesThatAddUpTo100"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs#EqualVisitCountsComeInNameOrderSoTheOrderNeverChanges"
        status: pass
    human_judgment: false
  - id: D3
    description: "StatBarList: ol rows with the name, '412 · 38%' and an 8px bar filled to the server share through --bar-w; empty line; one row is a full bar; a 200-character host wraps and its figure stays whole; names are text, never links; zero axe violations in Blush and Espresso"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/StatBarList.test.tsx#StatBarList: rows"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/StatBarList.test.tsx#StatBarList: empty, one and long rows"
        status: pass
    human_judgment: false
  - id: D4
    description: "The page shows 'Most viewed pages', 'Where visitors came from' and 'Devices and browsers' with their sub lines, page and device names from the copy, and zero axe violations with every list shown"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 the Most viewed pages card"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 the Where visitors came from card"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 the Devices and browsers card"
        status: pass
    human_judgment: false
  - id: D5
    description: "The look of the list cards: bar colour, spacing, the wrap of a long host and the two-column rows in Blush and Espresso at 320 to 1920px"
    verification: []
    human_judgment: true
    rationale: "jsdom checks class names only; colour contrast, real wrapping and the 1024px and 1280px breakpoints need the UI review or a browser"

duration: 79min
completed: 2026-11-18
status: complete
---

# Phase 12 Plan 26: Most viewed pages, sources, devices and browsers Summary

*Created: 2026-11-18T00:10:00-06:00 · Updated: 2026-11-18T00:10:00-06:00*

**The stats answer now carries four ranked lists (top pages, sources, devices, browsers) that the server groups with LINQ across the 13-month line, orders by count then name, and shares with `Shares.LargestRemainder`; the Visitor Stats page shows them in three cards built on a new admin-only `StatBarList`.**

## Performance

- **Duration:** 79 min
- **Started:** 2026-11-18T05:22:05Z
- **Completed:** 2026-11-18T06:41:35Z
- **Tasks:** 3 (all TDD: RED then GREEN; Task 1 was the tracer)
- **Files modified:** 19 (3 created)

## Accomplishments

- **Server read (`ReadListsAsync`):** page views per page key come from `DailyPageCounts` for the whole range. Visits per source, device class and browser come from the raw visits on the days from the cut on, and from `DailyReferrerCounts` and `DailyDeviceCounts` on the days before it (D-27). Each side is one LINQ group-by; the two sides are then added per name. A range wholly before the cut reads only the daily rows; one wholly after reads only raw visits.
- **Handler:** every list is ordered by count, highest first, then by name (ordinal), so equal counts always come in the same order. Shares are whole percents from `Shares.LargestRemainder` over the full list. Pages, sources and devices keep up to 10 rows. Browsers keep the top 5 named families and fold the rest, plus any family already stored as "Other", into one "Other" row at the end.
- **Answer:** `topPages`, `referrers`, `devices` and `browsers`, each a list of `{ name, count, share }`. Snapshot and generated types updated. The endpoint test's allowed-name list now includes these seven names.
- **StatBarList (`modules/admin/components`, SPEC-GAP: StatBarList):** an `ol`; each row has the name (Label 14/600, wraps anywhere), the figure "412 · 38%" (Small, muted, never split), and an 8px track whose fill takes the server share through `--bar-w`. No rows shows "No visitors allowed visitor stats in these dates." Names are plain text, never links (T-12-66).
- **Page:** under the Trend card, a two-column row with "Most viewed pages" ("Every page opened") and "Where visitors came from" ("Visitors who allowed visitor stats"), one column at 1023px and below. Then a row with `DeviceBrowserCard` ("Devices and browsers"), whose h3 "Device" and "Browser" lists sit side by side at 1280px and up. Page keys and device names come from `visitorStatsCopy.ts`. Until the first answer each list shows a skeleton.

## Task Commits

1. **Task 1: top pages (tracer):** RED `89ae6b46`, GREEN `4b05206d`. The tracer gate re-ran all three `<verify>` commands on the committed code (reader 15 of 15, endpoint and snapshot 29 of 29, web 46 of 46), then moved on to expansion.
2. **Task 2: sources, devices and browsers across the cut:** RED `5b2db199`, GREEN `ebc00182`
3. **Task 3: the cards, empty and long cases:** RED `4ce5788e`, GREEN `8852ff11`

## TDD Gate Compliance

| Task | RED | GREEN | RED evidence (`gsd check tdd-red-evidence`) |
|------|-----|-------|----------------------------------------------|
| 1 | 89ae6b46 | 4b05206d | All five were `RED_EVIDENCE_OK`: (1) handler `TopPagesAreOrderedByViewsThenNameWithSharesThatAddUpTo100` (JUnit), "TopPages should be [...] but was []"; (2) reader `TopPagesSumEachPagesViewsOverTheRangeOnly` (JUnit); (3) endpoint `TopPagesAreOrderedByViewsWithWholeSharesThatAddUpTo100` (JUnit), "should be [(gallery, 412, 38), ...] but was [*, *, *, *]"; (4) StatBarList "shows each count ... '412 · 38%'" (TAP), "expected [] to have a length of 2"; (5) page "shows 'Most viewed pages' ..." (TAP), "expected null not to be null". |
| 2 | 5b2db199 | ebc00182 | All four were `RED_EVIDENCE_OK` (JUnit): handler `SevenBrowsersAreTheTopFiveThenOther...` and `EqualVisitCountsComeInNameOrder...` (6 of 36 failed); reader `ReferrersAddRawVisitsFromTheCutOnToTheDailyRowsBeforeIt` (3 of 19 failed); endpoint `ARangeCrossingTheCutListsSources...` (1 of 19 failed). |
| 3 | 4ce5788e | 8852ff11 | Both were `RED_EVIDENCE_OK` (TAP): page "shows the sources exactly as the server stored them ..." and "shows Device and Browser lists under their h3s ...", each "expected null not to be null" (no card yet). |

**Semantic assessment:** each target ran and failed on its planned assertion against a stub: empty lists from the handler and the reader, a `StatBarList` and a `DeviceBrowserCard` that drew nothing, and a service that did not read the new lists. None failed on a build, load or fixture fault.
- **How the .NET evidence was captured:** xunit.v3 `--report-xunit-junit` reports with full `Namespace.Class.Method` target names, run start and report time recorded.
- **How the web evidence was captured:** single-test vitest `tap-flat` runs. My first two web records were refused as `invalid_record` ("Non-TAP data") because a `getByRole` failure dumps the DOM into the report. I changed each target's first assertion to one that fails on one line (a length check, or `queryByRole(...)` not null) and recorded the runs again; both were then `RED_EVIDENCE_OK`. The behaviour each test checks did not change.
- **Where the records are:** in the ignored `TestResults/` folder, deleted afterwards because the JUnit reports name the machine.
- **Tests that passed during RED:**
  - Task 1: `NoPageViewsIsAnEmptyList` (the stub already answered an empty list).
  - Task 2: `NoVisitsGiveEmptyReferrerDeviceAndBrowserLists` and the reader's `ARangeWithNoVisitsHasEmptyLists`, for the same reason.
  - Task 3: the six new StatBarList cases (empty, one row, 10 rows, the 200-character host, no links, axe in Blush and Espresso). The Task 1 GREEN `StatBarList` already had the empty line and the wrap classes, so these act as pins.

## Verification (quoted)

- `dotnet build`: "0 Warning(s) 0 Error(s)".
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*GetVisitorStatsHandlerTests"`: total 36, failed 0. The full Application suite: total 3278, failed 0.
- `dotnet test --project tests/Csps.ArchitectureTests`: total 290, failed 0.
- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests"` (LocalDB, `CSPS_TEST_SQL=localdb` for that process only): total 19, failed 0. With `*AnalyticsRetention*` added: total 49, failed 0.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*VisitorStatsEndpointTests" --filter-class "*OpenApiSnapshotTests"`: total 30, failed 0. With `*AuthorizationMatrixTests` added: total 599, failed 0. No endpoint was added or changed, so the matrix rows are the same.
- `dotnet format whitespace --verify-no-changes` on the seven changed C# files: exit 0.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- `npm --prefix web run test -- --run src/modules/admin/components/StatBarList.test.tsx src/modules/admin/pages/VisitorStatsPage.test.tsx src/modules/admin/services/visitorStatsService.test.ts src/test/no-long-dash.node.test.ts src/modules/admin/routes.test.tsx`: 5 files, 159 tests passed.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0. `npm --prefix web run typecheck`: exit 0. `prettier --check src/modules/admin`: "All matched files use Prettier code style!"
- **Full web `verify`, first run:** `test:coverage` had 1 failure out of 11391: `GalleryPage.test.tsx` "asks for the lightbox chunk only when a tile is first pressed". Run alone it passed (1 file, 28 tests). It is a known load flake and this plan does not touch the public Gallery.
- **Full web `verify`, second run:** exit 0. 425 files, 11391 tests passed; coverage all files 95.62% statements, 90.33% branches, 97.75% functions, 98.14% lines; build, `build:budget`, `license:check` and `notices:check` all passed.
- **`build:budget` (inside `verify`):** every row is within its limit, and no limit was changed (D-42):

| Measure | Size | Limit | Result |
|---|---|---|---|
| public JS (home) | 147.85 KB | 150.00 KB | ok |
| public JS (products) | 144.56 KB | 150.00 KB | ok |
| public JS (gallery) | 145.90 KB | 150.00 KB | ok |
| public JS (contact) | 149.40 KB | 150.00 KB | ok |
| public JS (privacy) | 149.60 KB | 150.00 KB | ok |
| public JS (cookies) | 149.50 KB | 150.00 KB | ok |
| public JS (terms) | 148.71 KB | 150.00 KB | ok |
| public JS (accessibility) | 148.27 KB | 150.00 KB | ok |
| public JS (notFound) | 140.62 KB | 150.00 KB | ok |
| admin JS | 223.25 KB | 250.00 KB | ok |
| CSS | 20.50 KB | 35.00 KB | ok |

- **Budget notes:** the new UI is only in admin modules and imports nothing new into `@/components`. Even so, every public row grew 0.02 KB (Privacy 149.58 to 149.60 KB, 0.40 KB left). The same 0.02 KB growth appeared in 12-25. It is likely the shared admin chunk's name or the manifest, not public code; not traced. Admin JS grew 0.04 KB and CSS 0.01 KB.

## Files Created/Modified

- `src/Csps.Application/Analytics/VisitorStatsResponse.cs`: `RankedItemDto` and the four list fields.
- `src/Csps.Application/Ports/IVisitorStatsReader.cs`: `ReadListsAsync`, `VisitorLists`, `NamedCount`.
- `src/Csps.Application/Analytics/GetVisitorStatsHandler.cs`: `Order`, `FoldBrowsers` and `Rank` (shares, then the top 10).
- `src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs`: the page group-by and the raw and rolled-up group-bys across the cut.
- `web/src/modules/admin/components/StatBarList.tsx` and `DeviceBrowserCard.tsx`: the list and the card. `visitorStats.recipe.ts` holds their looks.
- `web/src/modules/admin/pages/VisitorStatsPage.tsx`: the two list rows and a small `StatListCard`.
- `web/src/modules/admin/visitorStatsCopy.ts`: the list titles, sub lines, empty line, figure, page names and device names.
- `web/src/modules/admin/services/visitorStatsService.ts`: `RankedItem`; each count and share is narrowed to a number, and a bad one refuses the whole answer.
- Snapshot and types: `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts`.

## Decisions Made

These are the frontmatter `key-decisions`. They are implementation choices inside the plan's contract. The open questions below list the ones the owner may want to change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files outside the plan's list**
- **Found during:** Tasks 1 to 3.
- **Issue:** the lists had to reach the page through files the plan did not list: the service and its test (`visitorStatsService.ts`, `visitorStatsService.test.ts`), and the routes test, whose fake answer lacked the new fields (12-25 hit the same).
- **Fix:** I changed them, each with tests.
- **Commits:** 89ae6b46, 4b05206d, ebc00182, 4ce5788e, 8852ff11.

**2. [Rule 1 - Bug] Mistakes in my own tests**
- One share I worked out by hand was wrong (12, not 10); I fixed it before the RED run.
- The service's full-answer test needed the three new empty lists after Task 3 GREEN.
- **Commits:** 5b2db199, 8852ff11.

**3. A browser stored as "Other"**
- `UserAgentFamily.Other` is a real stored label. The plan says "top 5 plus 'Other' for the rest" but does not say what happens to it. I fold it into the same Other row, so the list never shows two "Other" rows. Covered by `AStoredOtherBrowserJoinsTheOtherRowWhichComesLast`.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) and 1 contract gap filled.
**Impact:** each change was needed to carry the contract or to fix a test. There is no scope creep, and no package, schema, endpoint or limit change.

## Open Questions (owner; nothing here was decided for you)

1. **Empty line on Most viewed pages.** The plan gives every list "No visitors allowed visitor stats in these dates." Page views are counted with or without cookies, so that line is not quite true for this card. Options:
   - **(A, recommended)** Use "No page views in these dates." on Most viewed pages only.
   - (B) Keep the plan's line on all four lists (what the code does now).
   - (C) Leave it to 12-28, where one EmptyState "No visits in these dates" replaces every card when the range has no visits.
2. **Shares when there are more than 10 sources.** The plan says shares are "over the full list, so a list's shares sum to 100". With 12 sources, the 10 shown add up to less than 100. Options:
   - **(A, recommended)** Keep shares over all visits (what the code does), so each bar is the true share.
   - (B) Add an 11th "Other sources" row so the list always adds up to 100.
   - (C) Share over the 10 shown rows only.
3. **Where the browser "Other" row sits.** Options:
   - **(A, recommended)** Always last (what the code does), as most charts do.
   - (B) Sorted by its count like the other rows, which the plan's "every list is ordered by count" line could also mean.
4. **Field names on the wire.** The plan's must-haves name the fields `{ key, views, share }` and `{ name, visits, share }`, while its interfaces section says one `RankedItemDto(Name, Count, Share)`. The code follows the interfaces: `{ name, count, share }` for all four. Options:
   - **(A, recommended)** Keep one shape for all four lists.
   - (B) Rename to the per-list names.

## Issues Encountered

- **Load flake:** `GalleryPage.test.tsx` "asks for the lightbox chunk only when a tile is first pressed" failed once in the first full run and passed alone (28 of 28) and in the second full run. It is already on the flake list.
- **Packages:** none added or bumped. `npm ci` in `web` and `tools/openapi-gen` installed the locked versions only; no `node_modules` link was used, and `notices:check` passed.
- **Line endings:** three C# files were saved with LF in the worktree. Git normalizes them on commit (it warned "LF will be replaced by CRLF"), so the commits are unchanged.
- **REQUIREMENTS.md not touched:** ANL-08 is also declared by 12-27 and 12-28. The orchestrator marks it when the last of those plans is done.

## Known Stubs

None. The page-wide empty state, the error states and the Component Showcase demos of StatBarList (0, 1 and 10 rows) belong to 12-28 and the showcase. They were not in this plan's file list. The second slot of the Devices and browsers row is left for Page speed (12-27).

## Threat Flags

None. No endpoint, auth path or schema changed. Referrer hosts render as plain text (T-12-66), and only names and counts leave the server (T-12-67).

## User Setup Required

None.

## Next Phase Readiness

- 12-27 can put `PageSpeedCard` in the second slot of the Devices and browsers row (`visitorStatsListRowClasses`).
- 12-28 can reuse `StatBarList` for its showcase demos and replace the list cards with the page-wide empty state.
- `IVisitorStatsReader` now has three reads.
- No background shell was left running. The RED records and JUnit reports were deleted.

---
*Phase: 12-consent-analytics-legal*
*Completed: 2026-11-18*

## Self-Check: PASSED

- Files: `web/src/modules/admin/components/StatBarList.tsx`, `StatBarList.test.tsx` and `DeviceBrowserCard.tsx` were FOUND.
- Commits: 89ae6b46, 4b05206d, 5b2db199, ebc00182, 4ce5788e and 8852ff11 were FOUND on HEAD (`git rev-list --count ebbc0e9a..HEAD` = 6 before this SUMMARY commit).
- Acceptance greps: `RankedItemDto` in VisitorStatsResponse.cs = 5; "Page not found" in visitorStatsCopy.ts = 1; `Shares.LargestRemainder` in the handler = 2; `DailyDeviceCount` in the reader = 2; "No visitors allowed visitor stats in these dates." in visitorStatsCopy.ts = 1; `DeviceBrowserCard` in VisitorStatsPage.tsx = 2. Key link `DailyReferrerCount` in the reader = 1; `SPEC-GAP: StatBarList` = 1; no em or en dash in the new web files.
