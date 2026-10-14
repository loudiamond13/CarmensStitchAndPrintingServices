---
phase: 02-web-foundation-design-system
plan: 17
subsystem: ui
tags: [button, buttonlink, uilink, linkprovider, react-router, parity, playwright, tailwind, d-33, web-09, a11y, tdd]
created: "2026-10-08T16:31:07-05:00"
updated: "2026-10-08T16:31:07-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-14)
    provides: "the live parity harness, the converted Button and buttonClasses, Button.test.tsx"
  - phase: 02-web-foundation-design-system (plan 02-38)
    provides: "the shared scenario list and renderNode"
provides:
  - "web/src/ui/actions: Button (icon-only now requires aria-label by type), ButtonLink, UiLink, LinkProvider, UiLinkProps, LinkProviderProps, ButtonLinkProps, buttonClasses; buttonIconSize in button.recipe.ts"
  - "24 actions scenarios: button-<variant>-<size> x15, button-icon-only-sm/md, button-icon-left/right, button-block, button-disabled, button-pending (via loading), buttonlink-primary-md, buttonlink-ghost-sm"
  - "Harness: unminified reference CSS (cssMinify false), REPAINT settle step after FREEZE, rowTimeout(row) per-row timeout, action-log-only trace"
affects: [02-18, 02-19, 02-20, 02-21, 02-22, 02-23, 02-24, 02-25, 02-26, 02-27, 02-28, 02-29, 02-30, 02-31, 02-33, parity, every-conversion-plan]

actuals:
  tokens: 11200    # chars/4 over the realized diff (44,785 chars, 14 files)
  tasks: 2
  commits: 4
plan_head_before: a80eda21bc6ca5742d6538c58b522c9c9f0fe7bf
plan_head_after: 6a9a8b2c390f9d98248499e3f09e0d2915771f58

tech-stack:
  added: []
  patterns:
    - "Scenario helper with an object argument (`buttonCase({ id: 'button-…', props, states? })`) so each id stays a greppable literal"
    - "Component tests render every scenario of their group through the implementation kit (renderNode + kit) and run axe, so a scenario that breaks the component fails in the unit suite before parity"
    - "Optional props forwarded to a child component are typed `?: T | undefined` (exactOptionalPropertyTypes)"
    - "Parity settles each page with a full repaint (root opacity 0.99 and back, two frames each way) after FREEZE"

key-files:
  created:
    - web/src/ui/actions/links.test.tsx
  modified:
    - web/src/ui/actions/Button.tsx
    - web/src/ui/actions/Button.test.tsx
    - web/src/ui/actions/ButtonLink.tsx
    - web/src/ui/actions/UiLink.tsx
    - web/src/ui/actions/button.recipe.ts
    - web/src/ui/actions/index.ts
    - web/src/dev/scenarios/groups/actions.ts
    - web/visual/vite.reference.config.ts
    - web/visual/parity.spec.ts
    - web/visual/parity-matrix.ts
    - web/visual/parity-matrix.test.ts
    - web/visual/playwright.visual.config.ts
    - docs/web/parity.md

key-decisions:
  - "The reference build is no longer CSS-minified: the minifier rewrote App. B background: transparent into background: 0 0, which sets background-position 0px 0px, a value the approved CSS never has. Fixed in the harness, not by copying the artifact into the components"
  - "Parity repaints each page in full after FREEZE (root opacity 0.99 and back through the CSSOM). The reference differed from itself by up to 16 anti-aliased pixels at clipped edges between runs; visibility toggling was rejected because it drops :hover, :active and :focus-visible"
  - "The visual trace keeps only the action log (no DOM snapshots or screencast): full tracing made one WebKit 1440 row take 5.3 min instead of 42 s"
  - "rowTimeout(row) = max(120 s, 60 s + 12 s per case): Firefox hover rows with 22 cases take about 2.0 min, at the edge of the flat 120 s"
  - "UiLink renders react-router's Link for in-app paths and a plain <a href> for https:, mailto:, tel: and # targets (App. D.3's own test); LinkProvider renders its children and ignores component (SPEC-DEVIATION: Flag 2)"
  - "Router Links keep react-router's data-discover attribute (App. D.6b's RouterLink renders the same Link); attributes are not compared"
  - "ButtonProps is a union: children, or no children plus a required aria-label (SPEC-DEVIATION: A11Y-04)"

