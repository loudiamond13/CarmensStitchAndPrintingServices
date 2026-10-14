---
phase: 02-web-foundation-design-system
plan: 02
subsystem: ui
tags: [vite, react, react-compiler, tailwindcss-v4, vitest, npm-supply-chain, gitattributes, tdd]
created: "2026-10-08T09:45:30-05:00"
updated: "2026-10-08T09:45:30-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-01)
    provides: "Anonymous SPA host that serves src/Csps.Server/wwwroot (MapSpaHost), committed fixture web root for .NET tests"
provides:
  - "web/ app installed and locked at the owner-approved exact pins (D-25 rows 1-34, lucide-react 1.53.0 per D-34, prettier-plugin-tailwindcss 0.8.1 + eslint-plugin-better-tailwindcss 4.7.0 per D-36), npm audit 0"
  - "web/.npmrc: save-exact, engine-strict, min-release-age=14, exclusions only for lucide-react, vite, source-map-js, http-cache-semantics (no rolldown exclusion, R-2)"
  - "The whole phase npm scripts table in web/package.json (dev, build, build:e2e, build:budget, typecheck, lint, format, format:check, test, test:coverage, verify, e2e, parity, lighthouse, license:check, notices, notices:check, review)"
  - "vite.config.ts: React + React Compiler (babel filter limited to web/src TS) + Tailwind; port 5180 strictPort; /api proxy to http://localhost:5115; __DEV_ROUTES__ define; outDir wwwroot in production, .<mode>-dist otherwise; license false (D-35); no source maps; assetsInlineLimit 0"
  - "vitest.config.ts: mergeConfig over the Vite config in mode test, jsdom default, src/scripts/visual include globs, JUnit to web/.vitest/junit/output.xml, v8 coverage thresholds (90%, lib/http 100%)"
  - "CSPS token theme: app.css (scan scope, 12 custom variants, cleared @theme, @theme inline with the 38 App. A.2 colours + transparent/current, fonts, shadow-level-1..3, 5 csp animations) and base.css (App. A token blocks, dark Mark tokens, global element rules)"
  - "PublicPlaceholderPage (D-21) in utilities; main.tsx page root (@container/pg, data-theme light, main#main tabIndex -1)"
  - "build-output.node.test.ts: CSP-safe index.html, one hashed CSS + one hashed module JS, token theme present, no default palette/radii/shadows, no .map, no .vite"
  - "Repository text rules: .gitattributes LF for web/, tools/openapi-gen/, tests/fixtures/; .editorconfig [web/**] and [tools/openapi-gen/**] 2-space + LF"
affects: [02-03, 02-04, 02-05, 02-06, 02-09, 02-12, 02-13, 02-29, 02-33, 02-35, 02-36, 02-37, web-build-into-wwwroot, stylesheet-contract]

actuals:
  tokens: 86900    # chars/4 over all 15 changed files; 79,700 of it is the generated package-lock.json (hand-written files: about 9,200)
  tasks: 2
  commits: 3
plan_head_before: 9ad1d8b2447fae4980e739c584b19d6cf5d3d801
plan_head_after: 53e36b4e14975b03df8a93f69e4b7bb4edd2cbd1

tech-stack:
  added:
    - "react/react-dom 19.3.0, react-router 8.4.0, @tanstack/react-query 5.103.2, nuqs 2.10.1, clsx 2.1.1, lucide-react 1.53.0, @fontsource/barlow-condensed 5.3.0, @fontsource-variable/archivo 5.3.0"
    - "vite 8.3.3, @vitejs/plugin-react 6.1.1, @rolldown/plugin-babel 0.2.4, @babel/core 7.29.7, babel-plugin-react-compiler 1.0.0, tailwindcss + @tailwindcss/vite 4.3.3"
    - "typescript -> @typescript/typescript6 6.0.2, @typescript/native -> typescript 7.0.2, eslint 10.11.0 + typescript-eslint 8.70.1 + plugins, prettier 3.9.9, prettier-plugin-tailwindcss 0.8.1, eslint-plugin-better-tailwindcss 4.7.0"
    - "vitest + @vitest/coverage-v8 5.0.1, jsdom 30.1.1, Testing Library, axe-core 4.13.0, @playwright/test 1.63.0, @axe-core/playwright 4.13.0, lighthouse 13.5.0, license-checker-rseidelsohn 5.0.1"
  patterns:
    - "*.node.test.ts = node-environment Vitest test (`// @vitest-environment node` header)"
    - "Build-output tests read files through existsSync guards, so a missing file fails an expect, never a thrown error (L-26)"
    - "Styles live only in app.css/base.css constructs; every visual decision is a utility in markup; spec container rules become pg-* variants"

