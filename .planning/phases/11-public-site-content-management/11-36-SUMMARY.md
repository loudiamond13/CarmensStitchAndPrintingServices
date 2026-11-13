---
phase: 11-public-site-content-management
plan: 36
subsystem: performance
tags: [brotli, static-files, response-compression, lighthouse, fonts, unicode-range, vite-plugin, playwright, lcp]
created: "2026-11-13T00:56:00-06:00"
updated: "2026-11-13T00:56:00-06:00"

requires:
  - phase: 11-public-site-content-management
    provides: "the real public pages (Home, Products, Gallery, Contact) from plans 11-14, 11-18, 11-25 and 11-31 that this plan measures"
provides:
  - "Build-time Brotli (quality 11) .br files and a server step that sends them only to browsers that list br"
  - "A four-page Lighthouse run (/, /products, /gallery, /contact) with LCP printed per page and still report-only (D-29)"
  - "A build step that stops a peso in display text from downloading the Barlow Condensed latin-ext fonts"
  - "A font network log of the four public pages in fonts.spec.ts, and the recorded Phase 11 LCP numbers"
affects: [11-37, 11-38, release-gates, ci, public-pages, fonts]

estimate:
  tokens: 120000
  raw_tokens: 120000
  tasks: 3
  confidence: low
actuals:
  tokens: 17855
  tasks: 3
  commits: 14
plan_head_before: 8b9defc5b3215dd87b09c9874df2d815eec60c01
plan_head_after: 53724ff5f713dfe444bf7ba7281432cfa330c564

tech-stack:
  added: []
  patterns:
    - "A server step that rewrites the static file path to a precompressed twin only after the request, the twin and the original all check out, and marks the request so the file response gets its Content-Encoding"
    - "A Vite transform that edits Fontsource unicode-range lists by code point"
    - "A Lighthouse run as data: one host, one page per step, a pause and two retries per page, one report per page"

key-files:
  created:
    - web/scripts/vite-brotli-plugin.ts
    - web/scripts/vite-brotli-plugin.test.ts
    - web/scripts/lighthouse.test.ts
    - src/Csps.Server/Http/PrecompressedStaticFiles.cs
    - tests/Csps.Server.IntegrationTests/Http/PrecompressedFilesTests.cs
    - tests/Csps.Testing/Fixtures/webroot/assets/precompressed-sample.js
    - tests/Csps.Testing/Fixtures/webroot/assets/precompressed-sample.js.br
  modified:
    - web/vite.config.ts
    - web/scripts/vite-preload-font-plugin.ts
    - web/scripts/vite-preload-font-plugin.test.ts
    - web/scripts/lighthouse.mjs
    - web/scripts/lighthouse-assert.mjs
    - web/scripts/lighthouse-assert.test.ts
    - web/e2e/fonts.spec.ts
    - src/Csps.Server/Program.cs
    - src/Csps.Server/Composition/SpaRegistration.cs
    - .gitattributes
    - docs/web/budgets.md
    - docs/web/release-gates.md
    - docs/operations/ci.md
    - docs/development.md
    - .planning/WINDOWS.md
    - .planning/phases/03-ci-cd-staging-deploy/deferred-items.md

key-decisions:
  - "A browser gets the .br file only when br is listed in Accept-Encoding with a quality above 0. A wildcard alone does not count, so the crawler path and every odd client stay on the plain file."
  - "The .br file is reached only through its asset's address. Asking for name.js.br directly answers the ordinary 404 problem response."
  - "Font files were not removed. No file a public page requests is unused, so the look-keeping fix is to stop the useless Barlow latin-ext downloads that a peso in display text caused (U+20B1 cut out of the Barlow unicode-ranges)."
  - "A Lighthouse page gets a 15 second pause before it and two more tries, and a failing exit with a finished report still counts. Without these the four-page run failed on Windows with NO_NAVSTART and EPERM errors that are not about the site."
  - "No limit was loosened. LCP stays report-only by D-29 and every other limit stays a hard failure on all four pages."

patterns-established:
  - "Evidence for a browser-side font rule: the same e2e test failed without the build step (barlow-condensed-latin-ext-700-normal requested) and passes with it."

