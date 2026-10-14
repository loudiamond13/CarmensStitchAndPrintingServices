---
status: partial
phase: 02-web-foundation-design-system
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md, 02-08-SUMMARY.md, 02-09-SUMMARY.md, 02-10-SUMMARY.md, 02-12-SUMMARY.md, 02-13-SUMMARY.md]
started: 2026-10-08T04:01:30-05:00
updated: 2026-10-08T06:01:16-05:00
created: 2026-10-08T04:01:30-05:00
---

# Phase 2 UAT: Web Foundation & Design System

**How this session was run.** The owner was away from the machine and asked for UAT to run anyway, with anything that needs them parked in the backlog. So:

- `source: automated` rows are deliverables whose SUMMARY `coverage:` block points at passing tests. The orchestrator gate re-ran them: build with 0 warnings, web verify 1242 tests, e2e 25/25 in five browser projects, dotnet 839/839.
- `source: claude` rows were tested hands-on by Claude against the real app: a fresh build, the API started the way the developer guide says, curl probes and the in-app browser. **They are not owner sign-offs.**
- Rows that need the owner's eyes or decisions are `blocked` or `skipped` with a reason. The decisions sit in backlog 999.1 (`.planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md`).
- Scope: plans 02-01..02-10, 02-12 and 02-13. Plans 02-11 and 02-14..02-18 have not run (they wait on owner rulings D-BL-03), so nothing they build is tested here.

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused — 3 items outstanding (look checks 7, 11, 12 wait on the showcase screens; Phase 2 styles are being re-planned to Tailwind per D-33)]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Clear the build output (wwwroot). Build the web app and start the API from scratch (`dotnet run --project src/Csps.Server --launch-profile http`). The server boots without errors, /health reports healthy (including the database), and the home page loads with live content and no console errors under the strict CSP.
result: pass
source: claude
evidence: "Preflight clean; wwwroot deleted and rebuilt with npm --prefix web run build; API started fresh on 5115. /health 200 with status Healthy (self, database, time-zone all Healthy). The pages /, /products and /admin/orders return 200 text/html with Cache-Control no-cache, br compression, the strict CSP and the nosniff, Referrer-Policy and Permissions-Policy headers. Hashed /assets/*.js return 200 with 'public, max-age=31536000, immutable' and br. /missing.js, /assets/missing.js, /favicon.ico and /api/v1/does-not-exist return an anonymous, uncompressed 404 application/problem+json. In Development, /openapi/v1.json returns 200 and /scalar returns 302. In the in-app browser the shell renders the planned tracer text 'Site update in progress.' with zero console messages."

### 2. Production web root serves only the app's own files
expected: After a production build, the API serves only the app's files from wwwroot (index.html, hashed assets, mark.svg, robots.txt). Build internals are never served; a request for one gets the anonymous 404.
result: pass
source: claude
retested_after_fix: "Gap G-02-2 fixed by plan 02-19 (HiddenSegmentFileProvider). Re-tested live on a fresh production build: /.vite/license.md, /.VITE/LICENSE.MD, /%2Evite/license.md, /assets%5C..%5C.vite%5Clicense.md, /VITE~1/license.md and /INDEX~1.HTM all 404 application/problem+json (HEAD has no ETag or Last-Modified). /, /.vite/ (non-file path) and /robots.txt, /mark.svg and /health are unchanged; /assets/*.js still 200, immutable, br."
originally_reported: "Found by Claude during automated UAT (owner away): GET http://localhost:5115/.vite/license.md returns 200 text/markdown (14,203 bytes). It lists every bundled dependency with its exact version (react 19.3.0 and so on). Vite's build.license writes it into wwwroot/.vite/, and UseStaticFiles serves dot-folders. The 02-01 SUMMARY guessed the dot-folder filter blocked it, but nobody had checked."
original_severity: minor

### 3. [02-01 D6] Developer guide explains the web workflow
expected: docs/development.md explains npm ci, the two-terminal dev setup, building into wwwroot, the preflight and never setting machine-level variables, and every command in it works as written.
result: pass
source: claude
evidence: "Ran the preflight, the production build and the API start exactly as written. The /health and /scalar checks behave as described, and the script names match web/package.json. Readability is a reading judgment; the owner can re-check it at leisure."

### 4. [02-10 D7] Developer guide 'API types' section
expected: The api.ts rule and the snapshot refresh, generate and check steps are correct and work as written.
result: pass
source: claude
evidence: "Ran the documented flow. The CSPS_WRITE_OPENAPI_SNAPSHOT=1 run wrote the snapshot and failed on purpose ('Snapshot written; run again without CSPS_WRITE_OPENAPI_SNAPSHOT'). The re-run passed 2/2, generate plus check reported 'Generated API types match', and git status was clean afterwards."

### 5. [02-03 D4] npm license gate: dev/build tree within D-26
expected: node web/scripts/license-gate.mjs exits 0 (production tree strict; dev/build tree only within the owner-approved licenses).
result: pass
source: claude
evidence: "Owner approved the three dev-only licenses on 2026-10-08 (D-BL-01: \"Approve all three (Recommended)\"). node web/scripts/license-gate.mjs now exits 0: production tree 16 packages, dev/build tree 522 packages, no stale exceptions."

### 6. [02-04 D7] The client preview is never shown as the final figure
expected: Once the server returns order totals, screens show the server figures, never the browser preview.
result: skipped
reason: "Deferred follow-up: no screen shows order totals until Phase 8 (order screens and the Discount modal), so check it there."

### 7. [02-05 D6] Visual effect of the overrides in the browser
expected: Bold current items, the drawn checkbox tick, the faded texts at full opacity (FYI-01) and no visible layout shift when the brand fonts swap in.
result: blocked
blocked_by: prior-phase
reason: "Nothing renders these classes until the showcase (plans 02-14/02-15), which waits on owner rulings D-BL-03. The owner then reviews the D-23 screenshots (plan 02-18)."

### 8. [02-08 D10] Shared list-query defaults fit every list
expected: staleTime 30 s, gcTime 5 min, refetchOnWindowFocus true and retry false suit every list screen.
result: skipped
reason: "Deferred follow-up: a flagged planning assumption that can only be judged per screen as later phases build lists. Any screen may override one query."

### 9. [02-09 D5] The Logout button looks identical to the old link (D-27)
expected: The owner confirms from the before/after pictures that the sidebar Logout looks the same.
result: pass
source: owner
evidence: "Owner confirmed in chat on 2026-10-08 (D-BL-03: \"Option A: accept all (Recommended)\", which includes the Logout look confirmed identical), recorded in D-31."