key-files:
  created:
    - web/.npmrc
    - web/package.json
    - web/package-lock.json
    - web/vite.config.ts
    - web/vitest.config.ts
    - web/index.html
    - web/public/mark.svg
    - web/src/main.tsx
    - web/src/styles/app.css
    - web/src/styles/base.css
    - web/src/app/public/PublicPlaceholderPage.tsx
    - web/src/test/build-output.node.test.ts
    - .gitattributes
  modified:
    - .gitignore
    - .editorconfig

key-decisions:
  - "Tailwind scan paths are relative to the stylesheet: app.css sits in web/src/styles, so the scan root is source(\"../../src\") with @source not \"../../src/**/*.test.{ts,tsx}\" and \"../../src/test\". The research skeleton's \"../src\" assumed a stylesheet one folder higher and failed the build (\"source(../src) does not exist\"). Plan 02-05's stylesheet-contract test must accept this form."
  - "vitest 5.0.1 installed (the install ran at 2026-10-08T14:35Z, before the 5.0.2 cut-off of 2026-10-09T09:00:46Z); no rolldown exclusion or overrides (install after 2026-10-08T14:30:23Z, R-2); rolldown resolved to 1.2.11 on its own."
  - "nuqs stays 2.10.1: a stable 2.10.2 exists but was published 2026-10-08T12:20Z, so it is not 14 days old and the nuqs owner trigger did not fire. It becomes eligible on 2026-10-22."
  - "The build-output test accepts [data-theme=dark] with or without quotes: Lightning CSS minification drops the attribute-value quotes (same selector)."

patterns-established:
  - "One stylesheet entry: main.tsx imports only @/styles/app.css (marked SPEC-DEVIATION: D-33)"
  - "Production root error callbacks are no-ops; development passes undefined so React reports as usual (WEB-05)"
  - "Dev-route builds write to git-ignored web/.<mode>-dist; production writes only the git-ignored src/Csps.Server/wwwroot"

requirements-completed: [WEB-01, WEB-02, QUAL-02]

coverage:
  - id: D1
    description: "Owner-approved toolchain installed at exact pins with a committed lockfile, npm ci reproducible, npm audit --audit-level=high reports 0, nothing deprecated"
    requirement: WEB-01
    verification:
      - kind: other
        ref: "npm --prefix web ci; npm --prefix web audit --audit-level=high; npm ls --depth=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Production build writes a CSP-safe index.html, one hashed CSS and one hashed module JS into the git-ignored src/Csps.Server/wwwroot, with no source map and no .vite folder"
    requirement: WEB-01
    verification:
      - kind: unit
        ref: "web/src/test/build-output.node.test.ts#production build output in src/Csps.Server/wwwroot"
        status: pass
      - kind: other
        ref: "npm --prefix web run build (exit 0, no warning lines)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Built CSS carries the CSPS token theme (both theme blocks, .bg-bg reads var(--bg)) and none of Tailwind's default palette, radii or shadows"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/test/build-output.node.test.ts#compiles the CSPS token theme: both theme blocks and token-backed utilities"
        status: pass
      - kind: unit
        ref: "web/src/test/build-output.node.test.ts#carries none of Tailwind's default palette, radii or shadows"
        status: pass
    human_judgment: false
  - id: D4
    description: "Web and generator text files are LF in the index and every checkout; editors use 2-space indent for web files"
    requirement: QUAL-02
    verification:
      - kind: other
        ref: "git check-attr eol -- web/package.json web/src/main.tsx tools/openapi-gen/package.json (all eol: lf); git ls-files --eol (i/lf)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The placeholder page looks like the App. E.2 page head on the Blush page root (eyebrow, uppercase italic h1 with accent em, lead)"
    requirement: WEB-02
    verification: []
    human_judgment: true
    rationale: "Look-equality against App. E.2 is proven by the parity suite in plan 02-29; no automated visual comparison exists yet."