requirements-completed: [PERF-02, PUB-01]

coverage:
  - id: D1
    description: "The production and e2e builds write a quality 11 .br next to every .js, .css and .svg over 1 KB (node:zlib, no package); nothing for 1 KB or less, HTML, fonts or JSON; budget and parity builds skip it"
    requirement: PERF-02
    verification:
      - kind: unit
        ref: "web/scripts/vite-brotli-plugin.test.ts (11 tests, including a real Vite build with a public/ file)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The server sends the .br twin with Content-Encoding br, the original content type, Vary Accept-Encoding, the immutable cache header and its own entity tag only when br is accepted; HEAD, 304 and q=0 behave; a .br is never served by its own address; the shell and JSON are never served from a .br"
    requirement: PERF-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/PrecompressedFilesTests.cs (22 tests); the whole Http namespace 356 passed"
        status: pass
    human_judgment: false
  - id: D3
    description: "A crawler that accepts only gzip and deflate never gets a .br body (gzip, deflate, identity, br;q=0, no header, wildcard)"
    requirement: PUB-01
    verification:
      - kind: integration
        ref: "PrecompressedFilesTests.AClientWithoutBrotliNeverGetsTheBrFile and AWildcardAloneDoesNotSelectTheBrFile"
        status: pass
    human_judgment: false
  - id: D4
    description: "A peso in display text no longer downloads the Barlow Condensed latin-ext fonts, the look is unchanged, Archivo is untouched"
    requirement: PERF-02
    verification:
      - kind: unit
        ref: "web/scripts/vite-preload-font-plugin.test.ts (barlowNoPesoPlugin, 11 tests)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @fonts: 60 passed in 5 projects; the showcase peso test failed without the plugin"
        status: pass
      - kind: other
        ref: "npm --prefix web run parity: 450 passed, 50 failed, the same 50 as the recorded machine baseline"
        status: pass
    human_judgment: true
    rationale: "The look is unchanged by construction (the peso fell through to Archivo before and after), but the parity run has a known baseline of 50 failures, so a person should confirm the look on the money and display text screens."
  - id: D5
    description: "npm run lighthouse scores /, /products, /gallery and /contact on one host, one report per page, LCP printed per page and in one line; a pause and two retries per page; a failing exit with a finished report counts"
    requirement: PERF-02
    verification:
      - kind: unit
        ref: "web/scripts/lighthouse.test.ts and lighthouse-assert.test.ts (83 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "LCP stays report-only after this phase: REPORT_ONLY_METRICS keeps largest-contentful-paint, the 2000 ms target is unchanged, every other category and metric is still a hard failure"
    requirement: PERF-02
    verification:
      - kind: unit
        ref: "web/scripts/lighthouse-assert.test.ts (LCP is report-only (D-29, WINDOWS.md entry 1))"
        status: pass
    human_judgment: false
  - id: D7
    description: "LCP measured on the four real pages before and after and recorded in this SUMMARY, WINDOWS.md entry 1, the Phase 3 deferred-items note and docs/web/budgets.md"
    requirement: PUB-01
    verification:
      - kind: other
        ref: "artifacts/lighthouse reports of three full runs (numbers in the table below)"
        status: pass
    human_judgment: true
    rationale: "LCP is still over 2000 ms on every page and the four-page performance score is flaky on this machine; the owner decides the next step (open items 1 and 2)."

duration: 2h 05m
completed: 2026-11-13
status: complete
---

# Phase 11 Plan 36: Public pages load faster without changing their look, and LCP stays report-only Summary

**Build-time Brotli files served only to browsers that accept them, a four-page Lighthouse run with LCP printed per page and kept report-only by D-29, and the useless Barlow latin-ext peso downloads removed; LCP is still 2.1 to 2.5 s, so font subsetting is the next step (D-124).**

## Performance

- **Duration:** about 2 h 05 min
- **Started:** 2026-11-12T22:55:00-06:00
- **Completed:** 2026-11-13T00:56:00-06:00
- **Tasks:** 3 (Task 3 answered ahead of time by D-124, see the measurement section)
- **Files modified:** 23 (7 created, 16 changed, counting the fixtures and docs; the SUMMARY is the 24th)

