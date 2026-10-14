---
phase: 02-web-foundation-design-system
plan: 12
subsystem: ui
tags: [fonts, fontsource, woff2, preload, size-adjust, font-face, vite-plugin, perf-05, cls, tdd]
created: "2026-10-08T12:34:00-05:00"
updated: "2026-10-08T12:34:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "verify pipeline, ESLint CSS-import ban with the `!@fontsource/**` negations, Prettier CSS formatting, console guard"
  - phase: 02-web-foundation-design-system (plan 02-05)
    provides: "stylesheet contract allowing top-level @font-face in base.css; class gate"
provides:
  - "web/scripts/vite-preload-font-plugin.ts: preloadFontPlugin(pattern) (build-only, order post, one crossorigin woff2 preload, this.error on zero or two matches) and woff2OnlyPlugin() (enforce pre, drops the Fontsource .woff fallback, this.error on any non-woff2 url)"
  - "web/scripts/font-metrics.mjs: readFontMetrics(file, sample), fallbackOverrides(brand, recordedArial), RECORDED_ARIAL, BODY_SAMPLE, DISPLAY_SAMPLE; CLI `node scripts/font-metrics.mjs [--arial <ttf>]`"
  - "base.css: @font-face \"Archivo Fallback\" and \"Barlow Condensed Fallback\" (skips U+20B1); --font-sans / --font-display stacks with the fallbacks"
  - "main.tsx: the five Fontsource weight imports before @/styles/app.css"
  - "build-output test: one Archivo latin woff2 preload whose file exists, woff2-only fonts, no data: fonts"
affects: [02-35, 02-33, 02-34, every-later-web-plan, perf, lighthouse, csp]

actuals:
  tokens: 11200    # chars/4 over the realized diff (44,784 chars, 8 files)
  tasks: 2
  commits: 4
plan_head_before: 0da52d0ff8eaf5546d9e81072201541cb269de67
plan_head_after: c2399172e3fc8231de784d785b79ded3e81c1320

tech-stack:
  added: []
  patterns:
    - "Build plugins fail closed through this.error (Rolldown aborts the build); unit tests call the hooks with a context whose error() throws"
    - "Vite PluginOption is flattened with a small recursive async helper, never .flat(Infinity) (L-27)"
    - "System-font metrics are recorded constants with their source; tests never read C:\\Windows\\Fonts"

key-files:
  created:
    - web/scripts/vite-preload-font-plugin.ts
    - web/scripts/vite-preload-font-plugin.test.ts
    - web/scripts/font-metrics.mjs
    - web/scripts/font-metrics.test.ts
  modified:
    - web/src/main.tsx
    - web/vite.config.ts
    - web/src/styles/base.css
    - web/src/test/build-output.node.test.ts

key-decisions:
  - "The Fontsource Barlow weight files list a .woff fallback after each woff2; woff2OnlyPlugin (enforce pre) strips it before vite:css resolves url(), so the web root ships woff2 only, and fails the build if any non-woff2 url is left"
  - "Arial metrics are recorded constants in font-metrics.mjs (Arial 7.06, unitsPerEm 2048, body/display weighted widths), measured once on this Windows machine; the drift test recomputes the base.css values from the installed woff2 files plus these constants and allows 0.01 percentage points"
  - "The preload link is injected at the end of head (injectTo: head), after the stylesheet link"

patterns-established:
  - "A font change (new weight, new family, new Fontsource version) must keep font-metrics.test.ts and the build-output font tests green; re-record Arial only with owner review"

requirements-completed: [PERF-05]

coverage:
  - id: D1
    description: "The production build ships the brand fonts as self-hosted woff2 files only (no .woff, no data: URLs) and still one CSS file"
    requirement: "PERF-05"
    verification:
      - kind: unit
        ref: "web/src/test/build-output.node.test.ts#ships the self-hosted brand fonts as woff2 files only (PERF-05)"
        status: pass
      - kind: unit
        ref: "web/src/test/build-output.node.test.ts#inlines no font as a data: URL, which font-src 'self' would block (T-02-33)"
        status: pass
      - kind: unit
        ref: "web/scripts/vite-preload-font-plugin.test.ts#woff2OnlyPlugin (PERF-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "index.html carries exactly one crossorigin woff2 preload for the hashed Archivo Variable latin file, and the build fails on zero or two matches"
    requirement: "PERF-05"
    verification:
      - kind: unit
        ref: "web/scripts/vite-preload-font-plugin.test.ts#preloadFontPlugin (PERF-05)"
        status: pass
      - kind: unit
        ref: "web/src/test/build-output.node.test.ts#preloads exactly one font: the hashed Archivo Variable latin woff2 under /assets (PERF-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "base.css declares the metric-matched fallback faces and font stacks with the exact UI-SPEC values, recomputed from the installed woff2 files within 0.01 points; the Barlow fallback skips U+20B1"
    requirement: "PERF-05"
    verification:
      - kind: unit
        ref: "web/scripts/font-metrics.test.ts (14 tests)"
        status: pass
      - kind: unit
        ref: "web/src/styles/stylesheet-contract.node.test.ts#base.css holds only the token blocks, @font-face and the global element rules"
        status: pass
    human_judgment: false
  - id: D4
    description: "The ₱ glyph renders in Archivo Variable (or falls through from Barlow to Archivo), never in a system font, in a real browser"
    requirement: "PERF-05"
    verification: []
    human_judgment: true
    rationale: "Browser proof (document.fonts.check + Chromium platform-font inspection, assumption A7) belongs to plan 02-35; this plan proves it only through the cmap read and the unicode-range."