patterns-established:
  - "Scenario ids are literals in the group file (acceptance greps count them)"
  - "Pending scenarios use App. D.3 `loading: true`"
  - "Full traces only on demand: add `--trace on` to the parity run"

requirements-completed: [WEB-02, WEB-09, A11Y-04]

coverage:
  - id: D1
    description: "Every Button variant x size, icon-only sm/md, icon left/right, block, disabled and pending is computed-style-, box- and pixel-equal to the approved spec Button in Blush and Espresso: rest/hover/focus-visible/active at 390 and 1440 in Chromium, rest/hover in Firefox and WebKit"
    requirement: "WEB-02"
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@actions|@selftest\" (35 passed: chromium 17, firefox 9, webkit 9)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pending Button: aria-disabled and aria-busy, spinner in place of the left icon, focus kept, clicks/Enter/Space/form submit ignored, and the same look as the disabled spec Button (button-pending scenario)"
    requirement: "WEB-09"
    verification:
      - kind: unit
        ref: "web/src/ui/actions/Button.test.tsx (38 tests)"
        status: pass
      - kind: automated_ui
        ref: "parity button-pending rows in three engines"
        status: pass
    human_judgment: false
  - id: D3
    description: "UiLink and ButtonLink render react-router's Link (a real <a href>, router navigation), external targets as plain anchors; ButtonLink has the button look and icons; LinkProvider renders children unchanged"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/actions/links.test.tsx (18 tests)"
        status: pass
      - kind: automated_ui
        ref: "parity buttonlink-primary-md and buttonlink-ghost-sm rows in three engines"
        status: pass
    human_judgment: false
  - id: D4
    description: "Button, ButtonLink and UiLink have no axe violations in unit tests and in every parity row; icon-only buttons must carry an aria-label (type error otherwise)"
    requirement: "A11Y-04"
    verification:
      - kind: unit
        ref: "Button.test.tsx#renders every Button scenario through the implementation kit…; links.test.tsx#axe cases; @ts-expect-error icon-only case under npm run typecheck"
        status: pass
    human_judgment: false
  - id: D5
    description: "The harness stays honest after the fixes: the 1px self-test still fails the comparison in three engines, and the reference smoke passes with unminified CSS"
    requirement: "WEB-02"
    verification:
      - kind: automated_ui
        ref: "@selftest (3 engines); npm --prefix web run parity -- --grep @reference (6 passed)"
        status: pass
      - kind: unit
        ref: "web/visual/parity-matrix.test.ts (rowTimeout)"
        status: pass
    human_judgment: false

duration: 1h 27m
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 17: The Whole Button Family and the Router Links Summary

**All 24 actions scenarios now match the approved design in Chromium, Firefox and WebKit, in both themes and every state. That covers 15 Button variant × size cases, icon-only sm and md, an icon on each side, block, disabled, pending, and two ButtonLinks. UiLink and ButtonLink render react-router's `Link`, and LinkProvider is kept as a pass-through. Three harness defects turned up along the way and are fixed: the reference CSS was minified, the reference raster was nondeterministic, and full tracing made WebKit very slow. No component look changed, and no tolerance or normalization was added.**

## Performance

- **Duration:** 1h 27m
- **Started:** 2026-10-08T20:03:26Z
- **Completed:** 2026-10-08T21:31:06Z
- **Tasks:** 2 of 2
- **Files modified:** 14 (1 created, 13 modified; ButtonLink.tsx and UiLink.tsx were created as RED stubs in this plan)

## Accomplishments