## Accomplishments

- **Brotli twins.** `web/scripts/vite-brotli-plugin.ts` writes a quality 11 `.br` next to every `.js`, `.css` and `.svg` over 1 KB in the production and e2e builds (node:zlib, no package). `PrecompressedStaticFiles` sends it only when `br` is listed with a quality above 0, with the original content type, `Vary: Accept-Encoding`, the immutable cache header and its own entity tag. On the production build the entry script is 90,571 B as `.br` against 105,231 B as gzip 9 (13.9 percent smaller) and the CSS is 15,901 B against 19,590 B.
- **Crawlers are safe.** A request with `gzip, deflate`, `gzip`, `identity`, `br;q=0`, a wildcard alone, an empty header or no header never gets the `.br` bytes. A `.br` file is never served by its own address (404 problem response), the shell page and JSON never come from a `.br`, and a response that already has a `Content-Encoding` is not compressed again (the test decodes it once).
- **Four-page Lighthouse run.** One host, `/`, `/products`, `/gallery` and `/contact`, one report per page, LCP printed per page and as one line, LCP still report-only (D-29), every other limit still a hard failure on any page.
- **Useless font downloads removed.** Barlow Condensed has no peso sign (cmap of its latin and latin-ext files checked). A peso in display text still made the browser fetch its latin-ext files (14.6 KB each). `barlowNoPesoPlugin` cuts U+20B1 out of the Barlow unicode-ranges at build time; the peso falls through to Archivo Variable exactly as before.
- **Font network log.** `fonts.spec.ts` lists the font files each public page requests at 390 and 1440 px and proves the preload is a file the page uses.

## Task Commits

1. **Task 1: Brotli twins and the crawler-safe server step (tracer)**
   - RED `1d859edf` test(11-36), GREEN `18d61b7c` perf(11-36)
2. **Task 2: four-page Lighthouse, font clean-up, records**
   - Lighthouse four pages: RED `e772cf56`, GREEN `2c8b5406`
   - Pause between pages: RED `0fbbdc44`, GREEN `d1913721`
   - Barlow peso downloads: RED `91806522`, GREEN `e3aba8ac`
   - Saved report counts after the Windows temp-folder error: RED `47d3937e`, GREEN `92f53be6`
   - Retry a failed page: RED `85ce384f`, GREEN `d184b65a`
   - Font network log and the peso test in the browser: `0c3ec27c` (test)
   - Records and docs: `53724ff5` (docs)
3. **Task 3: font decision.** Not run as a checkpoint. D-124 (owner, 2026-11-11) answers it ahead of time: LCP is over 2000 ms, so the follow-up is listed under the open owner items below. No font or look change was made.

**Plan metadata:** the SUMMARY commit follows this file.

## TDD Gate Compliance

Every GREEN commit has a RED commit before it. How the RED evidence was checked:

