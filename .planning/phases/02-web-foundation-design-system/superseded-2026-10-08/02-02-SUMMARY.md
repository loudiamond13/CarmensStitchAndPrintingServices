---
phase: 02-web-foundation-design-system
plan: 02
subsystem: testing
tags: [typescript, tsgo, eslint, typescript-eslint, jsx-a11y-x, react-hooks, prettier, vitest, axe-core, jsdom]
created: "2026-10-07T22:54:00-05:00"
updated: "2026-10-07T22:54:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "Plan 01: the web/ scaffold, exact D-25 toolchain installed and locked, vite.config.ts (5180/strictPort/proxy/outDir per mode/__DEV_ROUTES__)"
provides:
  - "npm --prefix web run verify = typecheck (TS 7) -> lint (--max-warnings 0) -> format:check -> vitest run --coverage -> build"
  - "tsconfig.app.json / tsconfig.node.json with the PRD 17.2 flags, valid for TS 6.0.3 (ESLint API) and TS 7.0.2 (tsc)"
  - "eslint.config.mjs with the exported architectureRules (WEB-04, WEB-10, QUAL-02 bans) and every rule at error"
  - "Prettier config and ignore list (spec CSS, frozen reference, generated types, build output)"
  - "vitest.config.ts over the Vite test-mode plugin chain; setup.ts with jest-dom, cleanup, matchMedia mock and the console guard"
  - "installConsoleGuard / assertNoConsoleOutput / resetConsoleGuard, AXE_TAGS, expectNoAxeViolations(container, options?)"
  - "Global declaration __DEV_ROUTES__: boolean (src/vite-env.d.ts)"
affects: [02-03, 02-04, 02-05, 02-06, 02-09, 02-14, every later web plan]

actuals:
  tokens: 9779        # chars/4 over git diff c5b031f..8ab952a (39114 chars)
  tasks: 3
  commits: 5
plan_head_before: c5b031fc7f51fc241c633932a60456c0021763e8
plan_head_after: 8ab952a416ebecba4a644c7e42b11224c4f02ea9

tech-stack:
  added: []
  patterns:
    - "Shared configs are passed through escalate(): any 'warn' rule becomes 'error' with its options kept, so a plugin update cannot add a silent warning"
    - "Architecture restrictions live in one exported array (architectureRules) that the lint-rule test runs through ESLint's Linter on virtual file names"
    - "Node-side tests (config readers) carry // @vitest-environment node and belong to tsconfig.node.json, not the app program"
    - "Test helpers are plain functions (no Matchers augmentation); deliberate a11y violations in tests use a per-line eslint-disable with a reason"

key-files:
  created:
    - web/eslint.config.mjs
    - web/tsconfig.json
    - web/tsconfig.app.json
    - web/tsconfig.node.json
    - web/src/vite-env.d.ts
    - web/.prettierrc.json
    - web/.prettierignore
    - web/vitest.config.ts
    - web/src/test/setup.ts
    - web/src/test/consoleGuard.ts
    - web/src/test/consoleGuard.test.ts
    - web/src/test/axeTags.ts
    - web/src/test/axe.ts
    - web/src/test/axe.test.tsx
    - web/src/test/lint-rules.test.ts
    - web/src/test/eslint-config.test.ts
    - web/src/test/build-config.test.ts
  modified:
    - web/package.json
    - web/vite.config.ts
    - web/index.html
    - .editorconfig

key-decisions:
  - "Warn-level rules in shared configs (react-hooks exhaustive-deps, incompatible-library, unsupported-syntax) are escalated to error rather than switched off"
  - "The three config-reading tests (lint-rules, eslint-config, build-config) are typed by tsconfig.node.json and excluded from tsconfig.app.json, so app code never sees Node types"
  - "Prettier pins tabWidth 2 explicitly and .editorconfig gains a web/** indent_size = 2 section; otherwise Prettier inherits the repo's 4-space default"
  - "no-console is off only for src/test/consoleGuard.ts and its test, the one helper that must replace console methods"
  - "Coverage thresholds stay at 90 % with no perFile and no `all` option (removed in Vitest 5); with zero covered files Vitest reports Unknown% and passes"

