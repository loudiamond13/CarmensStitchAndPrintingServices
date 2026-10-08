---
phase: 02-web-foundation-design-system
plan: 13
subsystem: testing
tags: [look-equality, parity, playwright, page-route, strict-csp, tailwind, rulings, reference, vite, tdd, d-33]
created: "2026-10-08T12:56:00-05:00"
updated: "2026-10-08T12:56:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-38)
    provides: "extract-spec.mjs with the SHA-256 pin, the shared scenario list (web/src/dev/scenarios) and renderNode"
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "ESLint rule set with the visual/reference/** relaxations, Prettier, verify gate, console guard"
  - phase: 02-web-foundation-design-system (plan 02-09)
    provides: "acquireLock/lockTimeoutMessage/PREFLIGHT_SCRIPT in web/scripts/e2e.mjs; the exposeBinding CSP guard pattern"
  - phase: 02-web-foundation-design-system (plan 02-12)
    provides: "PERF-05 fallback faces and font stacks in web/src/styles/base.css (copied identically into the rulings layer)"
provides:
  - "npm run parity (web/scripts/parity.mjs): parity.lock, preflight, extraction, reference build, visual Playwright with pass-through args; exports planSteps, executeSteps, PARITY_LOCK_PATH"
  - "Reference app: web/visual/reference/{index.html, main.tsx, kit.ts, select.ts, reference.css, rulings.css} built by web/visual/vite.reference.config.ts into web/.reference-dist"
  - "web/visual/serve.ts: routeDist, readStrictCsp, resolveDistFile, contentTypeFor, REFERENCE_ORIGIN (https://reference.parity.test), REFERENCE_DIST"
  - "web/visual/guard.ts: test/expect with an auto guard (console, pageerror, CSP via exposeBinding, failed requests), expectCases, EMPTY_SELECTION_MESSAGE"
  - "web/visual/playwright.visual.config.ts: chromium/firefox/webkit, no webServer, snapshotPathTemplate under test-results/parity"
  - "selectScenarios(list, search): ?theme/?group/?case filter shared by both sides of the proof"
  - "rulings.css: every owner look ruling on the spec classes, pinned by rulings.test.ts"
  - "web/tsconfig.reference.json: DOM/JSX/vite-client program for the reference entry"
  - "docs/web/parity.md"
affects: [02-14, 02-29, 02-30, 02-31, 02-33, parity, every-conversion-plan-adding-scenarios]

actuals:
  tokens: 20200    # chars/4 over the realized diff (80,778 chars, 23 files)
  tasks: 2
  commits: 5
plan_head_before: c27ec233424793faeedcf4dd599dbe416532ed55
plan_head_after: 74632b78067e3ec4d2fa2ba77109113ea07149c4

tech-stack:
  added: []
  patterns:
    - "Route-served parity pages: page.route fulfils a dist folder on an https origin with the StrictCsp parsed from SecurityHeadersMiddleware.cs; every other request is aborted"
    - "Frozen spec code is loaded through import.meta.glob, so no TS program or lint ever checks it and a missing extraction throws at load"
    - "Parity page filters (?theme, ?group, ?case) select nothing on a typo, and the data-parity-empty marker fails the spec"
    - "The rulings layer is unlayered CSS on .csp-*/.s-* selectors, one group per decision ID comment"

key-files:
  created:
    - web/scripts/parity.mjs
    - web/scripts/parity.test.ts
    - web/visual/serve.ts
    - web/visual/serve.test.ts
    - web/visual/guard.ts
    - web/visual/playwright.visual.config.ts
    - web/visual/vite.reference.config.ts
    - web/visual/reference-smoke.spec.ts
    - web/visual/reference/index.html
    - web/visual/reference/main.tsx
    - web/visual/reference/kit.ts
    - web/visual/reference/select.ts
    - web/visual/reference/select.test.ts
    - web/visual/reference/reference.css
    - web/visual/reference/rulings.css
    - web/visual/reference/rulings.test.ts
    - web/tsconfig.reference.json
    - docs/web/parity.md
  modified:
    - web/eslint.config.mjs
    - web/src/test/lint-rules.node.test.ts
    - web/tsconfig.json
    - web/tsconfig.node.json
    - web/package.json

