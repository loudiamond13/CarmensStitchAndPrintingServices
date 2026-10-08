---
phase: 02-web-foundation-design-system
plan: 05
subsystem: ui
tags: [css, tailwind, design-system, wcag, fonts, fontsource, vite-plugin, perf]
created: "2026-10-08T00:12:53-05:00"
updated: "2026-10-08T00:12:53-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "Plan 01: web/ scaffold, vite.config.ts (assetsInlineLimit 0, outDir per mode), fontsource packages installed; plan 02: verify pipeline, Prettier ignore of the five spec CSS files, node-typed test convention"
provides:
  - "web/src/styles/{tokens,globals,compat,components,screens}.css byte-for-byte (LF) from CSPS-UI-SPEC.md App. A-C, proven by verbatim.test.ts"
  - "spec-gaps.css (empty @layer components) for plans 12, 13 and 15"
  - "overrides.css (unlayered): D-01, D-02, D-03, D-05, WEB-09 and the PERF-05 fallback faces, each rule naming its decision ID"
  - "main.tsx stylesheet order: four Barlow weight files + @fontsource-variable/archivo -> globals -> spec-gaps -> overrides"
  - "overrides.test.ts: rule assertions per ruling, opacity scan over all CSS and TSX with a reasoned allow-list, viewport and token-only checks"
  - "scripts/vite-preload-font-plugin.ts: preloadFontPlugin(pattern), build-only, one crossorigin woff2 preload, fails closed"
  - "scripts/font-metrics.mjs: WOFF2/TrueType metric reader and fallback-override formula (local, one-off)"
affects: [02-09, 02-12, 02-13, 02-14, 02-15, 02-16, 02-17, public-site, admin-portal]

actuals:
  tokens: 40220       # chars/4 over git diff abefa5d..d43e6d5 (160880 chars); 23 KB of it is the five verbatim CSS files
  tasks: 3
  commits: 6
plan_head_before: abefa5d754a4187533a00064531d3517aafcea4a
plan_head_after: d43e6d5f499bbfcf855ebd4237340e535382fc05

tech-stack:
  added: []
  patterns:
    - "Verbatim CSS is checked by extracting the first ```css block after the spec heading that names the file, LF-normalized on both sides"
    - "Owner rulings live only in unlayered overrides.css; a rule test finds each one by selector, value and at-rule context and requires its decision-ID comment"
    - "Faded text is caught by a scan: any opacity < 1 must be on an allow-listed, reasoned selector or be reset to 1 by a D-02 rule in overrides.css"
    - "A pending (aria-disabled) button gets one reset rule per App. B :not(:disabled) hover/active rule, enforced by a parity test"
    - "Build plugins that depend on hashed assets run as order 'post' transformIndexHtml hooks and fail the build when the asset is missing"

key-files:
  created:
    - web/src/styles/tokens.css
    - web/src/styles/globals.css
    - web/src/styles/compat.css
    - web/src/styles/components.css
    - web/src/styles/screens.css
    - web/src/styles/spec-gaps.css
    - web/src/styles/overrides.css
    - web/src/styles/verbatim.test.ts
    - web/src/styles/overrides.test.ts
    - web/scripts/vite-preload-font-plugin.ts
    - web/scripts/vite-preload-font-plugin.test.ts
    - web/scripts/font-metrics.mjs
    - web/scripts/font-metrics.test.ts
    - .planning/phases/02-web-foundation-design-system/deferred-items.md
  modified:
    - web/src/main.tsx
    - web/vite.config.ts
    - web/src/test/build-config.test.ts
    - web/tsconfig.app.json
    - web/tsconfig.node.json

key-decisions:
  - "D-02 rule applied to five verbatim faded-text selectors (placeholder, Manager tag, CTA lead, filter-pill count, big-button caption): reset to opacity 1 in overrides.css. Four of them measured below 4.5:1 faded (placeholder 4.18, Manager tag 4.17, pill count 3.32 Blush; selected pill count 4.13 Espresso)"
  - "Opacity allow-list: disabled and aria-disabled buttons (WCAG 1.4.3 inactive control), thumb grip and actions (D-05), skeleton shimmer, the first frame of the csp-fade/rise/slide entry animations, and two decorations (.s-profile-stripe, .s-login-num); each entry carries its reason in the test"
  - "WEB-09 'visually identical to :disabled' includes hover and press: aria-disabled buttons reset every App. B :not(:disabled) hover/active property to the variant's resting value"
  - "PERF-05 fallback metrics are measured against Windows Arial (Arial Narrow is not installed here, the script's documented fallback): Archivo Fallback size-adjust 101.85%, ascent 86.21%, descent 20.62%, line gap 0%; Barlow Condensed Fallback 68.92% / 145.1% / 29.02% / 0% (Barlow 700 latin, uppercase-weighted sample)"
  - "preloadFontPlugin fails the build on zero matches, on more than one match and when no bundle is present, so exactly one preload link can ever be injected"

