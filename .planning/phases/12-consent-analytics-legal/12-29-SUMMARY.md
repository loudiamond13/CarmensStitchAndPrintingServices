---
phase: 12-consent-analytics-legal
plan: 29
subsystem: component-showcase
tags: [showcase, scenarios, dev-only, visitor-stats, consent, legal, a11y, playwright, bundle-budget]
created: "2026-11-18T06:20:00-06:00"
updated: "2026-11-18T06:20:00-06:00"

requires:
  - phase: 12-27
    provides: "PageSpeedCard, the speed answer shape and the page states (13-month Note, no visits, stale line)"
  - phase: 12-26
    provides: "StatBarList and the { name, count, share } list shape"
  - phase: 12-25
    provides: "VisitorTrendChart with null unique visitors before the cut"
  - phase: 12-17
    provides: "ClearDataDialog and the clear outcomes"
  - phase: 12-09
    provides: "ConsentBar, CookieSettingsDialog and the shared consent store"
  - phase: 12-07
    provides: "LegalNotice"
provides:
  - "visitor-stats scenario group: 16 Visitor Stats states in Blush and Espresso"
  - "consent scenario group: the cookie bar, five Cookie Settings states and the DRAFT notice, Blush only"
  - "Showcase sections 'Visitor stats' and 'Cookies and legal', with live Cookie Settings demos"
  - "demoConsent: seeds the shared consent store over an in-memory cookie and a stand-in service"
affects: [ui-review, component-showcase, parity, 12-28]

actuals:
  tokens: 12500
  tasks: 2
  commits: 6

plan_head_before: 7dad82ff28fdbbf0aecea3c7e34b917de42aac2b
plan_head_after: 899a7d4f4d1fc78b3dc4768812fa04c1c509c62f

tech-stack:
  added: []
  patterns:
    - "Admin or public module parts reach the kit through a dev preview file that re-exports them"
    - "A preview that imports a public part must reach the same module set as its public importers, or the bundler splits their shared chunk (D-42)"
    - "A fixed-position public scenario is a viewport case on the parity page and a live demo on a Blush surface in the showcase"

key-files:
  created:
    - web/src/dev/scenarios/groups/visitor-stats.ts
    - web/src/dev/scenarios/groups/consent.ts
    - web/src/dev/previews/VisitorStatsParts.tsx
    - web/src/dev/previews/StaticConsentBar.tsx
    - web/src/dev/previews/OpenedCookieSettings.tsx
    - web/src/dev/previews/PublicLegalNotice.tsx
    - web/src/dev/previews/demoConsent.ts
  modified:
    - web/src/dev/renderScenario.test.tsx
    - web/src/modules/admin/components/showcase/showcaseSections.ts
    - web/src/modules/admin/components/showcase/showcaseSections.test.ts
    - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
    - web/src/modules/admin/components/showcase/showcaseCopy.ts
    - web/src/modules/admin/components/showcase/showcase.recipe.ts
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
    - web/e2e/showcase.spec.ts

key-decisions:
  - "Two new showcase sections, 'Visitor stats' and 'Cookies and legal' (dev wording; see open question 1)"
  - "The page states that live only in VisitorStatsPage (13-month Note, no visits, failed read, stale line) are drawn by a preview with the page's own copy and classes, because the page has an h1"
  - "The cookie bar is drawn in flow by setting its position to static through the DOM after mount (a CSSOM write, allowed by the strict CSP); no new CSS rule"
  - "A demo clear restores localStorage and sessionStorage afterwards, so a Manager on /admin/components keeps the admin theme and list views"
  - "The DRAFT notice preview also re-exports LegalPage and LEGAL_PAGES so the legal pages keep one shared chunk (see Deviation 2)"

patterns-established:
  - "Scenario groups for module parts: relative type imports only; copy-bearing states go in a preview so the scenario holds demo data only"

requirements-completed: [ANL-08, ANL-01, LEGAL-05]