key-decisions:
  - "The reference entry gets its own TS program (tsconfig.reference.json: DOM, react-jsx, vite/client). The node program has no DOM/JSX/import.meta.glob types, so main.tsx, kit.ts and fragments are excluded from it; typecheck runs all three programs"
  - "kit.ts loads the frozen App. D.3 namespace with import.meta.glob instead of `import * as Spec`: the verbatim code (7 strict TS errors, research Pitfall 7) is never type-checked, and CI typecheck/lint does not need the git-ignored extraction"
  - "The kit holds PascalCase function exports only (the D.3 namespace also re-exports csps.ts helpers and constants); ./fragments components override D.3 names"
  - "Recorded D-33 ESLint exception: only visual/reference/main.tsx may import './reference.css' (csps/restrictions/visual-reference-entry), proven by a lint-rule test. No dangerouslySetInnerHTML override was needed: the D.4 Mark code stays in the ESLint-ignored .reference-src and is never copied"
  - "planSteps takes { extraArgs, preflightAvailable } and no portBusy flag: the parity run opens no port"
  - "O-6 also stops the .csp-overlay fade (part of the modal entry); the spinner keeps App. B's own reduced-motion rule"
  - "A theme value other than light/dark, an empty ?case=, or a viewport-frame scenario on a multi-case page selects nothing"

patterns-established:
  - "Visual specs import test/expect/expectCases from web/visual/guard.ts and call routeDist(page, { origin, distDir }) in beforeEach"
  - "A new owner look ruling goes into rulings.css (comment starting with its decision ID), rulings.test.ts and the docs/web/parity.md table together"

requirements-completed: [WEB-02]

coverage:
  - id: D1
    description: "npm run parity runs preflight, the pinned 02-38 extraction, the reference build and the visual Playwright run (L-22 JS entries, pass-through --grep/--project), stops on a failing extraction, uses web/.locks/parity.lock and never stops another process"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/scripts/parity.test.ts (13 tests)"
        status: pass
      - kind: other
        ref: "npm --prefix web run parity -- --grep @no-such-tag -> 'Error: No tests found', exit 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "The frozen spec Button (button-primary-md) renders from the shared scenario list in a [data-case] .s-page frame with data-theme, Blush --primary background rgb(87, 46, 43), fonts loaded, under the exact StrictCsp with zero CSP violations and console errors in chromium, firefox and webkit; a no-match filter shows data-parity-empty and expectCases fails on it"
    requirement: "WEB-02"
    verification:
      - kind: e2e
        ref: "npm --prefix web run parity -- --grep @reference (6 passed: 2 tests x 3 engines)"
        status: pass
      - kind: unit
        ref: "web/visual/reference/select.test.ts (7 tests)"
        status: pass
      - kind: unit
        ref: "web/visual/serve.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "rulings.css carries one commented group per ruling (D-01, D-02, D-02 FYI-01, D-03, D-05, D-27, D-31 O-3, O-6, D-31 D-BL-02, WEB-09, PERF-05), nothing for D-38, spec-class selectors only, PERF-05 identical to base.css, imported only by reference.css"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/visual/reference/rulings.test.ts (28 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/web/parity.md explains what the proof compares, how to run npm run parity -- --grep <tag>, the query filters, how to add scenarios, the intentional-differences list with decision IDs, and that the reference never ships"
    verification:
      - kind: other
        ref: "manual read of docs/web/parity.md sections 1-7"
        status: pass
    human_judgment: true
    rationale: "Whether the guide is clear enough for a later converter is a reader judgment"

duration: 15min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 13: Parity Reference App, Owner-Rulings Layer and Route-Served CSP Harness Summary

**The reference side of the look-equality proof works. `npm run parity` extracts the pinned spec, builds the frozen App. D.3 components with the verbatim App. A.2 CSS chain plus a test-only rulings layer, and serves the result through `page.route` under the production `StrictCsp`. The approved Button renders from the shared scenario list in chromium, firefox and webkit with zero CSP or console findings.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-08T17:40:33Z
- **Completed:** 2026-10-08T17:55:45Z
- **Tasks:** 2 of 2
- **Files modified:** 23 (18 created, 5 modified)

## Accomplishments

