---
phase: 02-web-foundation-design-system
plan: 35
subsystem: web-quality-gates
tags: [lighthouse, playwright, e2e, parity, responsive, fonts, wcag, keyboard, perf-02, perf-03, perf-05, a11y]
created: "2026-10-09T07:30:00-05:00"
updated: "2026-10-09T07:30:00-05:00"

requires:
  - phase: 02-09
    provides: E2E host on https://localhost:5199, the guard fixture, the shared run lock (acquireLock / LOCK_PATH)
  - phase: 02-12
    provides: woff2-only fonts, the single Archivo preload, metric fallback faces (02-35 owns the real-browser ₱ check)
  - phase: 02-33
    provides: build-enforced budgets (the production build the Lighthouse run measures)
  - phase: 02-34
    provides: "@/ui barrel and the /dev/components showcase (Sidebar active=null)"
  - phase: 02-32
    provides: admin-keyboard.spec.ts drawer and user-menu journeys (run under @keyboard)
provides:
  - "npm --prefix web run lighthouse: lock, busy-port refusal, preflight, production build, real host, lighthouse 13.5.0 mobile, assertReport"
  - "web/scripts/lighthouse-assert.mjs: THRESHOLDS + assertReport (raw values, missing fails, fixed order)"
  - "web/scripts/vite-route-preload-plugin.ts: modulepreload for the lazy public route chunks (production only)"
  - "Brotli/gzip response compression at CompressionLevel.Optimal"
  - "E2E suites @responsive, @fonts, @a11y-rulings, @keyboard (web/e2e/sweep.ts shared page list)"
  - "Showcase demo: ConfirmDialog with no type-to-confirm field (Open Delete Payment)"
  - "Parity harness: fonts settle before a case is read"
  - "docs/web/release-gates.md"
affects: [02-36, phase-03-ci, phase-04, every-later-web-plan]

actuals:
  tokens: 31900
  tasks: 3
  commits: 11
plan_head_before: 87b553c562da4fc5e7773543fe3cd13b1387a491
plan_head_after: 856028d

tech-stack:
  added: []
  patterns:
    - "Gate runner = planSteps (pure data, unit-tested) + executeSteps with injectable deps; it stops only the child it started (taskkill /T on its own PID)"
    - "Sweep specs collect every failure into one list and assert it empty, so one run reports every page and size"
    - "Known owner items are asserted exactly as they are today (per engine), never skipped, so a ruling changes a test on purpose"
    - "Page scripts as strings (the node TS program has no DOM types); locator.evaluate with a string does not call it"

key-files:
  created:
    - web/scripts/lighthouse.mjs
    - web/scripts/lighthouse-assert.mjs
    - web/scripts/lighthouse-assert.test.ts
    - web/scripts/vite-route-preload-plugin.ts
    - web/scripts/vite-route-preload-plugin.test.ts
    - web/e2e/sweep.ts
    - web/e2e/responsive.spec.ts
    - web/e2e/fonts.spec.ts
    - web/e2e/a11y-rulings.spec.ts
    - web/e2e/keyboard.spec.ts
    - docs/web/release-gates.md
  modified:
    - web/vite.config.ts
    - src/Csps.Server/Composition/SpaRegistration.cs
    - tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
    - web/src/dev/ShowcaseDemos.tsx
    - web/src/dev/ComponentShowcase.tsx
    - web/src/dev/ComponentShowcase.test.tsx
    - web/src/dev/showcaseCopy.ts
    - web/visual/parity.spec.ts
    - docs/web/e2e.md
    - .planning/phases/02-web-foundation-design-system/deferred-items.md