coverage:
  - id: D1
    description: "Visitor Stats scenarios: trend at 30 days, 12 months and across the 13-month cut; StatBarList 0, 1 and 10 rows; Page speed with Good, Needs work and Poor, no layout shift ('Not measured'), no data, over 13 months; KpiCard 'Not available' and 'Counted from'; the 13-month Note, no visits, failed read and failed refresh. Each renders with no console output, no axe finding and no request"
    requirement: ANL-08
    verification:
      - kind: unit
        ref: "web/src/dev/renderScenario.test.tsx#the Visitor Stats scenarios (plan 12-29)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Consent and legal scenarios in Blush: the bar in the page flow (a choice sends nothing), Cookie Settings with no choice, saved, GPC, cleared (Done Note, boxes unticked, storage kept) and clear failed (failure line), and the DRAFT notice"
    requirement: ANL-01
    verification:
      - kind: unit
        ref: "web/src/dev/renderScenario.test.tsx#the consent and legal scenarios (plan 12-29)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/ComponentShowcasePage.test.tsx#opens Cookie Settings in each state from its demo, in the Blush look, and Esc closes it again"
        status: pass
    human_judgment: false
  - id: D3
    description: "The showcase E2E covers the two new sections with its existing checks (one h1, every section, page-level axe in Blush and Espresso, no sideways scroll at 320 px, no API call for a Manager) in all five projects"
    requirement: LEGAL-05
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @showcase (chromium 24 of 24; firefox, webkit, pixel, iphone 95 of 96, the one Firefox timeout passed alone)"
        status: pass
    human_judgment: false
  - id: D4
    description: "How the new cases look side by side in the showcase (layout, wrapping, the Blush demo surface in the Espresso shell) for the owner's UI review"
    verification: []
    human_judgment: true
    rationale: "The tests check roles, text, axe and width only; the look is for /gsd-ui-review 12"

duration: 163min
completed: 2026-11-18
status: complete
---

# Phase 12 Plan 29: Consent, legal and stats parts in the component showcase Summary

*Created: 2026-11-18T06:20:00-06:00 · Updated: 2026-11-18T06:20:00-06:00*

**Two new scenario groups put every Phase 12 part in the component showcase on made-up data. `visitor-stats` (16 cases, Blush and Espresso) covers the trend chart, the ranked lists, Page speed, the "Not available" KPI and the page states. `consent` (7 cases, Blush only) covers the cookie bar drawn in the page flow, five Cookie Settings states on a seeded consent store with no network, and the DRAFT notice. The showcase has two new sections, "Visitor stats" and "Cookies and legal", and the Cookie Settings states open as live demos.**

## Performance

- **Duration:** 163 min (about 2 h 43 min)
- **Started:** 2026-11-18T09:32:38Z
- **Completed:** 2026-11-18T12:15:13Z
- **Tasks:** 2 (both TDD; Task 1 was the tracer)
- **Files:** 15 (7 created, 8 modified)

## Accomplishments

- **Visitor Stats cases** (`visitor-stats.ts`, all `parity: false`, both themes):
  - Trend: `visitor-trend-30-days` (Oct 17 to Nov 15, 2026), `visitor-trend-12-months`, and `visitor-trend-13-month-gap` (18 months; the 4 months before Oct 2025 have page views but `uniqueVisitors: null`, so the line stops).
  - `visitor-stats-cut-note`, `kpi-visitors-counted-from` and `kpi-visitors-not-available` (KpiCard `empty`, label "Not available").
  - `stat-bar-list-empty`, `-one` and `-ten` (made-up referrers).
  - `page-speed-ratings` (Good, Needs work, Poor), `page-speed-no-layout-shift` ("Not measured"), `page-speed-no-data` and `page-speed-over-13-months`.
  - `visitor-stats-no-visits`, `visitor-stats-load-error` (ErrorState with Try Again and a reference) and `visitor-stats-stale` ("Showing figures from 9:41 AM. Couldn't refresh.").
- **Consent and legal cases** (`consent.ts`, Blush only):
  - `consent-bar`: StaticConsentBar draws the real ConsentBar in a `data-theme="light"` box. Its position is set to static after mount.
  - `cookie-settings-no-choice`, `-saved`, `-gpc`, `-cleared` and `-clear-failed`: viewport cases. OpenedCookieSettings seeds the shared store and opens the real window. For the two clear states it presses Clear My Cookies & Data and then Clear My Data, as a person would.
  - `legal-notice`: the DRAFT notice.
- **No network, no cookie:** `demoConsent.ts` resets the one shared consent store over an in-memory cookie, a fixed demo day (so the saved line always reads "You chose on Nov 3, 2026") and a stand-in service. A choice or a clear sends nothing. A demo clear puts this browser's storage back afterwards.
- **Showcase:** two new sections, "Visitor stats" and "Cookies and legal". The five Cookie Settings states are live demos (VIEWPORT_DEMOS). Each opens a fresh window on a Blush surface. Esc closes it and focus returns to the trigger.
- **Wave note on 12-28:** no scenario uses the toolbar, a Download button or an export field, so nothing here depends on 12-28. There is nothing to reconcile after the merge.