patterns-established:
  - "Lint ban proof: every new restriction gets a firing case and an allowed case in src/test/lint-rules.test.ts"
  - "Any console.error/console.warn during a Vitest test fails that test (setup.ts after-each)"
  - "Component a11y: await expectNoAxeViolations(container) after render; an empty container fails"

requirements-completed: [QUAL-02, WEB-04, A11Y-01]

coverage:
  - id: D1
    description: "One verify script runs TS 7 typecheck, ESLint --max-warnings 0, prettier --check, vitest run --coverage and the build, in that order, and exits 0 on the scaffold with no warnings"
    requirement: QUAL-02
    verification:
      - kind: other
        ref: "npm --prefix web run verify (exit 0; grep for warn/error/(!) finds only the script's own --max-warnings echo)"
        status: pass
      - kind: other
        ref: "npm --prefix web exec -- tsc --version = Version 7.0.2; require('typescript').version = 6.0.3; tsc6 -p both configs also passes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every WEB-04 / WEB-10 / QUAL-02 lint ban fires outside its allowed files and stays quiet inside them"
    requirement: WEB-04
    verification:
      - kind: unit
        ref: "web/src/test/lint-rules.test.ts (27 cases: httpClient and relative lib/http imports, axios, react-router-dom, 4 nuqs adapters + v8 clean, parseAsIsoDate(Time), startTransition option vs useTransition, shallow, fetch/window/globalThis/self.fetch, XMLHttpRequest, raw-HTML JSX, console, non-null assertion, explicit any, scope)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ESLint config shape: no warn-level rule (raw and resolved per file type), unused disable directives are errors, prefer-nullish-coalescing ignorePrimitives, global ignores, jsx-a11y-x/react-hooks/type-aware wiring, eslint-config-prettier last"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "web/src/test/eslint-config.test.ts (10 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Vite config values pinned: per-mode outDir, emptyOutDir, assetsInlineLimit 0, sourcemap off, license on, __DEV_ROUTES__ false only in production, port 5180 strictPort and the /api proxy"
    verification:
      - kind: unit
        ref: "web/src/test/build-config.test.ts (5 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Any console.error or console.warn in a Vitest test fails it, React key warnings included"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "web/src/test/consoleGuard.test.ts (6 cases)"
        status: pass
      - kind: other
        ref: "Throwaway probe test (deleted): a missing-key list and a bare console.warn each failed with 'Unexpected console output', a clean render passed"
        status: pass
    human_judgment: false
  - id: D6
    description: "expectNoAxeViolations runs axe-core 4.13.0 with the five WCAG tags (contrast off in jsdom), rejects an empty container, and prints violations sorted by rule id then target"
    requirement: A11Y-01
    verification:
      - kind: unit
        ref: "web/src/test/axe.test.tsx (6 cases); npm --prefix web ls axe-core = 4.13.0 only"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-07
status: complete
---

# Phase 2 Plan 02: Static Gates (TS 7, ESLint, Prettier, Vitest, axe) Summary

**`npm run verify` now gates the web app: TS 7 strict typecheck over PRD 17.2 tsconfigs, ESLint (strict/stylistic type-checked, react-hooks 7, jsx-a11y-x strict, all rules at error, `--max-warnings 0`) with tested architecture bans, Prettier, and Vitest with a console guard and an in-house axe helper.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-08T03:39:11Z
- **Completed:** 2026-10-08T03:53:56Z
- **Tasks:** 3 of 3
- **Files modified:** 21

## Accomplishments

- `web/package.json` scripts `typecheck`, `lint`, `format:check`, `format`, `test`, `test:coverage` and `verify`. `verify` runs the five gates in the planned order and passes on the scaffold with zero warnings.
- One pair of tsconfigs that is valid for both compilers. `tsc` (7.0.2) and `tsc6` (6.0.3) both pass on `tsconfig.app.json` and `tsconfig.node.json`, with no `baseUrl`, `moduleResolution: bundler`, explicit `types`, and every PRD 17.2 flag.
- `eslint.config.mjs` exports `architectureRules`. 42 Vitest cases across three files prove each ban fires and each allowed file passes, pin the config shape (no warn-level rule, unused directives error, ignorePrimitives, ignores, prettier last) and pin the Vite config values.
- `setup.ts` fails any test that writes to `console.error` or `console.warn`. A probe showed that React's missing-key warning fails the test.
- `expectNoAxeViolations` gives a deterministic, sorted failure message and rejects empty containers.
- The full .NET suite still passes (565/565, LocalDB). `dotnet build` reports 0 warnings and `dotnet format --verify-no-changes` is clean.