### 10. [02-09 D6] Owner rulings O-1..O-8, the 20 redrawn icons and D-BL-02
expected: The owner's rulings are recorded as D-31/D-32 in 02-CONTEXT.md.
result: pass
source: owner
evidence: "Owner ruled in chat on 2026-10-08: D-BL-03 \"Option A: accept all (Recommended)\" and D-BL-02 \"Option B: hide it\"; recorded as D-31/D-32 in 02-CONTEXT.md (commit fe6180f)."

### 11. [02-12 D7] How the form primitives look in a browser
expected: OtpInput box row and legend spacing at 320/390 px, the skip link on focus, the checkbox and MoneyInput in item rows look right in Blush and Espresso.
result: blocked
blocked_by: prior-phase
reason: "Needs the showcase (plans 02-14/02-15) for the Playwright overflow and focus checks and the D-23 owner screenshots; those plans wait on D-BL-03."

### 12. [02-13 D8] No horizontal scroll at 320 px, phone card view, tablet scroll, icon-only Pagination on phones
expected: The list primitives lay out correctly at 320 px with four chips, show the phone card view and look right in Blush and Espresso.
result: blocked
blocked_by: prior-phase
reason: "Needs the showcase (plans 02-14/02-15) and its 4-chip Playwright overflow test, plus the D-23 owner screenshots; those plans wait on D-BL-03."

### 13. [02-01] Approved npm package set installed exactly and locked in web/ and tools/openapi-gen/, npm audit 0, whole tree past the 14-day cool-down except the approved exceptions
expected: Approved npm package set installed exactly and locked in web/ and tools/openapi-gen/, npm audit 0, whole tree past the 14-day cool-down except the approved exceptions
result: pass
source: automated
coverage_id: 02-01/D1
verified_by: npm --prefix web ls --depth=0 (42 entries = D-25 table); npm ls rolldown source-map-js http-cache-semantics; npm audit (both folders) = 0; scratchpad ages.mjs lists only rolldown/bindings 1.2.11, source-map-js 1.2.2, http-cache-semantics 4.3.0, lucide-react 1.52.0, vite 8.3.3

### 14. [02-01] npm --prefix web run build writes index.html, hashed assets, mark.svg and robots.txt into the git-ignored wwwroot with no warnings; the built index.html has no inline script or style
expected: npm --prefix web run build writes index.html, hashed assets, mark.svg and robots.txt into the git-ignored wwwroot with no warnings; the built index.html has no inline script or style
result: pass
source: automated
coverage_id: 02-01/D2
verified_by: npm --prefix web run build && git status --porcelain src/Csps.Server/wwwroot (empty) && git check-ignore -q src/Csps.Server/wwwroot/index.html

### 15. [02-01] Dev server is pinned to 5180 with strictPort (a busy 5180 is an error, never a port hop) and proxies /api to http://localhost:5115
expected: Dev server is pinned to 5180 with strictPort (a busy 5180 is an error, never a port hop) and proxies /api to http://localhost:5115
result: pass
source: automated
coverage_id: 02-01/D3
verified_by: Held 5180 with a node listener, ran npm --prefix web run dev -> exit 1 'Port 5180 is already in use'

### 16. [02-01] API serves the shell anonymously with no-cache and the strict CSP at any non-file path; missing files and reserved docs prefixes are anonymous ProblemDetails 404s; /api unknowns stay ProblemDetails 404
expected: API serves the shell anonymously with no-cache and the strict CSP at any non-file path; missing files and reserved docs prefixes are anonymous ProblemDetails 404s; /api unknowns stay ProblemDetails 404
result: pass
source: automated
coverage_id: 02-01/D4
verified_by: tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#NonFilePathsServeTheShell, UnknownApiRouteIsStillProblem404, MissingFileIsProblem404, ExistingFileIsServed, ReservedDocsPathsAre404OutsideDevelopment; tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs#ProductionHasNoApiDocs, Produ

### 17. [02-01] Static html/css/js/svg compressed (br/gzip), JSON and ProblemDetails never compressed; /assets immutable, everything else no-cache
expected: Static html/css/js/svg compressed (br/gzip), JSON and ProblemDetails never compressed; /assets immutable, everything else no-cache
result: pass
source: automated
coverage_id: 02-01/D5
verified_by: tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#CompressesStaticText, NeverCompressesJson, AssetsAreImmutable, OtherStaticFilesRevalidate

