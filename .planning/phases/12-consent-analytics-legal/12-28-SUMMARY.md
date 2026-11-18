---
phase: 12-consent-analytics-legal
plan: 28
subsystem: analytics
tags: [visitor-stats, csv, export, byte-order-mark, http-client, ef-core, linq, react, toast]
created: "2026-11-18T04:30:00-06:00"
updated: "2026-11-18T05:51:00-06:00"

requires:
  - phase: 12-27
    provides: "VisitorStatsController, GetVisitorStatsHandler, IVisitorStatsReader and the Visitor Stats page with its toolbar"
  - phase: 12-15
    provides: "the daily counts and the 13-month raw visit cut"
  - phase: 12-04
    provides: "AnalyticsRetention.RawCut"
provides:
  - "GET /api/v1/visitor-stats/export (ExportVisitorStats, Manager only): text/csv utf-8 with a byte-order mark, one CRLF row per business day"
  - "VisitorStatsCsv.Write / VisitorStatsCsv.Header and DailyStatsRow (Application)"
  - "ExportVisitorStatsHandler and VisitorStatsExport(FileName, Csv)"
  - "IVisitorStatsReader.ReadDailyAsync and DailyCount(Day, PageViews, Visits, UniqueVisitors)"
  - "httpClient RequestConfig.responseType 'text', allow-listed to text/csv"
  - "visitorStatsService.exportCsv(query, signal) -> { text, fileName }"
  - "downloadCsv(text, fileName) in modules/admin"
  - "The Export CSV button with the Exporting state and the two toasts"
affects: [12-29, visitor-stats, ui-review, secure-phase]

actuals:
  tokens: 14800
  tasks: 3
  commits: 7

plan_head_before: 7dad82ff28fdbbf0aecea3c7e34b917de42aac2b
plan_head_after: 1b31d76af25eff88a5f9c7f82c058389e9bb689c

tech-stack:
  added: []
  patterns:
    - "A file answer from a JSON controller: TypedResults.Text with a leading U+FEFF, a Content-Disposition built from validated DateOnly values, and an OpenAPI transformer that lists only text/csv for that 200"
    - "httpClient text mode: opt in per request with responseType 'text'; it sends Accept text/csv and accepts only a text/csv answer"
    - "Browser download: Blob of one byte-order mark plus the text, object URL, a[download] click, revoke after 10 seconds"

key-files:
  created:
    - src/Csps.Application/Analytics/VisitorStatsCsv.cs
    - src/Csps.Application/Analytics/ExportVisitorStatsHandler.cs
    - tests/Csps.Application.UnitTests/Analytics/VisitorStatsCsvTests.cs
    - tests/Csps.Application.UnitTests/Analytics/ExportVisitorStatsHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsExportTests.cs
    - web/src/modules/admin/downloadCsv.ts
    - web/src/modules/admin/downloadCsv.test.ts
  modified:
    - src/Csps.Application/Ports/IVisitorStatsReader.cs
    - src/Csps.Application/Analytics/GetVisitorStatsHandler.cs
    - src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs
    - src/Csps.Server/Controllers/VisitorStatsController.cs
    - src/Csps.Server/Composition/AnalyticsApplicationRegistration.cs
    - src/Csps.Server/Composition/OpenApiRegistration.cs
    - tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/core/api/http/httpClient.ts
    - web/src/core/api/http/httpClient.test.ts
    - web/src/modules/admin/services/visitorStatsService.ts
    - web/src/modules/admin/services/visitorStatsService.test.ts
    - web/src/modules/admin/components/VisitorStatsToolbar.tsx
    - web/src/modules/admin/pages/VisitorStatsPage.tsx
    - web/src/modules/admin/pages/VisitorStatsPage.test.tsx
    - web/src/modules/admin/visitorStatsCopy.ts