patterns-established:
  - "New CSS rules in overrides.css: one comment naming the decision ID right before each rule or its enclosing at-rule"
  - "Node-typed tests under src/ are listed in tsconfig.node.json and excluded from tsconfig.app.json (now including src/styles/*.test.ts)"

requirements-completed: [WEB-02, A11Y-04, PERF-03, PERF-05]

coverage:
  - id: D1
    description: "The five design stylesheets equal the spec App. A, A.2, A.3, B and C blocks (LF-normalized) and stay LF"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/styles/verbatim.test.ts#verbatim design CSS (WEB-02, D-07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "main.tsx loads fonts, globals, spec-gaps, overrides in that order with the SPEC-DEVIATION markers and no per-subset font files"
    requirement: A11Y-04
    verification:
      - kind: unit
        ref: "web/src/styles/verbatim.test.ts#main.tsx stylesheet load order (D-07, A11Y-04 ordering edge)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Owner WCAG rulings D-01 (phone 16px inputs), D-02 (inactive rows, no faded text), D-03 (bold current items, checkbox cue), D-05 (thumb actions on focus and touch) and the WEB-09 pending look are in overrides.css with decision-ID comments"
    requirement: A11Y-04
    verification:
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#overrides.css owner rulings (A11Y-04)"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#no faded text (D-02 rule, A11Y-04 empty edge)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phone text-entry fields render at 16px and index.html keeps pinch zoom (no maximum-scale or user-scalable)"
    requirement: PERF-03
    verification:
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#D-01 (C-34): phone text-entry fields compute to 16px, desktop and tablet keep 14px"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#index.html keeps pinch zoom: no maximum-scale and no user-scalable (D-01)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Metric-matched fallback faces (Barlow fallback skips U+20B1), font stacks with each fallback after its brand family, and exactly one Archivo latin woff2 preload in the production index.html; fonts are woff2 files under /assets"
    requirement: PERF-05
    verification:
      - kind: unit
        ref: "web/scripts/vite-preload-font-plugin.test.ts#preloadFontPlugin (PERF-05)"
        status: pass
      - kind: unit
        ref: "web/scripts/font-metrics.test.ts#committed PERF-05 values in overrides.css"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#PERF-05 metric-matched fallback fonts"
        status: pass
      - kind: other
        ref: "npm --prefix web run build && node -e (exactly one rel=preload for archivo-latin-wght-normal-*.woff2 in wwwroot/index.html)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual effect of the overrides in the browser: bold current items, the drawn checkbox tick, the full-opacity text that was faded, and no visible layout shift when the brand fonts swap in"
    requirement: A11Y-04
    verification: []
    human_judgment: true
    rationale: "No component renders these classes yet. The D-23 screenshots (plans 15-17) and the plan 17 E2E font check are where the owner sees them."

duration: 18min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 05: Verbatim Design CSS, Owner WCAG Overrides and PERF-05 Fonts Summary

*Created: 2026-10-08T00:12:53-05:00 · Updated: 2026-10-08T00:12:53-05:00*

**The approved design CSS (spec App. A-C) is now in `web/src/styles/`, byte-for-byte, and a test proves it. It loads after the self-hosted fonts and before an unlayered `overrides.css`, which holds the owner's WCAG rulings D-01, D-02, D-03 and D-05, the WEB-09 pending-button look, and metric-matched Arial fallback faces. The Barlow fallback skips ₱, so the peso never renders in a system font. The production build now preloads the hashed Archivo latin woff2 and fails if that file is missing.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-08T04:54:31Z
- **Completed:** 2026-10-08T05:12:53Z
- **Tasks:** 3 (TDD: 3 RED + 3 GREEN commits)
- **Files modified:** 18

## Accomplishments

