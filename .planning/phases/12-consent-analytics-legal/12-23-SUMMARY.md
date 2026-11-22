---
phase: 12-consent-analytics-legal
plan: 23
subsystem: ui
tags: [analytics, visitor-stats, admin, react, nuqs, zod, tanstack-query, tdd]
requires:
  - phase: 12-consent-analytics-legal
    provides: "12-21 GET /api/v1/visitor-stats (totals, resolved range, cut date) and the server's custom range messages"
provides:
  - "/admin/visitor-stats lazy Manager-only page (VisitorStatsRoute, VisitorStatsPage)"
  - "VISITOR_STATS_NAV_ITEM after Site Content in the sidebar and phone drawer; AdminSection 'stats'"
  - "icons chart-column, circle-x, download (D-32)"
  - "EmptyValue label prop and KpiCard emptyLabel (SPEC-DEVIATION EMPTY-LABEL)"
  - "visitorStatsService (OR-5), useVisitorStatsQuery, useVisitorStatsParams, visitorStatsRange (zod mirror, 3-year floor), VISITOR_STATS_COPY"
  - "VisitorKpiRow, VisitorStatsToolbar, StatsCustomRange, visitorStats.recipe"
affects: [12-24, 12-25, 12-26, 12-27, 12-28]
actuals:
  tokens: 18000
  tasks: 3
  commits: 7
plan_head_before: e081aaa2bf1eeea25a391ba713fff5f63e42ef8d
plan_head_after: 033065c0f3025ba0a68c3ca4d674161429063d5d
tech-stack:
  added: []
  patterns:
    - "A custom range that does not pass keeps the last applied query (adjusted during render), and waits for the business today before any request"
    - "Range change dims KPI values by colour only under the LoadingRegion's aria-busy"
key-files:
  created:
    - web/src/modules/admin/pages/VisitorStatsPage.tsx
    - web/src/modules/admin/services/visitorStatsService.ts
    - web/src/modules/admin/hooks/useVisitorStatsQuery.ts
    - web/src/modules/admin/hooks/useVisitorStatsParams.ts
    - web/src/modules/admin/visitorStatsRange.ts
    - web/src/modules/admin/visitorStatsCopy.ts
    - web/src/modules/admin/components/VisitorKpiRow.tsx
    - web/src/modules/admin/components/VisitorStatsToolbar.tsx
    - web/src/modules/admin/components/StatsCustomRange.tsx
    - web/src/modules/admin/components/visitorStats.recipe.ts
  modified:
    - web/src/components/states/EmptyValue.tsx
    - web/src/components/money/KpiCard.tsx
    - web/src/components/brand/icons.ts
    - web/src/components/navigation/Sidebar.tsx
    - web/src/components/navigation/index.ts
    - web/src/modules/admin/sections.ts
    - web/src/modules/admin/routes.tsx
key-decisions:
  - "Presets are sent by name only; the browser never works out preset dates (D-24)"
  - "KpiCard gained an emptyLabel prop so the KPI card can say 'Not available' (EMPTY-LABEL needed it one level up)"
  - "A custom range in the URL holds the stats request until the business today is known, so a shared link asks once, for its own dates"
requirements-completed: [ANL-08]
coverage:
  - id: D1
    description: "A Manager opens /admin/visitor-stats and reads the h1, the server-range subline and the three KPI totals with en-PH grouping, Not available and partial hints"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 the KPI row"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/services/visitorStatsService.test.ts"
        status: pass
      - kind: integration
        ref: "web/src/modules/admin/routes.test.tsx#Visitor Stats for Managers"
        status: pass
    human_judgment: false
  - id: D2
    description: "Visitor Stats menu item for Managers only after Site Content (sidebar and drawer, not the tab bar); an Admin is redirected to /admin with no stats request"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/components/navigation/Sidebar.test.tsx#Sidebar Visitor Stats item"
        status: pass
      - kind: integration
        ref: "web/src/modules/admin/routes.test.tsx#an Admin who opens /admin/visitor-stats is sent to /admin before any stats request"
        status: pass
    human_judgment: false
  - id: D3
    description: "Date range toolbar: presets in ?range= with replace, Custom range with the server's five messages, last applied range kept, aria-busy dimming"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/VisitorStatsPage.test.tsx#V1 the date range toolbar"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/visitorStatsRange.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useVisitorStatsParams.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Look at 320, 390, 820 and 1440 px in Blush and Espresso: toolbar wraps under the title, controls full width on phones, KPI grid 3 / 2+1 / 1, dimming on a range change"
    verification: []
    human_judgment: true
    rationale: "jsdom checks only the class names; real layout and colours need the owner screenshots or Playwright (owned by 12-24 in this wave)"