key-decisions:
  - "The client names the file from the CSV's own first and last day (the same dates the server put in Content-Disposition), so httpClient does not have to return headers; this kept the public-page change to a few bytes"
  - "The export reuses the stats read's validator and range resolver (GetVisitorStatsHandler.Resolve is now internal), so a preset or custom range resolves to the same dates in both"
  - "A negative count makes the CSV writer throw, because its cell would start with a minus sign (CWE-1236); counts can never be negative today"
  - "The object URL is revoked 10 seconds after the click, not at once, because Safari can fail a download whose URL is revoked immediately"
  - "Export CSV saves the range the page last applied (the one the figures show), not a custom range still being typed"
  - "No rate limit on the export: it is a Manager-only read like the stats read, which has none"

patterns-established:
  - "Text answers: any later file endpoint opts in with responseType 'text' and adds its type to the allow-list in toHttpResponse"

requirements-completed: [ANL-08]

coverage:
  - id: D1
    description: "Server export: Manager-only GET /api/v1/visitor-stats/export answers text/csv; charset=utf-8 that starts with EF BB BF, Content-Disposition attachment; filename=\"visitor-stats-{from}-to-{to}.csv\", the header Date,Unique visitors,Visits,Page views and one CRLF row per business day; Admin 403, anonymous 401, bad custom range 400 problem JSON, never cached"
    requirement: ANL-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsExportTests.cs#AManagerGetsTheRangeAsAUtf8CsvFileThatStartsWithAByteOrderMark"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsExportTests.cs#WithNoRangeTheFileHoldsTheLastThirtyDaysOneRowPerDay"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs#GET /api/v1/visitor-stats/export (401, 403, 200)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Safe and honest CSV: every cell is a date, digits or empty, no cell starts with = + - @ tab or CR, exactly four columns, days before the 13-month cut have empty Unique visitors and Visits cells, a range with no data has one zero row per day, business days at Manila midnight, invariant culture"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/VisitorStatsCsvTests.cs#NoCellOfAGeneratedFileStartsAFormula"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/ExportVisitorStatsHandlerTests.cs#DaysBeforeTheCutHaveEmptyVisitorAndVisitCellsButKeepTheirPageViews"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Analytics/ExportVisitorStatsHandlerTests.cs#ARangeWithNoDataHasOneZeroRowPerDay"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs#EachDayHasItsPageViewsVisitsAndDistinctVisitorsAndOnlyDaysWithDataAreListed"
        status: pass
    human_judgment: false
  - id: D3
    description: "httpClient text mode (Pitfall 2): responseType 'text' sends Accept text/csv and resolves to the text only for a text/csv answer; HTML, JSON, text/plain, empty and redirected answers still reject with kind parse, and a CSV answer without text mode still rejects (LIB-WR-05)"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/core/api/http/httpClient.test.ts#createHttpClient: text mode for a CSV file (Pitfall 2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "BOM-safe download (Pitfall 3): the Blob starts with EF BB BF exactly once, type text/csv;charset=utf-8, one a[download] click with the file name, object URL revoked after 10 seconds, no link left in the page"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/downloadCsv.test.ts#downloadCsv"
        status: pass
    human_judgment: false
  - id: D5
    description: "Export CSV button: secondary with the download icon, 'Exporting' busy state, one request for a second press, success toast with the file name, failure toast with nothing saved, back to rest, zero axe violations"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 CSV export (D-25)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The file opens cleanly in Excel and Google Sheets with the right characters, and the download works in Chrome, Firefox and Safari (the 10-second revoke)"
    verification: []
    human_judgment: true
    rationale: "jsdom checks the bytes and the click only; a real browser and spreadsheet are needed, and this plan may not run Playwright or a dev server while 12-29 owns them"

duration: 143min
completed: 2026-11-18
status: complete
---

# Phase 12 Plan 28: A Manager exports the chosen date range as a CSV with one row per day Summary

*Created: 2026-11-18T04:30:00-06:00 · Updated: 2026-11-18T05:51:00-06:00*

**A Manager presses Export CSV and gets `visitor-stats-{from}-to-{to}.csv`: UTF-8 with a byte-order mark, the header `Date,Unique visitors,Visits,Page views`, and one row per business day of the range shown. The server writes it with a small writer (no package) from a new daily read. The browser fetches it through a new allow-listed text mode in `httpClient` and saves it through an object URL. The button shows "Exporting", then a success or failure toast.**