- **Verbatim CSS.** `tokens`, `globals`, `compat`, `components` and `screens.css` were extracted from the CSPS-UI-SPEC.md appendices with LF line endings. `verbatim.test.ts` re-extracts each block and compares it after LF normalization. The test also pins the main.tsx import order and the `SPEC-DEVIATION: D-07` markers.
- **Owner rulings in one file.** `overrides.css` is unlayered and contains:
  - **D-01:** 16px in phone search, filter and item-row inputs.
  - **D-02:** `--surface-2` inactive rows and phone cards, plus five faded-text resets.
  - **D-03:** weight 700 on the current tab, site link, sidebar item and tab-bar item, and a checkbox with a 2px `--ink` border and an `--on-accent` tick drawn by a pseudo-element.
  - **D-05:** the drag grip shows on `:focus-within`, and the grip and actions are always visible on touch devices.
  - **WEB-09:** `[aria-disabled="true"]` looks like `:disabled`, including no hover or press styles.
- **Faded-text guard.** `overrides.test.ts` parses every stylesheet with a small plain-text reader. Any `opacity` below 1 must be on an allow-listed, reasoned selector, or `overrides.css` must reset it to 1 under D-02. The test also scans TSX style objects.
- **PERF-05 fonts.** "Archivo Fallback" and "Barlow Condensed Fallback" have computed `size-adjust` and ascent, descent and line-gap overrides. The Barlow face has `unicode-range: U+0000-20B0, U+20B2-10FFFF`. `--font-sans` and `--font-display` put each fallback right after its brand family. A new test proves Barlow has no ₱ glyph in any subset and Archivo latin-ext has one.
- **Preload.** The built `index.html` has exactly one `<link rel="preload" as="font" type="font/woff2" href="/assets/archivo-latin-wght-normal-<hash>.woff2" crossorigin>`. Fonts are woff2/woff files under `/assets` (no `data:` URLs).

## Task Commits

1. **Task 1: Tracer, verbatim CSS and fonts in contract order**
   - `8f0f6e0` test: verbatim byte-equality and load-order test (RED)
   - `ede2801` feat: five verbatim CSS files, spec-gaps/overrides placeholders, main.tsx imports (GREEN)
2. **Task 2: Owner WCAG rulings in overrides.css**
   - `92b5fc5` test: rule test and faded-text scan (RED)
   - `cb79c19` feat: D-01, D-02, D-03, D-05, WEB-09 overrides plus the hover/press parity rules (GREEN)
3. **Task 3: Fallback fonts and Archivo preload (PERF-05)**
   - `4691e22` test: plugin, font-metrics and font-face tests against inert placeholders (RED)
   - `d43e6d5` feat: font-metrics reader, fallback faces, preload plugin registered in vite.config.ts (GREEN)

**Tracer gate (Task 1):** interactive run, `end-of-phase` mode, automated-only `<verify>`. Both verify commands were re-run and passed before expansion (verbatim test green; the build emits CSS + woff2 with no Vite warning). No checkpoint was needed.

## TDD Gate Compliance (RED evidence)

| Task | RED run | Failing target (assertion) | Checker |
|------|---------|----------------------------|---------|
| 1 | `vitest run src/styles/verbatim.test.ts` exit 1, 8 of 9 failed | `src/styles/tokens.css equals its spec appendix block`: expected the App. A text, got `null` (file absent); load order `expected false to be true`; SPEC-DEVIATION markers `expected [] to have a length of 2`. The per-subset check passed in RED (characterization guard). | RED_EVIDENCE_OK (`p05/t1-red.json`) |
| 2 | `vitest run src/styles/overrides.test.ts` exit 1, 8 of 18 failed | `.csp-search input { font-size: 16px } in @container pg (max-width: 767px): expected +0 to be 1`. The scan listed the 5 verbatim faded-text selectors. The viewport, token-only, `.is-zero` and weight-600 checks passed in RED (they describe existing state). | RED_EVIDENCE_OK (`p05/t2-red.json`) |
| 2b | Same file, 1 of 19 failed before the parity CSS was written | `.csp-btn[aria-disabled="true"]:active { transform: none }: expected +0 to be 1` | log only (added under Rule 2, committed with GREEN) |
| 3 | `vitest run` on the plugin, font-metrics and overrides tests, exit 1, 18 of 37 failed | `apply: expected undefined to be 'build'`. `fallbackOverrides: expected { sizeAdjust: '' } to deeply equal { sizeAdjust: '80.00%' }`. Barlow `unicode-range: expected undefined`. | RED_EVIDENCE_OK (`p05/t3-red.json`) |

