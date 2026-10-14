---
phase: 02-web-foundation-design-system
plan: 36
subsystem: web-owner-review
tags: [owner-review, d-23, d-24, screenshots, parity-summary, spec-gap, playwright, web-02, a11y-04]
created: "2026-10-13T05:20:00-05:00"
updated: "2026-10-13T05:20:00-05:00"

requires:
  - phase: 02-35
    provides: lighthouse.mjs startHost/portIsBusy, the full 452-row parity run, the e2e host pattern
  - phase: 02-09
    provides: E2E host on https://localhost:5199 and the shared run lock web/.locks/e2e.lock
  - phase: 02-34
    provides: /dev/components showcase with every scenario case as a [data-case] frame
provides:
  - "npm --prefix web run review: git-ignore guard, run lock, busy-port refusal, preflight, guarded CSPS_E2E seed, rebuild-if-stale e2e bundle (L-29), real host for its own run only, 39 page shots + 54 SPEC-GAP shots, plain-words index.html"
  - "Parity summary per engine and group from web/test-results/parity-results.json (Playwright JSON reporter added to the visual config) plus the docs/web/parity.md section 6 differences table with decision IDs"
  - "node web/scripts/design-side-by-side.mjs: guarded local D-24 side-by-side against .planning/design exports (CI / ignore / tracked-file / output guards, network blocked, exact board titles and widths, theme switch)"
  - "docs/web/owner-review.md"
affects: [02-verify, phase-03-ci, every-later-web-plan]

actuals:
  tokens: 26000
  tasks: 2
  commits: 4
plan_head_before: c2c0aee1127129b916b7618c651185527064e2ef
plan_head_after: 7f8d25e540190bde9f6e2169f746184f86560b48

tech-stack:
  added: []
  patterns:
    - "Local-only report scripts: plan (pure, unit-tested) + execute split; every write passes an assert-inside-output-folder check; refuse unless the output folder is git-ignored"
    - "Private design material is read in place with every non-file network request aborted; never copied, never in CI"
    - "Parity results are read from Playwright's JSON reporter, never re-run by the review"

key-files:
  created:
    - web/scripts/owner-review.mjs
    - web/scripts/owner-review.test.ts
    - web/scripts/design-side-by-side.mjs
    - web/scripts/design-side-by-side.test.ts
    - docs/web/owner-review.md
  modified:
    - web/scripts/lighthouse.mjs
    - web/visual/playwright.visual.config.ts
    - docs/web/parity.md
    - .planning/phases/02-web-foundation-design-system/deferred-items.md

key-decisions:
  - "The parity summary comes from a Playwright JSON reporter added to web/visual/playwright.visual.config.ts (git-ignored output under web/test-results/); the review never runs parity itself"
  - "SPEC-GAP pictures are the [data-case] frames on /dev/components in both themes; the skip link is reached by keyboard (Shift+Tab, Tab, then :focus-visible asserted) and photographed at the screen's top left, the drawer as the whole phone screen"
  - "Side-by-side dark renders paint every ancestor of the themed design screen in the screen's own background, so the empty frame below a short screen is not a light strip"
  - "The owner's look approval is NOT given on the owner's behalf: the review pack is complete and logged as pending in deferred-items.md"

duration: about 1h 10m of active work across two sessions
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 36: Owner visual review (D-23 report and D-24 side-by-side) Summary

**Two guarded, local-only report scripts: `npm --prefix web run review` photographs the real host (39 page shots and 54 SPEC-GAP shots, Blush and Espresso, 390/820/1440) and adds the latest parity result (452 matched, 0 failed, three engines) with all 16 intentional differences and their decision IDs; `design-side-by-side.mjs` sets the original design screens next to our pages. The owner's look review is ready and pending.**

## Performance