duration: "about 1h 50m"
completed: 2026-11-17
status: complete
created: "2026-11-17T21:04:02-06:00"
updated: "2026-11-17T21:04:02-06:00"
---

# Phase 12 Plan 23: A Manager opens Visitor Stats and sees visitors, visits and page views for a chosen date range Summary

*Created: 2026-11-17T21:04:02-06:00 · Updated: 2026-11-17T21:04:02-06:00*

**What shipped:** a Manager-only Visitor Stats page at `/admin/visitor-stats`. It has its own menu item after Site Content, a head that shows the date range the server worked out, three KPI cards with the server's counts (shown as "Not available" past 13 months), and a Date range toolbar. The toolbar offers the 5 server presets and a Custom range, checked in the browser with the server's own words.

## Performance

- **Duration:** about 1h 50m (01:15Z to 03:04Z; most of the end was the full verify runs)
- **Tasks:** 3 of 3
- **Files changed:** 30 (10 created source files, 7 changed source files, the rest tests)

## Accomplishments

- **Page (Task 1, tracer):** `VisitorStatsRoute` sets the title "Visitor Stats · CSPS Admin". The subline reads "Oct 17 to Nov 15, 2026 · Visits to the public website. Staff signed in to admin aren't counted.", built from the server's `from` and `to`; the first date drops its year when both are in the same year. One `LoadingRegion` "the visitor stats" wraps the KPI row. A failed first read shows `ErrorState` with Try Again.
- **KPI row:** "Unique visitors" (users), "Visits" (clock), "Page views" (eye), with the hints from the UI-SPEC and en-PH grouping. A null count shows `EmptyValue` read as "Not available" with the hint "Not available for dates over 13 months ago". When `countedFrom` is set, the hint reads "Counted from Oct 15, 2025 only". The grid is 3 across, 2 then 1 on tablet, and 1 column on phones.
- **Service:** `GET /visitor-stats` with `range` (plus `from` and `to` for custom). Counts are narrowed with `requireFigure`, a bad count raises `VisitorStatsContractError`, and nulls are kept.
- **Menu (Task 2):** `VISITOR_STATS_NAV_ITEM` is added by `withAuditLog` after Site Content in the sidebar and the drawer. It is Manager only and not in the tab bar. `adminNavItemForPath` marks it current. The lazy route uses the `requireManager` loader, so an Admin goes to `/admin` before any stats request.
- **Icons:** `chart-column`, `circle-x` and `download` come from the installed lucide-react 1.53.0. No package was added.
- **Range (Task 3):** `STATS_PRESETS` holds the 5 server presets. `DEFAULT_STATS_RANGE` is `last-30-days` and stays out of the URL. `STATS_KEPT_YEARS = 3`, and `statsFloor` follows `DateOnly.AddYears(-3)`, so Feb 29 becomes Feb 28. The zod schema returns the five server messages. `useVisitorStatsParams` is the one URL hook (`createListParams(dateRangeParsers(...))`), with replace history. An unknown range, including `today`, falls back to last 30 days.
- **Custom range:** `StatsCustomRange` reads today from `useBusinessToday` and bounds From and To by the floor and today. Messages show once a date is touched. The range is applied only when both dates are valid; until then the page keeps the range it last applied. A shared custom link waits for today and then asks once, for its own dates.
- **Range change:** the last figures stay on screen with `aria-busy`, dimmed by colour only (`text-ink-subtle`, D-02), until the new ones arrive.

## Task Commits

1. **Task 1: page head and KPI row (tracer):** RED `1474bd00`, GREEN `e985012f`
2. **Task 2: Manager-only menu item:** RED `7695b3a1`, GREEN `a136a504`
3. **Task 3: date range toolbar:** RED `4205d810`, GREEN `13cf8e95`
4. **Fix found by verify:** `033065c0` (the showcase icon count, see Deviations)

## TDD record

