---
phase: 02-web-foundation-design-system
plan: 14
subsystem: testing
tags: [look-equality, parity, playwright, comparator, computed-style, pixels, axe, strict-csp, button, tailwind, wcag, tdd, d-33, web-09]
created: "2026-10-08T14:25:00-05:00"
updated: "2026-10-08T14:25:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-13)
    provides: "reference app, routeDist/readStrictCsp/REFERENCE_ORIGIN/REFERENCE_DIST, the visual guard, selectScenarios, npm run parity"
  - phase: 02-web-foundation-design-system (plan 02-38)
    provides: "the shared scenario list (button-primary-md) and renderNode"
  - phase: 02-web-foundation-design-system (plan 02-40)
    provides: "tw, pageRootClasses and the Icon wrapper"
  - phase: 02-web-foundation-design-system (plan 02-05)
    provides: "the class gate and the D-02 aria-disabled/disabled opacity-45 allow-list entry"
  - phase: 02-web-foundation-design-system (plan 02-12)
    provides: "the Fontsource weight imports and the woff2-only build the parity entry reuses"
provides:
  - "Implementation side: web/parity.html + web/src/dev/parity-main.tsx (dev-route builds only) and web/src/dev/kit.ts (every src/ui/<area>/index.ts component, duplicate names throw)"
  - "web/visual/compare.ts: collectCase, normalizeRecord, diffCases, formatDifferences, VISUAL_PROPERTIES, IGNORED, BOX_TOLERANCE"
  - "web/visual/intentional-differences.ts: STRUCTURAL_EXCEPTIONS (D-27 Logout x3, D-32 icon drawings), TOLERANCE_OVERRIDES (empty), assertRegistry, elementExceptionsFor, maskedIconViewBox, maxDiffPixelsFor"
  - "web/visual/parity-matrix.ts: planMatrix, CHROMIUM_ONLY_TAG, SHARED_WIDTHS, RESPONSIVE_WIDTHS, PASS_WIDTH"
  - "web/visual/parity.spec.ts: one test per matrix row (computed styles + boxes + pixels + axe + guard on both pages) and the @selftest"
  - "web/visual/guard.ts: appPage fixture (second guarded page), screenshotLocator/screenshotPage; web/visual/webkit-style-sync.ts allowance"
  - "web/visual/scenarios.ts: loadScenarios (the shared list from disk); web/src/dev/scenarios/collect.ts (glob-free collectScenarios)"
  - "web/src/ui/actions: Button, ButtonProps, ButtonVariant, ButtonSize, buttonClasses (barrel); buttonSpinnerClasses (recipe)"
  - "npm run parity now builds the implementation (vite build --mode e2e --outDir .parity-dist) before Playwright"
affects: [02-17, 02-18, 02-19, 02-20, 02-21, 02-22, 02-23, 02-24, 02-25, 02-26, 02-27, 02-28, 02-29, 02-30, 02-31, 02-33, parity, every-conversion-plan]

actuals:
  tokens: 34800    # chars/4 over the realized diff (139,362 chars, 27 files)
  tasks: 2
  commits: 5
plan_head_before: f94d409088a9afd638a0cc5429ee1c425c931114
plan_head_after: 2edde578facfcb64cd61e6ec3b4d2076de76d891

tech-stack:
  added: []
  patterns:
    - "Same-run A/B parity: reference and implementation pages in one browser context (page + appPage), both route-served under the real StrictCsp; the reference shot is written as the expected snapshot, the implementation must match with maxDiffPixels 0 and threshold 0"
    - "The in-page collector is a self-contained function typed with local structural DOM interfaces (the node TS program has no DOM lib), passed to page.evaluate"
    - "Normalizations replace ignored values with an IGNORED sentinel instead of deleting them, so a property visible on one side only is still reported through its width"
    - "Matrix rows are data (planMatrix) and unit-tested; Chromium-only rows carry @chromium-only and the Firefox/WebKit projects grepInvert it"
    - "Every visual-spec screenshot goes through screenshotLocator/screenshotPage so the guard can discount WebKit's one blocked screenshot <style>"
    - "Recipes split one CSS overlap into two maps (labelled padding vs icon-only width) so the conflicting utilities never reach the DOM together"