- **Duration:** about 1h 10m of active work. The first session ran 2026-10-09 07:30 to 08:10 CDT and stopped at the API usage limit. The continuation ran 2026-10-13 05:00 to 05:20 CDT.
- **Started:** 2026-10-09T12:30:00Z
- **Completed:** 2026-10-13T10:20:00Z
- **Tasks:** 2 of 2
- **Files:** 9 (5 created, 4 modified)

## Accomplishments

- **D-23 report** (`artifacts/owner-review/index.html`, git-ignored). The script:
  - takes the e2e run lock;
  - refuses a busy port 5199;
  - runs the preflight and the guarded CSPS_E2E seed;
  - rebuilds `web/.e2e-dist` whenever any build input is newer (L-29);
  - starts the real host for its own run only.
- **What the report contains:**
  - 39 page shots (`/` in Blush; five admin previews and `/dev/components` in Blush and Espresso; 390, 820 and 1440 px);
  - 54 SPEC-GAP shots: 27 cases × 2 themes, covering Pagination, OtpInput, MoneyInput, Checkbox, SkipLink, the list states, ErrorState, skeletons, LoadingRegion, LazyImage, the drawer and the user menu;
  - the latest full parity run (452/452, 2026-10-09, about 28 min, no filters), shown per engine and group;
  - the section 6 differences table from `docs/web/parity.md`, 16 rows, each with its decision ID;
  - the counts of structural exceptions and tolerances from `intentional-differences.ts`.
- **D-24 side-by-side** (`artifacts/owner-review/side-by-side/index.html`, git-ignored). It refuses to run:
  - in CI;
  - when `.planning/design` is not ignored;
  - when any file under it is tracked;
  - when its own output folder is not ignored.

  It opens the two exports in place with all network blocked, picks each board by its exact title, checks the board's width and switches its theme. The result is 32 design pictures paired with our shots.
- **`docs/web/owner-review.md`** explains in plain words how to make and how to read both reports.

## Task Commits

1. **Task 1: tracer — the guarded review script captures from the real host**
   - RED `973a837` (test)
   - GREEN `de28334` (feat)
2. **Task 2: SPEC-GAP section, parity summary and the guarded D-24 side-by-side**
   - RED `226a98e` (test)
   - GREEN `7f8d25e` (feat)

## Files Created/Modified

- `web/scripts/owner-review.mjs` contains:
  - `planReview` and `REVIEW_WIDTHS`;
  - `SPEC_GAP_CASES` and `planSpecGapShots`;
  - `summarizeParity` and `parseDifferencesTable`;
  - `renderIndex`;
  - the capture and report writers.
- `web/scripts/owner-review.test.ts` holds 49 tests.
- `web/scripts/design-side-by-side.mjs` contains:
  - `checkGuards` and `planSideBySide`;
  - `PAIRINGS`;
  - `assertSideBySidePath`;
  - `renderSideBySide`.
- `web/scripts/design-side-by-side.test.ts` holds 24 tests.
- `web/scripts/lighthouse.mjs` now exports `startHost` and `portIsBusy`, so the review can reuse them.
- `web/visual/playwright.visual.config.ts` adds the JSON reporter, which writes `web/test-results/parity-results.json`.
- `docs/web/owner-review.md` is the new guide. `docs/web/parity.md` gets a note about the results file.
- `deferred-items.md` records the pending owner review.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Parity results file for the summary**
- **Found during:** Task 2
- **Issue:** the plan requires pass counts per engine and group. The parity run printed only a list report, so nothing on disk held those counts.
- **Fix:** added a Playwright JSON reporter to `web/visual/playwright.visual.config.ts`. Its output is git-ignored under `web/test-results/`. Also added a one-line note in `docs/web/parity.md`. Neither file is in the plan's `files_modified`.
- **Commit:** `7f8d25e`

**2. [Rule 1 - Bug] The skip link picture was blank**
- **Found during:** Task 2 (continuation review of the shots)
- **Issue:** `.focus()` does not give `:focus-visible`. With keyboard focus, the SkipLink is `position: fixed` at the viewport's top left, so a frame screenshot can never show it.
- **Fix:**
  - reach the link by keyboard (Shift+Tab, then Tab);
  - assert `:focus-visible`;
  - photograph the top 160 px of the screen.