| Task | RED | GREEN | RED evidence (gsd `check tdd-red-evidence`) |
|------|-----|-------|------|
| 1 | 1474bd00 | e985012f | `RED_EVIDENCE_OK`: target `visitorStatsService.test.ts > visitorStatsService.get > calls GET /api/v1/visitor-stats with the preset name and no dates` (6 of 6 failed on the stub's "Not built yet."). The page tests (11 of 11) failed on "Unable to find an element with the text: 4,567"; EmptyValue and KpiCard failed on the label assertions. |
| 2 | 7695b3a1 | a136a504 | `RED_EVIDENCE_OK`: target `sections.test.ts > adminNavItemForPath > finds the Visitor Stats item...`, "expected undefined to be 'stats'". 15 tests failed on assertions. The Admin redirect tests passed already, because the Task 1 loader gives that behaviour; they stay as pinned tests. |
| 3 | 4205d810 | 13cf8e95 | `RED_EVIDENCE_OK`: target `visitorStatsRange.test.ts > statsCustomRangeErrors > asks for a start date`, "expected null to be 'Enter a start date.'". 40 of 53 failed on assertions against stubs; the 13 that passed are Task 1 page tests and two stub-neutral cases. |

**Semantic assessment:** each RED target ran and failed on the planned behaviour being missing (a stub with no logic). None failed on a load, syntax or fixture fault. The classifier rejected the multi-file TAP because vitest prints multi-line DOM dumps, so each record came from a single-file run (narrowed with `-t` for Task 3). The records are in the session scratchpad, not the repo.

## Verification (real output)

- Task 1 verify (plan command): `Test Files 4 passed (4)`, `Tests 96 passed (96)`. Re-run for the tracer gate, then expansion continued.
- Task 2 verify: `Test Files 6 passed (6)`, `Tests 356 passed (356)`.
- Task 3 verify (with `no-long-dash.node.test.ts`): `Test Files 4 passed (4)`, `Tests 54 passed (54)`.
- `npm --prefix web run lint`: exit 0. `npm --prefix web run typecheck`: exit 0. `prettier --check .`: passed inside verify.
- `npm --prefix web run verify`: typecheck, lint and format:check passed, but test:coverage failed in all four full runs, each time on tests this plan does not touch (see Issues):
  - Run 1: the showcase icon count (a real failure from this plan, fixed in `033065c0`) and `license-policy.test.ts` (environment).
  - Run 2: `OrderItemModal` 2 tests.
  - Run 3: `PublicLayout` beacon 1 test.
  - Run 4: `OrderItemModal` 2 tests and `OrderFormPage` axe 1 test.
  - Best run: `Tests 1 failed | 11320 passed (11321)`.
- The steps after test:coverage, run one by one: `build` exit 0, `build:budget` exit 0, `license:check` exit 0, `notices:check` exit 0.
- `build:budget`: `| admin JS | 219.86 KB | 250.00 KB | ok |`, CSS 20.45 KB. The tightest public row is privacy at 149.51 KB; this plan changed no public file.
- Coverage thresholds: **not confirmed.** Vitest prints no coverage table when a test fails, and no full run was clean. The new files' own tests all pass (VisitorStatsPage 28, params 11, service 6, range 14).
- Acceptance greps: `visitor-stats` in routes.tsx 1; "Staff signed in to admin aren't counted." in copy 2; `label?:` in EmptyValue 1; `'chart-column'` 1, `'circle-x'` 1; `VISITOR_STATS_NAV_ITEM` in sections.ts 2; `STATS_KEPT_YEARS = 3` on line 14; "Enter a start date." in visitorStatsCopy.ts 1; `useBusinessToday` in StatsCustomRange.tsx 3.
- gitleaks before each commit: "no leaks found" every time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] KpiCard needed an `emptyLabel` prop**
- **Found during:** Task 1
- **Issue:** KpiCard draws `<EmptyValue />` itself, so the KPI card could not pass "Not available" down.
- **Fix:** added an optional `emptyLabel` to KpiCard and passed it to EmptyValue. Without it the card still says "Not set". Test added in `money.test.tsx`.
- **Files:** `web/src/components/money/KpiCard.tsx`, `web/src/components/money/money.test.tsx` (neither is in the plan's file list)
- **Commits:** 1474bd00, e985012f

**2. [Rule 1 - Bug] Pinned nav and icon counts in tests outside the plan's file list**
- `web/src/layouts/AdminLayout.test.tsx` pins the full sidebar order. It was updated in the GREEN commit a136a504, not in RED, because it was found in the GREEN run.
- `web/src/modules/admin/pages/ComponentShowcasePage.test.tsx` counts every icon (71, now 74). This was found by verify and fixed in 033065c0.

**3. [Rule 2 - Correctness] A custom URL range waits for the business today**
- **Issue:** a shared `?range=custom&from=&to=` link would first ask for the default range while today loads, then ask again.
- **Fix:** `useVisitorStatsQuery(query, enabled)`. The request is held while the range is custom and today is unknown.
- **Commit:** 13cf8e95

**4. [Process] Acceptance grep `'download'`**
- Prettier removes quotes from keys that don't need them, so the key is `download: Download`. The `grep -c "'download'"` check returns 0. The icon is registered, and the Icon test lists `'download'`.

**5. [Process] Plan text versus the environment**
- The plan names branch `gsd/phase-12-...` and `gitleaks protect`. This ran in worktree branch `worktree-agent-a55023e62c0727f99` and used `gitleaks git --pre-commit --staged --redact --config .gitleaks.toml --no-banner`, as the dispatch said.
- The plan ledger could not be written into the git dir (the harness refused it), so the base `e081aaa2` was recorded in the scratchpad. `commits: 7` is measured with `git rev-list --count e081aaa2..HEAD`.

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 correctness) and 2 process notes. **Impact:** each change was small and needed for the plan; nothing beyond the plan was added.