## Task Commits

1. **Task 1 (tracer): Visitor Stats states:** RED `e02b070e`, GREEN `565e23d2`. Tracer gate: the run is interactive in `end-of-phase` mode with an automated-only `<verify>`, so I re-ran it on the committed code. `npm --prefix web run test -- --run src/dev/renderScenario.test.tsx` gave "Test Files 1 passed (1), Tests 26 passed (26)", exit 0. Then I moved on to Task 2.
2. **Task 2: consent bar, Cookie Settings states, DRAFT notice:** RED `e177b70b`, GREEN `1ea9c637`.
3. **Fixes found by the build and E2E:** `d95de058` (budget) and `899a7d4f` (320 px width, Espresso contrast, E2E waits).

## TDD Gate Compliance

| Task | RED | GREEN | RED evidence (`gsd check tdd-red-evidence`) |
|------|-----|-------|----------------------------------------------|
| 1 | e02b070e | 565e23d2 | `RED_EVIDENCE_OK` (TAP, 26 tests, 22 failed). Target "lists every Visitor Stats state in the visitor-stats group ..." failed with `expected +0 to be 16`. |
| 2 | e177b70b | 1ea9c637 | `RED_EVIDENCE_OK` (TAP, 39 tests, 13 failed). Target "lists the bar, every Cookie Settings state and the DRAFT notice ..." failed with `expected +0 to be 7`. |

**Semantic assessment:**
- Each target ran and failed on its planned assertion, because the group did not exist yet. There was no build, load or fixture fault.
- The first Task 1 record was `invalid_record`: the deep-equal diff broke TAP, as 12-27 also found. I added a one-line count check as the first assertion, re-ran, and got `RED_EVIDENCE_OK`. The behaviour the test checks did not change.
- The four `renderNode` tests passed during RED. They test the existing renderer.
- The records were in the ignored `TestResults/` folder. I deleted them afterwards because they name local paths.

## Verification (quoted)

- `npx vitest run src/dev/renderScenario.test.tsx`: "Tests 39 passed (39)".
- Showcase, dev and layout tests (`src/dev`, `showcase`, `ComponentShowcasePage*`, `no-long-dash`, `source-layout`, `src/modules/public`): "Tests 1 failed | 1389 passed (1390)". The one failure was `GalleryPage.test.tsx` "shows all 16 demo items ..."; it passed alone (28 of 28).
- After the last fix: `src/modules/admin/components/showcase`, `ComponentShowcasePage.test.tsx` and `src/dev`: "Tests 530 passed (530)". `npm run typecheck`: exit 0. `eslint --max-warnings 0` on the changed folders: exit 0.
- **E2E (`npm --prefix web run e2e -- --grep @showcase`, after preflight):**
  - Run 1: the e2e build stopped on the budget rule (Deviation 2).
  - Run 2: 44 passed and 76 failed (Deviation 3).
  - After the fixes, Chromium: "24 passed (8.0m)", exit 0.
  - Then Firefox, WebKit, Pixel and iPhone: "1 failed, 95 passed (21.7m)". The failure was a Firefox 120 s timeout in "/dev/components in Blush" while the machine was busy. Run alone it gave "1 passed (57.7s)", with the test itself taking 26.4 s.
- **Full web `verify`:**
  - Run 1: 2 failures, both in files I did not touch. `ProductsPage` axe passed alone. `license-policy.test.ts` failed alone too, because this worktree had no `tools/openapi-gen/node_modules`. After `npm ci` there (locked versions only), 64 of 64 passed.
  - Run 2: 6 load failures in `DashboardPage`, `OrderFormPage` and `EditUserPanel` while the 12-28 worktree ran its own coverage. Run alone, all 221 passed.
  - Run 3, on a quiet machine: exit 0. 426 files and 11487 tests passed. Coverage over all files: 95.62% statements, 90.32% branches, 97.78% functions, 98.15% lines. typecheck, lint, format:check, build, build:budget, license:check and notices:check all passed.
- **`build:budget` (from verify run 3).** Every row is within its limit, and no limit was changed (D-42).