## Task Commits

1. **Task 1 (tracer): `npm run verify` gates the scaffold; lint rejects an httpClient import outside api.ts**
   - RED `857b09a` (test), GREEN `2378060` (feat)
   - Tracer gate (interactive, end-of-phase, automated-only verify): `npm --prefix web run verify` re-run, exit 0. Tracer verified end-to-end, then expansion.
2. **Task 2: every architecture lint rule, the config shape and the Vite config are proven by tests**: `3f284a1` (test). No config change was needed, see the TDD section.
3. **Task 3: console guard and the in-house axe helper (D-18)**
   - RED `9efa86e` (test), GREEN `8ab952a` (feat)

No REFACTOR commits were needed.

## TDD Gate Compliance (RED evidence)

| Task | RED run | Failing target (assertion) | Checker |
|------|---------|----------------------------|---------|
| 1 | `vitest run src/test/lint-rules.test.ts` exit 1, 1 test failed | `httpClient import outside api.ts is an error`: expected `[['no-restricted-imports', 2]]`, got `[]`. `eslint.config.mjs` was an empty `architectureRules = []` placeholder in the RED commit, so the failure is on the assertion and not on a missing module. | RED_EVIDENCE_OK (`p02-t1-red.json`) |
| 2 | No RED: the rules were built in Task 1 (the tracer), so these are characterization tests. To prove they can fail, five mutations were each run and reverted. Dropping the `window/globalThis/self.fetch` selector failed 3 cases. `reportUnusedDisableDirectives: 'warn'` failed 1. Un-escalating react-hooks failed 6. `strictPort: false` failed 1. Moving the api.ts override failed the api.ts case. That last mutation exposed a vacuous case: the api.test.ts allowance used a relative import that never matched the ban pattern. It was fixed before the commit to `@/lib/http/httpClient`, and a re-run of the mutation fails it. | n/a (no `feat` for Task 2) |
| 3 | `vitest run consoleGuard.test.ts axe.test.tsx` exit 1, 9 of 12 failed | Guard: `assertNoConsoleOutput` did not throw after `console.error('x')` and `console.warn`, and reset did not restore the console. Axe: `AXE_TAGS` was `[]`, the image-alt case and the empty container resolved, and the sorted-lines case got no error. The inert placeholders in the RED commit export the right names. | RED_EVIDENCE_OK for both files (`p02-t3-red-guard.json`, `p02-t3-red-axe.json`) |

The evidence files are in the session scratchpad (`C:/Users/<user>/AppData/Local/Temp/claude/C--Work-CarmensStitchAndPrintingServices/a337486a-6eb9-40ae-aacf-62d9c5c49aa5/scratchpad/`). Tooling note: in JUnit XML, the checker's `name="` regex matches inside `classname="` first, so it reads every Vitest case name as the file name. The records therefore target the test file, which the checker matches at class level, and they name the exact test case in `expected`.

## Files Created/Modified