## Performance

- **Duration:** 2h 23m
- **Started:** 2026-11-18T09:27:48Z
- **Completed:** 2026-11-18T11:51:00Z
- **Tasks:** 3 (all TDD: RED then GREEN; Task 1 was the tracer)
- **Files modified:** 25 (7 created)

## Accomplishments

- **Server writer (`VisitorStatsCsv`):** the header `Date,Unique visitors,Visits,Page views` (D-33), then one CRLF line per day. Dates are `yyyy-MM-dd` and counts are invariant digits. A null count is an empty cell. A negative count throws, so no cell can ever start with a minus sign.
- **Daily read (`ReadDailyAsync`):** page views per day from the daily counts; visits and distinct visitors per day from the raw visits, from the cut day on. Two grouped LINQ queries, no inline SQL. Only days with data come back.
- **Handler (`ExportVisitorStatsHandler`):** the same validator and range resolver as the stats read. It fills every business day from the start to the end: a day with no data is `0,0,0`, and a day before the 13-month cut is `,,{page views}` (D-27). The file name is `visitor-stats-{from}-to-{to}.csv`, built only from the resolved `DateOnly` values (T-12-70).
- **Endpoint (`GET /api/v1/visitor-stats/export`, `ExportVisitorStats`):** Manager only (Admin 403, anonymous 401), never cached. It answers `text/csv; charset=utf-8` that starts with EF BB BF, and `Content-Disposition: attachment; filename="visitor-stats-2026-10-17-to-2026-11-15.csv"`. A bad custom range is the same 400 problem JSON as the stats read. Matrix row, snapshot and generated types are updated. The OpenAPI document lists only `text/csv` for its 200.
- **httpClient text mode (Pitfall 2, T-12-72):** `responseType: 'text'` sends `Accept: text/csv` and resolves to the body text only when the answer is `text/csv`. HTML, JSON, text/plain, empty and redirected answers still reject with kind `parse`, and a CSV answer to a normal request still rejects (LIB-WR-05). Error answers still carry their ProblemDetails.
- **Service and download:** `visitorStatsService.exportCsv(query, signal)` returns `{ text, fileName }`. It refuses a file with another header or no day rows. `downloadCsv(text, fileName)` builds the Blob from one byte-order mark plus the text (`text/csv;charset=utf-8`), clicks a temporary `a[download]`, and revokes the URL 10 seconds later. No CSP change.
- **Button:** "Export CSV" (secondary, download icon) sits at the end of the toolbar. While it runs it shows the WEB-09 busy state "Exporting" and ignores a second press. Then it shows the success toast "Visitor stats exported" / "visitor-stats-2026-10-17-to-2026-11-15.csv is in your downloads.", or the failure toast "Couldn't export the visitor stats." / "Check your internet connection and try again." with nothing saved.

## Task Commits

1. **Task 1: export end to end (tracer):** RED `ec7b92bc`, GREEN `fc4c9f46`. The tracer gate re-ran the three `<verify>` commands on the committed code: CSV writer 1 of 1; export, matrix, coverage and snapshot 601 of 601; httpClient and service 60 of 60. Then it moved on.
2. **Task 2: safe, honest file:** RED `43a6b88e`, GREEN `c36a7d7a`.
3. **Task 3: Exporting and toasts:** RED `7fccdba5`, GREEN `ec916cda`.
4. **Coverage fix:** REFACTOR `1b31d76a` (one content-type check for JSON and CSV, so core/api is back to 100% branches; no behaviour change).

## TDD Gate Compliance