| Measure | Size | Limit | Result |
|---|---|---|---|
| public JS (home) | 147.82 KB | 150.00 KB | ok |
| public JS (products) | 144.53 KB | 150.00 KB | ok |
| public JS (gallery) | 145.87 KB | 150.00 KB | ok |
| public JS (contact) | 149.37 KB | 150.00 KB | ok |
| public JS (privacy) | 149.57 KB | 150.00 KB | ok |
| public JS (cookies) | 149.47 KB | 150.00 KB | ok |
| public JS (terms) | 148.68 KB | 150.00 KB | ok |
| public JS (accessibility) | 148.24 KB | 150.00 KB | ok |
| public JS (notFound) | 140.59 KB | 150.00 KB | ok |
| admin JS | 223.21 KB | 250.00 KB | ok |
| CSS | 20.50 KB | 35.00 KB | ok |

  The production build in the same run reads Privacy 149.54 KB and admin 222.18 KB. Privacy is 0.03 KB under the wave 10 base (149.60).
- **Acceptance greps:** `VisitorTrendChart` in visitor-stats.ts: 4 (needs 3 or more). `ConsentBar` in consent.ts: 2 (needs 1 or more). `data-theme` in StaticConsentBar.tsx: 1 (needs 1 or more).
- **Secret scan:** before each of the 6 commits, `gitleaks git --pre-commit --staged --redact --config .gitleaks.toml --no-banner` reported "no leaks found". A manual grep found no local path, machine name, email or connection string. The demo ids and trace ids are made up.

## Files Created/Modified

- `web/src/dev/scenarios/groups/visitor-stats.ts` and `consent.ts`: the two groups.
- `web/src/dev/previews/VisitorStatsParts.tsx`: StatBarList and PageSpeedCard for the kit, plus StatsCutNote, StatsNoVisits, StatsLoadError and StatsStaleLine.
- `web/src/dev/previews/StaticConsentBar.tsx`, `OpenedCookieSettings.tsx` and `demoConsent.ts`: the consent previews and the store seeding.
- `web/src/dev/previews/PublicLegalNotice.tsx`: LegalNotice for the kit, plus LegalPage and LEGAL_PAGES.
- `showcaseSections.ts`: the two sections. `ShowcaseDemos.tsx`: CookieSettingsDemo and five VIEWPORT_DEMOS entries. `showcaseCopy.ts`: the trigger labels. `showcase.recipe.ts`: `publicDemoClasses`.
- Tests: `renderScenario.test.tsx`, `showcaseSections.test.ts`, `ComponentShowcasePage.test.tsx` and `e2e/showcase.spec.ts`.

## Decisions Made

These are the frontmatter `key-decisions`: implementation choices inside the plan's contract. The open questions below are yours.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files outside the plan's list**
- **Found during:** Tasks 1 and 2.
- **Issue:** the kit holds only `@/components` barrels and `dev/previews`. StatBarList, PageSpeedCard and LegalNotice live in modules, and a scenario file may import types only. The showcase also throws on a group that no section takes, and on a viewport case that has no demo.
- **Fix:** I added `VisitorStatsParts.tsx`, `PublicLegalNotice.tsx` and `demoConsent.ts`, the two sections, the demos and labels, a recipe class, and the section lists in three tests.
- **Commits:** 565e23d2, 1ea9c637.

**2. [Rule 1 - Bug] The DRAFT notice preview pushed Privacy over its budget**
- **Found during:** E2E run 1 (the e2e build).
- **Issue:** Privacy was 150.03 KB (limit 150.00) and every legal page grew by about 0.42 KB. With the showcase importing LegalNotice alone, the bundler moved it into a chunk of its own.
- **First attempt:** also reaching LegalPage brought Privacy to 149.68 KB. The `legalPages` table (531 B gzip) still split off.
- **Fix:** the preview reaches LegalPage and LEGAL_PAGES, the same modules as the legal pages. Privacy is now 149.57 KB, with no limit change.
- **Commit:** d95de058.

**3. [Rule 1 - Bug] The Cookie Settings demos widened the page and failed contrast**
- **Found during:** E2E run 2.
- **Issue:** at 320 px the longest trigger label made `main` 421 px wide. In the Espresso shell the light-only demo frame had no Blush surface, so axe flagged colour contrast on the triggers. The Manager test also expected exactly 16 sections.
- **Fix:**
  - Shorter labels at the small size, as the sign-out demos use.
  - A `bg-surface` box under each trigger. That class already exists, so CSS stays 20.50 KB.
  - The section count now comes from the E2E list.