duration: 11min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 02: Web Toolchain and Token-Themed Build Summary

**Vite 8 + React 19 + React Compiler + Tailwind 4.3.3 with the cleared CSPS token theme build the D-21 placeholder page into the git-ignored `src/Csps.Server/wwwroot`. The toolchain is locked at the owner-approved exact pins, and a node test guards CSP safety and the theme on every build.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-08T14:34:42Z
- **Completed:** 2026-10-08T14:45:08Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `web/` is installed and locked: 548 packages, every direct dependency at its exact approved version (`npm ls --depth=0`), `npm ci` reproducible, `npm audit --audit-level=high` reports 0, and no install, deprecation or engine warnings.
- One `npm run build` writes `index.html`, `mark.svg`, one hashed CSS file (10.28 kB, 3.56 kB gz) and one hashed JS file (69.47 kB gz) into the ignored web root. There is no inline script or style, no `.map` and no `.vite`.
- The token theme compiles: both `[data-theme]` blocks, token utilities such as `.bg-bg{background-color:var(--bg)}`, `pg-*` container variants, and the cleared defaults. Every placeholder utility was checked by name in the built CSS.
- The phase's whole npm scripts table now exists, so later plans don't edit `package.json` in parallel.
- Line-ending and editor rules keep `prettier --check` the same on Windows worktrees and on CI.

## Task Commits

1. **Task 1: Tracer - the approved toolchain builds a CSPS-themed placeholder page into the git-ignored wwwroot**
   - RED `8fef5ce` (test): toolchain install, configs and the failing build-output test (8/8 assertions failed; RED evidence `RED_EVIDENCE_OK`)
   - GREEN `2cff0e4` (feat): stylesheets, placeholder page, entry point, index.html and mark.svg (8/8 pass)
   - REFACTOR: none needed
2. **Task 2: Repository text rules** - `53e36b4` (chore)

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Files Created/Modified

- `web/.npmrc`: exact saves, engine-strict, 14-day cool-down, and the four approved exclusions, each commented with its decision
- `web/package.json` / `web/package-lock.json`: exact pins, overrides (axe-core, source-map-js, http-cache-semantics), engines and the scripts table
- `web/vite.config.ts`: the App. D.7 config plus `// SPEC-DEVIATION` deltas (compiler, mode-based outDir, `__DEV_ROUTES__`, port/proxy, `license: false`)
- `web/vitest.config.ts`: the test config over the Vite config, with JUnit output and coverage thresholds
- `web/index.html`: App. D.7c plus the meta description
- `web/public/mark.svg`: App. F, verbatim
- `web/src/main.tsx`: one stylesheet import, silent production error callbacks, the page root and the placeholder page
- `web/src/styles/app.css` / `base.css`: the Tailwind entry and the CSPS token theme
- `web/src/app/public/PublicPlaceholderPage.tsx`: the D-21 page in utilities
- `web/src/test/build-output.node.test.ts`: the build-output guard
- `.gitignore`: the whole `src/Csps.Server/wwwroot/` plus the web tooling output folders
- `.gitattributes` / `.editorconfig`: LF and 2-space rules for `web/` and `tools/openapi-gen/`

## Decisions Made