- **The runner.** `web/scripts/parity.mjs` takes the exclusive `web/.locks/parity.lock`, reusing `acquireLock` from e2e.mjs. It then runs the preflight, `visual/reference/extract-spec.mjs` (never with `--repin`), `vite build --config visual/vite.reference.config.ts` and `playwright test --config visual/playwright.visual.config.ts <args>`. Each step runs on `process.execPath` with a JS entry. A failing extraction stops the run before the build. A `--grep` that matches nothing exits 1.
- **The reference app.**
  - `main.tsx` imports the same Fontsource weight files as the app, then `reference.css`. It renders each selected scenario as `<div data-case data-theme className="s-page">{renderNode(kit, node, handlers)}</div>`, or a `<p data-parity-empty>` when nothing matches.
  - `select.ts` holds the `?theme` / `?group` / `?case` rules.
  - `kit.ts` merges the frozen D.3 components with `./fragments/*.tsx`.
  - `reference.css` imports App. A.2 `globals.css` verbatim, then `rulings.css`, with explicit `@source` lines for the git-ignored inputs.
  - The compiled CSS keeps Tailwind's layer order (properties, theme, base, components, utilities), and the rulings come after it, unlayered.
- **The harness.**
  - `serve.ts` parses `StrictCsp` from `SecurityHeadersMiddleware.cs`. The policy text is not copied anywhere; `grep "default-src 'self'" serve.ts` = 0.
  - It serves the dist folder with that CSP and `nosniff`, falls back to index.html for page paths, returns 404 for anything outside the folder, and aborts every off-origin request.
  - `guard.ts` fails a test on console errors or warnings, page errors, CSP violations (`exposeBinding`) and failed requests.
- **The rulings layer.** `rulings.css` covers D-01, D-02, D-02 FYI-01, D-03 (the bold cue and the checkbox), D-05, D-27, D-31 O-3, D-31 D-BL-02, O-6, WEB-09 and PERF-05.
  - The values come from `74621f5` overrides.css. The three rulings made after it (O-3, O-6, D-BL-02) follow the UI-SPEC.
  - The PERF-05 faces and stacks are identical to `base.css`.
  - D-38 has nothing in the file.
- **The guide.** `docs/web/parity.md` covers the method, the files, how to run it, the filters, how to add scenarios, the complete intentional-differences table and the honesty rules.

## Task Commits

1. **Task 1 (tracer): the frozen spec Button renders from the shared scenario list under the strict CSP in three engines**
   - RED `8957322` (test):
     - `scripts/parity.test.ts`: 12 of 13 tests failed against an inert `planSteps`.
     - `visual/reference/select.test.ts`: 5 of 7 failed against an inert filter.
     - Both records returned `RED_EVIDENCE_OK`.
     - The smoke spec ran against the harness with a page that renders nothing, and failed on its assertions in all three engines: `toBeAttached` (no case) and `toHaveCount(1)` (no empty marker). There were no guard findings.
   - GREEN `0ae3b00` (feat): 20/20 unit tests pass, `--grep @reference` passes 6/6, and lint and typecheck are clean.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit (13/13 and 6 passed), then started Task 2.
2. **Task 2: the complete owner-rulings layer, pinned by a test, and the parity guide**
   - RED `246c741` (test): 18 of 28 tests failed against the Task 1 rulings (WEB-09 and PERF-05 only). `RED_EVIDENCE_OK`.
   - GREEN `b2335ca` (feat): 28/28 pass, and `--grep @reference` still passes 6/6.
3. **REFACTOR `74632b7`:** the failing-step tests in parity.test.ts capture stderr and assert the exact line, so the test run prints no stray `parity: … failed` lines (the same pattern as e2e.test.ts).

**Plan metadata:** recorded in the docs(02-13) commit that adds this SUMMARY.

## Files Created/Modified

- `web/scripts/parity.mjs` / `parity.test.ts`: the runner and its contract (13 tests)
- `web/visual/serve.ts` / `serve.test.ts`: route-served dist with the real CSP, and its parser and path-guard tests (7)
- `web/visual/guard.ts`: the visual-suite guard and `expectCases`
- `web/visual/playwright.visual.config.ts`, `web/visual/vite.reference.config.ts`: the suite and the reference build
- `web/visual/reference-smoke.spec.ts`: `@reference` (2 tests × 3 engines)
- `web/visual/reference/{index.html, main.tsx, kit.ts, select.ts, select.test.ts, reference.css}`: the reference app
- `web/visual/reference/rulings.css` / `rulings.test.ts`: the owner-rulings layer and its pin (28 tests)
- `web/tsconfig.reference.json`, plus `tsconfig.json` (reference), `tsconfig.node.json` (exclude) and `package.json` (`typecheck` runs the third program)
- `web/eslint.config.mjs`, `web/src/test/lint-rules.node.test.ts`: the recorded reference-stylesheet import exception and its test
- `docs/web/parity.md`: the guide