key-files:
  created:
    - web/parity.html
    - web/src/dev/parity-main.tsx
    - web/src/dev/kit.ts
    - web/src/dev/scenarios/collect.ts
    - web/src/ui/actions/button.recipe.ts
    - web/src/ui/actions/Button.tsx
    - web/src/ui/actions/Button.test.tsx
    - web/src/ui/actions/index.ts
    - web/visual/compare.ts
    - web/visual/compare.test.ts
    - web/visual/intentional-differences.ts
    - web/visual/parity-matrix.ts
    - web/visual/parity-matrix.test.ts
    - web/visual/parity.spec.ts
    - web/visual/scenarios.ts
    - web/visual/webkit-style-sync.ts
    - web/visual/webkit-style-sync.test.ts
  modified:
    - web/vite.config.ts
    - web/scripts/parity.mjs
    - web/scripts/parity.test.ts
    - web/visual/guard.ts
    - web/visual/playwright.visual.config.ts
    - web/eslint.config.mjs
    - web/src/test/lint-rules.node.test.ts
    - web/src/test/build-config.node.test.ts
    - web/src/dev/scenarios/index.ts
    - docs/web/parity.md

key-decisions:
  - "The implementation page is a second Vite entry (build.rolldownOptions.input { main, parity }) only when dev routes are on; production keeps index.html alone (D-20, CWE-489), pinned by build-config tests and checked on a real production build"
  - "Both sides load in one browser context: `page` is the reference, the new guarded `appPage` fixture the implementation, so viewport, reduced-motion and touch settings always match"
  - "Pixels compare with maxDiffPixels 0 AND threshold 0; updateSnapshots is 'none' in the config and asserted in every test, because an update run would make the suite pass without comparing"
  - "Button keeps App. D.3's props API with explicit props (no spread, L-13) and adds `pending`; App. D.3's `loading` gets the same WEB-09 behaviour (aria-disabled + aria-busy + spinner, activation swallowed, focus kept) instead of native disabled (SPEC-DEVIATION: WEB-09)"
  - "Icon-only padding overlap: the recipe applies either the labelled padding map (px-3/5/6) or the icon-only width map (w-9/11/11), never both; block width applies only to labelled buttons (App. B source order)"
  - "WebKit's screenshotter appends <style>body {}</style> (animation sync); the CSP blocks it and WebKit reports it. The guard discounts exactly one such violation and console line per screenshot taken through the helpers, in WebKit only; the CSP is never relaxed"
  - "D-27 Logout exception paths are provisional (0/0/2/1 expanded with a user chip, 0/0/2/0 collapsed); plan 02-26 confirms them"

patterns-established:
  - "Conversion plans export components from src/ui/<area>/index.ts under their App. D.3 names; the kit picks them up by name"
  - "A scenario's `target` selector (inside the case) is what hover/active/focus-visible drive; otherwise the case's first element"
  - "Visual specs never call locator.screenshot directly; they use screenshotLocator/screenshotPage from visual/guard.ts"

requirements-completed: [WEB-02, A11Y-04]