| Cycle | RED check |
|---|---|
| Brotli plugin | `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the target test "writes a .br next to every .js, .css and .svg over 1 KB" (it failed on the planned assertion, 7 of 11 tests failed against a no-op stub) |
| Server step | xunit v3 output is not a supported classifier format. Semantic check: 8 of 23 tests failed on the planned assertions, for example the body was the host's own compression and not the `.br` file bytes, and `Vary` was missing for a client without `br` |
| Four-page Lighthouse, pause, retry, saved report | The classifier could not read the report: the failure messages hold Windows paths and multi-line array diffs, which break its YAML (`Non-TAP data`). Semantic check: 15, 3, 2 and 2 tests failed on the planned assertions (page lists, step order, sleep events, exit status), none on import or setup errors |
| Barlow peso plugin | Same classifier limit. Semantic check: 7 of 25 tests failed on the planned assertions against a no-op stub. In the browser the showcase test failed without the plugin on `barlow-condensed-latin-ext-700-normal` |

## Measurements (D-28)

`npm --prefix web run lighthouse`, mobile profile, simulated slow 4G, this shared machine, the real host on https://localhost:5199 serving the production build, database CSPS_E2E (see Deviations). LCP in ms, target 2000, report-only by D-29. "Before" is the Task 1 build (Brotli files, fonts unchanged); "after" is the build with the Barlow peso step. Two "after" runs and one "before" run, all of the four pages each.

| Page | LCP before | LCP after (run 1, run 2) | Font files removed |
|---|---|---|---|
| `/` | 2348 | 2354, 2367 | none requested before or after; the Barlow latin-ext fetch a peso caused is gone |
| `/products` | 2258 | 2134, 2530 | same |
| `/gallery` | 2301 | 2298, 2337 | same |
| `/contact` | 2120 | 2563, 2419 | same |

Other numbers of the same runs:

| Measure | Before | After run 1 | After run 2 |
|---|---|---|---|
| Performance score `/`, `/products`, `/gallery`, `/contact` | 0.96, 0.96, 0.96, 0.97 | 0.96, 0.96, 0.97, **0.94** | 0.96, **0.94**, 0.96, 0.95 |
| CLS `/products`, `/contact` | 0.041, 0.043 | 0.041, 0.043 | 0.041, 0.043 |
| FCP (ms) | not kept | 2068, 1971, 1975, 2258 | not kept |

Also kept: earlier runs of the same fonts build gave `/` 2349 and `/products` 2223 and 2353, `/gallery` 2298. The font requests of the four pages are the same before and after: Archivo latin (the one preloaded file), Barlow Condensed latin 700, 800 italic, and on Home and Contact 800 normal (`fonts.spec.ts` annotations, 390 and 1440 px, 5 projects). Barlow 600 was requested about 4 seconds after load in the Lighthouse runs and not at load in the Playwright log, so an element uses it and it stays. The seeded public pages show no peso in display text, so the new step changes nothing on them; the showcase page, which does, requests `archivo-latin-ext-wght-normal` and no Barlow latin-ext file.

**Reading:** the two columns differ by 200 to 400 ms between runs of identical font requests, so they show machine noise, not a gain. LCP follows FCP by 150 to 300 ms and FCP is 1970 to 2260 ms: the first paint waits for the entry script, the CSS and about 100 KB of fonts on the simulated link. Brotli makes the entry about 14 percent smaller than gzip, but both columns already had the `.br` files, so its effect is not in this table.

**Task 3 (D-124):** every page is over 2000 ms, so, as the owner ruled, the follow-up is listed below. Nothing about fonts or the look was changed and no tool was added.

## Files Created/Modified

See the frontmatter lists. The server step is `src/Csps.Server/Http/PrecompressedStaticFiles.cs` (wired before `UseStaticFiles` in `Program.cs`, content type and encoding header in `SpaCaching`). Deleted files: none.

## Decisions Made

See `key-decisions` above. None needed an owner ruling beyond D-28, D-29, D-46 and D-124.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A `.br` fixture would be rewritten by line-ending rules**
- **Found during:** Task 1
- **Issue:** `.gitattributes` had no rule for `.br`, so git could treat the binary fixture as text.
- **Fix:** added `*.br binary`. The plain fixture `.js` is one line with no trailing newline, so it is immune to CRLF conversion.
- **Files modified:** `.gitattributes`
- **Commit:** `1d859edf`

**2. [Rule 3 - Blocking] Lighthouse answered NO_NAVSTART on some runs and EPERM after others (Windows)**
- **Found during:** Task 2, the first four-page runs
- **Issue:** a second Chrome started within a few seconds of the first closing gave NO_NAVSTART ("run Lighthouse again") every time at 4 s and 15 s pauses in the first tries; separately, `chrome-launcher` failed to delete Chrome's temp profile with EPERM after the report was saved and exited 1. Neither is about the site.
- **Fix:** 15 seconds between pages (`PAGE_PAUSE_MS`), two more tries per page (`PAGE_RETRIES`), and a failing exit with a finished report (audits scored, no runtime error) counts for that page (`lighthouseExitStatus`). A missing report or one with a runtime error still fails the run. All three have RED tests first.
- **Files modified:** `web/scripts/lighthouse.mjs`, `web/scripts/lighthouse.test.ts`, `web/scripts/lighthouse-assert.test.ts`
- **Commits:** `0fbbdc44`, `d1913721`, `47d3937e`, `92f53be6`, `85ce384f`, `d184b65a`

**3. [Rule 2 - Missing critical] The waiver text still said "until Phase 11"**
- **Found during:** Task 2
- **Issue:** D-29 keeps the LCP waiver after Phase 11, but the warning text, the list comment, the docs and the ledger said it ends in Phase 11. A reader would empty `REPORT_ONLY_METRICS`.
- **Fix:** warning now reads `(report only, D-29)`, the comment says not to empty the list without the owner, docs and ledger updated. Added `lcpMilliseconds` for the per-page LCP line.
- **Files modified:** `web/scripts/lighthouse-assert.mjs`, `web/scripts/lighthouse-assert.test.ts`, `docs/web/release-gates.md`, `docs/operations/ci.md`, `docs/development.md`, `.planning/WINDOWS.md`
- **Commit:** `2c8b5406`, `53724ff5`

**4. [Rule 3 - Scope of the font step] No font file was wholly unused**
- **Found during:** Task 2
- **Issue:** the plan expected unused font files to drop from the build or the preload list. Every file the four pages request is used; the only wasted requests were the Barlow latin-ext files a peso in display text fetched, and subsets such as latin-ext and vietnamese stay because customer text may need them.
- **Fix:** `barlowNoPesoPlugin` removes the useless request without removing any file or changing a face. Nothing a page draws changes.
- **Files modified:** `web/scripts/vite-preload-font-plugin.ts`, `web/vite.config.ts`
- **Commit:** `e3aba8ac`

**5. The plan named `web/scripts/lighthouse.test.ts`, which did not exist**
- The earlier Lighthouse run tests live in `lighthouse-assert.test.ts`. The new four-page tests are in the new `lighthouse.test.ts`; the old ones were updated to the new step order and log prefixes.

**6. Measurement setup**
- CSPS_Dev is behind the repository (last applied migration 20261107110304, the repository has 20261113025547), so the public pages would have failed there. The measurements used CSPS_E2E: `dotnet run --project tools/Csps.DevSeed -- --database CSPS_E2E` (migrate and idempotent seed, no reset; it reported SiteSettings and CompanyExpenses as changed) and `ConnectionStrings__Csps` set on the one Lighthouse process. Before each run a bounded wait confirmed no other e2e, parity or Lighthouse runner of this project was active and port 5199 was free. The database drop-and-recreate of `npm run e2e` also ran for the `@fonts` runs, after the same wait.

**Total deviations:** 6 (4 auto-fixed, 2 recorded). **Impact:** all fixes were needed to measure or to keep D-29 true. No limit was loosened, no package added (`git log 8b9defc5..HEAD -- web/package.json web/package-lock.json` is empty).

## Checks run

| Check | Result |
|---|---|
| `npm --prefix web run test -- --run scripts` | 1297 passed, 1 failed: `license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions", the known fresh-worktree install failure |
| `scripts/vite-brotli-plugin.test.ts`, `vite-preload-font-plugin.test.ts`, `lighthouse.test.ts`, `lighthouse-assert.test.ts` | all pass |
| `eslint --max-warnings 0`, `prettier --check`, `tsc -p tsconfig.node.json` on every changed web file | clean |
| `dotnet test --project tests/Csps.Server.IntegrationTests --filter-namespace Csps.Server.IntegrationTests.Http` | 356 passed, 0 failed, no warnings |
| `dotnet test --project tests/Csps.ArchitectureTests` | 290 passed |
| `npm --prefix web run e2e -- --grep @fonts` | 60 passed (12 tests, 5 projects) |
| `npm --prefix web run parity` (no filter) | 450 passed, 50 failed in 29.5 min: groups data 12, money 6, navigation-overflow 6, overlays 18, status 8. That is the same total and the same five groups as the recorded baseline of 50 at f8cbb402; I did not re-run the baseline commit, so the per-group counts of the baseline are not compared |
| `npm --prefix web run build` and `build:budget` | exit 0, no warnings; public JS 149.16 KB (Home), 145.81, 147.17, 149.09, 141.88; admin 218.74; CSS 19.59 KB (production) |
| `npm --prefix web run lighthouse` | **not reliably green**, see open item 1. The before run exited 0 (all four pages passed). After run 1 exited 1 on the performance score of `/contact` (0.94) and after run 2 exited 1 on that of `/products` (0.94). LCP itself never failed a run |
| `gitleaks protect --staged` | no leaks before every commit |