- `web/tsconfig.json`: solution file (`files: []`, references to app and node) for editors and the typescript-eslint project service.
- `web/tsconfig.app.json`: PRD 17.2 flags, `types: ["vite/client"]`, `paths @/*`. It excludes `src/ui/__reference__` and the three Node-side config tests.
- `web/tsconfig.node.json`: the same strict flags, plus `allowJs`, `checkJs`, `allowImportingTsExtensions` and `types: ["node"]`. It covers the config files, scripts, e2e, `src/test/axeTags.ts` and the three config tests.
- `web/src/vite-env.d.ts`: the `vite/client` reference and `declare const __DEV_ROUTES__: boolean`.
- `web/eslint.config.mjs`: global ignores, js recommended, strictTypeChecked + stylisticTypeChecked (projectService), react-hooks recommended, jsx-a11y-x strict for TSX, browser globals for src, `architectureRules`, the console-guard exemption, prefer-nullish-coalescing ignorePrimitives, node globals, no-console off for scripts, `reportUnusedDisableDirectives: 'error'`, and eslint-config-prettier last.
- `web/.prettierrc.json`, `web/.prettierignore`.
- `web/vitest.config.ts`: merges `vite.config.ts` for mode `test` and sets jsdom, setup, include/exclude, restoreMocks, and v8 coverage with thresholds at 90.
- `web/src/test/setup.ts`, `consoleGuard.ts`, `axeTags.ts`, `axe.ts`, and their tests. Also `lint-rules.test.ts`, `eslint-config.test.ts` and `build-config.test.ts`.
- `web/package.json`: scripts.
- `web/vite.config.ts`: `isAppSource` accepts `string | undefined`. Prettier also reformatted it.
- `web/index.html`: Prettier wrapped the description `<meta>` attributes. The DOM is the same.
- `.editorconfig`: a `[web/**] indent_size = 2` section.

## Decisions Made