- **Commit:** 899a7d4f.

**4. [Rule 3 - Blocking] First-paint wait in the showcase E2E**
- **Found during:** E2E run 2.
- **Issue:** WebKit and Firefox did not show the h1 within 5 s.
- **Fix:** the `h1` waits in `showcase.spec.ts` are now 20 s, as 12-31 did in `shell.spec.ts` (STATE noted that `@showcase` might need the same). This is test only.
- **Commit:** 899a7d4f.

---

**Total deviations:** 4 (2 bugs, 2 blocking).
**Impact:** each was needed to meet the plan's checks. No package, endpoint, schema or budget limit changed.

## Open Questions (owner; nothing here was decided for you)

1. **Showcase section names (dev wording).**
   - **(A, recommended)** Keep "Visitor stats" and "Cookies and legal": they match the page names.
   - (B) One section, "Consent, stats and legal", one per phase as Phases 5 to 11 have.
2. **The "Cookie Settings: GPC" trigger label.** It is shown to Managers on /admin/components.
   - **(A, recommended)** Keep it: short enough for 320 px, and dev only.
   - (B) "Cookie Settings: do not track".
3. **The UI-SPEC "dev public page".** As the plan allows, these parts sit in the component showcase, and /dev/public is unchanged.
   - **(A, recommended)** Keep them in the showcase.
   - (B) Also add them to /dev/public later. This would change the focus E2E's field column.
4. **Clear wording, still open from 12-19 and 12-17.** The cleared demo shows the current line, "Done. This site's cookies and your visit records are deleted. ...". If you choose "optional cookies", the demo follows the copy with no change here.
5. **"today" range and the 12-25/26/27 chart and copy choices.** These are not touched here. The scenarios follow the current code.

## Issues Encountered

- **Vitest module cache:** after the new group file was added, `node_modules/.vitest-cache` kept the old `import.meta.glob` result for `scenarios/index.ts`, so the new group stayed invisible to tests. Deleting that cache in this worktree fixed it. A later plan that adds a group file may hit the same thing.
- **A hung grep:** a chunk file whose name starts with a dash broke one inspection command, and the grep after it waited on stdin. I stopped those two processes (both were mine) within minutes. No other process was touched.
- **Load flakes (recorded):**
  - `GalleryPage` "shows all 16 demo items" passed alone.
  - `ProductsPage` axe passed alone.
  - `DashboardPage`, `OrderFormPage` (4 tests) and `EditUserPanel` passed alone, 221 of 221.
  - The Firefox `@showcase` Blush timeout passed alone.
  - All of these ran while the 12-28 worktree was running its own tests.
- **Not run:** the parity suite (`npm run parity`). The new cases are `parity: false`, so they only ride along in its axe-and-guard rows, and the `@layouts-public` footer question from 12-13 is still open. REQUIREMENTS.md was not touched: ANL-08 is also declared by 12-28, so the orchestrator marks the IDs after the merge.
- **Packages:** none added or bumped. `npm ci` in `web` and in `tools/openapi-gen` installed locked versions only.

## Known Stubs

None. Every case uses the real component with made-up data.

## Threat Flags

None. These are dev scenarios and showcase demos only, and no request leaves them (T-12-73: demo data only, gitleaks clean; T-12-SC: no package). The showcase also ships at /admin/components for Managers. There a demo clear changes only the in-memory consent cookie, and this browser's storage is put back afterwards.

## User Setup Required

None.

## Next Phase Readiness

- `/gsd-ui-review 12` can see every Phase 12 state in the "Visitor stats" and "Cookies and legal" sections at /dev/components.
- No background shell, dev server or Playwright server is left running. The RED records, logs and JUnit output were deleted.

---
*Phase: 12-consent-analytics-legal*
*Completed: 2026-11-18*

## Self-Check: PASSED

- Files: all 7 created files were FOUND (visitor-stats.ts, consent.ts, VisitorStatsParts.tsx, StaticConsentBar.tsx, OpenedCookieSettings.tsx, PublicLegalNotice.tsx, demoConsent.ts).
- Commits: e02b070e, 565e23d2, e177b70b, 1ea9c637, d95de058 and 899a7d4f were FOUND on this branch. `git log 7dad82ff..HEAD` lists 6 before this SUMMARY commit.
- Each RED `test(12-29)` commit comes before its GREEN `feat(12-29)` commit.