## Open owner items

1. **Decision: the four-page Lighthouse gate is flaky on the performance score.** The performance category (hard limit 0.95) is built partly from LCP, so with LCP at 2.1 to 2.5 s it landed at 0.94 on one page in two of three full runs (a different page each time), and CI would fail those runs. LCP itself is waived, the score is not. Options, recommendation first:
   - **A (recommended): keep the gate exactly as built and run the font subsetting follow-up (item 2) first.** Reason: no limit changes, and a real LCP gain is the only honest way to make the score stable. Until then a failed CI run on `/products` or `/contact` may need a re-run.
   - B: gate the hard limits on `/` only for now and print the other three pages without failing on them. Reason: that is what ran before this plan. It means three pages are not held to the score.
   - C: treat the performance score like LCP (report-only) on all four pages until subsetting lands. Reason: simplest, but it waives a limit the owner has not waived.
2. **Follow-up /gsd-quick: try font subsetting (package check and owner yes before any tool is added).** This is D-124 applied: LCP is over 2000 ms on every public page (table above). No tool or font change was made here.
3. **Decision: CLS is close to its limit on two pages.** `/products` 0.041 and `/contact` 0.043 against 0.05, the same in all runs, now visible because the gate measures them. The shifting element on Contact is the hero `section.relative`. Recommendation: open a quick task to look at it before a copy or content change pushes it over. Not changed here.