- **Button.**
  - The 02-14 recipe already matched every variant, size and state. No class changed.
  - `ButtonProps` is now a union, so an icon-only Button without `aria-label` is a type error. It is marked SPEC-DEVIATION: A11Y-04.
  - The icon size map moved to the recipe as `buttonIconSize`, which Button and ButtonLink share.
  - Pending (WEB-09) behaviour is unchanged from 02-14. It is now also proven against the rulings layer by the `button-pending` scenario, which uses App. D.3 `loading`.
- **Links.**
  - `UiLink` renders `Link` from `react-router` for in-app paths. For `https:`, `mailto:`, `tel:` and `#` targets it renders a plain `<a href>`, using App. D.3's own test. Its props are explicit, with no spread.
  - `LinkProvider` renders its children and accepts `component` only for API compatibility. It is marked `// SPEC-DEVIATION: router link built in (Flag 2)`.
  - `ButtonLink` uses `buttonClasses` and keeps the label as a direct text child, as App. D.3 does. Its hover works because `not-disabled:` and `not-aria-disabled:` always match an `<a>`.
- **Scenarios.**
  - The actions group holds 24 cases. 22 are Button cases; their ids are literal `id: 'button-…'` strings.
  - Prop states (disabled, pending) run at rest only.
  - The two ButtonLink cases run at rest, hover and focus-visible.
- **Tests.**
  - `Button.test.tsx`: 38 tests, up from 14. They cover 15 variant × size looks, the padding/width split, the aria-label type rule, the same DOM node on re-render, the scenario-set contract, and every Button scenario rendered through the kit with axe.
  - `links.test.tsx`: 18 tests.

## Task Commits

1. **Task 1 (tracer): every Button variant, size and state.**
   - RED `758d364`: 4 of 38 tests fail on the scenario-set assertions. RED evidence is `RED_EVIDENCE_OK` for `src/ui/actions/Button.test.tsx`.
   - The look RED was the first Chromium parity run. It found 9 failing rows:
     - a `background-position` style difference on every transparent-background variant;
     - 2–11 anti-aliased pixels at clipped right edges (block focus-visible, secondary-sm active).
   - GREEN `8e8397c`: the scenarios, the aria-label union, the unminified reference and the repaint settle step. Chromium `@actions|@selftest` then passed 17/17.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit. Results: 38/38, then Chromium 16/16. Then I started Task 2.
2. **Task 2: ButtonLink, UiLink, LinkProvider, and the group in three engines.**
   - RED `e83f616` used stubs: plain anchors, no look, a LinkProvider that renders nothing. 9 of 15 tests failed on assertions, and RED evidence is `RED_EVIDENCE_OK` for `src/ui/actions/links.test.tsx`.
   - GREEN `6a9a8b2`: the components, the two scenarios, the trace and row-timeout fixes, two extra re-render tests for 100% branch coverage, and the parity guide update.