duration: 10min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 12: Self-Hosted Brand Fonts Summary

**The Barlow Condensed and Archivo Variable fonts are now served from the app as woff2 files only. The build adds one preload link for the Archivo latin file and fails if that file is missing or matched twice. base.css adds Arial-based fallback faces sized to match the brand fonts, so the swap does not shift the layout, and the Barlow fallback skips U+20B1 so ₱ always falls through to Archivo Variable.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-08T17:23:40Z
- **Completed:** 2026-10-08T17:34:00Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- `main.tsx` imports `@fontsource/barlow-condensed/{600,700,800,800-italic}.css` and `@fontsource-variable/archivo` before `@/styles/app.css`. These are the weight files, with `unicode-range` and `font-display: swap`. No per-subset file is imported (Pitfall 18).
- `preloadFontPlugin(/archivo-latin-wght-normal-.*\.woff2$/)` puts `<link rel="preload" as="font" type="font/woff2" href="/assets/archivo-latin-wght-normal-<hash>.woff2" crossorigin>` into the built `index.html`. Zero or two matches stop the build through `this.error`.
- `woff2OnlyPlugin()` removes the Fontsource `.woff` fallback before Vite's CSS step runs. The web root now has 16 woff2 files, no `.woff` files, and still one CSS file.
- base.css adds the "Archivo Fallback" and "Barlow Condensed Fallback" faces with the exact UI-SPEC values, and the two font stacks. The compiled CSS has `.font-sans{font-family:var(--font-sans)}`.
- `font-metrics.mjs` reads the font tables straight from the woff2 files with Node's built-in brotli, with no new package. `font-metrics.test.ts` recomputes all eight descriptor values on every run, and they match the committed ones exactly (101.85/86.21/20.62/0 and 68.92/145.10/29.02/0).

## Task Commits

1. **Task 1: Tracer: woff2 brand fonts and one preload**: RED `e7095d5` (test), GREEN `3890135` (feat)
2. **Task 2: Metric-matched fallback faces**: RED `b0f2d6f` (test), GREEN `c239917` (feat)

**Plan metadata:** see the docs(02-12) completion commit.

## Files Created/Modified