key-decisions:
  - "Lighthouse LCP fixed without any look change: modulepreload for the lazy public route chunks plus Optimal compression took LCP from 2407 ms to 1958-1965 ms (margin about 40 ms, logged)"
  - "assertReport also holds categories beyond the four (Lighthouse 13 adds agentic-browsing) to 0.95"
  - "Lighthouse drives the pinned Playwright Chromium through CHROME_PATH on its own child, so a machine Chrome update does not move the score"
  - "Responsive orientation = same width, height 16:9 (portrait) or 9:16 (landscape); phone projects use their own screen both ways"
  - "Labelled landmarks = every region named, and every navigation/search/complementary role that appears more than once named (ARIA landmark naming); App. E.7's sole search landmark stays unnamed"
  - "Admin Topbar minimum page width is per engine: 398 Chromium, 406 WebKit, 418 Firefox; asserted as today, owner item open"
  - "₱ proof without screenshots (WebKit's screenshotter trips the CSP guard): ten-glyph runs in the element's own stack vs Archivo vs Arial in every engine, the in-place glyph in Chromium/Firefox, CDP platform fonts in Chromium"
  - "D-05 reads a faded focused control again after its finite transitions (the approved 0.15s reveal); settle is capped at 2 s"
  - "Showcase keyboard journeys scope axe to the open dialog: the page behind a phone bottom sheet is not inert (Phase 4 follow-up logged)"
  - "Added a dev-only Delete Payment confirm demo (spec child-row delete copy) so the Cancel-focus journey has a field-less ConfirmDialog"

patterns-established:
  - "End-of-phase browser gates live in web/e2e with tags @responsive/@fonts/@a11y-rulings/@keyboard; docs/web/release-gates.md lists every gate and the run order"

requirements-completed: [PERF-02, PERF-03, PERF-05, A11Y-01, A11Y-02, A11Y-04, QUAL-04]

coverage:
  - id: D1
    description: "Lighthouse on the production public shell, real host, mobile profile: every category >= 0.95, LCP < 2000 ms, CLS < 0.05, TBT < 200 ms, enforced by a tested assertion"
    requirement: PERF-02
    verification:
      - kind: unit
        ref: "web/scripts/lighthouse-assert.test.ts (34 cases: boundaries, precision, missing, order, planSteps, executeSteps)"
        status: pass
      - kind: other
        ref: "npm --prefix web run lighthouse (a11y 0.98, best-practices 1, performance 0.99, seo 1, agentic-browsing 1; LCP 1961.9 ms, CLS 0, TBT 6 ms)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Route preload and Optimal compression that brought LCP under 2000 ms"
    requirement: PERF-02
    verification:
      - kind: unit
        ref: "web/scripts/vite-route-preload-plugin.test.ts (8 cases)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#CompressesAtTheOptimalLevel"
        status: pass
    human_judgment: false
  - id: D3
    description: "Responsive sweep: every page at 320-1920 px portrait and landscape, no sideways scroll (Topbar owner item asserted per engine), one h1, skip link, named landmarks, axe, 16px phone inputs, no zoom lock"
    requirement: PERF-03
    verification:
      - kind: e2e
        ref: "web/e2e/responsive.spec.ts (@responsive, 13 pages x 5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "₱ renders in Archivo Variable; one font preload; same-origin woff2 only"
    requirement: PERF-05
    verification:
      - kind: e2e
        ref: "web/e2e/fonts.spec.ts (@fonts, 15 of 15 in 5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Owner WCAG rulings on computed styles: D-02, D-03, D-05, D-BL-02, O-3, O-6"
    requirement: A11Y-04
    verification:
      - kind: e2e
        ref: "web/e2e/a11y-rulings.spec.ts (@a11y-rulings, 52 tests per project)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Keyboard journeys: skip link, Tabs, SegmentedControl, Modal and slide-over trap and return, ConfirmDialog focus, toast Dismiss"
    requirement: A11Y-02
    verification:
      - kind: e2e
        ref: "web/e2e/keyboard.spec.ts + admin-keyboard.spec.ts (@keyboard, all 5 projects)"
        status: pass
      - kind: unit
        ref: "web/src/dev/ComponentShowcase.test.tsx#opens the Delete Payment confirm (no type-to-confirm field) with focus on Cancel; it deletes nothing"
        status: pass
    human_judgment: false
  - id: D7
    description: "Full parity matrix with no filter (motion and touch passes included) in Chromium, Firefox and WebKit"
    requirement: QUAL-04
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity (452 of 452, 29.9 min)"
        status: pass
    human_judgment: false
  - id: D8
    description: "docs/web/release-gates.md: every gate, its command and pass rule, the preflight and the run order"
    verification: []
    human_judgment: true
    rationale: "Documentation clarity for the owner is a reading judgment no test asserts"