## Issues Encountered

- Two Lighthouse failure kinds on Windows (NO_NAVSTART, EPERM), handled in deviation 2.
- The other executor's e2e runs used port 5199 and CSPS_E2E on and off, so every Lighthouse, e2e and parity run waited for an idle machine first. Run-to-run noise on the shared machine is 200 to 400 ms, which is why the table lists every run.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. The new path rewrite is the planned surface (T-11-87, T-11-88): it only touches an existing static asset with the `.js`, `.css` or `.svg` extension, through the same hidden-segment web root provider, and a `.br` address answers 404 on its own.

## Next Phase Readiness

- 11-37 (audit labels) and the remaining Phase 11 plans are not affected.
- Public bundle after this plan (production, gzip): Home 149.16 KB (0.84 KB left), Products 145.81, Gallery 147.17, Contact 149.09 (0.91 KB left), Not found 141.88, admin 218.74, CSS 19.59. Nothing in this plan changed JavaScript.
- Carry-forward: CI now runs four Lighthouse pages with a 15 second pause between them, so the Lighthouse step takes about two minutes longer. Merge hot spots: `web/vite.config.ts` (two new plugins), `docs/web/budgets.md`.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-13*

## Self-Check: PASSED

- Created files exist: `vite-brotli-plugin.ts`, its test, `lighthouse.test.ts`, `PrecompressedStaticFiles.cs`, `PrecompressedFilesTests.cs`, both fixtures (FOUND).
- Commits exist on this branch: `1d859edf`, `18d61b7c`, `e772cf56`, `2c8b5406`, `0fbbdc44`, `d1913721`, `91806522`, `e3aba8ac`, `47d3937e`, `92f53be6`, `85ce384f`, `d184b65a`, `0c3ec27c`, `53724ff5` (14 commits, FOUND).
- Acceptance criteria: `brotliCompressSync` in the plugin (2 matches), `UsePrecompressedStaticFiles` in `Program.cs` (1 match), no change to `web/package.json` or the lockfile, `largest-contentful-paint` in `lighthouse-assert.mjs` (3 matches), `D-29` in `.planning/WINDOWS.md` (2 matches), the SUMMARY has the page, LCP before, LCP after and font files table.