### 18. [02-02] One verify script runs TS 7 typecheck, ESLint --max-warnings 0, prettier --check, vitest run --coverage and the build, in that order, and exits 0 on the scaffold with no warnings
expected: One verify script runs TS 7 typecheck, ESLint --max-warnings 0, prettier --check, vitest run --coverage and the build, in that order, and exits 0 on the scaffold with no warnings
result: pass
source: automated
coverage_id: 02-02/D1
verified_by: npm --prefix web run verify (exit 0; grep for warn/error/(!) finds only the script's own --max-warnings echo); npm --prefix web exec -- tsc --version = Version 7.0.2; require('typescript').version = 6.0.3; tsc6 -p both configs also passes

### 19. [02-02] Every WEB-04 / WEB-10 / QUAL-02 lint ban fires outside its allowed files and stays quiet inside them
expected: Every WEB-04 / WEB-10 / QUAL-02 lint ban fires outside its allowed files and stays quiet inside them
result: pass
source: automated
coverage_id: 02-02/D2
verified_by: web/src/test/lint-rules.test.ts (27 cases: httpClient and relative lib/http imports, axios, react-router-dom, 4 nuqs adapters + v8 clean, parseAsIsoDate(Time), startTransition option vs useTransition, shallow, fetch/window/globalThis/self.fetch, XMLHttpRequest, raw-HTML JSX, console, non-null assert

### 20. [02-02] ESLint config shape: no warn-level rule (raw and resolved per file type), unused disable directives are errors, prefer-nullish-coalescing ignorePrimitives, global ignores, jsx-a11y-x/react-hooks/type-aware wiring, eslint-config-prettier last
expected: ESLint config shape: no warn-level rule (raw and resolved per file type), unused disable directives are errors, prefer-nullish-coalescing ignorePrimitives, global ignores, jsx-a11y-x/react-hooks/type-aware wiring, eslint-config-prettier last
result: pass
source: automated
coverage_id: 02-02/D3
verified_by: web/src/test/eslint-config.test.ts (10 cases)

### 21. [02-02] Vite config values pinned: per-mode outDir, emptyOutDir, assetsInlineLimit 0, sourcemap off, license on, __DEV_ROUTES__ false only in production, port 5180 strictPort and the /api proxy
expected: Vite config values pinned: per-mode outDir, emptyOutDir, assetsInlineLimit 0, sourcemap off, license on, __DEV_ROUTES__ false only in production, port 5180 strictPort and the /api proxy
result: pass
source: automated
coverage_id: 02-02/D4
verified_by: web/src/test/build-config.test.ts (5 cases)

### 22. [02-02] Any console.error or console.warn in a Vitest test fails it, React key warnings included
expected: Any console.error or console.warn in a Vitest test fails it, React key warnings included
result: pass
source: automated
coverage_id: 02-02/D5
verified_by: web/src/test/consoleGuard.test.ts (6 cases); Throwaway probe test (deleted): a missing-key list and a bare console.warn each failed with 'Unexpected console output', a clean render passed

### 23. [02-02] expectNoAxeViolations runs axe-core 4.13.0 with the five WCAG tags (contrast off in jsdom), rejects an empty container, and prints violations sorted by rule id then target
expected: expectNoAxeViolations runs axe-core 4.13.0 with the five WCAG tags (contrast off in jsdom), rejects an empty container, and prints violations sorted by rule id then target
result: pass
source: automated
coverage_id: 02-02/D6
verified_by: web/src/test/axe.test.tsx (6 cases); npm --prefix web ls axe-core = 4.13.0 only

### 24. [02-03] Every npm pin in web/package.json and tools/openapi-gen/package.json is registered with a folder-qualified id, exact version, kind npm, scope and cool-down status
expected: Every npm pin in web/package.json and tools/openapi-gen/package.json is registered with a folder-qualified id, exact version, kind npm, scope and cool-down status
result: pass
source: automated
coverage_id: 02-03/D1
verified_by: dotnet test --project tests/Csps.ArchitectureTests (DependencyRegistryTests incl. NpmPinsAreExactVersions, ReadNpmManifestQualifiesIdsAndResolvesAliases) - 102/102

### 25. [02-03] Scope-aware license exceptions: MPL-2.0 accepted for test and build scopes, OFL-1.1 font-only
expected: Scope-aware license exceptions: MPL-2.0 accepted for test and build scopes, OFL-1.1 font-only
result: pass
source: automated
coverage_id: 02-03/D2
verified_by: tests/Csps.ArchitectureTests/DependencyRegistryTests.cs (scope exception cases)

### 26. [02-03] SPDX policy evaluation, tree checks, stale-exception detection and notices formatting
expected: SPDX policy evaluation, tree checks, stale-exception detection and notices formatting
result: pass
source: automated
coverage_id: 02-03/D3
verified_by: web/scripts/license-policy.test.ts (npm --prefix web run verify, 82 vitest tests)

### 27. [02-03] web/THIRD-PARTY-NOTICES.txt generated, committed and drift-checked
expected: web/THIRD-PARTY-NOTICES.txt generated, committed and drift-checked
result: pass
source: automated
coverage_id: 02-03/D5
verified_by: node web/scripts/third-party-notices.mjs --check - exit 0 (16 packages)

### 28. [02-04] One committed golden-vector file with 220 cases (>= 200) in eight categories (midpoint 39, ord-fixture 8, percent-100 6, zero-items 6, multi-discount 30, negative-balance 6, large-value 11, seeded-random 114), amounts as strings, generated by an exact-rational oracle that shares no code with either implementation
expected: One committed golden-vector file with 220 cases (>= 200) in eight categories (midpoint 39, ord-fixture 8, percent-100 6, zero-items 6, multi-discount 30, negative-balance 6, large-value 11, seeded-random 114), amounts as strings, generated by an exact-rational oracle that shares no code with either implementation
result: pass
source: automated
coverage_id: 02-04/D1
verified_by: web/scripts/golden-math.test.ts (11 hand-checked oracle cases); web/src/lib/csps.golden.test.ts#has at least 200 cases with unique ids, covers the <category> category (x8); tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs#HasAtLeast200CasesWithUniqueIds, CoversTheCategory (x8), PinsT

### 29. [02-04] Csps.Domain.Orders.OrderMath.Compute passes every vector (decimal, MidpointRounding.AwayFromZero) and the edge unit tests; Csps.Domain stays at 100% line and branch
expected: Csps.Domain.Orders.OrderMath.Compute passes every vector (decimal, MidpointRounding.AwayFromZero) and the edge unit tests; Csps.Domain stays at 100% line and branch
result: pass
source: automated
coverage_id: 02-04/D2
verified_by: tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs#MatchesEveryVector (220 theory rows); tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs (null lists, empty order, zero quantity, 100%/0%, midpoints, 999,999,999.99); powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/

### 30. [02-04] web/src/lib/csps.ts orderTotals (SPEC-DEVIATION D-09 integer centavos) passes every vector; the verbatim App. D.1 math fails 53 of 220 (7.5% of 17.00 previews 1.27 instead of 1.28); App. D.2's 7 tests pass unchanged
expected: web/src/lib/csps.ts orderTotals (SPEC-DEVIATION D-09 integer centavos) passes every vector; the verbatim App. D.1 math fails 53 of 220 (7.5% of 17.00 previews 1.27 instead of 1.28); App. D.2's 7 tests pass unchanged
result: pass
source: automated
coverage_id: 02-04/D3
verified_by: web/src/lib/csps.golden.test.ts#<case id>: <note> (220 rows); web/src/lib/csps.test.ts (App. D.2 x7, round2, discountAmount, D.1 characterization)

### 31. [02-04] Both suites only read the vector file; `node web/scripts/gen-golden-vectors.mjs --check` exits 0 on the committed file and 1 after a one-character edit
expected: Both suites only read the vector file; `node web/scripts/gen-golden-vectors.mjs --check` exits 0 on the committed file and 1 after a one-character edit
result: pass
source: automated
coverage_id: 02-04/D4
verified_by: node web/scripts/gen-golden-vectors.mjs --check (exit 0); edited 3.83 -> 3.84 (exit 1); restored (exit 0)

### 32. [02-04] formatPeso `₱12,450.00`, `−₱732.50` (U+2212), `₱0.00` for -0/null/undefined/''; formatDate `Oct 6, 2026`; formatBusinessDate Asia/Manila (`2026-10-05T16:30:00Z` -> `Oct 6, 2026`, 15:59:59Z -> `Oct 5, 2026`, invalid -> `—`)
expected: formatPeso `₱12,450.00`, `−₱732.50` (U+2212), `₱0.00` for -0/null/undefined/''; formatDate `Oct 6, 2026`; formatBusinessDate Asia/Manila (`2026-10-05T16:30:00Z` -> `Oct 6, 2026`, 15:59:59Z -> `Oct 5, 2026`, invalid -> `—`)
result: pass
source: automated
coverage_id: 02-04/D5
verified_by: web/src/lib/format.test.ts (13 cases)

### 33. [02-04] toCentavos accepts only ^\\d{0,9}(\\.\\d{0,2})?$ with a digit and returns an exact bigint; centavosToAmount writes two decimals
expected: toCentavos accepts only ^\\d{0,9}(\\.\\d{0,2})?$ with a digit and returns an exact bigint; centavosToAmount writes two decimals
result: pass
source: automated
coverage_id: 02-04/D6
verified_by: web/src/lib/csps.test.ts#toCentavos reads/rejects, centavosToAmount

### 34. [02-05] The five design stylesheets equal the spec App. A, A.2, A.3, B and C blocks (LF-normalized) and stay LF
expected: The five design stylesheets equal the spec App. A, A.2, A.3, B and C blocks (LF-normalized) and stay LF
result: pass
source: automated
coverage_id: 02-05/D1
verified_by: web/src/styles/verbatim.test.ts#verbatim design CSS (WEB-02, D-07)

### 35. [02-05] main.tsx loads fonts, globals, spec-gaps, overrides in that order with the SPEC-DEVIATION markers and no per-subset font files
expected: main.tsx loads fonts, globals, spec-gaps, overrides in that order with the SPEC-DEVIATION markers and no per-subset font files
result: pass
source: automated
coverage_id: 02-05/D2
verified_by: web/src/styles/verbatim.test.ts#main.tsx stylesheet load order (D-07, A11Y-04 ordering edge)

### 36. [02-05] Owner WCAG rulings D-01 (phone 16px inputs), D-02 (inactive rows, no faded text), D-03 (bold current items, checkbox cue), D-05 (thumb actions on focus and touch) and the WEB-09 pending look are in overrides.css with decision-ID comments
expected: Owner WCAG rulings D-01 (phone 16px inputs), D-02 (inactive rows, no faded text), D-03 (bold current items, checkbox cue), D-05 (thumb actions on focus and touch) and the WEB-09 pending look are in overrides.css with decision-ID comments
result: pass
source: automated
coverage_id: 02-05/D3
verified_by: web/src/styles/overrides.test.ts#overrides.css owner rulings (A11Y-04); web/src/styles/overrides.test.ts#no faded text (D-02 rule, A11Y-04 empty edge)

### 37. [02-05] Phone text-entry fields render at 16px and index.html keeps pinch zoom (no maximum-scale or user-scalable)
expected: Phone text-entry fields render at 16px and index.html keeps pinch zoom (no maximum-scale or user-scalable)
result: pass
source: automated
coverage_id: 02-05/D4
verified_by: web/src/styles/overrides.test.ts#D-01 (C-34): phone text-entry fields compute to 16px, desktop and tablet keep 14px; web/src/styles/overrides.test.ts#index.html keeps pinch zoom: no maximum-scale and no user-scalable (D-01)

### 38. [02-05] Metric-matched fallback faces (Barlow fallback skips U+20B1), font stacks with each fallback after its brand family, and exactly one Archivo latin woff2 preload in the production index.html; fonts are woff2 files under /assets
expected: Metric-matched fallback faces (Barlow fallback skips U+20B1), font stacks with each fallback after its brand family, and exactly one Archivo latin woff2 preload in the production index.html; fonts are woff2 files under /assets
result: pass
source: automated
coverage_id: 02-05/D5
verified_by: web/scripts/vite-preload-font-plugin.test.ts#preloadFontPlugin (PERF-05); web/scripts/font-metrics.test.ts#committed PERF-05 values in overrides.css; web/src/styles/overrides.test.ts#PERF-05 metric-matched fallback fonts; npm --prefix web run build && node -e (exactly one rel=preload for archivo-lat

### 39. [02-06] npm --prefix web run e2e runs the preflight, refuses a busy 5199, migrates CSPS_E2E through the dev-seed guard, builds web/.e2e-dist and starts the real host on https://localhost:5199 in Development with --webroot
expected: npm --prefix web run e2e runs the preflight, refuses a busy 5199, migrates CSPS_E2E through the dev-seed guard, builds web/.e2e-dist and starts the real host on https://localhost:5199 in Development with --webroot
result: pass
source: automated
coverage_id: 02-06/D1
verified_by: npm --prefix web run e2e -- --grep \"@smoke|@fixture\" (exit 0, 25 passed; log shows preflight report, 'Migrated CSPS_E2E (compatibility level 160)', vite e2e build, then Playwright); A2 probe: web/.e2e-dist/a2-probe.txt (absent from wwwroot) served 200 by the exact webServer command; probe file del

### 40. [02-06] The shell page is clean in all five projects: 200, the exact StrictCsp header, one h1, zero axe violations (contrast on), no console/pageerror/CSP/response findings
expected: The shell page is clean in all five projects: 200, the exact StrictCsp header, one h1, zero axe violations (contrast on), no console/pageerror/CSP/response findings
result: pass
source: automated
coverage_id: 02-06/D2
verified_by: web/e2e/smoke.spec.ts#@smoke shell loads clean (5/5: chromium, firefox, webkit, pixel, iphone)

### 41. [02-06] Each guard is proven to fire: console error, CSP violation (script-src*), axe image-alt rejection, routed 404 subresource; and an unconsumed finding fails the test at teardown
expected: Each guard is proven to fire: console error, CSP violation (script-src*), axe image-alt rejection, routed 404 subresource; and an unconsumed finding fails the test at teardown
result: pass
source: automated
coverage_id: 02-06/D3
verified_by: web/e2e/fixture-selftest.spec.ts (4 tests x 5 projects = 20 passed); Mutation runs on chromium/firefox/webkit: disabling the console, CSP, response or axe guard fails exactly its matching self-test (3 failed / 9 passed each); a throwaway spec with an unconsumed console.warn failed in all 5 projects 

### 42. [02-06] Developer guide documents running E2E safely on the shared machine
expected: Developer guide documents running E2E safely on the shared machine
result: pass
source: automated
coverage_id: 02-06/D4
verified_by: grep -c 'npm --prefix web run e2e' docs/development.md = 3; Updated timestamp 2026-10-08T00:32:10-05:00

### 43. [02-07] Typed GET round trip: baseURL + path, same-origin credentials, Accept JSON, params serialization (repeated keys, null/undefined skipped), default and request headers, method helpers
expected: Typed GET round trip: baseURL + path, same-origin credentials, Accept JSON, params serialization (repeated keys, null/undefined skipped), default and request headers, method helpers
result: pass
source: automated
coverage_id: 02-07/D1
verified_by: web/src/lib/http/httpClient.test.ts#createHttpClient: GET round trip

### 44. [02-07] Every failure is an HttpError (kind, status 0 without a response, problem, fieldErrors, traceId) with a plain-English message; never a raw Response
expected: Every failure is an HttpError (kind, status 0 without a response, problem, fieldErrors, traceId) with a plain-English message; never a raw Response
result: pass
source: automated
coverage_id: 02-07/D2
verified_by: web/src/lib/http/HttpError.test.ts; web/src/lib/http/httpClient.test.ts#createHttpClient: ProblemDetails errors

### 45. [02-07] Caller abort gives kind aborted, the timeout gives kind timeout, neither is retried, and timers are cleared
expected: Caller abort gives kind aborted, the timeout gives kind timeout, neither is retried, and timers are cleared
result: pass
source: automated
coverage_id: 02-07/D3
verified_by: web/src/lib/http/httpClient.resilience.test.ts#timeout and abort

### 46. [02-07] At most 2 capped exponential retries, only for GET/HEAD/PUT/DELETE/OPTIONS and a keyed POST, only after a network error or 503
expected: At most 2 capped exponential retries, only for GET/HEAD/PUT/DELETE/OPTIONS and a keyed POST, only after a network error or 503
result: pass
source: automated
coverage_id: 02-07/D4
verified_by: web/src/lib/http/httpClient.resilience.test.ts#capped retries

### 47. [02-07] Idempotency-Key reuse: the same key on every retry and on the refresh retry; no key on GET or keyless requests; a keyless POST is never retried; two POSTs make two requests
expected: Idempotency-Key reuse: the same key on every retry and on the refresh retry; no key on GET or keyless requests; a keyless POST is never retried; two POSTs make two requests
result: pass
source: automated
coverage_id: 02-07/D5
verified_by: web/src/lib/http/httpClient.resilience.test.ts#Idempotency-Key (WEB-09); web/src/lib/http/httpClient.transport.test.ts#a keyed POST upload is retried after a network error with the same key

### 48. [02-07] Single-flight 401 refresh: three concurrent 401s make one refresh call and one retry each; a failed refresh rejects all with 401 and calls onUnauthorized once
expected: Single-flight 401 refresh: three concurrent 401s make one refresh call and one retry each; a failed refresh rejects all with 401 and calls onUnauthorized once
result: pass
source: automated
coverage_id: 02-07/D6
verified_by: web/src/lib/http/httpClient.resilience.test.ts#single-flight 401 refresh

### 49. [02-07] Secret param names are rejected before any request is sent
expected: Secret param names are rejected before any request is sent
result: pass
source: automated
coverage_id: 02-07/D7
verified_by: web/src/lib/http/httpClient.resilience.test.ts#secrets never go in a URL (PRD 8.2, 9.3)

### 50. [02-07] JSON/FormData bodies, parse failures, the XHR upload transport (progress, errors, abort, timeout) and response interceptors
expected: JSON/FormData bodies, parse failures, the XHR upload transport (progress, errors, abort, timeout) and response interceptors
result: pass
source: automated
coverage_id: 02-07/D8
verified_by: web/src/lib/http/httpClient.transport.test.ts

### 51. [02-07] 100% line, branch, function and statement coverage for src/lib/http, enforced by a Vitest threshold
expected: 100% line, branch, function and statement coverage for src/lib/http, enforced by a Vitest threshold
result: pass
source: automated
coverage_id: 02-07/D9
verified_by: npm --prefix web run verify (exit 0; src/lib/http 227/227 statements, 131/131 branches, 57/57 functions, 223/223 lines); mutation: vitest run --coverage without httpClient.transport.test.ts fails the src/lib/http/** threshold (exit 1)

### 52. [02-08] Allow-list parsers: strict base-10 page and page size, literal values, search trimmed and capped at 100 UTF-16 code units with no lone surrogate, calendar-checked YYYY-MM-DD business dates, range presets resolved against an injected business today, businessToday in Asia/Manila
expected: Allow-list parsers: strict base-10 page and page size, literal values, search trimmed and capped at 100 UTF-16 code units with no lone surrogate, calendar-checked YYYY-MM-DD business dates, range presets resolved against an injected business today, businessToday in Asia/Manila
result: pass
source: automated
coverage_id: 02-08/D1
verified_by: web/src/lib/url-state/parsers.test.ts (70 cases incl. '0','-1','1.5','2.5','1e3',' 2','0x10' rejected; 9999 and '20.0' rejected; 100 kept, 101 cut, emoji straddle dropped; 2026-02-30 rejected; last-30-days 2026-09-08..2026-10-07; businessToday(2026-10-05T16:30Z) = 2026-10-06)

### 53. [02-08] An invalid list URL (?size=9999&page=0&status=bogus, ?from=2026-02-30, ?q=spaces, ?page=1 defaults) parses to defaults and is rewritten once with replace; no query string writes nothing; a re-render with the normalized URL writes nothing more
expected: An invalid list URL (?size=9999&page=0&status=bogus, ?from=2026-02-30, ?q=spaces, ?page=1 defaults) parses to defaults and is rewritten once with replace; no query string writes nothing; a re-render with the normalized URL writes nothing more
result: pass
source: automated
coverage_id: 02-08/D2
verified_by: web/src/lib/url-state/createListParams.test.tsx#createListParams: normalize once (16 cases)

### 54. [02-08] History and page reset: setPage pushes; setFilter, setPageSize, setSearch, setSort, setTab, setView replace and drop the page in one update; clampPage replaces a page past the last page; reset clears; keys serialize in one fixed order
expected: History and page reset: setPage pushes; setFilter, setPageSize, setSearch, setSort, setTab, setView replace and drop the page in one update; clampPage replaces a page past the last page; reset clears; keys serialize in one fixed order
result: pass
source: automated
coverage_id: 02-08/D3
verified_by: web/src/lib/url-state/createListParams.test.tsx#createListParams: history and page reset (17 cases); web/src/lib/url-state/defaultOptions.test.ts (5 cases)

### 55. [02-08] Search writes the URL after 300 ms of quiet (one update for 'jer' then 'jersey'), at once with { immediate: true }, and removes blank search
expected: Search writes the URL after 300 ms of quiet (one update for 'jer' then 'jersey'), at once with { immediate: true }, and removes blank search
result: pass
source: automated
coverage_id: 02-08/D4
verified_by: web/src/lib/url-state/createListParams.test.tsx#createListParams: search (4 cases, fake timers)

### 56. [02-08] Personal-data and secret URL keys are refused when a list hook is created (CWE-598 prohibition)
expected: Personal-data and secret URL keys are refused when a list hook is created (CWE-598 prohibition)
result: pass
source: automated
coverage_id: 02-08/D5
verified_by: web/src/lib/url-state/createListParams.test.tsx#createListParams: privacy (CWE-598) (12 cases)

### 57. [02-08] UrlStateLayout (NuqsAdapter from nuqs/adapters/react-router/v8 around Outlet) as a pathless layout route: setPage(2) pushes ?page=2, Back restores page 1, shared defaults and key order apply, a router navigation is read, an invalid link is normalized without a new history entry, no markup of its own
expected: UrlStateLayout (NuqsAdapter from nuqs/adapters/react-router/v8 around Outlet) as a pathless layout route: setPage(2) pushes ?page=2, Back restores page 1, shared defaults and key order apply, a router navigation is read, an invalid link is normalized without a new history entry, no markup of its own
result: pass
source: automated
coverage_id: 02-08/D6
verified_by: web/src/lib/url-state/UrlStateLayout.test.tsx (6 cases); grep -c 'nuqs/adapters/react-router/v8' UrlStateLayout.tsx = 1

### 58. [02-08] Query defaults (staleTime 30 s, gcTime 5 min, retry false for queries and mutations, refetchOnWindowFocus) and query keys; useListQuery keys on parsed values, passes the AbortSignal, keeps the previous page as placeholder data, aborts a superseded search key, honours enabled
expected: Query defaults (staleTime 30 s, gcTime 5 min, retry false for queries and mutations, refetchOnWindowFocus) and query keys; useListQuery keys on parsed values, passes the AbortSignal, keeps the previous page as placeholder data, aborts a superseded search key, honours enabled
result: pass
source: automated
coverage_id: 02-08/D7
verified_by: web/src/lib/query/queryClient.test.ts (3); web/src/lib/query/useListQuery.test.tsx (7 incl. keys)

### 59. [02-08] useDebouncedValue(q, 300) returns only the settled value; prefetchOnIntent's pointerenter/focus handlers prefetch the target, swallow errors and add no markup
expected: useDebouncedValue(q, 300) returns only the settled value; prefetchOnIntent's pointerenter/focus handlers prefetch the target, swallow errors and add no markup
result: pass
source: automated
coverage_id: 02-08/D8
verified_by: web/src/lib/query/useDebouncedValue.test.tsx (3); web/src/lib/query/prefetchOnIntent.test.tsx (4)

### 60. [02-08] Whole web gate still green with the new code at 100% coverage
expected: Whole web gate still green with the new code at 100% coverage
result: pass
source: automated
coverage_id: 02-08/D9
verified_by: npm --prefix web run verify (exit 0; 26 files, 687 tests; all files 99.79/99.07/100/100; src/lib/url-state and src/lib/query 100% in filtered runs); CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx (837 passed, 0 warnings)

### 61. [02-09] Frozen App. D.3/D.4/D.5 copies equal the spec code blocks (LF) and carry a README
expected: Frozen App. D.3/D.4/D.5 copies equal the spec code blocks (LF) and carry a README
result: pass
source: automated
coverage_id: 02-09/D1
verified_by: web/src/ui/reference-verbatim.test.ts#frozen reference copies (WEB-02, D-07)

### 62. [02-09] The reconciled 37 components render the same normalized DOM as the reference over 245 seed-data cases, re-rendered with equal props; Sidebar Logout (D-27) is the only listed difference
expected: The reconciled 37 components render the same normalized DOM as the reference over 245 seed-data cases, re-rendered with equal props; Sidebar Logout (D-27) is the only listed difference
result: pass
source: automated
coverage_id: 02-09/D2
verified_by: web/src/ui/differential.test.tsx#reconciled design system vs frozen App. D.3 (WEB-02, D-07); web/src/ui/differential.test.tsx#the one listed structural difference: Sidebar Logout (D-27); web/src/test/normalizeDom.test.ts

### 63. [02-09] Strict typecheck and ESLint pass with zero findings on the reconciled files; handlers moved to native listeners behave the same
expected: Strict typecheck and ESLint pass with zero findings on the reconciled files; handlers moved to native listeners behave the same
result: pass
source: automated
coverage_id: 02-09/D3
verified_by: npm --prefix web run typecheck && npm --prefix web run lint; web/src/ui/differential.test.tsx#handler parity after the listener moves (D-07 step 3)

### 64. [02-09] Icons via lucide-react behind the Icon name API (56 names), Mark as JSX
expected: Icons via lucide-react behind the Icon name API (56 names), Mark as JSX
result: pass
source: automated
coverage_id: 02-09/D4
verified_by: web/src/ui/differential.test.tsx#icons and mark (D-10, D-12, WEB-02)

### 65. [02-10] Committed canonical OpenAPI snapshot with a live-vs-snapshot drift test that writes only under the per-process switch and then still fails
expected: Committed canonical OpenAPI snapshot with a live-vs-snapshot drift test that writes only under the per-process switch and then still fails
result: pass
source: automated
coverage_id: 02-10/D1
verified_by: tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument; tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CanonicalFormSortsObjectKeysOrdinallyAndKeepsArrayOrder; CSPS_WRITE_OPENAPI_SNAPSHOT=1 dotnet test --project tests/Csps.Server.Inte

### 66. [02-10] Generated API types committed and drift-checked by openapi-typescript 7.13.0 regeneration in memory
expected: Generated API types committed and drift-checked by openapi-typescript 7.13.0 regeneration in memory
result: pass
source: automated
coverage_id: 02-10/D2
verified_by: npm --prefix tools/openapi-gen run check (exit 0); mutation: an edited api.generated.ts makes check exit 1

### 67. [02-10] api.ts is the only endpoint module: createApi, default api at /api/v1, api.site.settings typed from components['schemas'], independent AbortSignals per call, HttpError re-exports
expected: api.ts is the only endpoint module: createApi, default api at /api/v1, api.site.settings typed from components['schemas'], independent AbortSignals per call, HttpError re-exports
result: pass
source: automated
coverage_id: 02-10/D3
verified_by: web/src/lib/api.test.ts; npm --prefix web run lint (exit 0, max-warnings 0)

### 68. [02-10] useSubmission: one Idempotency-Key per submission, reused for a JSON-equal retry of a failed submission, new after success/reset/changed data; one request in flight; pending state; unmount aborts; v4 key from randomUUID or getRandomValues, never Math.random
expected: useSubmission: one Idempotency-Key per submission, reused for a JSON-equal retry of a failed submission, new after success/reset/changed data; one request in flight; pending state; unmount aborts; v4 key from randomUUID or getRandomValues, never Math.random
result: pass
source: automated
coverage_id: 02-10/D4
verified_by: web/src/lib/forms/useSubmission.test.tsx

### 69. [02-10] focusFirstInvalid focuses the first aria-invalid=\"true\" element in DOM order and returns false when there is none
expected: focusFirstInvalid focuses the first aria-invalid=\"true\" element in DOM order and returns false when there is none
result: pass
source: automated
coverage_id: 02-10/D5
verified_by: web/src/lib/forms/focusFirstInvalid.test.tsx

### 70. [02-10] describeHttpError returns the UI-SPEC copy for every listed kind and status, null for 401 and aborted, and never shows server text
expected: describeHttpError returns the UI-SPEC copy for every listed kind and status, null for 401 and aborted, and never shows server text
result: pass
source: automated
coverage_id: 02-10/D6
verified_by: web/src/lib/errors/describeHttpError.test.ts

### 71. [02-12] MoneyInput: type text, inputmode decimal, autocomplete off, ₱ prefix; 9 integer digits and 2 decimals on typing and paste, grouping stripped, minus and letters ignored; blur padding; validateMoneyInput copy; toCentavos of the emitted string is exact
expected: MoneyInput: type text, inputmode decimal, autocomplete off, ₱ prefix; 9 integer digits and 2 decimals on typing and paste, grouping stripped, minus and letters ignored; blur padding; validateMoneyInput copy; toCentavos of the emitted string is exact
result: pass
source: automated
coverage_id: 02-12/D1
verified_by: web/src/ui/gaps/MoneyInput.test.tsx; web/src/styles/overrides.test.ts#MoneyInput: a caller text-right right-aligns the amount (item rows, App. E.9)

### 72. [02-12] OtpInput: fieldset/legend markup, six numeric one-digit boxes, one-time-code on box 1, keyboard movement, paste fill from the focused box, onComplete only at 6 digits, validateOtp copy, error state on every box, zero axe violations
expected: OtpInput: fieldset/legend markup, six numeric one-digit boxes, one-time-code on box 1, keyboard movement, paste fill from the focused box, onComplete only at 6 digits, validateOtp copy, error state on every box, zero axe violations
result: pass
source: automated
coverage_id: 02-12/D2
verified_by: web/src/ui/gaps/OtpInput.test.tsx; web/src/styles/overrides.test.ts#OtpInput: a borderless fieldset with six 44-56px centred tabular boxes, 8px apart and 4px at 420px or less

### 73. [02-12] Checkbox: label.s-check around a native checkbox named by its label, toggled by click and Space, required/hint/error, zero axe violations
expected: Checkbox: label.s-check around a native checkbox named by its label, toggled by click and Space, required/hint/error, zero axe violations
result: pass
source: automated
coverage_id: 02-12/D3
verified_by: web/src/ui/gaps/Checkbox.test.tsx

### 74. [02-12] SkipLink: 'Skip to main content' with the primary md button classes, first focusable, focuses #main with no hash in the URL; hidden until :focus-visible then fixed top-left
expected: SkipLink: 'Skip to main content' with the primary md button classes, first focusable, focuses #main with no hash in the URL; hidden until :focus-visible then fixed top-left
result: pass
source: automated
coverage_id: 02-12/D4
verified_by: web/src/ui/gaps/SkipLink.test.tsx; web/src/styles/overrides.test.ts#SkipLink: hidden with the .csp-sr technique until :focus-visible, then fixed top-left above the page

### 75. [02-12] PasswordField (the WEB-06 PasswordInput): Show/Hide password toggle, Weak/Fair/Good/Strong, the empty hint, hint and error states with axe
expected: PasswordField (the WEB-06 PasswordInput): Show/Hide password toggle, Weak/Fair/Good/Strong, the empty hint, hint and error states with axe
result: pass
source: automated
coverage_id: 02-12/D5
verified_by: web/src/ui/PasswordField.test.tsx

### 76. [02-12] Text-entry boxes stay at 16px or more on phones and SPEC-GAP CSS sets no type (PERF-03)
expected: Text-entry boxes stay at 16px or more on phones and SPEC-GAP CSS sets no type (PERF-03)
result: pass
source: automated
coverage_id: 02-12/D6
verified_by: web/src/styles/overrides.test.ts#keeps every text-entry box at 16px or more on phones: .csp-input is 16px and only D-01 touches the size; web/src/styles/overrides.test.ts#sets no font size, weight or line height: SPEC-GAP type comes from the reused spec classes

### 77. [02-13] ResponsiveTable populated markup: .s-rt-wrap > table.s-rt, .csp-sr caption, data-label on every td, is-lead, r.is-acts under a .csp-sr 'Actions' th, .r.m money cells, is-inactive (D-02), '—' for missing values, 'Walk-in customer' (CustomerCell), optional tfoot
expected: ResponsiveTable populated markup: .s-rt-wrap > table.s-rt, .csp-sr caption, data-label on every td, is-lead, r.is-acts under a .csp-sr 'Actions' th, .r.m money cells, is-inactive (D-02), '—' for missing values, 'Walk-in customer' (CustomerCell), optional tfoot
result: pass
source: automated
coverage_id: 02-13/D1
verified_by: web/src/ui/gaps/ResponsiveTable.test.tsx#ResponsiveTable: populated (App. E.7 / E.12 markup)

### 78. [02-13] ResponsiveTable states: first-load SkeletonTable in an aria-busy LoadingRegion ('Loading users…' then 'Users loaded.'), empty and no-matches copy with Clear Filters, ErrorState with 'Reference: abc123' and Try Again, silent status after a failed load
expected: ResponsiveTable states: first-load SkeletonTable in an aria-busy LoadingRegion ('Loading users…' then 'Users loaded.'), empty and no-matches copy with Clear Filters, ErrorState with 'Reference: abc123' and Try Again, silent status after a failed load
result: pass
source: automated
coverage_id: 02-13/D2
verified_by: web/src/ui/gaps/ResponsiveTable.test.tsx#first load / empty / error describes

### 79. [02-13] Keep-previous refetch: no mark at 150 ms, .is-refetching at 250 ms with rows still rendered and focusable, swap in place; useDelayedFlag flips after the delay and resets at once; spec-gaps.css colours td and phone cards --surface-2 with no opacity
expected: Keep-previous refetch: no mark at 150 ms, .is-refetching at 250 ms with rows still rendered and focusable, swap in place; useDelayedFlag flips after the delay and resets at once; spec-gaps.css colours td and phone cards --surface-2 with no opacity
result: pass
source: automated
coverage_id: 02-13/D3
verified_by: web/src/ui/gaps/ResponsiveTable.test.tsx#ResponsiveTable: refetching keeps the old rows; web/src/ui/gaps/useDelayedFlag.test.tsx; web/src/styles/overrides.test.ts#ResponsiveTable refetching: every td and each phone card turn --surface-2, by colour only (D-02)

### 80. [02-13] Pagination: hidden for 0/1 pages, nav 'Pagination', 'Page 2 of 5' with strong numbers, disabled ends, names 'Previous page'/'Next page', focus target, Rows per page 10/20/50/100, phone icon-only CSS
expected: Pagination: hidden for 0/1 pages, nav 'Pagination', 'Page 2 of 5' with strong numbers, disabled ends, names 'Previous page'/'Next page', focus target, Rows per page 10/20/50/100, phone icon-only CSS
result: pass
source: automated
coverage_id: 02-13/D4
verified_by: web/src/ui/gaps/Pagination.test.tsx; web/src/styles/overrides.test.ts#Pagination (two cases)

### 81. [02-13] SearchBox, FilterBar, ResultBar, FilterChip: App. E.7 markup, type search + maxLength 100, Enter submits, 'Showing 1 order' / 'Showing 12 orders · sorted by due date', chip 'Status: Active + recent' with 'Clear status filter', four chips pass axe; chips wrap 8px apart with ellipsis labels
expected: SearchBox, FilterBar, ResultBar, FilterChip: App. E.7 markup, type search + maxLength 100, Enter submits, 'Showing 1 order' / 'Showing 12 orders · sorted by due date', chip 'Status: Active + recent' with 'Clear status filter', four chips pass axe; chips wrap 8px apart with ellipsis labels
result: pass
source: automated
coverage_id: 02-13/D5
verified_by: web/src/ui/gaps/FilterBar.test.tsx; web/src/styles/overrides.test.ts#FilterBar chips: the result bar and the chip group wrap 8px apart, and a long chip label ends in an ellipsis

### 82. [02-13] WEB-10 end to end through createListParams: Next = one push page=2 with focus moved; Rows per page 50 from page 3 = one replace ?size=50; chip clear = one replace dropping status and page; typing 'jersey' = one replace after 300 ms; Enter writes at once
expected: WEB-10 end to end through createListParams: Next = one push page=2 with focus moved; Rows per page 50 from page 3 = one replace ?size=50; chip clear = one replace dropping status and page; typing 'jersey' = one replace after 300 ms; Enter writes at once
result: pass
source: automated
coverage_id: 02-13/D6
verified_by: web/src/ui/gaps/listState.integration.test.tsx

### 83. [02-13] Skeleton family, LoadingRegion, ErrorState, LazyImage complete with axe in every state (SkeletonText/Card/Image sizes, LoadingRegion edges, ErrorState reference rules, LazyImage loading/loaded/error/priority/ratio)
expected: Skeleton family, LoadingRegion, ErrorState, LazyImage complete with axe in every state (SkeletonText/Card/Image sizes, LoadingRegion edges, ErrorState reference rules, LazyImage loading/loaded/error/priority/ratio)
result: pass
source: automated
coverage_id: 02-13/D7
verified_by: web/src/ui/gaps/Skeletons.test.tsx, LoadingRegion.test.tsx, ErrorState.test.tsx, LazyImage.test.tsx; web/src/styles/overrides.test.ts#LazyImage: the reserved box clips a cover image, the skeleton fills it, and the fallback shows no label chip

## Summary

total: 83
passed: 78
issues: 0
pending: 0
skipped: 2
blocked: 3

## Gaps

- gap_id: G-02-2
  truth: "After a production build, the API serves only the app's files from wwwroot; build internals such as .vite/license.md are never served."
  status: resolved
  resolved_by: 02-19-PLAN.md
  resolved_at: 2026-10-08
  reason: "Found by Claude during automated UAT (owner away): GET /.vite/license.md returns 200 text/markdown and lists every bundled dependency with its exact version."
  severity: minor
  test: 2
  root_cause: "Two causes, both required. (1) web/vite.config.ts build.license: true with outDir ../src/Csps.Server/wwwroot makes Vite emit .vite/license.md into the API web root on every production, e2e and budget build. (2) src/Csps.Server/Program.cs:78 UseStaticFiles has no path filter or allow-list: PhysicalFileProvider ExclusionFilters.Sensitive checks only the LAST path name (license.md), never parent dot folders (.vite), and .md maps to text/markdown, so the {*path:file} ProblemDetails 404 never runs. Case and encoded variants (/.VITE/LICENSE.MD, /%2Evite/license.md) and any file in any dot folder with a known extension (.json, .txt) are served the same way. Tests missed it: the fixture webroot has no dot folder and SpaHostTests never asserts that an existing non-app file is refused; build-config.test.ts:18 pins license: true. Nothing consumes the file (third-party-notices.mjs reads the npm tree). dotnet publish happens to drop dot folders, but dotnet run, the e2e host (web/.e2e-dist) and the planned 02-17 Lighthouse host serve it. CWE-200/CWE-538/CWE-497, low impact (anonymous, read-only, no secrets)."
  artifacts:
    - path: "src/Csps.Server/Program.cs"
      issue: "UseStaticFiles (line 78) serves any existing file, including files inside dot-prefixed folders"
    - path: "web/vite.config.ts"
      issue: "build.license: true writes .vite/license.md into the served outDir"
    - path: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs"
      issue: "no test that an existing file under a dot-prefixed folder is refused"
    - path: "tests/Csps.Testing/Fixtures/webroot/"
      issue: "no dot-folder fixture"
  missing:
    - "Static files refuse any decoded path segment that starts with a dot (case-insensitive), so the request falls through to the {*path:file} anonymous ProblemDetails 404 (option A; no owner decision needed)"
    - "Regression fixture Fixtures/webroot/.vite/license.md plus a SpaHostTests theory asserting the 404 ProblemDetails for /.vite/license.md, /.VITE/LICENSE.MD, /%2Evite/license.md and a nested /.x/y.txt"
    - "Owner ruling on the license file itself and on whether visitors can read third-party credits (D-10) is parked as D-BL-04 in backlog 999.1; the fix must not decide it"
  debug_session: ".planning/debug/wwwroot-vite-license-served.md"

## Deferred Follow-Ups

- test: 6
  idea: "Check on the Phase 8 order screens and the Discount modal that server totals replace the client preview after a save (02-04 D7, D-09)."
  deferred_at: 2026-10-08
- test: 8
  idea: "Review the shared list-query defaults (staleTime 30 s, gcTime 5 min, refetchOnWindowFocus true, retry false) per list screen as later phases build them, and override per query where needed (02-08 D10)."
  deferred_at: 2026-10-08