duration: 3h 11m
completed: 2026-10-09
status: complete
---

# Phase 2 Plan 35: End-of-phase browser gates Summary

**A Lighthouse gate on the real host (mobile, every category ≥ 0.95, LCP < 2 s), four new browser suites (responsive sweep, ₱ font proof, the owner's WCAG rulings, keyboard journeys) green in all five Playwright projects, and the full 452-row parity matrix green in three engines. Two no-look fixes got LCP under 2000 ms: a modulepreload for the public route chunks and Optimal compression.**

## Performance

- **Duration:** 3h 11m (most of it the long runs: two full parity matrices at about 30 min each, a full E2E at 29.5 min, the Task 2 sweep at about 45 min)
- **Started:** 2026-10-09T09:12:31Z
- **Completed:** 2026-10-09T12:25:00Z
- **Tasks:** 3 of 3
- **Files:** 21 (11 created, 10 modified)

## Accomplishments

- **Lighthouse gate** (`npm --prefix web run lighthouse`, Task 1 tracer):
  - It takes the shared e2e run lock and refuses a busy port 5199. It runs the preflight, builds production into wwwroot, starts `dotnet run … --urls https://localhost:5199 --webroot <wwwroot>` with Development set on that child only, and waits for /health.
  - It then runs lighthouse 13.5.0 on the mobile profile with `--no-enable-error-reporting`, using the pinned Playwright Chromium. It stops only the process tree it started and writes `artifacts/lighthouse/report.json`, which is git-ignored.
  - `assertReport` compares raw values with no rounding, fails a missing or null category or metric, and lists every failure (categories by name, then metrics).
  - Final run: accessibility 0.98, best practices 1, performance 0.99, SEO 1 and agentic-browsing 1; LCP 1961.9 ms, CLS 0, TBT 6 ms.
- **LCP fix (no look change).** The first run measured LCP at 2407 ms. Two changes brought it to **1958–1965 ms** over five runs:
  - `routePreloadPlugin` adds `<link rel="modulepreload">` for the lazy PublicLayout and PublicPlaceholderPage chunks. It is production only and fails closed when a route module has no chunk.
  - Brotli and gzip compression now run at `CompressionLevel.Optimal`. The entry script goes out at about 121 KB instead of about 150 KB.
- **@responsive** covers 13 page cases (`/`, five admin previews and the showcase, the admin ones in both themes) at the 8 widths × 2 orientations in the desktop engines, and each phone's own screen both ways. At every size it checks:
  - no sideways scroll;
  - one h1, the skip link first and one `main#main`;
  - named landmarks;
  - no page-level axe findings;
  - 16px text-entry fields on phones (D-01).

  It also checks once per page that the viewport does not lock zoom.
- **@fonts** checks:
  - exactly one font preload (Archivo latin);
  - every font is a 200 `font/woff2` from the app origin;
  - `document.fonts.check('16px "Archivo Variable"', '₱')` is true;
  - ₱ draws in Archivo Variable in the KPI value, the display Money and body Money in every engine. The CDP platform fonts in Chromium are web fonts only, Archivo and Barlow.
- **@a11y-rulings** checks:
  - D-02: no faded text, at 1280 and 390;
  - D-05: Tabbing through every page never focuses an invisible control, the thumb reveal shows on focus within and always on touch;
  - D-03: current and selected items are 700, their siblings 600;
  - D-BL-02 on every admin page;
  - O-3: the drawer link is 800 italic;
  - O-6: under reduced motion, the skeleton, modal, slide-over and toast animations are none, with a no-preference control run first.
- **@keyboard** covers the skip link on `/` and `/admin`, the Tabs and SegmentedControl arrows, the Add Payment and Add User trap and return, ConfirmDialog focus (Cancel with no field, the field with type-to-confirm), and a persistent danger toast whose Dismiss works by keyboard. It also runs with the 02-32 drawer and menu journeys.
- **Full parity matrix** (orchestrator request): the first run had 450 pass and 2 fail (WebKit `@navigation-gaps` drawer-open at 390, a font-load race in the harness). After the fix the full matrix passed **452 of 452** in 29.9 min (Chromium 212, Firefox 120, WebKit 120), the @motion and @touch passes included.
- **docs/web/release-gates.md** lists every gate with its command and pass rule, the preflight rule, the run order before `/gsd-verify-work`, and the items the gates assert as they are today.

## Task Commits

1. **Task 1: Lighthouse tracer**
   - `be577ba` test(02-35): add failing tests for the Lighthouse gate and its runner (RED_EVIDENCE_OK: 31 of 34 fail on assertions)
   - `442b7bd` feat(02-35): score the production shell with Lighthouse on the real host
   - The first real run failed LCP (2407 ms), so the fix followed its own RED → GREEN:
     - `95fc145` test(02-35): add failing tests for the public route preload and the compression level (RED_EVIDENCE_OK: web 5 of 8 and .NET 1 of 1 fail on assertions)
     - `2fd1101` fix(02-35): preload the public route chunks and compress at the optimal level
   - Tracer gate: the unit tests and `npm run lighthouse` were re-run (pass, LCP 1959.7 ms) before expanding.
2. **Task 2: responsive, fonts, rulings**
   - `aea52ec` test(02-35): add the responsive sweep, the ₱ font proof and the WCAG rulings suites
   - `856028d` test(02-35): bound the in-place ₱ check by Chromium's layout unit
3. **Task 3: keyboard, parity, guide**
   - `462028c` test(02-35): add a failing test for a showcase confirm with no type-to-confirm field (RED_EVIDENCE_OK)
   - `7f0a84a` feat(02-35): add the Delete Payment confirm demo to the showcase
   - `564a658` fix(02-35): wait for fonts to settle before comparing a parity case
   - `e9f941f` test(02-35): add the keyboard journeys on the real host
   - `a6b4856` docs(02-35): add the release-gates guide and log the end-of-phase findings

**Plan metadata:** recorded in the docs(02-35) commit that adds this file.

## Files Created/Modified

- `web/scripts/lighthouse.mjs`: `planSteps` (pure), `executeSteps` (injectable deps), the host start and stop, and the lighthouse child.
- `web/scripts/lighthouse-assert.mjs` and `lighthouse-assert.test.ts`: `THRESHOLDS` (frozen) and `assertReport`.
- `web/scripts/vite-route-preload-plugin.ts` and its test, plus `web/vite.config.ts`: registered in production only.
- `src/Csps.Server/Composition/SpaRegistration.cs` and `tests/.../SpaHostTests.cs`: Optimal compression and its test.
- `web/e2e/sweep.ts`: the shared page list, `openPage` (theme through localStorage), `settle` (finite animations, capped at 2 s) and `axeFindings`.
- `web/e2e/responsive.spec.ts`, `fonts.spec.ts`, `a11y-rulings.spec.ts` and `keyboard.spec.ts`: the four suites.
- `web/src/dev/ShowcaseDemos.tsx`, `ComponentShowcase.tsx` and `showcaseCopy.ts`, with their test: the Delete Payment demo and `ExtraCase.demo`.
- `web/visual/parity.spec.ts`: the `FONTS_SETTLED` wait.
- `docs/web/release-gates.md` (new) and `docs/web/e2e.md` (tags, link).
- `deferred-items.md`: the findings below.

## Decisions Made

See `key-decisions` in the frontmatter. The ones that matter for later plans:

- **Lighthouse 13 adds an `agentic-browsing` category.** assertReport holds every category the report scores to 0.95, not only the four.
- **Landmark rule:** every region has a name, and any navigation, search or complementary role that appears more than once has names. That is the ARIA standard. A stricter "every search has a name" rule would have flagged App. E.7's approved, unnamed toolbar.
- **The admin Topbar overflow is engine-specific:** the page must be at least 398px wide in Chromium, 406px in WebKit (the iPhone 15 profile, at 393px, is affected) and 418px in Firefox. `main` never overflows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Gate failure] LCP 2407 ms on the first Lighthouse run**
- **Found during:** Task 1, the tracer `<verify>`.
- **Issue:** The lazy public route chunks were fetched one round trip after the entry script, and the server compressed at the framework default (Fastest).
- **Fix:** A production-only modulepreload plugin and Optimal Brotli/gzip. Each has a test written RED first. No look, markup or font-preload change, and no threshold change.
- **Files modified:** web/scripts/vite-route-preload-plugin.ts (+test), web/vite.config.ts, src/Csps.Server/Composition/SpaRegistration.cs, tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
- **Verification:** LCP measured 1958–1965 ms over five runs, and every category was ≥ 0.95.
- **Committed in:** 95fc145 (RED), 2fd1101 (GREEN)