**Plan metadata:** recorded in the docs(02-17) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/actions/UiLink.tsx`: router-aware UiLink, pass-through LinkProvider
- `web/src/ui/actions/ButtonLink.tsx`: the button look on a router link
- `web/src/ui/actions/Button.tsx`: the icon-only aria-label union, shared `buttonIconSize`
- `web/src/ui/actions/button.recipe.ts`: `buttonIconSize`
- `web/src/ui/actions/index.ts`: exports Button, ButtonLink, UiLink, LinkProvider, buttonClasses and their types
- `web/src/ui/actions/Button.test.tsx`, `web/src/ui/actions/links.test.tsx`: 38 + 18 tests
- `web/src/dev/scenarios/groups/actions.ts`: 24 scenarios
- `web/visual/vite.reference.config.ts`: `cssMinify: false`
- `web/visual/parity.spec.ts`: the `REPAINT` settle step, `test.setTimeout(rowTimeout(row))`
- `web/visual/parity-matrix.ts` / `.test.ts`: `rowTimeout`, `ROW_TIMEOUT_FLOOR_MS`, `ROW_TIMEOUT_PER_CASE_MS` (+2 tests)
- `web/visual/playwright.visual.config.ts`: the trace keeps the action log only
- `docs/web/parity.md`: the repaint settle step, the unminified reference CSS and the row timeout

## Decisions Made

See `key-decisions` in the frontmatter. The most important ones for later plans:

- **The harness was fixed and the components were not.** All three defects were in the harness. The reference differed from itself, or was distorted by the build. Copying a minifier artifact such as `background-position: 0 0` into the shipped recipe would have been wrong.
- **`data-discover="true"` on router links.** react-router's `Link` adds it. App. D.6b's `RouterLink` renders the same `Link`, so the shipped app was always going to carry it. The comparator does not compare attributes. A test that checks exact `innerHTML` must compare against the same tree rendered without the wrapper, as `links.test.tsx` does.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The reference build minified the approved CSS**
- **Found during:** Task 1 (first parity run)
- **Issue:** Vite/Tailwind minification rewrote `.csp-btn-secondary/ghost/ghost-danger { background: transparent }` into `background: 0 0`. That set `background-position: 0px 0px` on the reference, while the approved CSS gives `0% 0%`. A cross-engine probe confirmed `0% 0%` for `background: transparent`. The difference was invisible but was reported on every transparent variant.
- **Fix:** `build.cssMinify: false` in `visual/vite.reference.config.ts`. Tailwind's optimizer follows the flag. The implementation build is unchanged.
- **Files modified:** web/visual/vite.reference.config.ts, docs/web/parity.md
- **Verification:** the style differences are gone; `@reference` smoke 6/6; `@selftest` still fails the 1px drift in three engines
- **Committed in:** `8e8397c`

**2. [Rule 1 - Bug] The reference raster was nondeterministic at clipped edges**
- **Found during:** Task 1
- **Issue:** The `button-block` focus-visible and `button-secondary-sm` active shots differed by 2–16 anti-aliased pixels at the frame's right edge, with equal styles and boxes. A probe that loaded the reference against itself showed the same diffs in about half the runs. The implementation against itself showed none in 8 runs.
- **Fix:** a `REPAINT` step after `FREEZE` on both pages. It sets the root opacity to 0.99 and back through the CSSOM, two frames each way. Probes showed 0 diffs in 6 runs for ref vs ref, ref vs impl, and the active cases. A visibility toggle was tried first and rejected, because it dropped `:focus-visible` and `:active` and restarted the press transition.
- **Files modified:** web/visual/parity.spec.ts, docs/web/parity.md
- **Committed in:** `8e8397c`

**3. [Rule 3 - Blocking] WebKit rows timed out**
- **Found during:** Task 2 (three-engine run)
- **Issue:** With 24 cases, WebKit 1440 rows and Firefox hover rows passed 120 s, while every comparison that finished passed. Per-step timing found the cause: the config's `trace: 'retain-on-failure'` records DOM snapshots and screencast frames for every action even when the test passes. At WebKit's device scale 2 and 1440 px, that made one row take 5.3 min. With tracing off it took 42 s.
- **Fix:**
  - The trace keeps the action log only (`snapshots: false, screenshots: false, sources: true`). Use `--trace on` when a full trace is needed.
  - `rowTimeout(row)` (60 s + 12 s per case, never below 120 s), unit-tested. Firefox hover rows still take about 2.0 min with 22 cases.
- **Files modified:** web/visual/playwright.visual.config.ts, web/visual/parity-matrix.ts, web/visual/parity-matrix.test.ts, web/visual/parity.spec.ts, docs/web/parity.md
- **Verification:** `@actions|@selftest` 35/35 in 6.8 min (was 14.4 min with 2 timeouts)
- **Committed in:** `6a9a8b2`

**4. [Rule 2 - Missing critical] An icon-only Button must be named**
- **Found during:** Task 1 (the plan's behaviour "icon-only requires aria-label (prop type)")
- **Fix:** `ButtonProps` is a union of children, or no children plus a required `aria-label`. A `@ts-expect-error` test pins it, and typecheck fails if the rule is lost. Marked SPEC-DEVIATION: A11Y-04.
- **Committed in:** `8e8397c`

**5. [Rule 3 - Blocking] exactOptionalPropertyTypes when forwarding props**
- **Found during:** Task 2
- **Fix:** UiLinkProps and the ButtonLink look props are typed `?: T | undefined`, so ButtonLink can forward its destructured props to UiLink.
- **Committed in:** `6a9a8b2`

---

**Total deviations:** 5 auto-fixed (2 Rule 1, 2 Rule 3, 1 Rule 2)
**Impact on plan:**
- Three of the fixes touch shared harness files outside the plan's file list: the reference config, the spec, the matrix and the visual config. They make the proof faithful and fast enough for the growing scenario list.
- None of them relaxes a comparison. Pixels are still compared with maxDiffPixels 0 and threshold 0, no normalization was added, and the self-test still fails the 1px drift.

## Issues Encountered

- Prettier reflowed the `VARIANTS` constant in `Button.test.tsx` after the RED commit. The reformat landed in the Task 2 GREEN commit.
- Firefox hover rows are the slowest rows now, at about 2.0 min each for 22 cases. I did not profile them further. As groups grow, `rowTimeout` keeps them from timing out, but the total run time is 6.8 min for this group, above the 02-14 target of 4 min per engine. Plans that add many state cases should watch it.

## TDD Gate Compliance

- Task 1: RED `758d364` comes before GREEN `8e8397c`, with `RED_EVIDENCE_OK`. The other new Button behaviour tests passed at RED, because 02-14 had already implemented them (its deviation 6). They pin that behaviour now. The look RED was the parity run.
- Task 2: RED `e83f616` comes before GREEN `6a9a8b2`, with `RED_EVIDENCE_OK`.
- The `rowTimeout` tests and the two re-render coverage tests were written during GREEN, together with the fixes they pin. They have no separate RED commit.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved.

## Look Gate (D-08 conditional checkpoint)

It did not fire. No component look, element, text or ARIA structure changed. The differences found came from the harness and were fixed there, with no tolerance.

## Threat Flags

None. UiLink and ButtonLink take a typed `to` string, and in-app paths go through react-router (T-02-47). Pending activation is swallowed and tested (T-02-46).

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

For 02-18 to 02-31:

- **Exports.** Import `ButtonLink`, `UiLink`, `LinkProvider` and `buttonClasses` from `@/ui/actions`, and `buttonIconSize` / `buttonSpinnerClasses` from `./button.recipe`. SkipLink should use `buttonClasses`.
- **Router.** Any test that renders UiLink or ButtonLink with an in-app path needs a router, such as `MemoryRouter`. External targets do not.
- **Settle step.** The parity settle step is now FREEZE, then REPAINT. A new kind of state should not need anything else.
- **Traces.** For a full trace when debugging, add `-- --trace on` to the parity run.
- **Timeouts.** Large groups get proportional timeouts automatically. Total runtime still grows with every state case, mostly in Firefox hover rows.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- Files exist: web/src/ui/actions/{Button.tsx, Button.test.tsx, ButtonLink.tsx, UiLink.tsx, links.test.tsx, button.recipe.ts, index.ts}, web/src/dev/scenarios/groups/actions.ts, web/visual/{vite.reference.config.ts, parity.spec.ts, parity-matrix.ts, parity-matrix.test.ts, playwright.visual.config.ts}, docs/web/parity.md
- Commits `758d364`, `8e8397c`, `e83f616` and `6a9a8b2` are on `gsd/phase-2-web-foundation-design-system`
- Acceptance:
  - `id: 'button-` = 22 (at least 22 required).
  - `not-aria-disabled` in the recipe = 7 (at least 1 required).
  - `react-router-dom` in UiLink.tsx = 0 and `from 'react-router'` = 1.
  - `npm --prefix web run verify` exit 0: 51 files, 1373 tests, coverage 100 / 99.83 / 100 / 100.
- Parity:
  - `--grep "@actions|@selftest"`: 35 passed (chromium 17, firefox 9, webkit 9).
  - `--grep @reference`: 6 passed.