Every `test(02-05)` commit comes before its `feat(02-05)` commit.

## Files Created/Modified

- `web/src/styles/tokens.css`, `globals.css`, `compat.css`, `components.css`, `screens.css`: verbatim spec CSS (never edit).
- `web/src/styles/spec-gaps.css`: an empty `@layer components` block with the SPEC-GAP rules in its header.
- `web/src/styles/overrides.css`: the owner rulings and the PERF-05 faces and stacks.
- `web/src/styles/verbatim.test.ts`, `overrides.test.ts`: node-environment tests (plain-text CSS reader, no library).
- `web/scripts/vite-preload-font-plugin.ts` (+ test): `preloadFontPlugin(pattern)`.
- `web/scripts/font-metrics.mjs` (+ test): `readFontMetrics(buffer, sample)`, `fallbackOverrides(brand, fallback)`, `BODY_SAMPLE`, `DISPLAY_SAMPLE`, plus the CLI.
- `web/src/main.tsx`: the App. D.6 font imports and the three stylesheets. The plan-01 tracer body is kept until plan 14.
- `web/vite.config.ts`: registers `preloadFontPlugin(/archivo-latin-wght-normal-.*\.woff2$/)` (`SPEC-DEVIATION: PERF-05 font preload`).
- `web/src/test/build-config.test.ts`: pins the plugin as build-only in production.
- `web/tsconfig.app.json`, `web/tsconfig.node.json`: the style tests are node-typed.
- `.planning/phases/02-web-foundation-design-system/deferred-items.md`: two out-of-scope findings.

## Decisions Made

- **Five verbatim faded-text rules reset under the D-02 rule.** The approved 02-UI-SPEC states the rule: "no text-bearing element may have opacity < 1". Faded, these measured placeholder 4.18:1, Manager tag 4.17:1 and filter-pill count 3.32:1 in Blush, and the selected pill count 4.13:1 in Espresso. At full opacity they are 6.28-13.66:1. The CTA lead and the big-button caption (4.71-9.11:1 faded) are reset too, so the rule holds with no exceptions. Visible effect: those five texts are slightly darker. It shows in the D-23 screenshots, and removing a rule reverts it.
- **Allow-list scope.** The plan listed disabled buttons, thumb actions and skeleton shimmer. The verbatim CSS also fades the first frame of three entry animations (transient, and O-6 covers reduced motion) and two pure decorations: the aria-hidden profile stripe, and the login numeral, which has a transparent fill and only an outline. These are allow-listed with reasons, not overridden.
- **Fallback measured against Arial.** Arial Narrow is not installed on the measuring machine, so the Barlow fallback is matched to Arial, the face most visitors' devices resolve. On a device that has Arial Narrow, the swap frame is slightly less exact. Only the first paint is affected.
- **Display sample is uppercase.** The Barlow width is weighted on uppercase letters because the large spec headlines are UPPERCASE, and they cause the biggest shift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Five verbatim selectors faded text below 4.5:1, which the opacity scan had to accept or reject**
- **Found during:** Task 2 (RED run of the scan)
- **Issue:** The plan's allow-list did not cover `.csp-input::placeholder`, `.csp-nav-tag`, `.s-cut-accent .s-lead`, `.s-pill-count` or `.s-bigbtn span`. Four of them fail WCAG 1.4.3 when faded. The verbatim files cannot change (D-07).
- **Fix:** One D-02 rule in overrides.css resets them to opacity 1. The scan treats a selector as compliant only when it is allow-listed or reset by a D-02-commented top-level override. Entry-animation first frames and two decorations were allow-listed with reasons.
- **Files modified:** web/src/styles/overrides.css, web/src/styles/overrides.test.ts
- **Verification:** the scan reports `[]`, and a dedicated test requires the five resets.
- **Committed in:** cb79c19

**2. [Rule 2 - Missing critical] WEB-09 "visually identical" also needed the hover and press states**
- **Found during:** Task 2
- **Issue:** App. B hover and press styles are `:not(:disabled)`, so an `aria-disabled` button would still change color and shadow and move on press, unlike `:disabled`.
- **Fix:** One reset rule per App. B hover/active rule (primary, secondary, ghost, danger, ghost-danger, active transform), with values from each variant's resting rule. A parity test derives the expected values from components.css.
- **Files modified:** web/src/styles/overrides.css, web/src/styles/overrides.test.ts
- **Verification:** the parity test failed first (`:active { transform: none }` missing), then passed.
- **Committed in:** cb79c19