**2. [Rule 1 - Harness race] Parity `@navigation-gaps` drawer-open failed in WebKit at 390px**
- **Found during:** Task 3, the full parity matrix.
- **Issue:** `document.fonts.ready` resolved before the preview's effect opened the drawer. The drawer's text then started a new font load, so the status read "loading".
- **Fix:** `open()` waits until no font is loading (`ready` plus two frames, up to ten rounds) and still requires "loaded". Nothing is compared differently.
- **Files modified:** web/visual/parity.spec.ts
- **Verification:** `--grep @navigation-gaps --project webkit` passed 4 of 4, and the full matrix passed 452 of 452.
- **Committed in:** 564a658

**3. [Rule 3 - Blocking] No field-less ConfirmDialog on /dev/components**
- **Found during:** Task 3.
- **Issue:** Every confirm demo has the type-to-confirm field, so the "ConfirmDialog Cancel focus" journey had nothing to run on.
- **Fix:** A dev-only "Open Delete Payment" demo using the spec's child-row delete copy. It sits in a non-page-root demo frame (`ExtraCase.demo`), and Delete Payment only closes it. The test was written RED first. The owner question about the trigger words is logged.
- **Committed in:** 462028c, 7f0a84a

**4. [Rule 1 - Test methodology] Fixes to the new suites found by running them in all engines**
- D-05 read the 0.15s thumb reveal at its first frame (opacity 0). The suite now re-reads a faded control after its finite transitions. The settle is capped at 2 s because WebKit could hang on a pending transition.
- The admin Topbar minimum is per engine (406 WebKit, 418 Firefox), not 398 everywhere.
- WebKit rounds single-character Range boxes to whole pixels, and adds no letter-spacing after the last character of a run. The ₱ proof therefore compares ten-glyph runs, which every engine measures to the subpixel. Chromium's in-place check is bounded at 0.05 px, its 1/64 px layout unit, while Archivo's and Arial's ₱ differ by more than 2 px.
- The showcase journeys get a 120 s timeout. The Tab walk gets 600 s, because WebKit and iPhone under a parallel run take up to 5 minutes.
- Toast Dismiss is reached by one Tab from the last stop before the layer. Links count except in WebKit. Going round with Shift+Tab passes through each engine's browser chrome.
- Phone dialog axe is scoped to the dialog. The page behind a phone bottom sheet is not inert, so axe flags the half-covered buttons with `target-size`. This is logged as a Phase 4 follow-up.