| Task | RED | GREEN | RED evidence (`gsd check tdd-red-evidence`) |
|------|-----|-------|----------------------------------------------|
| 1 | ec7b92bc | fc4c9f46 | Five records were `RED_EVIDENCE_OK`. JUnit: `VisitorStatsCsvTests.AThreeDayRangeIsTheHeaderThenOneLinePerDay` (1 of 1 failed: the stub wrote the header only); `VisitorStatsExportTests.AManagerGetsTheRangeAsAUtf8CsvFileThatStartsWithAByteOrderMark` (10 of 601 failed, "HttpStatusCode.OK but was NotFound"; the 3 matrix rows failed on 404 the same way). TAP: httpClient "asks for text/csv and resolves to the body text ..." (rejected with kind parse), service "... names the file from its first and last day" (the stub's empty name), page "pressing Export CSV ..." (no button). |
| 2 | 43a6b88e | c36a7d7a | Two records were `RED_EVIDENCE_OK` (TAP): downloadCsv "builds a text/csv Blob whose first bytes are ... EF BB BF" (`'44 61 74 65'`, no mark) and "... then revokes the object URL" (nothing revoked). |
| 3 | 7fccdba5 | ec916cda | Three records were `RED_EVIDENCE_OK` (TAP): the success toast, the "Exporting" busy button and the failure toast, each failing on its first one-line assertion. |

**Semantic assessment:** each target ran and failed on its planned assertion against a stub or a missing endpoint. None failed on a build, load or fixture fault.
- **Pins (passed during RED):**
  - Task 1: four httpClient rejection cases (HTML, text/plain, empty, redirected) were already rejected by the JSON guard; they now pin the allow-list.
  - Task 2: every .NET case (writer, handler, reader: 20 and 27 tests). Task 1 GREEN had to build them for the export to work end to end, so they guard the behaviour rather than drive it. The downloadCsv "keeps one byte-order mark" and "leaves no link" cases also passed.
  - Task 3: "exports the custom range the page shows" (Task 1 already passed the applied range).
- **Records needed one-line first assertions:** a deep-equal diff, a timeout message and an escaped apostrophe all broke TAP (`invalid_record`). I added a one-line first check (`fileName`, `not.toBeNull()`) and ran each target alone with `-t`. What each test checks did not change.
- **Records:** in the ignored `TestResults/` folder. They are deleted after this plan because the reports name local paths and the machine.

## Verification (quoted)

- `dotnet build Csps.slnx`: "0 Warning(s) 0 Error(s)" (after the last C# change and again at the end).
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*VisitorStatsCsvTests" --filter-class "*ExportVisitorStatsHandlerTests"`: total 20, failed 0. Full Application suite: total 3302, failed 0.
- `dotnet test --project tests/Csps.ArchitectureTests`: total 290, failed 0.
- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests"` (LocalDB, `CSPS_TEST_SQL=localdb` for that process only): total 27, failed 0. With `*AnalyticsRetention*`: total 57, failed 0.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*VisitorStatsExportTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests" --filter-class "*OpenApiSnapshotTests"`: total 601, failed 0. The whole `Csps.Server.IntegrationTests.Analytics` namespace: total 143, failed 0. `*RateLimitTests` with `*AuthorizationFailureTests`: total 90, failed 0.
- The snapshot was written with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for that one process. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- `dotnet format whitespace --verify-no-changes` on every changed C# file: exit 0.
- Plan verify commands for the web: `npm --prefix web run test -- --run src/core/api/http/httpClient.test.ts src/modules/admin/services/visitorStatsService.test.ts` 60 passed; `src/modules/admin/downloadCsv.test.ts` 4 passed; `src/modules/admin/pages/VisitorStatsPage.test.tsx src/test/no-long-dash.node.test.ts` 77 passed; `src/core/api` 160 passed; `npm --prefix web run lint` exit 0; `npm --prefix web run typecheck` exit 0.
- **core/api coverage:** `vitest run --coverage --coverage.include='src/core/api/**' src/core/api`: lines 247 of 247, branches 163 of 163, functions 61 of 61 (100%). The first measure was 99.28% branches on `httpClient.ts` line 377 (a missing Content-Type in text mode); the refactor `1b31d76a` shares one check with the JSON path, which covers it.
- **Full web `verify`, run 1 (before the refactor):** typecheck, lint and format:check passed; `test:coverage` had 6 failures out of 11451, all in files this plan does not touch, while 12-29 drove Playwright: `OrderFormPage` (axe timeout and a pending-save test), `routes.test.tsx` (site-content redirect, 10 s timeout), `OrderRefundModal`, `GalleryPage` lightbox, `third-party-notices.test.ts` (120 s timeout). Run alone: 4 of the 5 files passed at once (235 tests); `GalleryPage` failed once more on another lightbox test, passed that test alone, then passed whole (28 of 28).
- **Full web `verify`, run 2 (after the last change):** typecheck, lint and format:check passed; `test:coverage` had 1 failure out of 11451: `OrderFormPage.test.tsx` "has no axe violations with the card in each state" (5 s timeout, the known load flake). Run alone it passed. `verify` stops at the first failing step, so I ran the remaining steps one by one: `build`, `build:budget`, `license:check` and `notices:check` all exit 0.
- **`test:coverage`, run 3 (after 12-29's own `verify` had ended):** 1 failure out of 11451, again in `OrderFormPage.test.tsx`, this time "cannot be left through the dialog while a save is pending ...". The whole `OrderFormPage.test.tsx` run alone: 84 of 84 passed.
- **Not measured:** the overall web coverage percentage. Vitest writes no coverage report when a test fails, and each of the three full runs had one `OrderFormPage` flake. core/api was measured on its own (100%, above). The 12-27 gate had 90.33% branches; this plan adds only tested code, but the wave gate's `verify` should confirm the number.

**`build:budget` before and after (gzip -9; no limit changed, D-42):**

| Measure | Base (7dad82ff) | After Task 1 | Final | Limit |
|---|---|---|---|---|
| public JS (home) | 147.86 KB | 147.85 KB | 147.82 KB | 150.00 KB |
| public JS (products) | 144.57 KB | 144.56 KB | 144.53 KB | 150.00 KB |
| public JS (gallery) | 145.91 KB | 145.90 KB | 145.87 KB | 150.00 KB |
| public JS (contact) | 149.41 KB | 149.40 KB | 149.36 KB | 150.00 KB |
| public JS (privacy) | 149.60 KB | 149.59 KB | 149.56 KB | 150.00 KB |
| public JS (cookies) | 149.50 KB | 149.49 KB | 149.46 KB | 150.00 KB |
| public JS (terms) | 148.71 KB | 148.70 KB | 148.67 KB | 150.00 KB |
| public JS (accessibility) | 148.27 KB | 148.25 KB | 148.23 KB | 150.00 KB |
| public JS (notFound) | 140.63 KB | 140.61 KB | 140.59 KB | 150.00 KB |
| admin JS | 223.22 KB | 223.26 KB | 223.22 KB | 250.00 KB |
| CSS | 20.50 KB | 20.50 KB | 20.50 KB | 35.00 KB |

Every public page is now 0.04 KB smaller than at the base: the text mode adds only a few bytes, and the shared content-type check saves a little more than that. Privacy has 0.44 KB left.

**Acceptance greps (all pass):**
- `grep -c "Date,Unique visitors,Visits,Page views" src/Csps.Application/Analytics/VisitorStatsCsv.cs`: 1.
- `grep -c "\"/api/v1/visitor-stats/export\"" tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`: 1.
- `grep -c "responseType" web/src/core/api/http/httpClient.ts`: 3.
- `grep -c "\\\\uFEFF" web/src/modules/admin/downloadCsv.ts`: 1.
- `grep -c "'='\|\"=\"" tests/Csps.Application.UnitTests/Analytics/VisitorStatsCsvTests.cs`: 1.
- `grep -c "Visitor stats exported" web/src/modules/admin/visitorStatsCopy.ts`: 1; `grep -c "Exporting" ...`: 1.

## Files Created/Modified

- `src/Csps.Application/Analytics/VisitorStatsCsv.cs`: `DailyStatsRow` and the writer.
- `src/Csps.Application/Analytics/ExportVisitorStatsHandler.cs`: the use case and `VisitorStatsExport`.
- `src/Csps.Application/Ports/IVisitorStatsReader.cs`: `ReadDailyAsync` and `DailyCount`.
- `src/Csps.Application/Analytics/GetVisitorStatsHandler.cs`: `Resolve` is now `internal` so the export shares it.
- `src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs`: `ReadDailyAsync`.
- `src/Csps.Server/Controllers/VisitorStatsController.cs`: the `Export` action.
- `src/Csps.Server/Composition/AnalyticsApplicationRegistration.cs`: registers the handler.
- `src/Csps.Server/Composition/OpenApiRegistration.cs`: lists only `text/csv` for the export's 200.
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts`: snapshot and types.
- `web/src/core/api/http/httpClient.ts`: `responseType` and the `text/csv` allow-list.
- `web/src/modules/admin/services/visitorStatsService.ts`: `exportCsv` and `VisitorStatsFile`.
- `web/src/modules/admin/downloadCsv.ts`: the browser save.
- `web/src/modules/admin/components/VisitorStatsToolbar.tsx`: `ExportCsvButton` and the `exportQuery` prop.
- `web/src/modules/admin/pages/VisitorStatsPage.tsx`: passes the applied range to the toolbar.
- `web/src/modules/admin/visitorStatsCopy.ts`: "Export CSV", "Exporting" and the toasts.
- Tests: `VisitorStatsCsvTests`, `ExportVisitorStatsHandlerTests`, `VisitorStatsExportTests`, 3 reader cases, the matrix row, 8 httpClient cases, 5 service cases, `downloadCsv.test.ts`, 6 page cases.

## Decisions Made

These are the frontmatter `key-decisions`. Each is an implementation choice inside the plan's contract; the open questions below list what you may want to change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files outside the plan's list**
- **Found during:** Tasks 1 and 3.
- **Issue:** the toolbar needs the range the page applied, and the export must share the stats read's range rules. The OpenAPI document also needed a fix (next item).
- **Fix:** `VisitorStatsPage.tsx` passes `exportQuery` to the toolbar; `GetVisitorStatsHandler.Resolve` became `internal`; `OpenApiRegistration.cs` got one operation transformer.
- **Commits:** fc4c9f46.

**2. [Rule 1 - Bug] `[Produces("text/csv")]` on the action made the document wrong**
- **Found during:** Task 1 (snapshot).
- **Issue:** the plan said to override `[Produces]` on the action. With the class's `application/json`, the document then listed both types, plus `text/csv` on the 400, 401 and 403 answers.
- **Fix:** no `[Produces]` on the action; `[ProducesResponseType<string>(200, "text/csv")]` and an operation transformer that drops `application/json` from that one 200. The real answer is set by `TypedResults.Text` either way. Errors stay ProblemDetails JSON like every other endpoint.
- **Commit:** fc4c9f46.

**3. [Rule 1 - Bug] Invisible characters in source**
- **Found during:** Task 1 (lint `no-irregular-whitespace`).
- **Issue:** my editor wrote a real U+FEFF character where `\uFEFF` was meant, in the service, the controller and a test.
- **Fix:** each is now the escape `\uFEFF`; no file holds a raw byte-order mark.
- **Commits:** fc4c9f46, 43a6b88e, c36a7d7a.

**4. [Rule 1 - Bug] Mistakes in my own tests**
- `ContentDisposition.FileName` keeps no quotes after parsing; the 30-day test expected them.
- `new Response(blob)` in jsdom reads a jsdom Blob as "[object Blob]"; the byte check now uses `blob.arrayBuffer()`.
- **Commits:** fc4c9f46, 43a6b88e.

**5. [Rule 2 - Missing critical] Revoke after a delay**
- **Found during:** Task 2.
- **Issue:** revoking the object URL in the same tick as the click can fail the download in Safari.
- **Fix:** revoke 10 seconds later; the test uses fake timers and checks nothing is revoked before then.
- **Commit:** c36a7d7a.

---

**Total deviations:** 5 (1 blocking, 3 bugs, 1 missing critical).
**Impact:** each change was needed to carry the contract or keep the document and the source clean. No package, schema, limit or public endpoint change beyond the planned export.

## Open Questions (owner; nothing here was decided for you)

1. **Unique visitors per day in the file.** Each row counts the distinct visitors of that day. If someone adds up the column in a spreadsheet, a person who came on 3 days counts 3 times, so the sum is more than the page's "Unique visitors" card. Options:
   - **(A, recommended)** Keep it: one row per day is what D-25 asks, and each row is true for its day.
   - (B) Rename the column "Unique visitors that day". This changes the D-33 header.
2. **Rate limit on the export.** None was added; the stats read has none either, and both need a Manager sign-in. Options:
   - **(A, recommended)** Keep none.
   - (B) Add a small per-user limit. That also means a `RateLimitTests.LimitedEndpoints` row and the owner review host.
3. **When the object URL is let go.** I chose 10 seconds after the click. Recommended: keep it; the file is a few KB, so holding it briefly costs nothing.

## Issues Encountered

- **Budget:** measured before, after Task 1 and at the end (table above). Every public row ends 0.04 KB smaller than at the base; no limit was changed (D-42).
- **Load flakes (recorded, none in this plan's files):** with 12-29's Playwright and then its own `verify` on the machine, the full web run failed on `OrderFormPage` (axe and pending save), `routes.test.tsx` (site-content redirect), `OrderRefundModal` (credit message), `GalleryPage` (lightbox) and `third-party-notices.test.ts` (120 s timeout). Each passed when run alone. `OrderRefundModal`, `routes.test.tsx` and `third-party-notices.test.ts` are new to the flake list. `OrderFormPage` failed one test in each of the three full runs (a different test each time) and passes whole when run alone (84 of 84); it may be worth a look, because it now blocks a clean `verify` on a busy machine.
- **Still open from 12-23:** with a custom range, if the business-day call fails, the cards stay loading. This plan does not cover page states, so it stays open.
- **Packages:** none added or bumped. `npm ci` in `web` and `tools/openapi-gen` installed the locked versions only, and no `node_modules` link was used.
- **No Playwright, Lighthouse or dev server** was run: 12-29 owns them. Preflight showed its Playwright run and a CSPS host on port 5199; `verify` uses no port.
- **REQUIREMENTS.md not touched:** the orchestrator marks ANL-08 after the wave.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. The one new endpoint is the planned Manager-only export (T-12-71, matrix rows 401/403/200). Its file holds only the four daily totals (the ANL-08 prohibition): no visitor, visit, page, source or device value. The file name comes only from validated dates (T-12-70). Every cell is a date, digits or empty, and a test fails on any formula start (T-12-69). The text mode is opt-in and allow-listed (T-12-72). No package was added (T-12-SC).

## User Setup Required

None.

## Next Phase Readiness

- 12-29 can show the Export CSV button in a showcase scenario; the page now takes one more prop (`exportQuery`).
- A real-browser check of the download (Chrome, Firefox, Safari) and of the file in Excel and Google Sheets is owed (coverage D6), for the UI review or the owner.
- No background shell was left running. The RED records and JUnit reports in `TestResults/` are deleted.

---
*Phase: 12-consent-analytics-legal*
*Completed: 2026-11-18*

## Self-Check: PASSED

- Files: `VisitorStatsCsv.cs`, `ExportVisitorStatsHandler.cs`, `VisitorStatsCsvTests.cs`, `ExportVisitorStatsHandlerTests.cs`, `VisitorStatsExportTests.cs`, `downloadCsv.ts` and `downloadCsv.test.ts` were FOUND.
- Commits: ec7b92bc, fc4c9f46, 43a6b88e, c36a7d7a, 7fccdba5, ec916cda and 1b31d76a were FOUND on HEAD (`git rev-list --count 7dad82ff..HEAD` = 7 before this SUMMARY commit).
- Each RED `test(12-28)` commit comes before its GREEN `feat(12-28)` commit; the `refactor(12-28)` commit comes last.
- Every acceptance grep passes. No raw byte-order mark and no long dash is in any changed file or in this SUMMARY.