See `key-decisions` in the frontmatter. In short:
- Warn-level rules in shared configs are raised to error, not switched off.
- The Node-side config tests are typed by the node program, so app code never sees Node types.
- Prettier pins 2-space indents explicitly, and `.editorconfig` matches it for `web/**`.
- The console guard is the only place where no-console is off.
- Coverage thresholds stay at 90 % (Vitest 5 has no `coverage.all`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier inherited 4-space indents from the repo .editorconfig**
- **Found during:** Task 1
- **Issue:** The root `.editorconfig` sets `indent_size = 4`, and Prettier honours it. With the planned `.prettierrc.json`, `prettier --check` rejected every 2-space file, including the plan-01 files written from the UI spec.
- **Fix:** Added `"tabWidth": 2, "useTabs": false` to `web/.prettierrc.json`, plus a `[web/**] indent_size = 2` section in `.editorconfig` so editors agree. Kept the file's CRLF line endings.
- **Files modified:** web/.prettierrc.json, .editorconfig
- **Verification:** `npm run format:check` passes. `dotnet format --verify-no-changes` exits 0.
- **Committed in:** `2378060`

**2. [Rule 1 - Bug] `vite.config.ts` `isAppSource` had the wrong filter signature**
- **Found during:** Task 1 (first typecheck)
- **Issue:** @rolldown/plugin-babel's `MatchPattern` passes `filename: string | undefined`. The plan-01 function took `string`, which is TS2322 under strict mode.
- **Fix:** It now accepts `string | undefined` and returns false for undefined. Nothing changes at runtime for real files.
- **Committed in:** `2378060`

**3. [Rule 3 - Blocking] The config-reading tests need Node types, which the app program does not have**
- **Found during:** Task 1
- **Issue:** `lint-rules`, `eslint-config` and `build-config` import `node:url`, ESLint and `vite.config.ts` (which imports `node:url`). `tsconfig.app.json` has `types: ["vite/client"]` only.
- **Fix:** Listed those three files in `tsconfig.node.json` `include` and in the `tsconfig.app.json` `exclude`. Added `allowImportingTsExtensions` to the node config, so `vitest.config.ts` and `build-config.test.ts` can import `./vite.config.ts` with its extension. That clears Vite's `configLoader: 'native'` warning ("import without a file extension").
- **Committed in:** `2378060`, `3f284a1`

**4. [Rule 2 - Missing critical] Warn-level rules from react-hooks would break the zero-warn truth**
- **Found during:** Task 1
- **Issue:** `eslint-plugin-react-hooks` 7.1.1 `configs.flat.recommended` sets `exhaustive-deps`, `incompatible-library` and `unsupported-syntax` to `warn`.
- **Fix:** An `escalate()` helper raises any warn entry (with its options kept) to error. It is applied to every shared config. `eslint-config.test.ts` checks both the raw array and the resolved config for four file types.
- **Committed in:** `2378060`

**5. [Rule 3 - Blocking] The console guard must use console; axe.test.tsx must render inaccessible markup**
- **Found during:** Task 3 (verify lint)
- **Issue:** `no-console` (app rule) flagged the guard and its test. `jsx-a11y-x/alt-text` flagged the deliberate `<img>` without alt in the axe self-test.
- **Fix:** A narrow `csps/console-guard` block turns no-console off only for `src/test/consoleGuard.ts` and `src/test/consoleGuard.test.ts`. The four deliberate `<img>` cases carry per-line `eslint-disable-next-line jsx-a11y-x/alt-text -- deliberate violation`. Since unused directives are errors, those directives must keep matching a real finding.
- **Files modified:** web/eslint.config.mjs, web/src/test/axe.test.tsx (eslint.config.mjs was not in Task 3's file list)
- **Committed in:** `8ab952a`

**6. [Rule 3 - Blocking] RED placeholders committed with the RED tests**
- **Found during:** Tasks 1 and 3
- **Issue:** The plan expected the Task 1 RED to fail "because eslint.config.mjs does not exist". A missing-module failure is INVALID_RED under the gate.
- **Fix:** The RED commits carry inert placeholders: an empty `architectureRules`, and no-op guard/axe functions with `AXE_TAGS = []`. The tests then fail on their assertions. The GREEN commits replace the placeholders.
- **Committed in:** `857b09a`, `9efa86e`

---

**Total deviations:** 6 auto-fixed (1 bug, 1 missing critical, 4 blocking).
**Impact on plan:** All planned behaviour is delivered, and every rule stays at error. No package was added, removed or changed. The startTransition selector stays broad (`ObjectExpression > Property[key.name='startTransition']`). The `useTransition` destructuring case is clean, so assumption A8 holds as planned. One known limit: a custom hook that returns an object literal with a `startTransition` key would be flagged. If a later plan hits that, narrow the selector to nuqs call sites.

## Issues Encountered

- Coverage today reports `Unknown% (0/0)`, because every current source file is excluded (`main.tsx`, `src/test/**`). Vitest 5 passes thresholds with zero files, so the 90 % numbers stayed and no `perFile`/`all` workaround was needed. The thresholds start to bite when plan 04 adds `src/lib/**`.
- The console guard prints React's format string unsubstituted (for example `...unique "key" prop.%s%s`). The warning is still clearly named. Placeholder substitution is a possible later nicety.
- A cleanup command with a wrong relative path was stopped by the shell safety check before it ran, so nothing was deleted. The verify log went to the scratchpad instead.

## Known Stubs

None added. `web/src/main.tsx` is still plan 01's intentional tracer placeholder, which plans 05 and 14 replace. It is already recorded.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Every later web plan can use `npm --prefix web run verify`, `expectNoAxeViolations` and the console guard.
- Plan 03 still owns `.vite/license.md` in wwwroot and the npm kind in the dependency registry. Plan 04's `src/lib/http/**` and `src/lib/api.ts` already have their lint allowances.
- No blockers.

## Self-Check: PASSED

- All 17 created key files exist on disk.
- Commits 857b09a, 2378060, 3f284a1, 9efa86e and 8ab952a exist. The ledger count is 5 (c5b031f..8ab952a).
- Acceptance checks:
  - `exactOptionalPropertyTypes` appears 1 time and `baseUrl` 0 times in tsconfig.app.json.
  - `architectureRules` appears 2 times in eslint.config.mjs.
  - `color-contrast` appears 1 time in axe.ts.
  - `npm ls axe-core` shows only 4.13.0.
  - typecheck, lint and format:check each exit 0.
- Plan `<verification>` passed:
  - `npm --prefix web run verify` exits 0 with no warnings: 5 test files, 54 tests.
  - `tsc --version` prints Version 7.0.2.
- Full suites passed:
  - preflight clean.
  - `dotnet test --solution Csps.slnx` 565/565 (CSPS_TEST_SQL=localdb, per process).
  - `dotnet build` 0 warnings.
  - `dotnet format --verify-no-changes` exit 0.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-07*