- **Commit:** `7f8d25e`

**3. [Rule 1 - Bug] Light strip under dark design screens**
- **Found during:** Task 2
- **Issue:** a wrapper `div` in the export, above the themed `.s-page`, keeps the light page colour. Below short dark screens it showed a blush band that is not part of the design.
- **Fix:** paint every ancestor of the themed element in that element's own computed background.
- **Commit:** `7f8d25e`

**4. [Rule 1 - Lint] `no-unsafe-assignment` on the `page.evaluate` result**
- **Fix:** typed the result as `unknown`, then compared it with `!== true`.
- **Commit:** `7f8d25e`

**Note:** the continuation brief spoke of three tasks. The plan has two. The only remaining item was Task 2's `<human-check>`, the owner's look review. It is pending, not approved (see below).

## Issues Encountered

- The first executor stopped at the API usage limit with Task 2 GREEN uncommitted. This continuation reviewed that work and kept it. It then fixed deviations 2 to 4 and committed.

## TDD Gate Compliance

- **Task 1:** RED `973a837` (RED_EVIDENCE_OK, 32 of 35 failing on assertions against stubs), then GREEN `de28334`.
- **Task 2:** RED `226a98e` (RED_EVIDENCE_OK for both files), then GREEN `7f8d25e`. No refactor commit was needed.

## Verification

- `npm --prefix web run test -- --run scripts/design-side-by-side.test.ts scripts/owner-review.test.ts`: 73 of 73 passed (24 + 49).
- `npm --prefix web run review`: exit 0 after the preflight. It produced 39 shots and 54 SPEC-GAP shots. The report says "The pages reported no errors".
- `node web/scripts/design-side-by-side.mjs`: exit 0. It produced 32 design pictures and `side-by-side/index.html`, which contains no remote addresses.
- `git check-ignore .planning/design artifacts/owner-review` prints both paths. `git ls-files .planning/design artifacts` prints nothing. `git status --porcelain artifacts web/src src/Csps.Server` is clean.
- The report's parity section lists all 16 differences, each with its decision ID (D-01 … D-40, WEB-09, PERF-05).
- `npm --prefix web run verify`: exit 0 with zero warnings. That is 103 files and 2711 tests, with coverage at 98.05% statements and 96.09% branches. The budgets, the license gate and the notices check all pass.

## Owner Decisions Pending (logged in deferred-items.md)

- **Owner visual review of the phase 2 look (end-of-phase human check):**
  - Open `artifacts/owner-review/index.html` and `artifacts/owner-review/side-by-side/index.html`.
  - Check the public layout (Blush), the admin frame and the showcase (Blush and Espresso) at 390, 820 and 1440 px.
  - Check the SPEC-GAP parts and the differences list.
  - Every difference the owner names becomes a gap-closure fix; a look change becomes a D-08 decision.
  - **Not auto-approved.**

## Known Stubs

None. The report notes, on purpose and in plain words, that the admin pages and the public home are still placeholders (D-20).

## Threat Flags

None. No new network, auth or schema surface. The scripts are local tools: T-02-77 and T-02-78 are mitigated as planned, and no package was installed (T-02-SC).

## User Setup Required

None.

## Next Phase Readiness

- The phase's automated plans are complete. Phase 2 sign-off waits on the owner's visual review and on the open look questions in deferred-items.md.

## Self-Check: PASSED

- FOUND: web/scripts/owner-review.mjs, web/scripts/owner-review.test.ts, web/scripts/design-side-by-side.mjs, web/scripts/design-side-by-side.test.ts, docs/web/owner-review.md
- FOUND commits: 973a837, de28334, 226a98e, 7f8d25e
- FOUND (local, git-ignored): artifacts/owner-review/index.html, artifacts/owner-review/side-by-side/index.html