**3. [Rule 3 - Blocking] The style tests need Node types**
- **Found during:** Task 1
- **Issue:** `verbatim.test.ts` and `overrides.test.ts` read files with `node:fs`, but tsconfig.app.json has no Node types.
- **Fix:** Listed both in tsconfig.node.json and excluded them from tsconfig.app.json, as plan 02 did for the other config-reading tests.
- **Files modified:** web/tsconfig.app.json, web/tsconfig.node.json
- **Committed in:** 8f0f6e0

**4. [Rule 2 - Missing critical] Tests for the code the plan touched but did not list**
- **Found during:** Task 3
- **Issue:** `font-metrics.mjs` (a hand-written binary font reader) and the vite.config.ts registration had no planned test.
- **Fix:** Added `scripts/font-metrics.test.ts`. It checks the reader on the installed woff2 files, verifies Pitfall 17's ₱ claim, checks the formula, and confirms the committed overrides.css values reproduce the brand metrics without reading Arial, so it runs on CI's ubuntu. Also added a build-config assertion that the plugin is registered and is build-only. The plugin additionally fails on more than one match and on a missing bundle (fail closed, "exactly one" link).
- **Files modified:** web/scripts/font-metrics.test.ts, web/src/test/build-config.test.ts, web/scripts/vite-preload-font-plugin.ts
- **Committed in:** 4691e22, d43e6d5

---

**Total deviations:** 4 auto-fixed (3 missing critical, 1 blocking).
**Impact on plan:** All four serve the plan's own truths: no faded text, the WEB-09 look, and tested scripts. No new packages, and no verbatim file was edited.

## Issues Encountered

- A `node -e` edit dropped the regex backslash in vite.config.ts (`.*.woff2`). The Edit tool fixed it before the commit.
- `[x].flat(Infinity)` on Vite's `PluginOption` type hit TS2589 (instantiation too deep). A small recursive `flatten` replaced it.

## Deferred Items

Logged in `deferred-items.md` (not fixed: each needs an owner ruling or affects nothing yet):
- **Owner question (D-08 candidate):** on the selected Users sidebar row the "Manager" tag is `--nav-ink` on `--primary`, which is 1.00:1 in Blush and 1.43:1 in Espresso, so it is invisible. This is in the verbatim App. B. Fixing it changes the visuals, so it belongs in the O-1..O-8 owner batch.
- The Tailwind `font-sans`/`font-display` utilities inline the App. A.2 `@theme inline` stack and would bypass the fallback faces. No code uses them.

## Verification

- `npm --prefix web run verify`: exit 0. Typecheck (TS 7) and lint (0 warnings) pass, Prettier is clean, **430 tests** pass (383 before), coverage is 99.06% statements, 96.7% branches, 100% functions and 100% lines, and the build has no warnings.
- Production build: CSS and woff2 assets are in `src/Csps.Server/wwwroot/assets`, and `index.html` has exactly one Archivo latin preload.
- `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx`: 837/837 passed, 0 warnings.
- `node web/scripts/license-gate.mjs`: exactly the 5 known D-BL-01 dev-tree packages (no new failures, no exceptions added).
- Acceptance greps: the SPEC-DEVIATION marker appears 2 times, `latin-800` 0, `D-01|D-02|D-03|D-05|WEB-09` 19, and the `U+0000-20B0, U+20B2-10FFFF` string 1.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plans 12, 13 and 15 add SPEC-GAP blocks inside `spec-gaps.css`'s `@layer components`. The overrides test already requires them to use tokens only and stay layered.
- Plan 14 replaces the main.tsx body with the router and keeps the import block as it is. `verbatim.test.ts` pins that block.
- Plan 17's E2E font check proves the final rendered face. The first-paint ₱ assumption (latin-ext loads on demand) stays flagged in the plan's Edge Coverage.

## Self-Check: PASSED

- All 14 created files and 5 modified files exist on disk.
- Commits 8f0f6e0, ede2801, 92b5fc5, cb79c19, 4691e22 and d43e6d5 exist (`git rev-list --count abefa5d..HEAD` = 6).

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*