- `web/scripts/vite-preload-font-plugin.ts`: `preloadFontPlugin` and `woff2OnlyPlugin`
- `web/scripts/vite-preload-font-plugin.test.ts`: 14 tests (both plugins, the hooks' fail-closed paths, and vite.config.ts registering both)
- `web/scripts/font-metrics.mjs`: WOFF2/SFNT table reader, override formula, `RECORDED_ARIAL`, CLI
- `web/scripts/font-metrics.test.ts`: 14 tests (metrics, cmap ₱ check, formula, recorded Arial, committed faces, unicode-range, stacks, utilities)
- `web/src/main.tsx`: five Fontsource imports, marked `SPEC-DEVIATION: D-33 (only the font CSS and app.css are imported)`
- `web/vite.config.ts`: both plugins registered, each with a `SPEC-DEVIATION: PERF-05` comment
- `web/src/styles/base.css`: two `@font-face` fallback faces and the PERF-05 font stacks
- `web/src/test/build-output.node.test.ts`: 3 new tests (one preload whose file exists, woff2-only fonts, no `data:` fonts)

## Decisions Made

- **The `.woff` fallback is removed at build time.** The must-have says the build ships woff2 only, but the Barlow weight files list `url(...woff2) format('woff2'), url(...woff) format('woff')`, so Vite would also emit eight `.woff` files. A small `enforce: 'pre'` transform, limited to stylesheets inside `@fontsource` and `@fontsource-variable`, removes the second source. Every browser the project supports reads woff2.
- **The Arial metrics are recorded constants.** I measured them once from `C:\Windows\Fonts\arial.ttf` (Arial 7.06; 2048 units per em; weighted widths 902.4647 for lowercase and 1218.4179 for uppercase). With these constants the formula reproduces the committed values exactly. The test never reads a system font.
- **readFontMetrics takes a path, a file URL or raw bytes,** plus the weighted sample. The plan's artifact list names `readFontMetrics(path)`, and a sample is needed to measure the average width.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Fontsource Barlow weight files would ship `.woff` files**
- **Found during:** Task 1 (RED design, reading `800.css`)
- **Issue:** Each Barlow face lists a `.woff` fallback after the woff2. The must-have "the production build emits only woff2 font files" could not hold with the plan's imports and plugin alone.
- **Fix:** I added `woff2OnlyPlugin()` to `vite-preload-font-plugin.ts` and registered it in `vite.config.ts`. It is tested for stripping, Windows paths, the `@fontsource-variable` scope, ignoring other packages, and failing the build if a non-woff2 url is left.
- **Files modified:** `web/scripts/vite-preload-font-plugin.ts`, `web/scripts/vite-preload-font-plugin.test.ts`, `web/vite.config.ts`
- **Verification:** The build lists 16 `.woff2` assets and no `.woff`. The build-output test "ships the self-hosted brand fonts as woff2 files only" passes.
- **Committed in:** `e7095d5` (RED), `3890135` (GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 3).
**Impact on plan:** This was needed to meet the stated must-have. It adds no package and doesn't change the look.

## Issues Encountered

- A stale `.git/gsd-plan-head-before-02-12` ledger from the superseded run pointed at `74a1cb4`. I reset it to this plan's real base `0da52d0` before the first commit, so `commits: 4` is measured against the right base.
- The minifier drops the quotes around family names (`font-family:Archivo Fallback`). That is still valid CSS, because unquoted family names may contain spaces.

## Verification

- `npm --prefix web run test -- --run scripts/vite-preload-font-plugin.test.ts`: 14/14 passed
- `npm --prefix web run build`: clean, with one preload link and 16 woff2 fonts
- `npm --prefix web run test -- --run src/test/build-output.node.test.ts`: 11/11 passed
- `npm --prefix web run test -- --run scripts/font-metrics.test.ts src/styles/stylesheet-contract.node.test.ts`: 33/33 passed
- `node scripts/class-gate.mjs`: no findings
- `npm --prefix web run verify` (typecheck, lint, format:check, test:coverage, build, license:check, notices:check): exit 0. 27 files and 875 tests passed, with 100% line coverage.
- Plan-level check: build, then `test -- --run src/test/build-output.node.test.ts scripts`: 10 files and 190 tests passed
- Acceptance greps: `800-italic.css` 1, per-subset imports 0, `preloadFontPlugin` in vite.config.ts 2, `U+0000-20B0, U+20B2-10FFFF` 1, `Archivo Fallback` in base.css 2

## TDD Gate Compliance

- Task 1: RED `e7095d5` comes before GREEN `3890135`. RED evidence was `RED_EVIDENCE_OK` for `scripts/vite-preload-font-plugin.test.ts` (13 of 14 failed on assertions against stub plugins) and for `src/test/build-output.node.test.ts` (the preload and woff2 tests failed on assertions).
- Task 2: RED `b0f2d6f` comes before GREEN `c239917`. RED evidence was `RED_EVIDENCE_OK` for `scripts/font-metrics.test.ts` (12 of 14 failed on assertions against the stub module and the unchanged base.css).
- No refactor commit was needed.
- Tracer gate: interactive run, `end-of-phase` mode, and the verify step is automated only. I re-ran the Task 1 verify (plugin test, build, build-output) after GREEN, and it passed before Task 2 started.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved. The two Fontsource packages (5.3.0, OFL-1.1, D-18) were already installed, and the WOFF2 reader uses Node's built-in `zlib`.

## Known Stubs

None.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **02-35 (browser font proof):** `document.fonts.check('16px "Archivo Variable"', '₱')` and the Chromium platform-font check still need to run in a real browser. The CSP must keep `font-src 'self'`, and the fonts are same-origin `/assets/*.woff2`.
- **Vietnamese subsets:** the weight files also emit the Vietnamese woff2 subsets. Because of `unicode-range`, browsers download them only for Vietnamese text, but they do add about 52 KB to the web root. That size is not part of the JS/CSS budgets.
- **Font changes:** a Fontsource upgrade that changes a file name breaks the build through the preload plugin. A metric change fails `font-metrics.test.ts`. Re-record `RECORDED_ARIAL` only with the owner's review.

## Self-Check: PASSED

- All 4 created files exist on disk.
- All 4 task commits (`e7095d5`, `3890135`, `b0f2d6f`, `c239917`) are in the git log.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*