## Issues Encountered

- **Load flakes during full runs.** The sibling 12-24 was running Playwright and Lighthouse at the same time. Each failure passed when run alone:
  - `OrderItemModal.test.tsx` "sends one request for a double click" and "shows Saving..." failed in 2 of 4 full runs ("expected [...] to have a length of 1 but got 2") and passed alone 4 of 4 (33 of 33 each time).
  - `PublicLayout.test.tsx`: two cookie bar tests failed once in a targeted run and the beacon test once in a full run; it passed alone 2 of 2.
  - `OrderFormPage.test.tsx` axe failed once; it passed alone 84 of 84.
  - This plan touches none of these files. The OrderItemModal double-click case is new to the flake list and worth watching at the wave gate.
- **Environment:** `scripts/license-policy.test.ts` failed in run 1 with "No packages found in this path" because `tools/openapi-gen/node_modules` was not installed in this worktree. After `npm --prefix tools/openapi-gen ci` (lock file only, no package change) it passed.
- No Playwright, Lighthouse, parity run or dev server was started, and no file under `web/e2e/` was edited.

## Known Stubs

None. The 13-month Note, trend, lists, speed, export and the empty state belong to plans 12-25 to 12-28, as the plan says.

## Known limitation (for 12-28 states)

- If the business today call fails while the range is custom, the KPI row stays in its loading state, because the request waits for today. `useBusinessTodayState` exposes `isError`, so 12-28 can show the ErrorState there.

## Open owner questions (not decided here)

1. **"Today" range (STATE row "12-21 today range").** The UI-SPEC shows a "today" choice the server does not offer. This page offers the 5 server presets only, and `?range=today` falls back to Last 30 days (tested). Options:
   - **(A) drop "today" from the page and the UI-SPEC.** Recommended: it matches the server and D-24, and nothing more to build.
   - (B) add `today` to the server presets (a Domain change plus tests).
   - (C) send "today" as a custom range with the same day for From and To (no server change; the page would need a seventh option).
2. **Visits, not visitors, in daily figures (wave note).** This plan shows totals only. "Unique visitors" here is the server's distinct count over the whole range. The page says "Visits" wherever visits are counted. No decision needed now; it is for 12-25.

## Threat Flags

None beyond the register. T-12-61: allow-list parsers for `range` and calendar-date parsers for `from` and `to`, and the server validates again. T-12-62: loader redirect before any request (tested with 0 stats calls), item hidden from Admins, API 403. T-12-SC: no package added or bumped; `npm ci` used the lock files only.

## User Setup Required

None.

## Next Phase Readiness

12-25 to 12-28 can add the Note, trend, lists, speed, states and export inside the page's `LoadingRegion` and head. `VISITOR_STATS_COPY`, `visitorStats.recipe.ts` and the `download` and `circle-x` icons are ready. The `node_modules` folders installed in this worktree are git-ignored. No junctions or background shells were left.

## Self-Check: PASSED

All 10 created files exist and all 7 commits (1474bd00, e985012f, 7695b3a1, a136a504, 4205d810, 13cf8e95, 033065c0) are ancestors of HEAD (checked below before commit).

---
*Phase: 12-consent-analytics-legal*
*Completed: 2026-11-17*