coverage:
  - id: D1
    description: "npm run parity builds the implementation side (vite build --mode e2e --outDir .parity-dist) after the extraction and the reference build, before Playwright, under the parity lock, and stops at a failing build"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/scripts/parity.test.ts (16 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "parity.html is an entry of the dev-route builds only; the production build (wwwroot) has no parity.html and no parity or scenario code"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/test/build-config.node.test.ts (parity entry in e2e/budget, none in production)"
        status: pass
      - kind: other
        ref: "npm --prefix web run build; ls src/Csps.Server/wwwroot -> assets index.html mark.svg robots.txt; grep for parity/data-case/button-primary-md in wwwroot JS -> none"
        status: pass
    human_judgment: false
  - id: D3
    description: "The converted Button (App. D.3 API, explicit props, buttonClasses recipe in tw literals) is computed-style-, box- and pixel-equal to the approved spec Button (button-primary-md) in chromium, firefox and webkit, Blush and Espresso, 390 and 1440, rest and hover, plus focus-visible and active in chromium, with zero axe and guard findings on both sides"
    requirement: "WEB-02"
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@actions|@selftest\" (35 passed: chromium 17, firefox 9, webkit 9)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Button behaviour: D.3 markup, icons 16/18px, icon-only name, native disabled, WEB-09 pending/loading (aria-disabled, aria-busy, spinner, clicks/Enter/Space/form submit swallowed, focus kept), axe clean, memo re-render"
    requirement: "A11Y-04"
    verification:
      - kind: unit
        ref: "web/src/ui/actions/Button.test.tsx (14 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The comparator applies only the allowed normalizations (transition lists, 0-width border/outline style and colour, icon drawings, transforms, display:none), never compares attributes, reports structure/style/box differences, and accepts a tag mismatch only for a registry entry with a decision ID"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/visual/compare.test.ts (38 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The harness cannot pass vacuously: a 1px CSSOM padding-top drift on the implementation is reported as a padding-top style difference and rejected by the pixel comparison in all three engines"
    requirement: "WEB-02"
    verification:
      - kind: automated_ui
        ref: "web/visual/parity.spec.ts#@parity @selftest (3 engines)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The matrix: every engine 390/1440 rest+hover; Chromium 320/820 rest for responsive scenarios, focus-visible/active at 390/1440, motion and touch passes; themes per scenario; SPEC-GAP cases axe-checked only"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/visual/parity-matrix.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The WebKit screenshot allowance discounts exactly one blocked inline stylesheet and console line per screenshot and nothing else"
    verification:
      - kind: unit
        ref: "web/visual/webkit-style-sync.test.ts (4 tests)"
        status: pass
    human_judgment: false
  - id: D9
    description: "docs/web/parity.md explains the live comparison, the matrix and the rules for conversion plans"
    verification: []
    human_judgment: true
    rationale: "Whether the guide is clear enough for later converters is a reader judgment"

duration: 36min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 14: The Live Look-Equality Proof and the First Converted Component (Button) Summary

**The parity harness is live. The approved spec page and a new dev-only implementation page (`parity.html`) render the same scenario in one browser context under the production CSP, and a comparator checks about 120 computed properties per element, each element's box, the pixels (`maxDiffPixels: 0`, `threshold: 0`), axe and the guard on both sides. A 1px self-test proves the harness can fail. The converted Button (`buttonClasses` recipe plus the WEB-09 pending state) is equal to the approved Button in Chromium, Firefox and WebKit, in both themes, at rest and on hover, and also on focus and press in Chromium.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-10-08T18:49:03Z
- **Completed:** 2026-10-08T19:25:00Z
- **Tasks:** 2 of 2
- **Files modified:** 27 (17 created, 10 modified)

## Accomplishments

- **Implementation side.**
  - `web/parity.html` → `src/dev/parity-main.tsx` loads the same fonts and `app.css` as the app (a recorded lint exception). It reads `?theme/?group/?case` through the reference's `select.ts`, wraps the page in a `MemoryRouter`, and renders each case in `<div data-case data-theme className={pageRootClasses}>` with `renderNode(kit, …)`.
  - `src/dev/kit.ts` merges every `src/ui/<area>/index.ts` and `src/dev/previews/*.tsx` by export name, and a name clash throws.
  - Vite adds the `parity` input only when dev routes are on.
- **Button.** `buttonClasses({ variant, size, block, iconOnly, className })` transcribes every `.csp-btn*` rule into `tw('…')` literals:
  - The base, five variants and three sizes are separate axes.
  - A labelled button gets the padding map; an icon-only button gets the width map instead.
  - Block width applies to labelled buttons only.
  - Hover and press are guarded by `not-disabled:not-aria-disabled:`, and `aria-disabled` uses the same look as `disabled`.
  - `font: inherit` is dropped, there is no `enabled:` variant, and transitions always set a duration and an easing.

  `Button` keeps the App. D.3 markup. It renders the left icon, the label `<span>`, then the right icon. While pending it shows the `loader-circle` spinner with `animate-csp-spin motion-reduce:[animation-duration:2.4s]`.
- **Comparator** (`visual/compare.ts`):
  - It walks the case in DOM order, skipping `display: none` subtrees and including `::before`/`::after` that have content.
  - It reads about 120 properties and each element's box relative to the case root.
  - It normalizes only what the UI-SPEC lists, then pairs the two sides by child-index path and reports structure, style and box differences (box tolerance 0.01 px).
  - Attributes are recorded for the report only and never compared.
- **Registry** (`visual/intentional-differences.ts`):
  - D-27 Logout `a` → `button`, one entry for each of the three sidebar scenarios.
  - The D-32 icon-drawing mask, with viewBox `0 0 24 24`.
  - An empty tolerance list.
  - `assertRegistry` rejects any entry without a decision ID and a reason.
- **Suite** (`visual/parity.spec.ts`):
  - Each matrix row is one test, and each row loads both sides.
  - States are driven with real input: the mouse for hover, mouse down for active, and Tab for focus-visible.
  - Transitions are finished and other animations paused before measuring.
  - Each case is compared, and axe runs on both pages.
  - The guard covers both pages.
- **Runner.** `npm run parity` now runs preflight → extract → reference build → **implementation build** (`.parity-dist`) → Playwright.

## Task Commits

0. **Refactor `aa47768`:** `collectScenarios`, `assertSerializable` and `GroupModule` moved, unchanged, into the glob-free `src/dev/scenarios/collect.ts`. Playwright has no `import.meta.glob`. `index.ts` re-exports them, and its 15 tests still pass.
1. **Task 1 (tracer): the converted primary Button is pixel- and style-equal in Chromium**
   - RED `4d4029d` (test):
     - `scripts/parity.test.ts`: 8 of 16 cases fail (`RED_EVIDENCE_OK`).
     - `src/ui/actions/Button.test.tsx`: 11 of 14 fail against a stub (`RED_EVIDENCE_OK`).
     - The parity tracer ran against the stub Button, which has the D.3 markup but no utilities. It reported over 40 style and box differences and a pixel mismatch ("Expected an image 390px by 44px, received 390px by 24px"), with no guard findings.
   - GREEN `b8871ab` (feat): 56/56 unit tests pass (parity, Button, tailwind-classes), the class gate exits 0, and `--grep @actions --project chromium` passes 1/1.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit (30/30, then 1 passed), then started Task 2.
2. **Task 2: comparator self-test, normalization tests, registry and the full matrix**
   - RED `c8ba069` (test):
     - `visual/compare.test.ts`: 17 of 37 fail (`RED_EVIDENCE_OK`).
     - `visual/parity-matrix.test.ts`: 8 of 8 fail against the stub (`RED_EVIDENCE_OK`).
     - The self-test already passed in Chromium and Firefox against the Task 1 comparator. That is expected: it proves the harness can fail, and it is not a RED target.
   - GREEN `2edde57` (feat): 116/116 visual unit tests pass, and `--grep "@actions|@selftest"` passes 35 in three engines.

**Plan metadata:** recorded in the docs(02-14) commit that adds this SUMMARY.

## Files Created/Modified

- `web/parity.html`, `web/src/dev/parity-main.tsx`, `web/src/dev/kit.ts`: the implementation page and kit
- `web/src/dev/scenarios/collect.ts` (+ `index.ts` re-export): glob-free scenario validation
- `web/src/ui/actions/{button.recipe.ts, Button.tsx, index.ts, Button.test.tsx}`: the converted Button and its 14 tests
- `web/visual/compare.ts` / `compare.test.ts`: the comparator (38 tests)
- `web/visual/intentional-differences.ts`: the registry
- `web/visual/parity-matrix.ts` / `parity-matrix.test.ts`: the matrix (8 tests)
- `web/visual/parity.spec.ts`: the suite and the self-test
- `web/visual/scenarios.ts`: the list loaded from disk
- `web/visual/webkit-style-sync.ts` / `.test.ts`: the WebKit screenshot allowance (4 tests)
- `web/visual/guard.ts`: the `appPage` fixture and the screenshot helpers
- `web/visual/playwright.visual.config.ts`: `updateSnapshots: 'none'`, a 120 s timeout, and Firefox/WebKit skip `@chromium-only`
- `web/vite.config.ts`: the dev-route `parity` input
- `web/scripts/parity.mjs` / `parity.test.ts`: the `build-app` step
- `web/eslint.config.mjs`, `web/src/test/lint-rules.node.test.ts`: the recorded `app.css` exception for the parity entry
- `web/src/test/build-config.node.test.ts`: the dev routes have the parity entry, and production does not
- `docs/web/parity.md`: the live comparison, the matrix (section 7) and the rules for conversion plans (section 8)

## Decisions Made

See `key-decisions` in the frontmatter. Downstream plans need these most:

- **Pending in scenarios (02-17):** the reference `Button` spreads unknown props onto `<button>`. A scenario with `pending: true` would therefore make React warn on the reference side, and the guard would fail. Use `loading: true` for the pending scenario instead. Both sides then render the WEB-09 look: the reference through native `disabled` plus the rulings layer, and the implementation through `aria-disabled`.
- **The self-test uses `button-primary-md`.** If that id is ever renamed, update the `@selftest` case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The scenario list is loaded from disk for the suite**
- **Found during:** Task 1 (design)
- **Issue:** `src/dev/scenarios/index.ts` discovers groups with `import.meta.glob`, which Playwright cannot run. The spec still has to plan its matrix from the same list.
- **Fix:** I moved the pure `collectScenarios`/`assertSerializable` into `collect.ts`; `index.ts` re-exports them. I added `visual/scenarios.ts` (`loadScenarios`), which imports `groups/*.ts` from disk through the same validation.
- **Files modified:** web/src/dev/scenarios/collect.ts, web/src/dev/scenarios/index.ts, web/visual/scenarios.ts
- **Committed in:** `aa47768`, `4d4029d`

**2. [Rule 3 - Blocking] A second guarded page (`appPage`)**
- **Found during:** Task 1
- **Issue:** `routeDist` routes every request on a page and aborts other origins, so one page cannot serve both sides. The guard watched only `page`.
- **Fix:** `watchPage(page)` is now reusable. The new `appPage` fixture is a second page in the same context, guarded the same way, and it fails the test on findings at teardown.
- **Committed in:** `4d4029d`

**3. [Rule 3 - Blocking] `build.rolldownOptions.input`, not `rollupOptions`**
- **Found during:** Task 1
- **Issue:** Vite 8 marks `rollupOptions` as deprecated, and `@typescript-eslint/no-deprecated` is an error.
- **Fix:** I used `rolldownOptions.input` with absolute paths for `index.html` and `parity.html`.
- **Committed in:** `4d4029d`

**4. [Rule 3 - Blocking] WebKit reports a CSP violation for every screenshot**
- **Found during:** Task 2 (three-engine run)
- **Issue:** In WebKit, Playwright's screenshotter appends `<style>body {}</style>` to sync animations (playwright-core `inPagePrepareForScreenshots`). The strict CSP blocks it, as it should, and WebKit reports one `style-src-elem` violation and one console error. That happened on both sides, on every screenshot, including a plain `locator.screenshot()`. Chromium and Firefox run that helper in an isolated world that the page CSP does not cover.
- **Fix:**
  - `screenshotLocator`/`screenshotPage` in `guard.ts` count the suite's own screenshots per page.
  - In WebKit only, the guard discounts exactly one matching violation and one matching console line per counted screenshot (`webkit-style-sync.ts`, 4 tests). Any extra finding still fails, and the CSP is not relaxed.
  - Screenshots also use `caret: 'initial'`, because Playwright's caret hiding injects a style too. The freeze step instead hides a focused field's caret through the CSSOM.
- **Files modified:** web/visual/guard.ts, web/visual/webkit-style-sync.ts, web/visual/webkit-style-sync.test.ts, web/visual/parity.spec.ts
- **Committed in:** `2edde57`

**5. [Rule 3 - Blocking] The visual suite's test timeout is 120 s**
- **Found during:** Task 2
- **Issue:** A WebKit row at 1440 px takes about 12 s alone, because two pages are open and axe runs twice at about 2.5 s each. With four workers busy it took about 30 s and hit the default 30 s timeout.
- **Fix:** `timeout: 120_000` in `playwright.visual.config.ts`, with the measured reason in a comment.
- **Committed in:** `2edde57`

**6. [Rule 2 - Missing critical] Button unit tests and the explicit WEB-09 behaviour**
- **Found during:** Task 1
- **Issue:** The plan's Task 1 behaviour lists only the parity and runner tests. But the Button gains new behaviour: pending swallows clicks, Enter, Space and form submission, and keeps focus. Without tests, `src/ui` coverage would also drop.
- **Fix:** `Button.test.tsx` with 14 cases, written RED first. It covers the D.3 markup, icon sizes, the icon-only name, native disabled, pending/loading (aria-disabled, aria-busy, spinner, swallowed activation, no form submit, focus kept), axe and the memo re-render. Plan 02-17 extends this file.
- **Committed in:** `4d4029d`, `b8871ab`

**7. [Rule 2 - Missing critical] No vacuous passes**
- **Found during:** Task 1
- **Issue:** With `maxDiffPixels: 0` alone, Playwright's default per-pixel `threshold` (0.2) still lets small colour differences through. An `--update-snapshots` run would also overwrite the reference shot.
- **Fix:** `threshold: 0` on every comparison, `updateSnapshots: 'none'` in the config, and a `beforeEach` assertion on it.
- **Committed in:** `4d4029d`

**8. [Rule 2 - Missing critical] The matrix and its gates are unit-tested**
- **Found during:** Task 2
- **Issue:** A matrix typed into the spec could silently drop rows.
- **Fix:**
  - `planMatrix` lives in `parity-matrix.ts`, with 8 tests.
  - The kit throws on duplicate component names.
  - `build-config` tests pin the dev-route parity entry and its absence in production.
  - A lint-rule test proves that only `src/dev/parity-main.tsx`, besides `main.tsx`, may import `app.css`. The shared ESLint message now names the parity entry too.
- **Committed in:** `4d4029d`, `c8ba069`, `2edde57`

---

**Total deviations:** 8 auto-fixed (5 Rule 3, 3 Rule 2)
**Impact on plan:** All were needed to run, type-check, lint or keep the proof honest. No package changed, and no look changed.

## Issues Encountered

- The dev-route builds (e2e, budget, parity) now have two entries. Vite emits a shared chunk named `jsx-runtime-*.js` and a single `jsx-runtime-*.css`; the production build still emits `index-*.{js,css}`. Each build still has exactly one CSS asset (02-33's budget rule), but the file names in `.e2e-dist`/`.budget-dist` changed.
- Python heredocs in Git Bash turned `\\n` into a real newline twice. Two edits were repaired by hand: the guard's error message, and the parity test's expected stderr. Both were caught before commit, by reading the code and by typecheck.
- The RED commits `4d4029d` and `c8ba069` hold stubs with unused parameters and a third argument that the Task 1 `diffCases` did not yet accept. Lint and typecheck are clean at each GREEN commit.

## Verification

- `npm --prefix web run test -- --run scripts/parity.test.ts scripts/tailwind-classes.test.ts`: passed (16 + 26)
- `npm --prefix web run test -- --run visual/compare.test.ts`: 38/38 passed; all visual unit tests: 116/116
- Preflight (all four ports free, no other project's test processes), then `npm --prefix web run parity -- --grep "@actions|@selftest"`: **35 passed** (chromium 17, firefox 9, webkit 9) in 1.3 min
- `npm --prefix web run parity -- --grep @reference`: 6 passed (the 02-13 smoke still holds with the refactored guard)
- `npm --prefix web run verify`: exit 0. That covers typecheck (3 programs), lint, format, 45 files with 1269 tests, coverage (100 / 99.78 / 100 / 100; the Button files are at 100%), build, license gate and notices.
- `npm --prefix web run build`: `src/Csps.Server/wwwroot` holds `assets`, `index.html`, `mark.svg` and `robots.txt`, with no `parity.html`. No wwwroot JS contains `parity`, `data-case` or `button-primary-md`.
- Acceptance greps:
  - `from '(@/ui|..)/tw'` in button.recipe.ts = 1.
  - `export function tw` = 0 in both Button files.
  - `font:inherit` = 0 and `enabled:` = 0 in button.recipe.ts.
  - `decision` in intentional-differences.ts = 20 (at least 2 required).
- `node web/scripts/class-gate.mjs`: exit 0.

## TDD Gate Compliance

- Task 1: RED `4d4029d` comes before GREEN `b8871ab`. RED evidence was `RED_EVIDENCE_OK` for `scripts/parity.test.ts` and `src/ui/actions/Button.test.tsx`. The Playwright tracer failed on its assertions against the stub Button.
- Task 2: RED `c8ba069` comes before GREEN `2edde57`. RED evidence was `RED_EVIDENCE_OK` for `visual/compare.test.ts` and `visual/parity-matrix.test.ts`.
- `webkit-style-sync.test.ts` was written in GREEN, together with the fix for a harness blocker found during the three-engine run (deviation 4). It has no separate RED commit.
- The refactor commit `aa47768` only moved code, and every test still passed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved; `package.json` and `package-lock.json` are unchanged.

## Look Gate (D-08 conditional checkpoint)

It did not fire. The Button matched the approved design on the first GREEN run. No look, element, text or ARIA change was needed beyond the WEB-09 ruling, which was already in the rulings layer. No tolerance was added.

## Known Provisional Data

- `web/visual/intentional-differences.ts`: the three D-27 Logout paths (`0/0/2/1` for the expanded sidebar with a user chip, `0/0/2/0` for the collapsed one) were derived from the App. D.3 Sidebar markup. Plan 02-26 confirms them when it adds the sidebar scenarios, and a wrong path fails that plan's parity run loudly.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

For **02-17 to 02-28** (conversion plans) and **02-29 to 02-31** (layouts):

- **Exports and scenarios.**
  - Export each converted component from `web/src/ui/<area>/index.ts` under its App. D.3 name, so the kit finds it.
  - Add scenarios to `web/src/dev/scenarios/groups/<group>.ts`. The suite generates the rows; nothing else needs registering.
  - Set `target` when the element a state acts on is not the case's first element.
- **Running it.** `npm --prefix web run parity -- --grep @<group>`, or add `--project chromium` for the quick loop.
  - Rows only Chromium runs carry `@chromium-only`.
  - A run never needs `--update-snapshots`, and every test refuses it.
- **Screenshots.** In any new visual spec, take screenshots only through `screenshotLocator`/`screenshotPage` from `visual/guard.ts`.
- **Fixing differences.** Fix the implementation. Never add a normalization. A tolerance needs an owner decision (D-08), recorded in `intentional-differences.ts`.
- **Recipes.** Share looks through recipes: `buttonClasses` is exported from `@/ui/actions`, and `buttonSpinnerClasses` from `./button.recipe`.
- **ButtonLink (02-17).** Gets the hover through `not-disabled:` (an `<a>` is never `:disabled`).
- **Runtime.** A Chromium row takes about 2 s and a WebKit 1440 row about 12 s. State rows load one page pair per case, so watch the budget (< 5 min Chromium, < 4 min per other engine) as scenarios grow.
- **02-33 (budgets).** `.budget-dist` now has the `parity` entry too. The public-JS budget should measure the `main` entry's chunks (`main-*.js` plus the shared `jsx-runtime-*.js`), not `parity-*.js`.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 17 created files and 10 modified files exist on disk.
- Commits `aa47768`, `4d4029d`, `b8871ab`, `c8ba069` and `2edde57` are on `gsd/phase-2-web-foundation-design-system`.