**5. [Rule 3 - Helper file] `web/e2e/sweep.ts`**
- The plan lists only the four spec files. A shared helper (page list, theme setup, settle, collecting axe) avoids copying the same code into four specs.

---

**Total deviations:** 5 groups (2 gate fixes, 1 blocking addition, test-methodology fixes, 1 helper file). **Impact:** no approved screen changed its look, words or ARIA structure, and no threshold, tolerance or normalization was added or loosened. The server change is the compression level only.

## Issues Encountered

- **Flakes in specs or tests this plan did not change** (both logged in deferred-items.md):
  - `showcase.spec.ts` (02-34) timed out once on iPhone and once on a cold Firefox load. It passed 10 of 10 on rerun.
  - `dotnet test` failed 2 of 890 once, straight after a Lighthouse run. A rerun passed 890 of 890, and both tests pass on their own.
- **Long runs.** WebKit and iPhone Tab walks over the showcase take minutes. The full E2E suite takes about 30 min and parity about 30 min.

## TDD Gate Compliance

- Task 1:
  - RED `be577ba` → GREEN `442b7bd`.
  - Fix RED `95fc145` → GREEN `2fd1101`.
  - All three RED records (`lighthouse-assert.test.ts`, `vite-route-preload-plugin.test.ts`, `SpaHostTests`) were verified `RED_EVIDENCE_OK`.