## Decisions Made

See `key-decisions` in the frontmatter. The ones later plans need:
- **02-14** imports `routeDist`, `readStrictCsp`, `REFERENCE_ORIGIN` and `REFERENCE_DIST` from `visual/serve.ts`, and `test`, `expect` and `expectCases` from `visual/guard.ts`. It reuses `selectScenarios` from `visual/reference/select.ts` for the implementation page, so both sides filter the same way. The app origin is `https://app.parity.test`.
- **02-29 to 02-31** add layout fragments as `web/visual/reference/fragments/<Name>.tsx`. The kit picks up PascalCase function exports, and the fragments are type-checked under `tsconfig.reference.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A third TypeScript program for the reference entry**
- **Found during:** Task 1 (design)
- **Issue:** `tsconfig.node.json` includes `visual/**/*`, but it has no DOM lib, no JSX and no `vite/client` types. The reference `main.tsx` (JSX, `document`) and its imports (`import.meta.glob` in the 02-38 scenario index) could not type-check there.
- **Fix:** Added `web/tsconfig.reference.json` with the app's strict settings plus DOM, react-jsx and vite/client. It covers `main.tsx`, `kit.ts` and `fragments/**`, which `tsconfig.node.json` now excludes. It is referenced from `tsconfig.json` (so the ESLint project service finds it), and `npm run typecheck` runs it as the third program. No package changed.
- **Files modified:** web/tsconfig.reference.json, web/tsconfig.json, web/tsconfig.node.json, web/package.json
- **Committed in:** `8957322`

**2. [Rule 3 - Blocking] The frozen D.3 namespace is loaded by `import.meta.glob`, not `import * as Spec`**
- **Found during:** Task 1
- **Issue:** A static import pulls the verbatim spec code into the reference TS program, which has 7 strict errors (Pitfall 7). It also makes typecheck and lint fail on a clean CI checkout where `.reference-src` has not been extracted yet.
- **Fix:** `kit.ts` globs `../.reference-src/ui/index.tsx` eagerly. If the file is missing, `kit.ts` throws a plain message telling you to run the extraction. Vite bundles it the same way, and the reference build was confirmed to contain the spec (the JS grew from 219 KB to 271 KB).
- **Committed in:** `0ae3b00`

**3. [Rule 2 - Missing critical] The recorded ESLint exception for the reference stylesheet import, with a test**
- **Found during:** Task 1 (lint)
- **Issue:** The D-33 stylesheet-import ban rejected `import './reference.css'` in `visual/reference/main.tsx`. 02-04 said CSS imports there need a recorded override.
- **Fix:** Added a `csps/restrictions/visual-reference-entry` block that allows only `./reference.css`, and only in that one file. A lint-rule test proves that `main.tsx` may import it, that `./rulings.css` and other files may not, and that `src/main.tsx` may not. No `dangerouslySetInnerHTML` override was needed: the D.4 code stays in the ESLint-ignored `.reference-src`.
- **Committed in:** `0ae3b00`

**4. [Rule 2 - Missing critical] Unit tests for the filter and the serving path guard**
- **Found during:** Task 1
- **Issue:** The empty-selection edge (WEB-02) and the `page.route` file resolution (path traversal, T-02-37) were covered only by the browser smoke test.
- **Fix:** I moved the query-string rules into `select.ts` with `select.test.ts` (7 tests: a theme typo, an empty `?case=`, a group mismatch, viewport frames one per load, light-only scenarios). I added `serve.test.ts` (7 tests: the CSP parsed from the real file, a fail-loud parse, `..`, `%2E%2E` and `%5C` traversal, folders, a bad escape).
- **Committed in:** `8957322`, `0ae3b00`

**5. [Rule 1 - Bug] planSteps has no `portBusy` option**
- **Found during:** Task 1 (RED)
- **Issue:** The plan's behavior line calls `planSteps({ portBusy: false })`, but the parity run opens no port. A `portBusy` flag would do nothing.
- **Fix:** `planSteps({ extraArgs?, preflightAvailable? })`. The tests call `planSteps({})`.
- **Committed in:** `8957322`

---

**Total deviations:** 5 auto-fixed (1 Rule 1, 2 Rule 2, 2 Rule 3)
**Impact on plan:** All of them were needed to type-check, lint or prove the harness. No package was added or changed, and no lint rule was relaxed beyond the one recorded exception.

## Issues Encountered

- `npm run lint` was the first lint run over the 02-38 files (`web/src/dev/**`, `extract-spec.mjs`). It reported no findings, so no 02-38 code changed.
- The first `rulings.test.ts` importer check also matched a lint-rule fixture string in `src/test/lint-rules.node.test.ts`. It now looks only at real import lines in shipped (non-test) app files.
- The rulings header first mentioned the D-38 ID while explaining why nothing is there. That broke the "no D-38" pin, so the text now describes the separator ruling without the ID.
- A stale `.git/gsd-plan-head-before-02-13` ledger (`a6f64f2`) from the superseded run was reset to `c27ec23` before the first commit, so `commits: 5` is measured against this run.
- `docs/web/*.md` sits outside the web Prettier gate, as `e2e.md` and `styling.md` already do.

## Verification

- `npm --prefix web run test -- --run scripts/parity.test.ts`: 13/13 passed
- `npm --prefix web run test -- --run visual/reference/rulings.test.ts`: 28/28 passed
- Preflight (all four ports free, no other test processes), then `npm --prefix web run parity -- --grep @reference`: 6 passed in chromium, firefox and webkit. The guard reported no CSP violations and no console errors. Run after both GREEN commits.
- `npm --prefix web run parity -- --grep @no-such-tag`: "No tests found", exit 1
- `npm --prefix web run verify`: exit 0. That covers typecheck (3 programs), lint, format, 931 tests in 31 files (coverage 100 / 99.6 / 100 / 100), build, license gate and notices check.
- Acceptance:
  - `git check-ignore` prints both reference paths.
  - `StrictCsp` appears 6 times in serve.ts, and `default-src 'self'` appears 0 times.
  - The ruling-ID comment grep counts 25 (at least 10 needed), and `D-38` counts 0.
- `web/.locks/` is empty after every run. No port was opened and no process was stopped.

## TDD Gate Compliance

- Task 1: RED `8957322` comes before GREEN `0ae3b00`. RED evidence was `RED_EVIDENCE_OK` for `scripts/parity.test.ts` and `visual/reference/select.test.ts`. The Playwright smoke spec failed on its assertions at RED in all three engines (it is not a Vitest target, so it has no JUnit record).
- Task 2: RED `246c741` comes before GREEN `b2335ca`. RED evidence was `RED_EVIDENCE_OK` for `visual/reference/rulings.test.ts`.
- REFACTOR `74632b7` changed tests only, and all tests still pass.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved, and `package-lock.json` is unchanged. In `package.json` only the `typecheck` script line changed. Playwright 1.63.0 and its browsers were already installed.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **02-14 (implementation side and comparator):**
  - Build the e2e or showcase bundle and serve it with `routeDist(page, { origin: 'https://app.parity.test', distDir })`.
  - Pair cases with the reference page through the same `?theme/?group/?case` query and `selectScenarios`.
  - Tag the comparison `@parity`. The config's `snapshotPathTemplate` is already set for the reference-as-expected screenshots.
  - Run the O-6 pass with `reducedMotion: 'reduce'` and the D-05 pass with touch/no-hover.
- **Fragments (02-29 to 02-31):** add `fragments/<Name>.tsx`; `reference.css` already has `@source "./fragments"`.
- **Budget plan (02-33):** `.reference-dist` and `.reference-src` stay outside `wwwroot`, so assert there that `wwwroot` holds neither.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 18 created files and 5 modified files exist on disk.
- Commits `8957322`, `0ae3b00`, `246c741`, `b2335ca` and `74632b7` are on `gsd/phase-2-web-foundation-design-system`.