- The Tailwind scan root is `source("../../src")`, relative to `web/src/styles/` (see Deviations).
- vitest 5.0.1, because the install came before the 5.0.2 cut-off. There is no rolldown exclusion (R-2), and rolldown resolved to 1.2.11 without one.
- The newer nuqs 2.10.2 was published today, so it is inside the cool-down. The owner trigger (a stable 2.10.2+ that is at least 14 days old) didn't fire. It becomes eligible on 2026-10-22, and switching then still needs the owner's OK.
- The build-output test accepts the attribute selector with or without quotes, because the minifier drops them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Tailwind `source()` / `@source not` paths pointed at a folder that doesn't exist**
- **Found during:** Task 1 (GREEN build)
- **Issue:** The plan's `@import "tailwindcss" source("../src")` is resolved relative to `web/src/styles/app.css`, which gives `web/src/src`. The build failed with "The `source(../src)` does not exist or is not a directory."
- **Fix:** I changed the paths to `source("../../src")`, `@source not "../../src/**/*.test.{ts,tsx}"` and `@source not "../../src/test"`, all relative to the stylesheet's own folder, and added a comment explaining why.
- **Files modified:** `web/src/styles/app.css`
- **Verification:** The build passes, and the utilities from `PublicPlaceholderPage.tsx` and `main.tsx` all appear in the built CSS.
- **Committed in:** `2cff0e4`
- **Follow-up:** Plan 02-05's must-have truth says the stylesheet-contract test expects `source("../src")`. That test must accept `source("../../src")`, the form that is correct for this file location.

**2. [Rule 1 - Bug] The test checked for a quoted attribute selector**
- **Found during:** Task 1 (RED authoring)
- **Issue:** Lightning CSS minification writes `[data-theme=dark]` without the quotes, so a literal `[data-theme="dark"]` check would fail on correct output.
- **Fix:** The test now uses the regex `/\[data-theme="?dark"?\]/`, and the same for light. It is the same selector either way.
- **Files modified:** `web/src/test/build-output.node.test.ts`
- **Committed in:** `8fef5ce`

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Both were needed for a correct build and test. There was no scope creep, and no package changed.

## Issues Encountered

- Lightning CSS rewrites `@container pg (max-width: 767px)` to the equivalent `(width<=767px)`, and it adds a `color-mix` fallback layer for the mesh background. Both are semantically identical. The parity suite (plan 02-29) compares computed results, not CSS text.

## Package Approval Gate (conditional checkpoint)

The `checkpoint:decision` did not fire. Each trigger was checked:
- **Drift:** none. Every direct dependency resolved to its exact pin.
- **Audit:** `npm audit --audit-level=high` reported 0 vulnerabilities, on install and on ci.
- **Deprecated or yanked:** none. `npm ci` printed no warnings, and `npm view <pkg>@<ver> deprecated` was empty for the runtime and Tailwind packages.
- **lucide-react 1.53.0:** no advisory.
- **nuqs:** 2.10.2 is under 14 days old, so it is not eligible.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 02-37 can add the tsconfig files, `vite-env.d.ts` (which types `__DEV_ROUTES__` and `import.meta.env`), the env files and `tools/openapi-gen/` against these configs.
- `typecheck`, `lint`, `verify`, `e2e`, `parity`, `lighthouse`, `license:check`, `notices` and `review` point at files that later plans create. Until then they fail with a missing-file error, as planned.
- The `test:coverage` thresholds (90%) will fail until component tests exist, because `PublicPlaceholderPage.tsx` is counted.
- Plan verification: `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SpaHostTests"` passed 16/16.

## TDD Gate Compliance

RED `8fef5ce` (`test(02-02)`) comes before GREEN `2cff0e4` (`feat(02-02)`). The RED evidence (the JUnit record for `src/test/build-output.node.test.ts`) was verified with `check tdd-red-evidence`, which returned `RED_EVIDENCE_OK`. No refactor commit was needed.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 13 created files exist on disk, and `.gitignore` and `.editorconfig` were modified.
- Commits `8fef5ce`, `2cff0e4` and `53e36b4` are present in `git log`.
- All Task 1 and Task 2 acceptance criteria were re-run and pass.