- Task 2: these are proof suites over behaviour that earlier plans built, so no RED is possible: the feature exists, and the tdd.md "unexpected GREEN" rule applies. Their first runs did fail, but only on test-method problems (deviation 4), never on an app defect, so no production code changed in Task 2.
- Task 3: RED `462028c` (RED_EVIDENCE_OK) → GREEN `7f0a84a` for the showcase demo. The keyboard spec is a proof suite, like Task 2.

## Verification

- `npm --prefix web run verify`: exit 0, no warnings. That is 101 files and 2638 tests, with coverage at 98.05% statements and 96.09% branches. Production public JS is 129.95 KB and CSS 12.92 KB; dev-route public JS is 149.47 KB (unchanged) and admin JS 154.60 KB.
- `npm --prefix web run e2e` (all tags, 5 projects): 504 of 507 in the full run. The 3 failures were 2 @fonts (fixed in `856028d`, then 15 of 15) and 1 @showcase flake (passed on rerun). Every @responsive, @a11y-rulings and @keyboard test passed across the full run and the targeted reruns.
- `npm --prefix web run parity` (no filter): **452 of 452** in 29.9 min.
- `npm --prefix web run lighthouse`: pass. LCP 1961.9 ms, CLS 0, TBT 6 ms, every category ≥ 0.95.
- `dotnet test --solution Csps.slnx`: 890 of 890 (second run; see Issues).
- `npm --prefix tools/openapi-gen run check`: the types match.
- Acceptance:
  - `grep -c "no-enable-error-reporting" web/scripts/lighthouse.mjs` gives 1.
  - `git check-ignore artifacts/lighthouse/report.json` prints the path.
  - The width list in `responsive.spec.ts` holds all eight values.
  - The rulings test titles name D-02, D-03, D-05, D-BL-02, O-3 and O-6.
  - `release-gates.md` mentions the preflight 5 times and lists every gate script.

## Owner Decisions Pending (logged in deferred-items.md)

- **Public footer headings h1 → h4.** Lighthouse's best-practice "heading order" audit flags them; the accessibility score is still 0.98. Recommended: h2, with no visible change.
- **One more dev-only showcase button, "Open Delete Payment".** This joins the 02-34 question about the demo button words.
- **Updated: admin Topbar on small phones.** The per-engine numbers are now in that item.

## Known Stubs

None. The Delete Payment demo deletes nothing by design, like the existing Delete Order demo.

## Threat Flags

None. The Lighthouse runner opens only port 5199, after the busy-port refusal. It stops only the process tree it started and uploads nothing (T-02-75, T-02-76). No package was added (T-02-SC). lighthouse 13.5.0 was already installed.

## User Setup Required

None.

## Next Phase Readiness

- **02-36 (owner review pack):** the gates are in place, and `docs/web/release-gates.md` gives the run order. The review pack can link it.
- **Phase 3 CI:**
  - Run the gates in the guide's order on ubuntu. The Lighthouse runner's `taskkill` branch is Windows-only; Linux uses a process-group kill.
  - Lighthouse needs Chrome or the Playwright Chromium on the runner.
- **Phase 4:**
  - **LCP has about 40 ms of headroom.** Choose precompressed Brotli, moving TanStack Query off the public entry, or a second font preload (an owner rule change) before adding public code. Never raise the limit.
  - Make the layout inert while a Modal is open, then re-run page-level axe with dialogs open.

## Self-Check: PASSED

- Every created file exists on disk: `web/scripts/lighthouse.mjs`, `lighthouse-assert.mjs`, `lighthouse-assert.test.ts`, `vite-route-preload-plugin.ts` (+ test), `web/e2e/sweep.ts`, `responsive.spec.ts`, `fonts.spec.ts`, `a11y-rulings.spec.ts`, `keyboard.spec.ts` and `docs/web/release-gates.md`.
- All 11 commits are present in `git log`: be577ba, 442b7bd, 95fc145, 2fd1101, aea52ec, 462028c, 7f0a84a, 564a658, e9f941f, a6b4856 and 856028d. That is 11 commits since the ledger base (`git rev-list --count 87b553c..HEAD`).

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-09*
