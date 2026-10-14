---
status: diagnosed
phase: 02-web-foundation-design-system
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md, 02-08-SUMMARY.md, 02-09-SUMMARY.md, 02-10-SUMMARY.md, 02-11-SUMMARY.md, 02-12-SUMMARY.md, 02-13-SUMMARY.md, 02-14-SUMMARY.md, 02-15-SUMMARY.md, 02-16-SUMMARY.md, 02-17-SUMMARY.md, 02-18-SUMMARY.md, 02-19-SUMMARY.md, 02-20-SUMMARY.md, 02-21-SUMMARY.md, 02-22-SUMMARY.md, 02-23-SUMMARY.md, 02-24-SUMMARY.md, 02-25-SUMMARY.md, 02-26-SUMMARY.md, 02-27-SUMMARY.md, 02-28-SUMMARY.md, 02-29-SUMMARY.md, 02-30-SUMMARY.md, 02-31-SUMMARY.md, 02-32-SUMMARY.md, 02-33-SUMMARY.md, 02-34-SUMMARY.md, 02-35-SUMMARY.md, 02-36-SUMMARY.md, 02-37-SUMMARY.md, 02-38-SUMMARY.md, 02-39-SUMMARY.md, 02-40-SUMMARY.md]
started: 2026-10-13T10:53:22-05:00
created: 2026-10-13T10:53:22-05:00
updated: 2026-10-13T20:10:00-05:00
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state. Start the application from scratch. Server boots without errors, and a primary query (health check, homepage load) returns live data.
result: pass
source: automated
evidence: |
  Run 2026-10-13 ~10:50 -05:00 by the UAT-prep agent on HEAD 1824d94.
  - Preflight (C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199): all four ports free, no dev/test processes, no TheBETSLLC test processes.
  - Fresh production build: `npm --prefix web run build` exit 0, no warning lines, written to src/Csps.Server/wwwroot (index-Dqcc87oJ.js 122.31 kB gz, index-Hzxc5V1b.css 13.05 kB gz).
  - Fresh API host: `dotnet run --project src/Csps.Server --launch-profile http` (ASPNETCORE_ENVIRONMENT=Development set by the launch profile for that one process only), "Now listening on: http://localhost:5115", no ERR/WRN/FTL log lines.
  - GET /health -> 200 application/json, Cache-Control no-store, body {"status":"Healthy"} with self, database and time-zone checks Healthy.
  - GET / -> 200 text/html, Cache-Control no-cache, the built app shell (<div id="root">, hashed module script and stylesheet, no inline script or style).
  - Strict CSP header on /, /health and the API 404: default-src 'self'; script-src 'self'; style-src 'self'; ... object-src 'none'; frame-ancestors 'none' (no unsafe-inline / unsafe-eval), plus nosniff, Referrer-Policy, Permissions-Policy, COOP.
  - Deep link /products -> 200 text/html (shell fallback); hashed JS and CSS assets -> 200; GET /api/v1/nope -> 404 application/problem+json "We couldn't find that." with traceId.
  - Stopped only the process started for this test (Csps.Server.exe PID 13844); port 5115 confirmed free afterwards.
  Limit: run in Development (Production redirects to HTTPS and needs the host-secret certificate); the Production 500 body and minimal /health body are covered by the .NET integration tests.

### 2. Owner visual review of the Phase 2 look (D-23 report and D-24 side-by-side)
expected: Open C:\Work\CarmensStitchAndPrintingServices\artifacts\owner-review\index.html and artifacts\owner-review\side-by-side\index.html. The public layout (Blush), the admin frame and the Component Showcase, in Blush and Espresso at 390, 820 and 1440 px, look like the approved design. The placeholder page reads like the approved page head (eyebrow, uppercase italic heading with the accent word, lead line). The 56 icons, the filter toolbar and the order-item row look right. The 16 intentional differences listed in the report match what was decided. Each difference you name becomes a fix.
result: pass
source_plans: [02-36 (legacy SUMMARY), 02-02 D5, 02-20 D6, 02-34 D5, 02-40 D6]
why_human: The look approval belongs to the owner and is the BLOCKING end-of-phase check (plan 02-36, ROADMAP SC2, WEB-02). The automated parity proof (452/452 in Chromium, Firefox, WebKit) compares against the spec's own code, not the owner's eye. 02-02 D5 / 02-20 D6 / 02-40 D6 are looks that only the parity harness or the screenshots show.
note: The pack was generated at 05:06 on 2026-10-13, BEFORE the code-review fixes. Regenerate it first with `npm --prefix web run review` (run the preflight first; it uses port 5199 and the CSPS_E2E database). The side-by-side is regenerated with `node web/scripts/design-side-by-side.mjs`. How to read both: docs/web/owner-review.md.

### 3. SPEC-GAP parts look like they belong (no approved design to compare with)
expected: In the review pack's SPEC-GAP section (27 cases x 2 themes) - Pagination, OtpInput, MoneyInput, Checkbox, SkipLink, the list states, ErrorState, skeletons, LoadingRegion, LazyImage, the admin drawer and the user menu popover - each part looks like it belongs with the approved design in both Blush and Espresso.
result: pass
source_plans: [02-27 D6, 02-28 D7, 02-32 D4, 02-36]
why_human: SPEC-GAP primitives have no approved reference, so no automated comparison exists; the UI-SPEC routes them to the owner's D-23 screenshot review.

### 4. Long text wraps inside its box (showcase backstop)
expected: In the review pack's Component Showcase shots, the long toast message, the long field error and the long EmptyState message each wrap inside their box (toast text as a column; EmptyState message at most 380px wide) with no overflow and nothing cut off.
result: pass
source_plans: [02-34 D5, 02-VERIFICATION truth 23]
why_human: The backstop truth's evidence is defined as the D-23 screenshots; no test measures these three cases directly.

### 5. Money preview is never shown as the saved figure (rule for later phases)
expected: You agree the rule stands - totals the browser works out (csps.ts orderTotals) are only ever labelled and shown as a preview; once an order is saved, screens show the server's figures. (Today no Phase 2 screen saves or shows a saved order; Phase 8 order screens must follow this.)
result: pass
source_plans: [02-07 D6, 02-VERIFICATION prohibition]
why_human: Judgment-tier prohibition; no test can enforce it until order screens exist. Verifier's non-authoritative judgment: it holds today.

### 6. Order math naming decision (NET-WR-02, settle before Phase 5)
expected: You pick one - (a) the PRD naming: "Subtotal" is the amount before discounts and "Total" = Subtotal - Discount, renamed across OrderMath.cs, csps.ts and the 220 golden test cases; or (b) keep the design's naming ("Total" before discounts) as a recorded difference from the PRD. The choice is recorded.
result: pass
source: owner ruling D-41 R2-06
evidence: Owner chose the PRD names (Subtotal before discount, Total after discount); implemented in quick-261013-ihp. The before/after wording is confirmed visually in test 2.
source_plans: [02-VERIFICATION human item 4, deferred-items.md "Order math naming"]
why_human: Owner decision on the meaning of a Core Value figure. Cheap to rename now, expensive after Phase 5 builds on the name.

### 7. No sideways scroll from 320 to 1920 px (verifier gap 1)
expected: Every page, public and admin, fits the screen from 320 to 1920 px wide with no sideways scrolling - including the admin top bar on phones narrower than about 418 px (e.g. iPhone 15 at 393 px) and list tables at tablet width (768 px).
result: pass
source: owner ruling D-41 R2-01/R2-02 + automated
evidence: min-w-0 on the Topbar search and contain-paint on the table frame (quick-261013-g6s). 02-VERIFICATION gap 1 CLOSED: responsive.spec plain scrollWidth <= innerWidth on every page in 5 browser projects, lists-overflow.spec at 768/820 in 3 engines.
source_plans: [02-30 D6, 02-31 D8, 02-35 D3, 02-VERIFICATION gap 1 (truth 7, SC2/PERF-03)]
note: Awaiting owner ruling (deferred-items.md "Admin top bar: the page scrolls sideways on phones narrower than 398px" and "Tablet list tables: the page can scroll sideways by 22px"). The verifier marked this FAILED - today the admin Topbar overflows by 8-98 px below 398/406/418 px (Chromium/WebKit/Firefox) and the 768 px list table lets the page scroll 22 px. The automated sweep (02-35 D3, web/e2e/responsive.spec.ts TOPBAR_MIN_PAGE_WIDTH) and web/visual/lists-overflow.spec.ts pass only by encoding these as exceptions. Recommended fix: min-w-0 on the Topbar search box and a containing block on the table frame, each with a rulings.css rule, then remove the exemptions. When resuming, record the ruling; this item passes only after the fix lands and the plain scrollWidth <= innerWidth check runs at every width in every engine. Deferring to the Phase 14 release gate needs an explicit owner override.

### 8. WCAG-conflict rulings applied: SearchBox focus ring and "/" shortcut (verifier gap 2)
expected: Tabbing into a list search box shows a clearly visible focus indicator (WCAG 2.4.7 AA), and the admin "/" search shortcut can be turned off or needs a modifier key (WCAG 2.1.4 A). Each has an owner ruling recorded and applied.
result: pass
source: owner ruling D-41 R2-03/R2-04 + automated
evidence: list search border turns --focus (contrast node test), '/' replaced by Ctrl/Cmd+K (quick-261013-g6s, refined by quick-261013-lgi WR-01). 02-VERIFICATION gap 2 CLOSED. Hands-on check of the shortcut is test 197.
source_plans: [02-30 D7, 02-VERIFICATION gap 2 (truth 18, SC5/A11Y-04, A11Y-02 "visible focus")]
note: Awaiting owner ruling (deferred-items.md "Search box: no visible keyboard focus ring" and "Admin search shortcut \"/\""). The verifier marked this FAILED - searchInputClasses in web/src/ui/lists/lists.recipe.ts sets [outline:none] with no replacement focus style, and the "/" shortcut in web/src/ui/navigation/Topbar.tsx has no off switch or modifier. The two reflow items in test 7 also fail WCAG 1.4.10. The review recommends option (b) for "/", a keyboard-shortcuts switch that keeps the approved look. This item passes only after the rulings are applied (recipe change + rulings.css rule + a Playwright focus-indicator check), or the owner records an override deferring them to the Phase 14 release gate.

### 9. Screen-reader and real-phone spot checks (NVDA / VoiceOver)
expected: With NVDA (Windows) or VoiceOver (iPhone), on /dev/components: toasts are announced once through the polite live region; a dialog announces its name, and the cascade and failure alerts are read; the order totals list is read with the note as a definition and the KPI change direction is clear; chart month groups and the scrolling table region are read sensibly, and the focus ring on a chart month is clear; the image uploader (browse button, thumbnail list, "No image yet") and the star rating are announced sensibly; on a real phone the thumbnail actions are comfortable to tap.
result: pass
source_plans: [02-21 D6, 02-22 D6, 02-23 D4, 02-24 D4, 02-25 D4]
why_human: jsdom and axe check roles and names, not what a real screen reader announces or how it feels on a real phone. A11Y-05 owns the manual passes; these may be deferred to that pass if preferred (record as skipped with the reason).

### 10. "Get a Quote" stays a button
expected: You confirm the public "Get a Quote" call to action stays a button that navigates (as in the approved design), or say it should become a link.
result: pass
source: owner ruling D-41 R2-11
evidence: Owner: keep "Get a Quote" as a button, no change.
source_plans: [02-26 D5]
why_human: Element choice for the public CTA is an owner look/ARIA decision (D-08); the plan asked for a link, the approved design has a button.

### 11. Meaning of "intent prefetch" (WEB-08 assumption)
expected: You confirm that "prefetch on intent" means - start loading a page's data after about 100 ms of hovering over or focusing its link, and do not prefetch on a touch device's first tap.
result: pass
source_plans: [02-39 D5]
why_human: Flagged planner assumption to confirm at verify time; only the owner can confirm the meaning.

### 12. Owner-facing docs read clearly in plain words
expected: docs/dependencies.md (the npm registry and the tool-only licenses), docs/web/budgets.md (size limits, the 135 KB trigger, what to do when over), docs/web/release-gates.md (every gate, its command and pass rule, the preflight, the run order) and docs/web/owner-review.md (how to make and read the review pack) each read clearly to you.
result: pass
source_plans: [02-06 D5, 02-33 D5, 02-35 D8, 02-36]
why_human: Documentation clarity for the owner is a reading judgment no test asserts.

### 13. Developer guides are clear and complete
expected: docs/development.md ("How the API serves the web app"), docs/web/styling.md (D-33 rules, tw() recipes, the 12 custom variants, banned built-ins, gates), docs/web/e2e.md (prerequisites, preflight, --grep tags, run lock, busy-port refusal, HTTPS, never-kill rule), docs/web/url-state.md (createListParams, push/replace, privacy, dates, 300 ms debounce, Query defaults, useListQuery, intent prefetch) and docs/web/parity.md (what the proof compares, running it, adding scenarios, the matrix, the differences list, conversion rules) are clear enough for a new developer or a later phase.
result: pass
source_plans: [02-03 D5, 02-05 D6, 02-09 D4, 02-11 D6, 02-13 D4, 02-14 D9]
why_human: Editorial judgment; the greps only prove the sections exist. The owner may delegate this to a reviewer, or skip it with a reason.

### 14. Non-blocking look and copy rulings (deferred-items.md "Owner decisions pending")
expected: You give a ruling (or "keep as is") on each - the ErrorState "Try Again" label colour; the small muted name and initials in the Users table user cell; the admin preview pages' empty-state words; the two extra Component Showcase sections and the demo button words (incl. "Open Delete Payment"); public footer headings jumping from h1 to h4; a message when a money paste is refused; an overpaid order showing only "Fully Paid"; the Barlow Condensed fallback trying Arial Narrow first; the .npmrc cool-down waivers naming a package, not a version, with no end date. FYI items (tablet rail names, no current sidebar item on the showcase, danger toasts announced politely once) need nothing unless you object.
result: pass
source: owner rulings D-41 R2-13..R2-19, R2-25, R2-26
evidence: Try Again muted (keep), Users name 12px muted (keep), empty-state words (keep), Showcase extras (keep), footer h2 (implemented), money paste hint (implemented), Arial Narrow fallback (keep), .npmrc waivers (keep), FYIs accepted. Recorded in 999.1/DECISIONS.md.
source_plans: [02-28 D7, 02-30 D7, 02-31 D8, 02-34, 02-35, code review UI-WR-09, UI-WR-14, TOOL-WR-11, TOOL-WR-13]
why_human: Owner look/copy/policy preferences; they block nothing, but each answer becomes a small follow-up or a recorded "keep".

### 15. ₱ renders in the Archivo font in a real browser
expected: The peso sign renders in Archivo Variable (falling through from Barlow to Archivo), never in a system font.
result: pass
source: automated
coverage_id: 02-12/D4 (resolved by 02-35/D4)
note: 02-12 classified this as a human checkpoint because its browser proof belonged to plan 02-35; 02-35 D4 ("₱ renders in Archivo Variable; one font preload; same-origin woff2 only") is auto-passed with passing verification, so no human check is needed.

### 16. [02-01] Anonymous GET/HEAD on page paths (/, /products, /admin/orders) returns the fixture shell as text/html with the strict CSP and Cache-Control no-cache
expected: Anonymous GET/HEAD on page paths (/, /products, /admin/orders) returns the fixture shell as text/html with the strict CSP and Cache-Control no-cache
result: pass
source: automated
coverage_id: 02-01/D1
requirement: WEB-01
verified_by: tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#NonFilePathsServeTheShell; tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#HeadServesTheShell; tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#ExistingFileIsServed

### 17. [02-01] Unknown /api paths, missing files (GET and POST) and, outside Development, /openapi and /scalar prefixes answer anonymous ProblemDetails 404s; POST to a page path stays 401
expected: Unknown /api paths, missing files (GET and POST) and, outside Development, /openapi and /scalar prefixes answer anonymous ProblemDetails 404s; POST to a page path stays 401
result: pass
source: automated
coverage_id: 02-01/D2
requirement: WEB-01
verified_by: tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#UnknownApiRouteIsStillProblem404; tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#MissingFileIsProblem404; tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#ReservedDocsPathsAre404OutsideDevelopment; tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs#UnservedMethodOnAPagePathIsChallenged; tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs#ProductionMapsOnlyTheReservedDocsFallbacks; tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs#ProductionHasNoApiDocs

### 18. [02-01] Default-deny is kept: all five new endpoint keys have matrix rows and allow-list entries, and discovery finds no unlisted endpoint
expected: Default-deny is kept: all five new endpoint keys have matrix rows and allow-list entries, and discovery finds no unlisted endpoint
result: pass
source: automated
coverage_id: 02-01/D3
requirement: WEB-01
verified_by: tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#DiscoveredEndpointsAreFullyCovered; tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus

### 19. [02-01] The whole Csps.Server.IntegrationTests project passes with no src/Csps.Server/wwwroot folder, rebuilt from scratch without it
expected: The whole Csps.Server.IntegrationTests project passes with no src/Csps.Server/wwwroot folder, rebuilt from scratch without it
result: pass
source: automated
coverage_id: 02-01/D4
requirement: WEB-01
verified_by: mv src/Csps.Server/wwwroot aside; dotnet build tests/Csps.Server.IntegrationTests; dotnet test --project tests/Csps.Server.IntegrationTests (210/210)

### 20. [02-02] Owner-approved toolchain installed at exact pins with a committed lockfile, npm ci reproducible, npm audit --audit-level=high reports 0, nothing deprecated
expected: Owner-approved toolchain installed at exact pins with a committed lockfile, npm ci reproducible, npm audit --audit-level=high reports 0, nothing deprecated
result: pass
source: automated
coverage_id: 02-02/D1
requirement: WEB-01
verified_by: npm --prefix web ci; npm --prefix web audit --audit-level=high; npm ls --depth=0

### 21. [02-02] Production build writes a CSP-safe index.html, one hashed CSS and one hashed module JS into the git-ignored src/Csps.Server/wwwroot, with no source map and no .vite folder
expected: Production build writes a CSP-safe index.html, one hashed CSS and one hashed module JS into the git-ignored src/Csps.Server/wwwroot, with no source map and no .vite folder
result: pass
source: automated
coverage_id: 02-02/D2
requirement: WEB-01
verified_by: web/src/test/build-output.node.test.ts#production build output in src/Csps.Server/wwwroot; npm --prefix web run build (exit 0, no warning lines)

### 22. [02-02] Built CSS carries the CSPS token theme (both theme blocks, .bg-bg reads var(--bg)) and none of Tailwind's default palette, radii or shadows
expected: Built CSS carries the CSPS token theme (both theme blocks, .bg-bg reads var(--bg)) and none of Tailwind's default palette, radii or shadows
result: pass
source: automated
coverage_id: 02-02/D3
requirement: WEB-02
verified_by: web/src/test/build-output.node.test.ts#compiles the CSPS token theme: both theme blocks and token-backed utilities; web/src/test/build-output.node.test.ts#carries none of Tailwind's default palette, radii or shadows

### 23. [02-02] Web and generator text files are LF in the index and every checkout; editors use 2-space indent for web files
expected: Web and generator text files are LF in the index and every checkout; editors use 2-space indent for web files
result: pass
source: automated
coverage_id: 02-02/D4
requirement: QUAL-02
verified_by: git check-attr eol -- web/package.json web/src/main.tsx tools/openapi-gen/package.json (all eol: lf); git ls-files --eol (i/lf)

### 24. [02-03] Any web-root file under a dot-prefixed or tilde segment (/.vite/license.md, /.VITE/LICENSE.MD, /%2Evite/license.md, /assets%5C..%5C.vite%5Clicense.md, /VITE~1/license.md, /.x/y.txt) answers the anonymous ProblemDetails 404 with no ETag, Last-Modified or Accept-Ranges, for GET and HEAD, identical to a missing file
expected: Any web-root file under a dot-prefixed or tilde segment (/.vite/license.md, /.VITE/LICENSE.MD, /%2Evite/license.md, /assets%5C..%5C.vite%5Clicense.md, /VITE~1/license.md, /.x/y.txt) answers the anonymous ProblemDetails 404 with no ETag, Last-Modified or Accept-Ranges, for GET and HEAD, identical to a missing file
result: pass
source: automated
coverage_id: 02-03/D1
requirement: WEB-01
verified_by: tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs#DotFolderFilesAre404; tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs#IsHiddenRules; tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs#DirectoryListingsHideSegments

### 25. [02-03] Real files keep being served: /assets/app-fixture.js answers 200 text/javascript
expected: Real files keep being served: /assets/app-fixture.js answers 200 text/javascript
result: pass
source: automated
coverage_id: 02-03/D2
requirement: WEB-01
verified_by: tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#ExistingFileIsServed; tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs#RealWebRootAppFileIsUnchanged

### 26. [02-03] The shell and static js are Brotli-compressed when the client accepts br, gzip; /health JSON and /api ProblemDetails are never compressed
expected: The shell and static js are Brotli-compressed when the client accepts br, gzip; /health JSON and /api ProblemDetails are never compressed
result: pass
source: automated
coverage_id: 02-03/D3
requirement: PERF-02
verified_by: tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#CompressesStaticText; tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#NeverCompressesJson

### 27. [02-03] /assets/* carry Cache-Control public, max-age=31536000, immutable; /robots.txt, /index.html and the shell at / carry no-cache
expected: /assets/* carry Cache-Control public, max-age=31536000, immutable; /robots.txt, /index.html and the shell at / carry no-cache
result: pass
source: automated
coverage_id: 02-03/D4
requirement: PERF-02
verified_by: tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#AssetsAreImmutable; tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#OtherStaticFilesRevalidate

### 28. [02-04] npm run verify runs typecheck, lint, format:check, test:coverage and build in that order and stops at the first failing step with its exit code; it is green on the scaffold
expected: npm run verify runs typecheck, lint, format:check, test:coverage and build in that order and stops at the first failing step with its exit code; it is green on the scaffold
result: pass
source: automated
coverage_id: 02-04/D1
requirement: QUAL-02
verified_by: web/scripts/verify.test.ts#verify pipeline (5 cases); npm --prefix web run verify (exit 0; 130 tests; coverage 100% statements/branches/functions/lines; build ok)

### 29. [02-04] Lint fails on any warning and no resolved rule is at warn level for src, scripts and e2e files; shared-config warns are escalated with options kept; unused disable directives are errors; a pattern matching no files rejects
expected: Lint fails on any warning and no resolved rule is at warn level for src, scripts and e2e files; shared-config warns are escalated with options kept; unused disable directives are errors; a pattern matching no files rejects
result: pass
source: automated
coverage_id: 02-04/D2
requirement: QUAL-02
verified_by: web/src/test/eslint-config.node.test.ts#eslint.config.mjs (12 cases); npm --prefix web run lint (eslint . --max-warnings 0, exit 0, no findings)

### 30. [02-04] Every WEB-04, D-19, nuqs, CWE-79, D-33 and QUAL-02 ban fires with its exact rule id and message, stays quiet where allowed, and still fires inside every override block (lib/http, api.ts, main.tsx, visual/reference)
expected: Every WEB-04, D-19, nuqs, CWE-79, D-33 and QUAL-02 ban fires with its exact rule id and message, stays quiet where allowed, and still fires inside every override block (lib/http, api.ts, main.tsx, visual/reference)
result: pass
source: automated
coverage_id: 02-04/D3
requirement: WEB-04
verified_by: web/src/test/lint-rules.node.test.ts (54 architecture/markup/import/override cases)

### 31. [02-04] better-tailwindcss reports cleared-theme defaults as unknown, p-4 p-2 as conflicting, hex/rgb/oklch literals and the max-*, @max-*, @min-*, enabled: variants as restricted; spec variants and theme classes are clean; Prettier sorts className/clsx/tw classes deterministically
expected: better-tailwindcss reports cleared-theme defaults as unknown, p-4 p-2 as conflicting, hex/rgb/oklch literals and the max-*, @max-*, @min-*, enabled: variants as restricted; spec variants and theme classes are clean; Prettier sorts className/clsx/tw classes deterministically
result: pass
source: automated
coverage_id: 02-04/D4
requirement: QUAL-02
verified_by: web/src/test/lint-rules.node.test.ts#D-36 Tailwind class rules against the CSPS theme (17 cases); web/src/test/eslint-config.node.test.ts#Prettier with prettier-plugin-tailwindcss (D-36) (3 cases)

### 32. [02-04] expectNoAxeViolations runs axe-core 4.13 with the WCAG 2.0/2.1/2.2 A+AA tags, rejects an empty container, sorts violations by id then target; the placeholder page passes it with exactly one h1 named 'Site update in progress.'
expected: expectNoAxeViolations runs axe-core 4.13 with the WCAG 2.0/2.1/2.2 A+AA tags, rejects an empty container, sorts violations by id then target; the placeholder page passes it with exactly one h1 named 'Site update in progress.'
result: pass
source: automated
coverage_id: 02-04/D5
requirement: A11Y-01
verified_by: web/src/test/axe.test.tsx#expectNoAxeViolations (6 cases); web/src/app/public/PublicPlaceholderPage.test.tsx (4 cases)

### 33. [02-04] Any console.error or console.warn during a Vitest test fails that test; console.info passes
expected: Any console.error or console.warn during a Vitest test fails that test; console.info passes
result: pass
source: automated
coverage_id: 02-04/D6
requirement: QUAL-02
verified_by: web/src/test/consoleGuard.test.ts#console guard (7 cases); throwaway probe test (deleted): console.error and console.warn tests failed with 'Unexpected console output in this test', a quiet test passed

### 34. [02-05] web/src/styles holds exactly app.css and base.css, with only the allowed constructs; a class selector, @apply or @utility fails and is named
expected: web/src/styles holds exactly app.css and base.css, with only the allowed constructs; a class selector, @apply or @utility fails and is named
result: pass
source: automated
coverage_id: 02-05/D1
requirement: WEB-02
verified_by: web/src/styles/stylesheet-contract.node.test.ts (19 tests)

### 35. [02-05] Every class token in src compiles against the CSPS theme; cleared defaults and typos are reported as unknown, CSPS theme names pass
expected: Every class token in src compiles against the CSPS theme; cleared defaults and typos are reported as unknown, CSPS theme names pass
result: pass
source: automated
coverage_id: 02-05/D2
requirement: WEB-02
verified_by: web/scripts/tailwind-classes.test.ts#checkClassTokens + the real source

### 36. [02-05] No class token carries a hex, rgb( or oklch( colour literal
expected: No class token carries a hex, rgb( or oklch( colour literal
result: pass
source: automated
coverage_id: 02-05/D3
requirement: WEB-02
verified_by: web/scripts/tailwind-classes.test.ts#reports rgb( and oklch( colour literals

### 37. [02-05] The custom variants emit the exact spec query text, and hover: is a plain :hover
expected: The custom variants emit the exact spec query text, and hover: is a plain :hover
result: pass
source: automated
coverage_id: 02-05/D4
requirement: WEB-02
verified_by: web/scripts/tailwind-classes.test.ts#the custom variants emit the exact spec query text

### 38. [02-05] opacity-* is accepted only from the D-02/D-05 allow-list, by file
expected: opacity-* is accepted only from the D-02/D-05 allow-list, by file
result: pass
source: automated
coverage_id: 02-05/D5
requirement: A11Y-04
verified_by: web/scripts/tailwind-classes.test.ts#allows the thumb reveal opacity only in the ImageUploader files (D-05)

### 39. [02-06] The architecture tests read both npm manifests (deps, devDeps, overrides; aliases resolved; manifest-qualified ids) and fail on any unregistered, mismatched, unsorted or ranged npm pin; the real registry passes
expected: The architecture tests read both npm manifests (deps, devDeps, overrides; aliases resolved; manifest-qualified ids) and fail on any unregistered, mismatched, unsorted or ranged npm pin; the real registry passes
result: pass
source: automated
coverage_id: 02-06/D1
requirement: WEB-01
verified_by: tests/Csps.ArchitectureTests/DependencyRegistryTests.cs (51 cases, 18 new npm cases); dotnet test --project tests/Csps.ArchitectureTests (97/97)

### 40. [02-06] The npm license gate passes only when the shipped tree uses the allow-list plus OFL-1.1 fonts and the dev/build/tool trees add only the D-26 + addendum exceptions within their scopes; a stricter policy, an unused exception or an unused scope fails with exit 1
expected: The npm license gate passes only when the shipped tree uses the allow-list plus OFL-1.1 fonts and the dev/build/tool trees add only the D-26 + addendum exceptions within their scopes; a stricter policy, an unused exception or an unused scope fails with exit 1
result: pass
source: automated
coverage_id: 02-06/D2
requirement: WEB-01
verified_by: web/scripts/license-policy.test.ts (51 cases, including the --exceptions CLI proof); node web/scripts/license-gate.mjs (exit 0: 16 production, 535 dev/build/tool packages); with an empty npmLicenseExceptions list (exit 1)

### 41. [02-06] web/THIRD-PARTY-NOTICES.txt lists every shipped package with exact version, license, repository and full license text; notices:check fails on drift and names the first differing package
expected: web/THIRD-PARTY-NOTICES.txt lists every shipped package with exact version, license, repository and full license text; notices:check fails on drift and names the first differing package
result: pass
source: automated
coverage_id: 02-06/D3
requirement: WEB-01
verified_by: web/scripts/third-party-notices.test.ts (11 cases, including --check / --write CLI proofs); npm --prefix web run notices:check (up to date, 16 packages)

### 42. [02-06] npm run verify runs license:check and notices:check after the build and is green
expected: npm run verify runs license:check and notices:check after the build and is green
result: pass
source: automated
coverage_id: 02-06/D4
requirement: WEB-01
verified_by: web/scripts/verify.test.ts#runs typecheck, lint, format:check, test:coverage, build, license:check and notices:check in that order; npm --prefix web run verify (exit 0; 15 files, 280 tests; build ok; license gate passed; notices up to date)

### 43. [02-07] One shared 220-case golden-vector file (8 categories incl. every section 12.2 seed order) passes identically in xUnit OrderMath and Vitest orderTotals
expected: One shared 220-case golden-vector file (8 categories incl. every section 12.2 seed order) passes identically in xUnit OrderMath and Vitest orderTotals
result: pass
source: automated
coverage_id: 02-07/D1
requirement: WEB-07
verified_by: tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs (MatchesVector x220, PinsTheOperationOrder, HasAtLeast200CasesWithUniqueIds, CoversTheCategory x8); web/src/lib/csps.golden.test.ts (231 tests: every case, operation order, >= 200 unique ids, 8 categories, spec-formula proof)

### 44. [02-07] 7.5% of 17.00 previews 1.28 (half away from zero, integer centavos); the unmodified spec round2 fails 54 of 220 vectors (37 midpoints), asserted by a test
expected: 7.5% of 17.00 previews 1.28 (half away from zero, integer centavos); the unmodified spec round2 fails 54 of 220 vectors (37 midpoints), asserted by a test
result: pass
source: automated
coverage_id: 02-07/D2
requirement: WEB-07
verified_by: web/src/lib/csps.golden.test.ts#catches the unmodified spec round2 on at least one midpoint vector (Pitfall 13); web/src/lib/csps.test.ts#round2 (D-09), discountAmount (D-09)

### 45. [02-07] node web/scripts/gen-golden-vectors.mjs --check exits 0 on the committed file and 1 on drift; the generator and both suites only read the committed file
expected: node web/scripts/gen-golden-vectors.mjs --check exits 0 on the committed file and 1 on drift; the generator and both suites only read the committed file
result: pass
source: automated
coverage_id: 02-07/D3
requirement: WEB-07
verified_by: web/scripts/gen-golden-vectors.test.ts (12 tests incl. CLI --check on the committed file without writing it, drift on a temp copy, --write repair); web/scripts/golden-math.test.ts (25 hand-worked oracle cases); node web/scripts/gen-golden-vectors.mjs --check (exit 0, 220 cases)

### 46. [02-07] App. D.2 passes unchanged against the reconciled csps.ts; formatPeso goes through centavos; csps.ts lint-clean with no eslint-disable
expected: App. D.2 passes unchanged against the reconciled csps.ts; formatPeso goes through centavos; csps.ts lint-clean with no eslint-disable
result: pass
source: automated
coverage_id: 02-07/D4
requirement: WEB-07
verified_by: web/src/lib/csps.test.ts (43 tests: the 7 App. D.2 tests plus D-09 and characterization cases); npm --prefix web run verify (exit 0; coverage 100% statements/lines, 98.8% branches)

### 47. [02-07] Csps.Domain stays at 100% line and branch coverage with OrderMath added
expected: Csps.Domain stays at 100% line and branch coverage with OrderMath added
result: pass
source: automated
coverage_id: 02-07/D5
verified_by: tools/scripts/Invoke-CoverageGate.ps1 (Csps.Domain line 100% 320/320, branch 100% 140/140)

### 48. [02-08] formatBusinessDate('2026-10-05T16:30:00Z') is 'Oct 6, 2026' and '2026-12-31T16:00:00Z' is 'Jan 1, 2027' on machines in America/Chicago, Pacific/Kiritimati and Pacific/Pago_Pago; invalid or zone-less input is an em dash
expected: formatBusinessDate('2026-10-05T16:30:00Z') is 'Oct 6, 2026' and '2026-12-31T16:00:00Z' is 'Jan 1, 2027' on machines in America/Chicago, Pacific/Kiritimati and Pacific/Pago_Pago; invalid or zone-less input is an em dash
result: pass
source: automated
coverage_id: 02-08/D1
requirement: ORD-09
verified_by: web/src/lib/format.test.ts#formatBusinessDate

### 49. [02-08] formatCalendarDate('2026-10-06') is 'Oct 6, 2026' with no zone shift; impossible dates (2026-02-30, 2026-02-29, month 13) are an em dash
expected: formatCalendarDate('2026-10-06') is 'Oct 6, 2026' with no zone shift; impossible dates (2026-02-30, 2026-02-29, month 13) are an em dash
result: pass
source: automated
coverage_id: 02-08/D2
requirement: ORD-09
verified_by: web/src/lib/format.test.ts#formatCalendarDate

### 50. [02-08] Money text rules: MONEY_TEXT/isMoneyText accept and reject per the spec, normalizePastedMoney(' 12,450.00 ') is '12450.00', padMoneyOnBlur('5000') is '5000.00' and '' stays ''
expected: Money text rules: MONEY_TEXT/isMoneyText accept and reject per the spec, normalizePastedMoney(' 12,450.00 ') is '12450.00', padMoneyOnBlur('5000') is '5000.00' and '' stays ''
result: pass
source: automated
coverage_id: 02-08/D3
requirement: ORD-09
verified_by: web/src/lib/format.test.ts#isMoneyText, normalizePastedMoney, padMoneyOnBlur

### 51. [02-08] moneyTextToCentavos('0.07') is 7 and ('999999999.99') is 99999999999 exactly; centavosToMoneyText(125050) is '1250.50'; every amount 0..10000 centavos round-trips
expected: moneyTextToCentavos('0.07') is 7 and ('999999999.99') is 99999999999 exactly; centavosToMoneyText(125050) is '1250.50'; every amount 0..10000 centavos round-trips
result: pass
source: automated
coverage_id: 02-08/D4
requirement: ORD-09
verified_by: web/src/lib/format.test.ts#moneyTextToCentavos, centavosToMoneyText; npm --prefix web run verify (exit 0, 703 tests)

### 52. [02-09] npm run e2e runner: busy-port refusal (no kill), preflight -> CSPS_E2E seed -> e2e build -> playwright with no .cmd shims, stop at first failure, wx run lock that waits, times out and releases only its own file
expected: npm run e2e runner: busy-port refusal (no kill), preflight -> CSPS_E2E seed -> e2e build -> playwright with no .cmd shims, stop at first failure, wx run lock that waits, times out and releases only its own file
result: pass
source: automated
coverage_id: 02-09/D1
requirement: QUAL-04
verified_by: web/scripts/e2e.test.ts (21 tests); live check: a temporary listener on 127.0.0.1:5199 made npm run e2e print the refusal and exit 1 with the lock released

### 53. [02-09] The real API host serves the e2e build on https://localhost:5199 and / is clean (200, strict CSP, one h1 'Site update in progress.', no guard findings, axe clean) in chromium, firefox, webkit, pixel and iphone
expected: The real API host serves the e2e build on https://localhost:5199 and / is clean (200, strict CSP, one h1 'Site update in progress.', no guard findings, axe clean) in chromium, firefox, webkit, pixel and iphone
result: pass
source: automated
coverage_id: 02-09/D2
requirement: QUAL-04
verified_by: npm --prefix web run e2e -- --grep @smoke (5 passed)

### 54. [02-09] Each guard is proven to fire in all three engines: console.error, injected <style> (style-src CSP violation), unlabelled image (axe image-alt), undeclared same-origin 404 (and a declared one is not reported)
expected: Each guard is proven to fire in all three engines: console.error, injected <style> (style-src CSP violation), unlabelled image (axe image-alt), undeclared same-origin 404 (and a declared one is not reported)
result: pass
source: automated
coverage_id: 02-09/D3
requirement: A11Y-01
verified_by: npm --prefix web run e2e -- --grep @fixture (12 passed); combined @smoke|@fixture run 17 passed

### 55. [02-10] A typed GET round trip and a ProblemDetails 404/400 travel through one client: baseURL join, params (arrays repeated, null/undefined skipped), same-origin credentials, Accept JSON, default/request headers, ordered request interceptors with eject, 204/205/empty -> undefined
expected: A typed GET round trip and a ProblemDetails 404/400 travel through one client: baseURL join, params (arrays repeated, null/undefined skipped), same-origin credentials, Accept JSON, default/request headers, ordered request interceptors with eject, 204/205/empty -> undefined
result: pass
source: automated
coverage_id: 02-10/D1
requirement: WEB-03
verified_by: web/src/lib/http/httpClient.test.ts (18 cases); web/src/lib/http/HttpError.test.ts (23 cases)

### 56. [02-10] Caller abort -> aborted, timeout -> timeout, neither retried; at most 2 retries (250/500 ms, cap 2 s) only for GET/HEAD/PUT/DELETE/OPTIONS and a keyed POST, only on network error or 503; secret params rejected before sending
expected: Caller abort -> aborted, timeout -> timeout, neither retried; at most 2 retries (250/500 ms, cap 2 s) only for GET/HEAD/PUT/DELETE/OPTIONS and a keyed POST, only on network error or 503; secret params rejected before sending
result: pass
source: automated
coverage_id: 02-10/D2
requirement: WEB-03
verified_by: web/src/lib/http/httpClient.resilience.test.ts#timeout and abort / capped retries / secrets never go in a URL

### 57. [02-10] One Idempotency-Key per submission from the caller, identical on every retry and on the 401 refresh replay, never on GET/HEAD/OPTIONS, never created by the client; two calls send two requests
expected: One Idempotency-Key per submission from the caller, identical on every retry and on the 401 refresh replay, never on GET/HEAD/OPTIONS, never created by the client; two calls send two requests
result: pass
source: automated
coverage_id: 02-10/D3
requirement: WEB-09
verified_by: web/src/lib/http/httpClient.resilience.test.ts#Idempotency-Key (WEB-09) (13 cases)

### 58. [02-10] Three concurrent 401s share exactly one refresh and each retries once; a failed refresh rejects every waiter with a 401 HttpError and calls onUnauthorized once
expected: Three concurrent 401s share exactly one refresh and each retries once; a failed refresh rejects every waiter with a 401 HttpError and calls onUnauthorized once
result: pass
source: automated
coverage_id: 02-10/D4
requirement: WEB-03
verified_by: web/src/lib/http/httpClient.resilience.test.ts#single-flight 401 refresh (11 cases)

### 59. [02-10] JSON bodies, FormData passthrough, kind parse for malformed JSON, XHR upload transport only with onUploadProgress (progress, abort, timeout, same HttpError shapes), response interceptors; lib/http at 100% in every column
expected: JSON bodies, FormData passthrough, kind parse for malformed JSON, XHR upload transport only with onUploadProgress (progress, abort, timeout, same HttpError shapes), response interceptors; lib/http at 100% in every column
result: pass
source: automated
coverage_id: 02-10/D5
requirement: WEB-03
verified_by: web/src/lib/http/httpClient.transport.test.ts (23 cases); npm --prefix web run test -- --run src/lib/http --coverage --coverage.include=src/lib/http/** (100% statements 227/227, branches 131/131, functions 57/57, lines 223/223); npm --prefix web run verify (exit 0; 844 tests)

### 60. [02-11] Allow-list parsers: page below 1 or malformed -> 1, size outside 10/20/50/100 -> 20, unknown literal -> default, q trimmed and capped at 100 code units without a lone surrogate, business dates calendar-validated (2024-02-29 valid, 2026-02-29 and 2026-02-30 invalid), clampPage (0 pages -> 1)
expected: Allow-list parsers: page below 1 or malformed -> 1, size outside 10/20/50/100 -> 20, unknown literal -> default, q trimmed and capped at 100 code units without a lone surrogate, business dates calendar-validated (2024-02-29 valid, 2026-02-29 and 2026-02-30 invalid), clampPage (0 pages -> 1)
result: pass
source: automated
coverage_id: 02-11/D1
requirement: WEB-10
verified_by: web/src/lib/url-state/parsers.test.ts (93 cases)

### 61. [02-11] createListParams: an invalid URL (?page=0&size=9999&status=bogus) gives defaulted state and exactly one replace to the canonical URL, idempotent on re-render; setPage pushes; filter, size, search, sort, tab and view replace with page 1 in the same update; search writes after 300 ms or at once on Enter; privacy key names throw at definition
expected: createListParams: an invalid URL (?page=0&size=9999&status=bogus) gives defaulted state and exactly one replace to the canonical URL, idempotent on re-render; setPage pushes; filter, size, search, sort, tab and view replace with page 1 in the same update; search writes after 300 ms or at once on Enter; privacy key names throw at definition
result: pass
source: automated
coverage_id: 02-11/D2
requirement: WEB-10
verified_by: web/src/lib/url-state/createListParams.test.tsx (60 cases, nuqs testing adapter)

### 62. [02-11] Tracer: a component feeding useListParams state (search through useDebouncedValue 300) into the 02-39 useListQuery keys and fetches only the parsed, defaulted values for a hostile URL, once
expected: Tracer: a component feeding useListParams state (search through useDebouncedValue 300) into the 02-39 useListQuery keys and fetches only the parsed, defaulted values for a hostile URL, once
result: pass
source: automated
coverage_id: 02-11/D3
requirement: WEB-08
verified_by: web/src/lib/url-state/createListParams.test.tsx#createListParams with useListQuery

### 63. [02-11] URL_STATE_DEFAULTS exact; orderSearchParams writes page, size, q, then code-unit order and is idempotent; date presets stored by name and resolved against an injected business today, from/to only for custom
expected: URL_STATE_DEFAULTS exact; orderSearchParams writes page, size, q, then code-unit order and is idempotent; date presets stored by name and resolved against an injected business today, from/to only for custom
result: pass
source: automated
coverage_id: 02-11/D4
requirement: WEB-10
verified_by: web/src/lib/url-state/defaultOptions.test.ts (6 cases); web/src/lib/url-state/parsers.test.ts (dateRangeParsers, resolveDateRange, resolveRangePreset, businessToday)

### 64. [02-11] The lazily loaded UrlStateLayout inside createBrowserRouter: setPage pushes (history grows, window.location.search changes), a filter replaces (history length unchanged), two setters in one tick make one replaceState, Back restores, a hostile link normalizes once, router navigation is read, no markup of its own
expected: The lazily loaded UrlStateLayout inside createBrowserRouter: setPage pushes (history grows, window.location.search changes), a filter replaces (history length unchanged), two setters in one tick make one replaceState, Back restores, a hostile link normalizes once, router navigation is read, no markup of its own
result: pass
source: automated
coverage_id: 02-11/D5
requirement: WEB-10
verified_by: web/src/lib/url-state/UrlStateLayout.test.tsx (8 cases)

### 65. [02-12] The production build ships the brand fonts as self-hosted woff2 files only (no .woff, no data: URLs) and still one CSS file
expected: The production build ships the brand fonts as self-hosted woff2 files only (no .woff, no data: URLs) and still one CSS file
result: pass
source: automated
coverage_id: 02-12/D1
requirement: PERF-05
verified_by: web/src/test/build-output.node.test.ts#ships the self-hosted brand fonts as woff2 files only (PERF-05); web/src/test/build-output.node.test.ts#inlines no font as a data: URL, which font-src 'self' would block (T-02-33); web/scripts/vite-preload-font-plugin.test.ts#woff2OnlyPlugin (PERF-05)

### 66. [02-12] index.html carries exactly one crossorigin woff2 preload for the hashed Archivo Variable latin file, and the build fails on zero or two matches
expected: index.html carries exactly one crossorigin woff2 preload for the hashed Archivo Variable latin file, and the build fails on zero or two matches
result: pass
source: automated
coverage_id: 02-12/D2
requirement: PERF-05
verified_by: web/scripts/vite-preload-font-plugin.test.ts#preloadFontPlugin (PERF-05); web/src/test/build-output.node.test.ts#preloads exactly one font: the hashed Archivo Variable latin woff2 under /assets (PERF-05)

### 67. [02-12] base.css declares the metric-matched fallback faces and font stacks with the exact UI-SPEC values, recomputed from the installed woff2 files within 0.01 points; the Barlow fallback skips U+20B1
expected: base.css declares the metric-matched fallback faces and font stacks with the exact UI-SPEC values, recomputed from the installed woff2 files within 0.01 points; the Barlow fallback skips U+20B1
result: pass
source: automated
coverage_id: 02-12/D3
requirement: PERF-05
verified_by: web/scripts/font-metrics.test.ts (14 tests); web/src/styles/stylesheet-contract.node.test.ts#base.css holds only the token blocks, @font-face and the global element rules

### 68. [02-13] npm run parity runs preflight, the pinned 02-38 extraction, the reference build and the visual Playwright run (L-22 JS entries, pass-through --grep/--project), stops on a failing extraction, uses web/.locks/parity.lock and never stops another process
expected: npm run parity runs preflight, the pinned 02-38 extraction, the reference build and the visual Playwright run (L-22 JS entries, pass-through --grep/--project), stops on a failing extraction, uses web/.locks/parity.lock and never stops another process
result: pass
source: automated
coverage_id: 02-13/D1
requirement: WEB-02
verified_by: web/scripts/parity.test.ts (13 tests); npm --prefix web run parity -- --grep @no-such-tag -> 'Error: No tests found', exit 1

### 69. [02-13] The frozen spec Button (button-primary-md) renders from the shared scenario list in a [data-case] .s-page frame with data-theme, Blush --primary background rgb(87, 46, 43), fonts loaded, under the exact StrictCsp with zero CSP violations and console errors in chromium, firefox and webkit; a no-match filter shows data-parity-empty and expectCases fails on it
expected: The frozen spec Button (button-primary-md) renders from the shared scenario list in a [data-case] .s-page frame with data-theme, Blush --primary background rgb(87, 46, 43), fonts loaded, under the exact StrictCsp with zero CSP violations and console errors in chromium, firefox and webkit; a no-match filter shows data-parity-empty and expectCases fails on it
result: pass
source: automated
coverage_id: 02-13/D2
requirement: WEB-02
verified_by: npm --prefix web run parity -- --grep @reference (6 passed: 2 tests x 3 engines); web/visual/reference/select.test.ts (7 tests); web/visual/serve.test.ts (7 tests)

### 70. [02-13] rulings.css carries one commented group per ruling (D-01, D-02, D-02 FYI-01, D-03, D-05, D-27, D-31 O-3, O-6, D-31 D-BL-02, WEB-09, PERF-05), nothing for D-38, spec-class selectors only, PERF-05 identical to base.css, imported only by reference.css
expected: rulings.css carries one commented group per ruling (D-01, D-02, D-02 FYI-01, D-03, D-05, D-27, D-31 O-3, O-6, D-31 D-BL-02, WEB-09, PERF-05), nothing for D-38, spec-class selectors only, PERF-05 identical to base.css, imported only by reference.css
result: pass
source: automated
coverage_id: 02-13/D3
requirement: WEB-02
verified_by: web/visual/reference/rulings.test.ts (28 tests)

### 71. [02-14] npm run parity builds the implementation side (vite build --mode e2e --outDir .parity-dist) after the extraction and the reference build, before Playwright, under the parity lock, and stops at a failing build
expected: npm run parity builds the implementation side (vite build --mode e2e --outDir .parity-dist) after the extraction and the reference build, before Playwright, under the parity lock, and stops at a failing build
result: pass
source: automated
coverage_id: 02-14/D1
requirement: WEB-02
verified_by: web/scripts/parity.test.ts (16 tests)

### 72. [02-14] parity.html is an entry of the dev-route builds only; the production build (wwwroot) has no parity.html and no parity or scenario code
expected: parity.html is an entry of the dev-route builds only; the production build (wwwroot) has no parity.html and no parity or scenario code
result: pass
source: automated
coverage_id: 02-14/D2
requirement: WEB-02
verified_by: web/src/test/build-config.node.test.ts (parity entry in e2e/budget, none in production); npm --prefix web run build; ls src/Csps.Server/wwwroot -> assets index.html mark.svg robots.txt; grep for parity/data-case/button-primary-md in wwwroot JS -> none

### 73. [02-14] The converted Button (App. D.3 API, explicit props, buttonClasses recipe in tw literals) is computed-style-, box- and pixel-equal to the approved spec Button (button-primary-md) in chromium, firefox and webkit, Blush and Espresso, 390 and 1440, rest and hover, plus focus-visible and active in chromium, with zero axe and guard findings on both sides
expected: The converted Button (App. D.3 API, explicit props, buttonClasses recipe in tw literals) is computed-style-, box- and pixel-equal to the approved spec Button (button-primary-md) in chromium, firefox and webkit, Blush and Espresso, 390 and 1440, rest and hover, plus focus-visible and active in chromium, with zero axe and guard findings on both sides
result: pass
source: automated
coverage_id: 02-14/D3
requirement: WEB-02
verified_by: npm --prefix web run parity -- --grep \"@actions|@selftest\" (35 passed: chromium 17, firefox 9, webkit 9)

### 74. [02-14] Button behaviour: D.3 markup, icons 16/18px, icon-only name, native disabled, WEB-09 pending/loading (aria-disabled, aria-busy, spinner, clicks/Enter/Space/form submit swallowed, focus kept), axe clean, memo re-render
expected: Button behaviour: D.3 markup, icons 16/18px, icon-only name, native disabled, WEB-09 pending/loading (aria-disabled, aria-busy, spinner, clicks/Enter/Space/form submit swallowed, focus kept), axe clean, memo re-render
result: pass
source: automated
coverage_id: 02-14/D4
requirement: A11Y-04
verified_by: web/src/ui/actions/Button.test.tsx (14 tests)

### 75. [02-14] The comparator applies only the allowed normalizations (transition lists, 0-width border/outline style and colour, icon drawings, transforms, display:none), never compares attributes, reports structure/style/box differences, and accepts a tag mismatch only for a registry entry with a decision ID
expected: The comparator applies only the allowed normalizations (transition lists, 0-width border/outline style and colour, icon drawings, transforms, display:none), never compares attributes, reports structure/style/box differences, and accepts a tag mismatch only for a registry entry with a decision ID
result: pass
source: automated
coverage_id: 02-14/D5
requirement: WEB-02
verified_by: web/visual/compare.test.ts (38 tests)

### 76. [02-14] The harness cannot pass vacuously: a 1px CSSOM padding-top drift on the implementation is reported as a padding-top style difference and rejected by the pixel comparison in all three engines
expected: The harness cannot pass vacuously: a 1px CSSOM padding-top drift on the implementation is reported as a padding-top style difference and rejected by the pixel comparison in all three engines
result: pass
source: automated
coverage_id: 02-14/D6
requirement: WEB-02
verified_by: web/visual/parity.spec.ts#@parity @selftest (3 engines)

### 77. [02-14] The matrix: every engine 390/1440 rest+hover; Chromium 320/820 rest for responsive scenarios, focus-visible/active at 390/1440, motion and touch passes; themes per scenario; SPEC-GAP cases axe-checked only
expected: The matrix: every engine 390/1440 rest+hover; Chromium 320/820 rest for responsive scenarios, focus-visible/active at 390/1440, motion and touch passes; themes per scenario; SPEC-GAP cases axe-checked only
result: pass
source: automated
coverage_id: 02-14/D7
requirement: WEB-02
verified_by: web/visual/parity-matrix.test.ts (8 tests)

### 78. [02-14] The WebKit screenshot allowance discounts exactly one blocked inline stylesheet and console line per screenshot and nothing else
expected: The WebKit screenshot allowance discounts exactly one blocked inline stylesheet and console line per screenshot and nothing else
result: pass
source: automated
coverage_id: 02-14/D8
verified_by: web/visual/webkit-style-sync.test.ts (4 tests)

### 79. [02-15] OpenApiSnapshotTests fails when the live Development /openapi/v1.json differs from the committed snapshot after JSON normalization, naming the first differing JSON path and the refresh steps
expected: OpenApiSnapshotTests fails when the live Development /openapi/v1.json differs from the committed snapshot after JSON normalization, naming the first differing JSON path and the refresh steps
result: pass
source: automated
coverage_id: 02-15/D1
requirement: WEB-04
verified_by: tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument; tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#AnEditedSnapshotFailsNamingTheChangedPath (5 cases), KeyOrderAndWhitespaceAreNotDifferences, CanonicalFormSortsObjectKeysOrdinallyAndKeepsArrayOrder, ASnapshotThatIsNotJsonFailsWithAPlainMessage

### 80. [02-15] npm --prefix tools/openapi-gen run check regenerates types from the committed snapshot and fails on any difference from web/src/types/api.generated.ts; generate rewrites it
expected: npm --prefix tools/openapi-gen run check regenerates types from the committed snapshot and fails on any difference from web/src/types/api.generated.ts; generate rewrites it
result: pass
source: automated
coverage_id: 02-15/D2
requirement: WEB-04
verified_by: tools/openapi-gen/check.test.mjs (9 cases, node:test); npm --prefix tools/openapi-gen run check (exit 0); node tools/openapi-gen/check.mjs --snapshot <temp copy with facebookUrl renamed> (exit 1)

### 81. [02-15] api.ts is the single endpoint module: api.site.settings(signal) returns the generated SiteSettingsDto type through one shared createHttpClient({ baseURL: '/api/v1' }); groups declared; HttpError re-exported
expected: api.ts is the single endpoint module: api.site.settings(signal) returns the generated SiteSettingsDto type through one shared createHttpClient({ baseURL: '/api/v1' }); groups declared; HttpError re-exported
result: pass
source: automated
coverage_id: 02-15/D3
requirement: WEB-04
verified_by: web/src/lib/api.test.ts#api.site.settings (WEB-04) (4 cases), api groups; npm --prefix web run lint (exit 0); npm --prefix web run typecheck (0 errors)

### 82. [02-15] Three concurrent 401s through createApi share one refresh and retry once each; a failed refresh rejects all three and signs out once
expected: Three concurrent 401s through createApi share one refresh and retry once each; a failed refresh rejects all three and signs out once
result: pass
source: automated
coverage_id: 02-15/D4
requirement: WEB-04
verified_by: web/src/lib/api.test.ts#one shared client (WEB-04 concurrency edge) (2 cases); npm --prefix web run verify (exit 0; 46 files, 1276 tests)

### 83. [02-16] newIdempotencyKey returns an RFC 4122 v4 UUID from crypto.randomUUID, or from getRandomValues with version/variant bits set when randomUUID is missing; Math.random is never called on either path
expected: newIdempotencyKey returns an RFC 4122 v4 UUID from crypto.randomUUID, or from getRandomValues with version/variant bits set when randomUUID is missing; Math.random is never called on either path
result: pass
source: automated
coverage_id: 02-16/D1
requirement: WEB-09
verified_by: web/src/lib/forms/idempotencyKey.test.ts (5 cases)

### 84. [02-16] A double-clicked Save or a second Enter sends exactly one request; a trigger while pending (even with changed data) gets the same outcome; pending is true until settle
expected: A double-clicked Save or a second Enter sends exactly one request; a trigger while pending (even with changed data) gets the same outcome; pending is true until settle
result: pass
source: automated
coverage_id: 02-16/D2
requirement: WEB-09
verified_by: web/src/lib/forms/useSubmission.test.tsx#useSubmission: one request in flight (WEB-09 concurrency) (3 cases)

### 85. [02-16] A failed submission retried with the same data (including submit() with no data) reuses its key; success, reset() or changed data gets a new key; uncomparable data never reuses a key
expected: A failed submission retried with the same data (including submit() with no data) reuses its key; success, reset() or changed data gets a new key; uncomparable data never reuses a key
result: pass
source: automated
coverage_id: 02-16/D3
requirement: WEB-09
verified_by: web/src/lib/forms/useSubmission.test.tsx#useSubmission: key per submission (WEB-09 idempotency) (7 cases)

### 86. [02-16] A 400 with errors.Amount fills fieldErrors.Amount; failures without field errors call onFailure with the describeHttpError copy; 400 field errors and 401 do not call onFailure; a synchronous throw in send never leaves the form stuck
expected: A 400 with errors.Amount fills fieldErrors.Amount; failures without field errors call onFailure with the describeHttpError copy; 400 field errors and 401 do not call onFailure; a synchronous throw in send never leaves the form stuck
result: pass
source: automated
coverage_id: 02-16/D4
requirement: WEB-09
verified_by: web/src/lib/forms/useSubmission.test.tsx#useSubmission: results and errors (11 cases)

### 87. [02-16] describeHttpError gives the exact Copywriting Contract strings for network/timeout, 400 with field errors, 403, 404, 409, 429 and any 5xx (with Reference: {traceId}), null for 401 and aborted, and never shows server text
expected: describeHttpError gives the exact Copywriting Contract strings for network/timeout, 400 with field errors, 403, 404, 409, 429 and any 5xx (with Reference: {traceId}), null for 401 and aborted, and never shows server text
result: pass
source: automated
coverage_id: 02-16/D5
requirement: WEB-04
verified_by: web/src/lib/errors/describeHttpError.test.ts (24 cases)

### 88. [02-16] focusFirstInvalid focuses the first aria-invalid control in DOM order inside the root and returns false (focus kept) when none is invalid
expected: focusFirstInvalid focuses the first aria-invalid control in DOM order inside the root and returns false (focus kept) when none is invalid
result: pass
source: automated
coverage_id: 02-16/D6
requirement: WEB-09
verified_by: web/src/lib/forms/focusFirstInvalid.test.tsx (3 cases); npm --prefix web run test -- --run src/lib/errors src/lib/forms --coverage (100% statements/branches/functions/lines); npm --prefix web run verify (exit 0; 50 files, 1329 tests)

### 89. [02-17] Every Button variant x size, icon-only sm/md, icon left/right, block, disabled and pending is computed-style-, box- and pixel-equal to the approved spec Button in Blush and Espresso: rest/hover/focus-visible/active at 390 and 1440 in Chromium, rest/hover in Firefox and WebKit
expected: Every Button variant x size, icon-only sm/md, icon left/right, block, disabled and pending is computed-style-, box- and pixel-equal to the approved spec Button in Blush and Espresso: rest/hover/focus-visible/active at 390 and 1440 in Chromium, rest/hover in Firefox and WebKit
result: pass
source: automated
coverage_id: 02-17/D1
requirement: WEB-02
verified_by: npm --prefix web run parity -- --grep \"@actions|@selftest\" (35 passed: chromium 17, firefox 9, webkit 9)

### 90. [02-17] Pending Button: aria-disabled and aria-busy, spinner in place of the left icon, focus kept, clicks/Enter/Space/form submit ignored, and the same look as the disabled spec Button (button-pending scenario)
expected: Pending Button: aria-disabled and aria-busy, spinner in place of the left icon, focus kept, clicks/Enter/Space/form submit ignored, and the same look as the disabled spec Button (button-pending scenario)
result: pass
source: automated
coverage_id: 02-17/D2
requirement: WEB-09
verified_by: web/src/ui/actions/Button.test.tsx (38 tests); parity button-pending rows in three engines

### 91. [02-17] UiLink and ButtonLink render react-router's Link (a real <a href>, router navigation), external targets as plain anchors; ButtonLink has the button look and icons; LinkProvider renders children unchanged
expected: UiLink and ButtonLink render react-router's Link (a real <a href>, router navigation), external targets as plain anchors; ButtonLink has the button look and icons; LinkProvider renders children unchanged
result: pass
source: automated
coverage_id: 02-17/D3
requirement: WEB-02
verified_by: web/src/ui/actions/links.test.tsx (18 tests); parity buttonlink-primary-md and buttonlink-ghost-sm rows in three engines

### 92. [02-17] Button, ButtonLink and UiLink have no axe violations in unit tests and in every parity row; icon-only buttons must carry an aria-label (type error otherwise)
expected: Button, ButtonLink and UiLink have no axe violations in unit tests and in every parity row; icon-only buttons must carry an aria-label (type error otherwise)
result: pass
source: automated
coverage_id: 02-17/D4
requirement: A11Y-04
verified_by: Button.test.tsx#renders every Button scenario through the implementation kit…; links.test.tsx#axe cases; @ts-expect-error icon-only case under npm run typecheck

### 93. [02-17] The harness stays honest after the fixes: the 1px self-test still fails the comparison in three engines, and the reference smoke passes with unminified CSS
expected: The harness stays honest after the fixes: the 1px self-test still fails the comparison in three engines, and the reference smoke passes with unminified CSS
result: pass
source: automated
coverage_id: 02-17/D5
requirement: WEB-02
verified_by: @selftest (3 engines); npm --prefix web run parity -- --grep @reference (6 passed); web/visual/parity-matrix.test.ts (rowTimeout)

### 94. [02-18] Mark renders the App. F / D.4 drawing as JSX children of a 512 viewBox svg with no dangerouslySetInnerHTML; ring and stitch read --csp-mark-ring/--csp-mark-stitch; pixel- and style-equal to the spec Mark in Blush and Espresso
expected: Mark renders the App. F / D.4 drawing as JSX children of a 512 viewBox svg with no dangerouslySetInnerHTML; ring and stitch read --csp-mark-ring/--csp-mark-stitch; pixel- and style-equal to the spec Mark in Blush and Espresso
result: pass
source: automated
coverage_id: 02-18/D1
requirement: WEB-02
verified_by: web/src/ui/brand/brand.test.tsx (Mark describe, 6 tests); npm --prefix web run parity -- --grep @brand (mark-48, logo-* rows; 16 passed in 3 engines); grep -c dangerouslySetInnerHTML= web/src/ui/brand/Mark.tsx = 0; grep -c csp-mark-ring = 3

### 95. [02-18] Logo sm/md/lg, no tagline, mark-only and wordmark are pixel- and style-equal to the spec Logo in both themes at 390 and 1440 in Chromium, Firefox and WebKit; one image named \"CSPS — Carmen's Stitch & Printing Services\"
expected: Logo sm/md/lg, no tagline, mark-only and wordmark are pixel- and style-equal to the spec Logo in both themes at 390 and 1440 in Chromium, Firefox and WebKit; one image named \"CSPS — Carmen's Stitch & Printing Services\"
result: pass
source: automated
coverage_id: 02-18/D2
requirement: WEB-02
verified_by: web/src/ui/brand/brand.test.tsx (Logo describe, 12 tests, incl. axe); npm --prefix web run parity -- --grep @brand

### 96. [02-18] StitchDivider (with and without label), SectionCut (both, top accent, bottom, mesh) and MediaPlaceholder (4/3, 1/1 with label and number, 16/9 with number, no chip) match the spec motifs at 320/390/820/1440 including SectionCut's 1024px padding; MediaPlaceholder sets only --ratio in style
expected: StitchDivider (with and without label), SectionCut (both, top accent, bottom, mesh) and MediaPlaceholder (4/3, 1/1 with label and number, 16/9 with number, no chip) match the spec motifs at 320/390/820/1440 including SectionCut's 1024px padding; MediaPlaceholder sets only --ratio in style
result: pass
source: automated
coverage_id: 02-18/D3
requirement: WEB-02
verified_by: web/src/ui/brand/motifs.test.tsx (21 tests); npm --prefix web run parity -- --grep @brand (chromium 320/390/820/1440, firefox and webkit 390/1440)

### 97. [02-18] All 56 spec icons plus size 16/24, stroke 1.5 and labelled variants render through Icon with a wrapper equal to the spec wrapper (drawings masked, D-32); labelled icon is role img with a name
expected: All 56 spec icons plus size 16/24, stroke 1.5 and labelled variants render through Icon with a wrapper equal to the spec wrapper (drawings masked, D-32); labelled icon is role img with a name
result: pass
source: automated
coverage_id: 02-18/D4
requirement: WEB-02
verified_by: web/src/ui/brand/brand.test.tsx (icons-all describe, 3 tests); parity icons-all case in every @brand row

### 98. [02-18] The brand rows can fail: a mutated gap, padding, number offset or icon vertical-align is reported as a style/box difference and a pixel mismatch
expected: The brand rows can fail: a mutated gap, padding, number offset or icon vertical-align is reported as a style/box difference and a pixel mismatch
result: pass
source: automated
coverage_id: 02-18/D5
requirement: WEB-02
verified_by: two throw-away mutation runs (--grep \"@brand light 390\" and \"@brand light 1440\", chromium), reverted, not committed

### 99. [02-19] Badge in all 8 tones, with a dot and with an icon, StatusBadge for all six order statuses, and the 4 payment and 7 expense badges are computed-style-, box- and pixel-equal to the approved design in Blush and Espresso at 390 and 1440 px in Chromium, Firefox and WebKit
expected: Badge in all 8 tones, with a dot and with an icon, StatusBadge for all six order statuses, and the 4 payment and 7 expense badges are computed-style-, box- and pixel-equal to the approved design in Blush and Espresso at 390 and 1440 px in Chromium, Firefox and WebKit
result: pass
source: automated
coverage_id: 02-19/D1
requirement: WEB-02
verified_by: npm --prefix web run parity -- --grep \"@status|@choice\" (44 passed: chromium 20, firefox 12, webkit 12); web/src/ui/status/status.test.tsx (44 tests: Badge, StatusBadge, tone tables, scenario set, kit render + axe)

### 100. [02-19] Avatar renders the initials with role img and aria-label = the name (D-31 O-1), sets only --avatar-size and --avatar-fs (max(10, round(size x .38))px) in style, and matches the spec Avatar at 24, 32, 40 and 56 px
expected: Avatar renders the initials with role img and aria-label = the name (D-31 O-1), sets only --avatar-size and --avatar-fs (max(10, round(size x .38))px) in style, and matches the spec Avatar at 24, 32, 40 and 56 px
result: pass
source: automated
coverage_id: 02-19/D2
requirement: A11Y-04
verified_by: web/src/ui/status/status.test.tsx#Avatar (App. D.3, D-31 O-1); parity avatar-24/32/40/56 in every @status row (3 engines)

### 101. [02-19] SegmentedControl is a radiogroup of role=radio buttons with aria-checked and a roving tabIndex; arrow keys move and select with wrap; icon-only options keep aria-label and title; it matches the spec at rest, hover and focus-visible (and hover on an unselected option)
expected: SegmentedControl is a radiogroup of role=radio buttons with aria-checked and a roving tabIndex; arrow keys move and select with wrap; icon-only options keep aria-label and title; it matches the spec at rest, hover and focus-visible (and hover on an unselected option)
result: pass
source: automated
coverage_id: 02-19/D3
requirement: A11Y-02
verified_by: web/src/ui/choice/SegmentedControl.test.tsx (18 tests); parity segmented-text, segmented-icons, segmented-icon-labels rows (3 engines; focus-visible in Chromium)

### 102. [02-19] Tabs implement the WAI-ARIA tabs pattern on App. D.3's elements: ids, aria-selected, aria-controls = getTabPanelProps id, roving tabIndex, Right/Left wrap and select, Home/End; axe clean with the panel
expected: Tabs implement the WAI-ARIA tabs pattern on App. D.3's elements: ids, aria-selected, aria-controls = getTabPanelProps id, roving tabIndex, Right/Left wrap and select, Home/End; axe clean with the panel
result: pass
source: automated
coverage_id: 02-19/D4
requirement: WEB-02
verified_by: web/src/ui/choice/Tabs.test.tsx (22 tests); parity tabs-orders, tabs-orders-other (axe on both sides with the TabsWithPanel panel)

### 103. [02-19] The selected tab differs by weight 700 vs 600 and ink colour, not only the orange underline (D-03), in both themes; the strip scrolls sideways with the scrollbar hidden and no page overflow (tabs-overflow at 320/390/820/1440)
expected: The selected tab differs by weight 700 vs 600 and ink colour, not only the orange underline (D-03), in both themes; the strip scrolls sideways with the scrollbar hidden and no page overflow (tabs-overflow at 320/390/820/1440)
result: pass
source: automated
coverage_id: 02-19/D5
requirement: A11Y-04
verified_by: parity @choice rows incl. 320/820 Chromium; mutation runs (weight 600, scrollbar shown) both fail the comparison; Tabs.test.tsx#marks the selected tab by weight 700 and ink...; #scrolls the strip sideways...; visual/compare.test.ts#reads scrollbar-width

### 104. [02-19] The full web gate passes with the new components
expected: The full web gate passes with the new components
result: pass
source: automated
coverage_id: 02-19/D6
verified_by: npm --prefix web run verify (exit 0: 56 files, 1504 tests, coverage 100 / 99.88 / 100 / 100)

### 105. [02-20] Field (label, hint, error with 14px triangle-alert, required ' *', multiline textarea, ₱ prefix, disabled) is computed-style-, box- and pixel-equal to the approved field in Blush and Espresso at 320/390/820/1440, at rest, hover and focus-visible (focus-within ring), in Chromium, Firefox and WebKit
expected: Field (label, hint, error with 14px triangle-alert, required ' *', multiline textarea, ₱ prefix, disabled) is computed-style-, box- and pixel-equal to the approved field in Blush and Espresso at 320/390/820/1440, at rest, hover and focus-visible (focus-within ring), in Chromium, Firefox and WebKit
result: pass
source: automated
coverage_id: 02-20/D1
requirement: WEB-02
verified_by: npm --prefix web run parity -- --grep @forms (32 passed: chromium 16, firefox 8, webkit 8)

### 106. [02-20] Field assistive-technology wiring: label for/id, aria-describedby to the hint or error, aria-invalid only with an error, nothing invalid before an error is passed, aria-hidden ' *' and prefix, native passthrough, axe clean
expected: Field assistive-technology wiring: label for/id, aria-describedby to the hint or error, aria-invalid only with an error, nothing invalid before an error is passed, aria-hidden ' *' and prefix, native passthrough, axe clean
result: pass
source: automated
coverage_id: 02-20/D2
requirement: A11Y-04
verified_by: web/src/ui/forms/Field.test.tsx (22 tests)

### 107. [02-20] D-01 and D-02 FYI-01 in the shared recipe: region boxes 14px, 16px on phone pages, the plain box 16px everywhere, no maximum-scale/user-scalable, placeholder in --ink-muted with no opacity; compiled rule order proven; focus beats hover and invalid beats both
expected: D-01 and D-02 FYI-01 in the shared recipe: region boxes 14px, 16px on phone pages, the plain box 16px everywhere, no maximum-scale/user-scalable, placeholder in --ink-muted with no opacity; compiled rule order proven; focus beats hover and invalid beats both
result: pass
source: automated
coverage_id: 02-20/D3
requirement: PERF-03
verified_by: web/src/ui/forms/field.recipe.node.test.ts (7 tests)

### 108. [02-20] PasswordField (WEB-06 PasswordInput): Show password / Hide password toggle with aria-pressed and type switch, Weak/Fair/Good/Strong meter from passwordStrength with toned bars, the empty hint copy, hint/error wiring, autocomplete passthrough, axe clean; equal to the approved look (empty, four strengths, revealed, error) in three engines
expected: PasswordField (WEB-06 PasswordInput): Show password / Hide password toggle with aria-pressed and type switch, Weak/Fair/Good/Strong meter from passwordStrength with toned bars, the empty hint copy, hint/error wiring, autocomplete passthrough, axe clean; equal to the approved look (empty, four strengths, revealed, error) in three engines
result: pass
source: automated
coverage_id: 02-20/D4
requirement: WEB-06
verified_by: web/src/ui/forms/PasswordField.test.tsx (22 tests); npm --prefix web run parity -- --grep @forms (password-* cases)

### 109. [02-20] Select: native select with string and object options, placeholder, chevron overlay, label/hint/error wiring, disabled, Tab-reachable; equal to the approved select (default at every width, error, disabled) in three engines
expected: Select: native select with string and object options, placeholder, chevron overlay, label/hint/error wiring, disabled, Tab-reachable; equal to the approved select (default at every width, error, disabled) in three engines
result: pass
source: automated
coverage_id: 02-20/D5
requirement: WEB-02
verified_by: web/src/ui/forms/Select.test.tsx (17 tests); npm --prefix web run parity -- --grep @forms (select-* cases)

### 110. [02-21] EmptyState (icon tile turned -6deg, icon upright, title, message up to 380px, one action) equals the approved design in both themes at 320/390/820/1440 in Chromium, and at 390/1440 in Firefox and WebKit; heading level prop, default h2
expected: EmptyState (icon tile turned -6deg, icon upright, title, message up to 380px, one action) equals the approved design in both themes at 320/390/820/1440 in Chromium, and at 390/1440 in Firefox and WebKit; heading level prop, default h2
result: pass
source: automated
coverage_id: 02-21/D1
requirement: WEB-02
verified_by: web/src/ui/feedback/feedback.test.tsx (EmptyState, 10 tests); npm --prefix web run parity -- --grep @feedback (34 passed: chromium 18, firefox 8, webkit 8)

### 111. [02-21] Skeleton sizes only through --sk-w/--sk-h/--sk-r, is aria-hidden, shimmers with animate-csp-shimmer and stops under reduced motion (O-6), equal to the spec in three engines and in the Chromium reduced-motion pass
expected: Skeleton sizes only through --sk-w/--sk-h/--sk-r, is aria-hidden, shimmers with animate-csp-shimmer and stops under reduced motion (O-6), equal to the spec in three engines and in the Chromium reduced-motion pass
result: pass
source: automated
coverage_id: 02-21/D2
requirement: WEB-06
verified_by: web/src/ui/feedback/feedback.test.tsx (Skeleton, 6 tests); npm --prefix web run parity -- --grep @feedback (incl. @motion rows, light and dark)

### 112. [02-21] Toast in four tones (danger role=alert, others role=status, Dismiss button) equal to the spec at rest, the Dismiss button on hover and keyboard focus, and with the entry animation stopped under reduced motion
expected: Toast in four tones (danger role=alert, others role=status, Dismiss button) equal to the spec at rest, the Dismiss button on hover and keyboard focus, and with the entry animation stopped under reduced motion
result: pass
source: automated
coverage_id: 02-21/D3
requirement: WEB-06
verified_by: web/src/ui/feedback/feedback.test.tsx (Toast, 14 tests); npm --prefix web run parity -- --grep @feedback

### 113. [02-21] Toast queue: max 3 newest first, success/info leave after 4500 ms of running time, pause/resume keep the remaining time, danger/warning persist, trim protects persistent toasts, dismiss by id
expected: Toast queue: max 3 newest first, success/info leave after 4500 ms of running time, pause/resume keep the remaining time, danger/warning persist, trim protects persistent toasts, dismiss by id
result: pass
source: automated
coverage_id: 02-21/D4
requirement: A11Y-04
verified_by: web/src/ui/feedback/toastQueue.test.ts (20 tests, 100% statements and branches)

### 114. [02-21] ToastProvider: layer always mounted as the polite live region inside the provider's parent (no portal), useToast show/dismiss, pause while hovered or focused, resume when the stack empties, axe clean
expected: ToastProvider: layer always mounted as the polite live region inside the provider's parent (no portal), useToast show/dismiss, pause while hovered or focused, resume when the stack empties, axe clean
result: pass
source: automated
coverage_id: 02-21/D5
requirement: A11Y-04
verified_by: web/src/ui/feedback/ToastProvider.test.tsx (14 tests)

### 115. [02-22] Modal is a real dialog (role, aria-modal, aria-labelledby), focus goes to the first field (or first focusable, or the dialog), Tab/Shift+Tab are trapped with refs and no wrapper element, Esc and scrim close except while loading, focus returns to the trigger, body gets and loses overflow-hidden through classList
expected: Modal is a real dialog (role, aria-modal, aria-labelledby), focus goes to the first field (or first focusable, or the dialog), Tab/Shift+Tab are trapped with refs and no wrapper element, Esc and scrim close except while loading, focus returns to the trigger, body gets and loses overflow-hidden through classList
result: pass
source: automated
coverage_id: 02-22/D1
requirement: WEB-02
verified_by: web/src/ui/overlays/Modal.test.tsx (30 tests) and useFocusTrap.test.tsx (16 tests)

### 116. [02-22] A11Y-02 edges: Tab on the last element goes to the first and Shift+Tab on the first to the last; no focusable child focuses the container (tabIndex -1) or Cancel in a ConfirmDialog without a field
expected: A11Y-02 edges: Tab on the last element goes to the first and Shift+Tab on the first to the last; no focusable child focuses the container (tabIndex -1) or Cancel in a ConfirmDialog without a field
result: pass
source: automated
coverage_id: 02-22/D2
requirement: A11Y-02
verified_by: web/src/ui/overlays/useFocusTrap.test.tsx; ConfirmDialog.test.tsx (Cancel focus)

### 117. [02-22] Modal (centred, bottom sheet below 640px), the slide-over and the ConfirmDialog in the Overlay region equal the approved design in both themes at 320/390/820/1440 in Chromium and at 390/1440 in Firefox and WebKit, with the entry animations stopped under reduced motion (O-6)
expected: Modal (centred, bottom sheet below 640px), the slide-over and the ConfirmDialog in the Overlay region equal the approved design in both themes at 320/390/820/1440 in Chromium and at 390/1440 in Firefox and WebKit, with the entry animations stopped under reduced motion (O-6)
result: pass
source: automated
coverage_id: 02-22/D3
requirement: WEB-02
verified_by: npm --prefix web run parity -- --grep @overlays (18 passed: chromium 10, firefox 4, webkit 4)

### 118. [02-22] ConfirmDialog: cascade sentence and five tiles (zero dimmed), \"This can't be undone.\", Delete disabled until the trimmed text matches exactly, one onConfirm per attempt while pending
expected: ConfirmDialog: cascade sentence and five tiles (zero dimmed), \"This can't be undone.\", Delete disabled until the trimmed text matches exactly, one onConfirm per attempt while pending
result: pass
source: automated
coverage_id: 02-22/D4
requirement: WEB-06
verified_by: web/src/ui/overlays/ConfirmDialog.test.tsx (23 tests)

### 119. [02-22] Failure state: dialog stays open with the typed text, role=alert describeHttpError line with the traceId above the buttons (no server text), Delete re-enabled and focused, retry calls onConfirm again, no toast; axe clean
expected: Failure state: dialog stays open with the typed text, role=alert describeHttpError line with the traceId above the buttons (no server text), Delete re-enabled and focused, retry calls onConfirm again, no toast; axe clean
result: pass
source: automated
coverage_id: 02-22/D5
requirement: WEB-06
verified_by: web/src/ui/overlays/ConfirmDialog.test.tsx; confirm-delete-order-error (parity: false): axe + CSP guard in three engines

### 120. [02-23] Money renders formatPeso text (\"₱12,450.00\", negatives \"−₱732.50\" with U+2212) in tabular figures with the sm/md/lg sizes and the success/warning/danger/muted tones, equal to the approved Money in both themes at 390/1440 in Chromium, Firefox and WebKit
expected: Money renders formatPeso text (\"₱12,450.00\", negatives \"−₱732.50\" with U+2212) in tabular figures with the sm/md/lg sizes and the success/warning/danger/muted tones, equal to the approved Money in both themes at 390/1440 in Chromium, Firefox and WebKit
result: pass
source: automated
coverage_id: 02-23/D1
requirement: ORD-09
verified_by: web/src/ui/money/money.test.tsx (Money, 7 tests); npm --prefix web run parity -- --grep @money (18 passed: chromium 10, firefox 4, webkit 4)

### 121. [02-23] OrderTotals for ORD-2026-0148 (Total ₱22,450.00, Discount −₱1,122.50, Paid −₱12,000.00, Balance due ₱9,327.50, Expenses ₱6,065.00, Profit ₱15,262.50) and ORD-2026-0151 (Fully Paid) from csps.ts orderTotals, server totals winning, equal to the approved panel and card at 320/390/820/1440 in Chromium and 390/1440 in Firefox and WebKit, axe clean
expected: OrderTotals for ORD-2026-0148 (Total ₱22,450.00, Discount −₱1,122.50, Paid −₱12,000.00, Balance due ₱9,327.50, Expenses ₱6,065.00, Profit ₱15,262.50) and ORD-2026-0151 (Fully Paid) from csps.ts orderTotals, server totals winning, equal to the approved panel and card at 320/390/820/1440 in Chromium and 390/1440 in Firefox and WebKit, axe clean
result: pass
source: automated
coverage_id: 02-23/D2
requirement: WEB-02
verified_by: web/src/ui/money/money.test.tsx (OrderTotals, 13 tests); npm --prefix web run parity -- --grep @money

### 122. [02-23] KpiCard (icon tile, overline label, peso or count value, delta chip up/down with a named direction, hint) and its loading state (aria-busy, 70% × 36 skeleton, shimmer stopped under reduced motion) equal to the approved design in both themes at 390/1440 in three engines; a zero figure has no opacity (D-02)
expected: KpiCard (icon tile, overline label, peso or count value, delta chip up/down with a named direction, hint) and its loading state (aria-busy, 70% × 36 skeleton, shimmer stopped under reduced motion) equal to the approved design in both themes at 390/1440 in three engines; a zero figure has no opacity (D-02)
result: pass
source: automated
coverage_id: 02-23/D3
requirement: WEB-02
verified_by: web/src/ui/money/money.test.tsx (KpiCard, 12 tests); npm --prefix web run parity -- --grep @money (incl. the @motion row for kpi-loading); npm --prefix web run verify (exit 0; class gate finds no opacity token in src/ui/money)

### 123. [02-24] OrderCard (cover placeholder, StatusBadge with the ring, image-count chip, order number in --accent-ink, piece count, team or customer title, customer line, dates with the overdue colour, the card totals, View / Edit / Delete) equal to the approved design for ORD-2026-0148, ORD-2026-0151 and the no-team ORD-2026-0153 in both themes at 390 and 1440 (and on hover for 0148) in Chromium, Firefox and WebKit; axe clean
expected: OrderCard (cover placeholder, StatusBadge with the ring, image-count chip, order number in --accent-ink, piece count, team or customer title, customer line, dates with the overdue colour, the card totals, View / Edit / Delete) equal to the approved design for ORD-2026-0148, ORD-2026-0151 and the no-team ORD-2026-0153 in both themes at 390 and 1440 (and on hover for 0148) in Chromium, Firefox and WebKit; axe clean
result: pass
source: automated
coverage_id: 02-24/D1
requirement: WEB-02
verified_by: web/src/ui/data/data.test.tsx (OrderCard, 15 tests); npm --prefix web run parity -- --grep @data (24 passed: chromium 8, firefox 8, webkit 8)

### 124. [02-24] DataTable (.csp-table look, align class map, widths only through --col-w, 4 skeleton rows while loading, error and empty rows, last-row cells without a rule, hovered row on --surface-2, focusable named scroll region) equal to the approved table in both themes at 390 and 1440 in three engines; axe clean
expected: DataTable (.csp-table look, align class map, widths only through --col-w, 4 skeleton rows while loading, error and empty rows, last-row cells without a rule, hovered row on --surface-2, focusable named scroll region) equal to the approved table in both themes at 390 and 1440 in three engines; axe clean
result: pass
source: automated
coverage_id: 02-24/D2
requirement: WEB-02
verified_by: web/src/ui/data/data.test.tsx (DataTable, 12 tests); npm --prefix web run parity -- --grep @data

### 125. [02-24] IncomeExpenseChart (hand-rolled SVG, income/expense bars in --chart-income/--chart-expense, ₱0/₱100k/₱200k ticks, legend, tooltip positioned only through --tip-x; every month group focusable and named with the month and both peso figures) equal to the approved chart at rest for 6 and 12 months in both themes at 390 and 1440 in three engines; axe clean at rest and with the tooltip open
expected: IncomeExpenseChart (hand-rolled SVG, income/expense bars in --chart-income/--chart-expense, ₱0/₱100k/₱200k ticks, legend, tooltip positioned only through --tip-x; every month group focusable and named with the month and both peso figures) equal to the approved chart at rest for 6 and 12 months in both themes at 390 and 1440 in three engines; axe clean at rest and with the tooltip open
result: pass
source: automated
coverage_id: 02-24/D3
requirement: WEB-02
verified_by: web/src/ui/data/IncomeExpenseChart.test.tsx (20 tests); npm --prefix web run parity -- --grep @data; npm --prefix web run verify (exit 0)

### 126. [02-25] ImageUploader (dashed drop zone with the browse link button and the {n}/{max} hint, image-only hidden input, data-over drag state; thumbnail grid with the Cover tag and accent ring, chip-less placeholders with the centred number, make-cover and remove buttons, native drag reorder) equal to the approved design in both themes at 390 and 1440, on hover and with keyboard focus, in Chromium, Firefox and WebKit; axe clean
expected: ImageUploader (dashed drop zone with the browse link button and the {n}/{max} hint, image-only hidden input, data-over drag state; thumbnail grid with the Cover tag and accent ring, chip-less placeholders with the centred number, make-cover and remove buttons, native drag reorder) equal to the approved design in both themes at 390 and 1440, on hover and with keyboard focus, in Chromium, Firefox and WebKit; axe clean
result: pass
source: automated
coverage_id: 02-25/D1
requirement: WEB-02
verified_by: web/src/ui/media/ImageUploader.test.tsx (17 tests); npm --prefix web run parity -- --grep \"@media|@marketing\" (44 passed: media 30 across three engines)

### 127. [02-25] D-05: the thumb grip and actions are hidden at rest on hover devices, appear on hover and on keyboard focus within the thumb, and are always visible on touch; every Tab-reached control sits in a thumb whose grip and actions carry the reveal, and the focused control is never the faded element
expected: D-05: the thumb grip and actions are hidden at rest on hover devices, appear on hover and on keyboard focus within the thumb, and are always visible on touch; every Tab-reached control sits in a thumb whose grip and actions carry the reveal, and the focused control is never the faded element
result: pass
source: automated
coverage_id: 02-25/D2
requirement: A11Y-04
verified_by: web/src/ui/media/ImageUploader.test.tsx#every control reached by Tab is named and sits in a thumb whose focus reveals its grip and actions; parity @media focus-visible rows (390, 1440, both themes) and the @touch pass (390, both themes), Chromium

### 128. [02-25] CategoryCard (one in-app link, 4:5 slanted media, number grows on card hover, arrow nudge), ProcessSteps (1/2/4 columns at 0/640/1024 px, stitched top rule, italic numerals) and TestimonialCard (stars, curly quotes, avatar byline) equal to the approved public looks in Blush (D-14) at 390 and 1440 (ProcessSteps also 320 and 820, CategoryCard also hovered) in three engines; the star rating is one named image (O-2); axe clean
expected: CategoryCard (one in-app link, 4:5 slanted media, number grows on card hover, arrow nudge), ProcessSteps (1/2/4 columns at 0/640/1024 px, stitched top rule, italic numerals) and TestimonialCard (stars, curly quotes, avatar byline) equal to the approved public looks in Blush (D-14) at 390 and 1440 (ProcessSteps also 320 and 820, CategoryCard also hovered) in three engines; the star rating is one named image (O-2); axe clean
result: pass
source: automated
coverage_id: 02-25/D3
requirement: WEB-02
verified_by: web/src/ui/marketing/marketing.test.tsx (16 tests); npm --prefix web run parity -- --grep \"@media|@marketing\" (marketing 14 across three engines); npm --prefix web run verify (exit 0, 1853 tests)

### 129. [02-26] Sidebar (both themes): App. D.3 markup and props, Manager tag on manager-only rows, user chip, collapse, D-03 current row (aria-current, primary fill, accent marker, 700), D-BL-02 tag hidden on the current row, D-27 Logout button with the nav-item look; computed-, box- and pixel-equal to the approved sidebar
expected: Sidebar (both themes): App. D.3 markup and props, Manager tag on manager-only rows, user chip, collapse, D-03 current row (aria-current, primary fill, accent marker, 700), D-BL-02 tag hidden on the current row, D-27 Logout button with the nav-item look; computed-, box- and pixel-equal to the approved sidebar
result: pass
source: automated
coverage_id: 02-26/D1
requirement: WEB-02
verified_by: web/src/ui/navigation/Sidebar.test.tsx (20 tests); npm --prefix web run parity -- --grep \"@navigation|@brand|@status|@marketing\" (74 passed, chromium/firefox/webkit)

### 130. [02-26] SiteHeader (Blush, 320/390/820/1440): D-03 current link, no current link, O-3 italic aria-current drawer link, drawer open/close, Get a Quote to /contact; equal to the approved header
expected: SiteHeader (Blush, 320/390/820/1440): D-03 current link, no current link, O-3 italic aria-current drawer link, drawer open/close, Get a Quote to /contact; equal to the approved header
result: pass
source: automated
coverage_id: 02-26/D2
requirement: WEB-05
verified_by: web/src/ui/navigation/SiteHeader.test.tsx (18 tests); parity @navigation site-header-* rows in three engines; mutation run (italic and hover removed) failed as expected

### 131. [02-26] Topbar (Blush moon / Espresso sun, every width): / shortcut, Enter to onSearch, theme toggle names, user-menu trigger, phone menu button with aria-expanded/aria-controls pass-through, D-01 16px phone search text, A.3 compat padding; equal to the approved topbar
expected: Topbar (Blush moon / Espresso sun, every width): / shortcut, Enter to onSearch, theme toggle names, user-menu trigger, phone menu button with aria-expanded/aria-controls pass-through, D-01 16px phone search text, A.3 compat padding; equal to the approved topbar
result: pass
source: automated
coverage_id: 02-26/D3
requirement: WEB-02
verified_by: web/src/ui/navigation/Topbar.test.tsx (19 tests); parity @navigation topbar-* rows in three engines; mutation run (D-01 and kbd family removed) failed as expected

### 132. [02-26] Owner rulings on navigation applied and accessible: D-03, D-27, O-3, D-BL-02, FYI-01, D-01; zero axe findings in unit tests and on both parity pages
expected: Owner rulings on navigation applied and accessible: D-03, D-27, O-3, D-BL-02, FYI-01, D-01; zero axe findings in unit tests and on both parity pages
result: pass
source: automated
coverage_id: 02-26/D4
requirement: A11Y-04
verified_by: axe cases in Sidebar/SiteHeader/Topbar tests (8 scenarios through the kit); visual/reference/rulings.test.ts (32); npm --prefix web run verify (exit 0: 74 files, 1912 tests, coverage 99.08/98.04/100/99.89)

### 133. [02-27] MoneyInput: ₱-prefixed Field, type text, inputMode decimal, autocomplete off; 9th integer digit kept and 10th ignored, 2nd decimal kept and 3rd ignored, minus (ASCII and U+2212) and non-ASCII digits rejected, paste strips commas and spaces, blur pads ('5000' → '5000.00', empty stays empty), no grouping while editing, pasted '12,450.5' → '12450.50' → 1245050 centavos, Copywriting errors, align right, 16px text, axe clean
expected: MoneyInput: ₱-prefixed Field, type text, inputMode decimal, autocomplete off; 9th integer digit kept and 10th ignored, 2nd decimal kept and 3rd ignored, minus (ASCII and U+2212) and non-ASCII digits rejected, paste strips commas and spaces, blur pads ('5000' → '5000.00', empty stays empty), no grouping while editing, pasted '12,450.5' → '12450.50' → 1245050 centavos, Copywriting errors, align right, 16px text, axe clean
result: pass
source: automated
coverage_id: 02-27/D1
requirement: ORD-09
verified_by: web/src/ui/entry/MoneyInput.test.tsx (41 tests)

### 134. [02-27] OtpInput: fieldset + label-look legend, six numeric one-digit boxes named 'Digit i of 6', first box with one-time-code autocomplete, typing advances, Backspace/Delete/arrows/Home/End, paste and direct-input fill from the focused box, ASCII digits only, onComplete once when all six are filled, 'Enter all 6 digits.' on a 4-digit submit with every box invalid, axe clean
expected: OtpInput: fieldset + label-look legend, six numeric one-digit boxes named 'Digit i of 6', first box with one-time-code autocomplete, typing advances, Backspace/Delete/arrows/Home/End, paste and direct-input fill from the focused box, ASCII digits only, onComplete once when all six are filled, 'Enter all 6 digits.' on a 4-digit submit with every box invalid, axe clean
result: pass
source: automated
coverage_id: 02-27/D2
requirement: WEB-06
verified_by: web/src/ui/entry/OtpInput.test.tsx (27 tests)

### 135. [02-27] Checkbox: label text is the accessible name and toggles the native box; D-03 look (20×20, 2px --ink border, --surface-2, --accent when checked) and an aria-hidden 10×5px --on-accent tick equal to the 74621f5 reference geometry in three engines
expected: Checkbox: label text is the accessible name and toggles the native box; D-03 look (20×20, 2px --ink border, --surface-2, --accent when checked) and an aria-hidden 10×5px --on-accent tick equal to the 74621f5 reference geometry in three engines
result: pass
source: automated
coverage_id: 02-27/D3
requirement: WEB-06
verified_by: web/src/ui/entry/entry.test.tsx#Checkbox (10 tests); scratch tick-geometry check: 0 differing pixels vs the 74621f5 ::before tick, chromium/firefox/webkit × light/dark; mutation (1px) caught

### 136. [02-27] SkipLink: 'Skip to main content', primary md button look, visually hidden until keyboard focus then fixed top-left at --z-toast, first Tab stop, Enter or click focuses #main and the URL never gains #main
expected: SkipLink: 'Skip to main content', primary md button look, visually hidden until keyboard focus then fixed top-left at --z-toast, first Tab stop, Enter or click focuses #main and the URL never gains #main
result: pass
source: automated
coverage_id: 02-27/D4
requirement: A11Y-02
verified_by: web/src/ui/entry/entry.test.tsx#SkipLink (7 tests)

### 137. [02-27] Every entry scenario (9, parity: false) loads with zero axe and CSP/console findings in Chromium, Firefox and WebKit
expected: Every entry scenario (9, parity: false) loads with zero axe and CSP/console findings in Chromium, Firefox and WebKit
result: pass
source: automated
coverage_id: 02-27/D5
requirement: PERF-03
verified_by: npm --prefix web run parity -- --grep @entry (16 passed); npm --prefix web run verify (exit 0: 77 files, 2000 tests, coverage 99.01/97.85/100/99.9)

### 138. [02-28] ErrorState: role=alert banner in the .s-banner.is-danger look, triangle-alert 20, \"Couldn't load {things}.\" + the reassurance line, \"Reference: {traceId}\" for an HttpError that has one, never server title/detail, secondary sm Try Again calling onRetry (click and keyboard), mapper copy for modal banners, axe clean
expected: ErrorState: role=alert banner in the .s-banner.is-danger look, triangle-alert 20, \"Couldn't load {things}.\" + the reassurance line, \"Reference: {traceId}\" for an HttpError that has one, never server title/detail, secondary sm Try Again calling onRetry (click and keyboard), mapper copy for modal banners, axe clean
result: pass
source: automated
coverage_id: 02-28/D1
requirement: WEB-06
verified_by: web/src/ui/states/ErrorState.test.tsx (18 tests)

### 139. [02-28] SkeletonText (3 lines 14px at 100/90/60%, gap 8), SkeletonCard (App. E.8 order-card skeleton), SkeletonImage (--ratio box, full-box radius-0 Skeleton): aria-hidden, sizes only via --sk-*, shimmer stops under reduced motion
expected: SkeletonText (3 lines 14px at 100/90/60%, gap 8), SkeletonCard (App. E.8 order-card skeleton), SkeletonImage (--ratio box, full-box radius-0 Skeleton): aria-hidden, sizes only via --sk-*, shimmer stops under reduced motion
result: pass
source: automated
coverage_id: 02-28/D2
requirement: WEB-06
verified_by: web/src/ui/states/loading.test.tsx#SkeletonText|SkeletonCard|SkeletonImage

### 140. [02-28] LoadingRegion: aria-busy=true while loading, one sibling sr-only role=status aria-live=polite node saying \"Loading orders…\" then \"Orders loaded.\", silent when never loading or after a failed load
expected: LoadingRegion: aria-busy=true while loading, one sibling sr-only role=status aria-live=polite node saying \"Loading orders…\" then \"Orders loaded.\", silent when never loading or after a failed load
result: pass
source: automated
coverage_id: 02-28/D3
requirement: WEB-06
verified_by: web/src/ui/states/loading.test.tsx#LoadingRegion (8 tests)

### 141. [02-28] useDelayedFlag(flag, 200): true only after 200 ms of a true flag, false at once when the flag turns false, waits the full delay again
expected: useDelayedFlag(flag, 200): true only after 200 ms of a true flag, false at once when the flag turns false, waits the full delay again
result: pass
source: automated
coverage_id: 02-28/D4
verified_by: web/src/ui/states/useDelayedFlag.test.tsx (6 tests, fake timers)

### 142. [02-28] LazyImage: --ratio box (4 / 3 default), img loading=lazy decoding=async width height alt, priority -> eager + fetchpriority high, Skeleton until load, chip-less MediaPlaceholder on error with role=img named by the alt, empty alt stays decorative, new src starts over
expected: LazyImage: --ratio box (4 / 3 default), img loading=lazy decoding=async width height alt, priority -> eager + fetchpriority high, Skeleton until load, chip-less MediaPlaceholder on error with role=img named by the alt, empty alt stays decorative, new src starts over
result: pass
source: automated
coverage_id: 02-28/D5
requirement: WEB-06
verified_by: web/src/ui/states/LazyImage.test.tsx (11 tests); scratch probe in chromium/firefox/webkit: loading case keeps its skeleton after the image loads, failed case shows the named placeholder, both 390x292.5, no console messages

### 143. [02-28] All 8 states scenarios load with zero axe, CSP, console and request findings in Chromium, Firefox and WebKit (incl. the reduced-motion pass for the skeletons)
expected: All 8 states scenarios load with zero axe, CSP, console and request findings in Chromium, Firefox and WebKit (incl. the reduced-motion pass for the skeletons)
result: pass
source: automated
coverage_id: 02-28/D6
requirement: WEB-06
verified_by: npm --prefix web run parity -- --grep @states (18 passed); npm --prefix web run verify (exit 0: 81 files, 2051 tests, coverage 99.03/97.94/100/99.9; ui/states 100%)

### 144. [02-29] Data router with lazy public routes, hydrate fallback and Root query client; every non-API path renders PublicLayout + PublicPlaceholderPage; /admin/* falls through to the placeholder
expected: Data router with lazy public routes, hydrate fallback and Root query client; every non-API path renders PublicLayout + PublicPlaceholderPage; /admin/* falls through to the placeholder
result: pass
source: automated
coverage_id: 02-29/D1
requirement: WEB-05
verified_by: web/src/app/public/PublicLayout.test.tsx#Root and ShellFallback; current link /admin/orders; npm --prefix web run e2e -- --grep \"@public|@smoke|@fixture\" (37 passed, five projects)

### 145. [02-29] PublicLayout landmarks, one h1, current-link state (none on unknown paths), skip link first and focusing main with no hash, keyboard order
expected: PublicLayout landmarks, one h1, current-link state (none on unknown paths), skip link first and focusing main with no hash, keyboard order
result: pass
source: automated
coverage_id: 02-29/D2
requirement: A11Y-01
verified_by: web/src/app/public/PublicLayout.test.tsx (25 tests incl. axe); web/e2e/public.spec.ts @public /, /products, /some/unknown in chromium, firefox, webkit, pixel, iphone

### 146. [02-29] Route and root error boundaries, chunk-load failures included, no error text on screen, silent in production
expected: Route and root error boundaries, chunk-load failures included, no error text on screen, silent in production
result: pass
source: automated
coverage_id: 02-29/D3
requirement: WEB-05
verified_by: web/src/app/ErrorBoundary.test.tsx (13 tests)

### 147. [02-29] Public frame (header, D-21 page head, footer) pixel- and style-equal to App. E.1/E.2 at 320/390/820/1440 (Chromium) and 390/1440 (Firefox, WebKit)
expected: Public frame (header, D-21 page head, footer) pixel- and style-equal to App. E.1/E.2 at 320/390/820/1440 (Chromium) and 390/1440 (Firefox, WebKit)
result: pass
source: automated
coverage_id: 02-29/D4
requirement: A11Y-02
verified_by: npm --prefix web run parity -- --grep \"@layouts-public|@reference\" (20 passed, three engines)

### 148. [02-29] 320px long-text backstop: the 52px placeholder h1 wraps inside its wrapper with no horizontal scroll
expected: 320px long-text backstop: the 52px placeholder h1 wraps inside its wrapper with no horizontal scroll
result: pass
source: automated
coverage_id: 02-29/D5
verified_by: web/e2e/public.spec.ts#@public at 320px the placeholder h1 wraps inside its wrapper with no horizontal scroll

### 149. [02-30] ResponsiveTable renders the App. E.12 Users table equal to the approved design (desktop table, tablet in-frame scroll, phone cards with data-label, D-02 inactive row, D-38 last-card title), every cell labelled, hidden caption and Actions header, money cells, tfoot
expected: ResponsiveTable renders the App. E.12 Users table equal to the approved design (desktop table, tablet in-frame scroll, phone cards with data-label, D-02 inactive row, D-38 last-card title), every cell labelled, hidden caption and Actions header, money cells, tfoot
result: pass
source: automated
coverage_id: 02-30/D1
requirement: WEB-06
verified_by: web/src/ui/lists/ResponsiveTable.test.tsx (27 tests); npm --prefix web run parity -- --grep @lists (rt-users-populated, rt-long-name at 320/390/820/1440 Chromium, 390/1440 Firefox and WebKit, light and dark, rest and hover)

### 150. [02-30] List states: first-load SkeletonTable in a busy LoadingRegion, ErrorState above the table, first-use and no-match EmptyState, refetch dim after 200 ms by colour only with aria-busy
expected: List states: first-load SkeletonTable in a busy LoadingRegion, ErrorState above the table, first-use and no-match EmptyState, refetch dim after 200 ms by colour only with aria-busy
result: pass
source: automated
coverage_id: 02-30/D2
requirement: WEB-08
verified_by: web/src/ui/lists/ResponsiveTable.test.tsx#ResponsiveTable list states; web/src/ui/lists/lists.recipe.node.test.ts (5 tests); parity @lists rest rows: lists-states cases axe + CSP + console guard in three engines

### 151. [02-30] FilterBar (role=search, data-ui=s-toolbar) equal to the App. E.7 toolbar at every width; SearchBox, ResultBar and FilterChip; filters replace with a page reset; chips only for non-default filters
expected: FilterBar (role=search, data-ui=s-toolbar) equal to the App. E.7 toolbar at every width; SearchBox, ResultBar and FilterChip; filters replace with a page reset; chips only for non-default filters
result: pass
source: automated
coverage_id: 02-30/D3
requirement: WEB-10
verified_by: web/src/ui/lists/FilterBar.test.tsx (18 tests); parity @lists toolbar-orders (three engines)

### 152. [02-30] Pagination: nav Pagination, disabled ends, hidden for n <= 1, push + focus to the results heading, Rows per page replace + reset, icon-only on phones with kept names
expected: Pagination: nav Pagination, disabled ends, hidden for n <= 1, push + focus to the results heading, Rows per page replace + reset, icon-only on phones with kept names
result: pass
source: automated
coverage_id: 02-30/D4
requirement: WEB-06
verified_by: web/src/ui/lists/Pagination.test.tsx (13 tests)

### 153. [02-30] End-to-end list state in a real data router: one canonical rewrite for a hostile link, ?q=jersey after 300 ms with one settled query, replace + page reset, push on Next, Back restores rows (window.location.search, history.length)
expected: End-to-end list state in a real data router: one canonical rewrite for a hostile link, ?q=jersey after 300 ms with one settled query, replace + page reset, push on Next, Back restores rows (window.location.search, history.length)
result: pass
source: automated
coverage_id: 02-30/D5
requirement: WEB-10
verified_by: web/src/ui/lists/listState.integration.test.tsx (5 tests); web/src/lib/query/useSettledListParams.test.tsx (6 tests)

### 154. [02-31] Dev-only admin routes render the admin shell with the section's preview page, current sidebar item and document title on all five paths, in five Playwright projects
expected: Dev-only admin routes render the admin shell with the section's preview page, current sidebar item and document title on all five paths, in five Playwright projects
result: pass
source: automated
coverage_id: 02-31/D1
requirement: WEB-05
verified_by: web/src/app/admin/AdminLayout.test.tsx#AdminLayout sections (D-20, A11Y-04); npm --prefix web run e2e -- --grep @admin (35 passed)

### 155. [02-31] Production builds contain no admin or /dev module (D-20)
expected: Production builds contain no admin or /dev module (D-20)
result: pass
source: automated
coverage_id: 02-31/D2
requirement: WEB-10
verified_by: web/src/test/build-output.node.test.ts#contains no admin or /dev module

### 156. [02-31] UrlStateLayout (the one NuqsAdapter) sits as a lazy pathless route above the admin pages
expected: UrlStateLayout (the one NuqsAdapter) sits as a lazy pathless route above the admin pages
result: pass
source: automated
coverage_id: 02-31/D3
requirement: WEB-10
verified_by: web/src/app/admin/AdminLayout.test.tsx#AdminLayout error boundaries (admin > url state > pages shape)

### 157. [02-31] Theme toggle persists in localStorage['csps-theme'], starts in Blush, never reads prefers-color-scheme, works in memory when storage throws
expected: Theme toggle persists in localStorage['csps-theme'], starts in Blush, never reads prefers-color-scheme, works in memory when storage throws
result: pass
source: automated
coverage_id: 02-31/D4
requirement: WEB-05
verified_by: web/src/app/admin/theme.test.ts; web/e2e/admin.spec.ts#@admin the theme toggle switches to Espresso, and the choice survives a reload

### 158. [02-31] Shell switches at exactly 767/768 (tab bar to 72px rail, no Manager tag) and 1023/1024 (rail to 248px sidebar) with no horizontal scroll at those widths
expected: Shell switches at exactly 767/768 (tab bar to 72px rail, no Manager tag) and 1023/1024 (rail to 248px sidebar) with no horizontal scroll at those widths
result: pass
source: automated
coverage_id: 02-31/D5
requirement: WEB-05
verified_by: web/e2e/admin.spec.ts#@admin switches from the phone tab bar to the tablet rail at 768px and to the full sidebar at 1024px

### 159. [02-31] Admin shell pixel- and style-equal to App. E.6 at 320/390/820/1440 and in 767.5px/1023.5px page roots, both themes
expected: Admin shell pixel- and style-equal to App. E.6 at 320/390/820/1440 and in 767.5px/1023.5px page roots, both themes
result: pass
source: automated
coverage_id: 02-31/D6
requirement: WEB-05
verified_by: npm --prefix web run parity -- --grep '@layouts-admin|@navigation|@brand|@layouts-public' (90 passed, three engines)

### 160. [02-31] Skip link first, main#main focus target, labelled landmarks, rail items keep their names, zero axe findings
expected: Skip link first, main#main focus target, labelled landmarks, rail items keep their names, zero axe findings
result: pass
source: automated
coverage_id: 02-31/D7
requirement: A11Y-02
verified_by: web/src/app/admin/AdminLayout.test.tsx#AdminLayout landmarks and keyboard (A11Y-01, A11Y-02); web/src/ui/navigation/Sidebar.test.tsx#Sidebar names on the tablet rail (A11Y-01, plan 02-31)

### 161. [02-32] Phone navigation drawer: opens from the Topbar menu button (aria-expanded/aria-controls), modal dialog named Navigation with the full Sidebar, focus trapped, closes on Esc/scrim/followed link with focus back on the menu button, body scroll class, frame inert
expected: Phone navigation drawer: opens from the Topbar menu button (aria-expanded/aria-controls), modal dialog named Navigation with the full Sidebar, focus trapped, closes on Esc/scrim/followed link with focus back on the menu button, body scroll class, frame inert
result: pass
source: automated
coverage_id: 02-32/D1
requirement: WEB-05
verified_by: web/src/ui/navigation/MobileNavDrawer.test.tsx (15 tests); web/src/app/admin/AdminLayout.test.tsx#AdminLayout phone navigation drawer (5 tests); npm --prefix web run e2e -- --grep @keyboard (drawer journeys, 3 tests x 5 projects at 390px)

### 162. [02-32] User menu: aria-haspopup button with aria-expanded opens a role=menu popover (surface-3, radius 12, shadow-2, min 200px) with My Profile and Logout; arrows wrap, Home/End jump, Esc returns focus, Tab and outside press close
expected: User menu: aria-haspopup button with aria-expanded opens a role=menu popover (surface-3, radius 12, shadow-2, min 200px) with My Profile and Logout; arrows wrap, Home/End jump, Esc returns focus, Tab and outside press close
result: pass
source: automated
coverage_id: 02-32/D2
requirement: A11Y-02
verified_by: web/src/ui/navigation/UserMenu.test.tsx (22 tests); web/src/app/admin/AdminLayout.test.tsx#AdminLayout user menu (3 tests); npm --prefix web run e2e -- --grep \"@keyboard|@admin\" (60 passed, five projects)

### 163. [02-32] 40-character user name wraps inside the sidebar chip and adds no width to the phone Topbar button at 320 and 390px
expected: 40-character user name wraps inside the sidebar chip and adds no width to the phone Topbar button at 320 and 390px
result: pass
source: automated
coverage_id: 02-32/D3
requirement: WEB-05
verified_by: npm --prefix web run parity -- --grep @overflow (web/visual/navigation-overflow.spec.ts, 2 widths x 3 engines)

### 164. [02-33] Production build measures public initial JS and CSS (gzip -9, 1 KB = 1000 B) and fails through this.error with the size table over 150 KB / 35 KB; exactly-at-limit passes
expected: Production build measures public initial JS and CSS (gzip -9, 1 KB = 1000 B) and fails through this.error with the size table over 150 KB / 35 KB; exactly-at-limit passes
result: pass
source: automated
coverage_id: 02-33/D1
requirement: PERF-01
verified_by: web/scripts/budget.test.ts#evaluateBudgets: public JS and CSS (production build); web/scripts/vite-budget-plugin.test.ts#fails the build through this.error with the size table when public JS is over its limit; npm --prefix web run build (public JS 129.94 KB, CSS 12.90 KB)

### 165. [02-33] Budget-mode build measures admin initial JS (<= 250 KB) and the admin-included public number with the 135 KB note
expected: Budget-mode build measures admin initial JS (<= 250 KB) and the admin-included public number with the 135 KB note
result: pass
source: automated
coverage_id: 02-33/D2
requirement: PERF-01
verified_by: web/scripts/budget.test.ts#evaluateBudgets: admin topology (budget-mode build with dev routes); web/scripts/budget.test.ts#evaluateBudgets: the Phase 4 barrel-split trigger (research Flag 4); npm --prefix web run build:budget (public 149.34 KB, admin 154.48 KB, CSS 12.90 KB, note printed)

### 166. [02-33] Fail-closed build-shape rules: missing entry or route module, not exactly one CSS asset, admin/src-dev/web-visual code or a second entry in production, .reference-* output or folders in wwwroot
expected: Fail-closed build-shape rules: missing entry or route module, not exactly one CSS asset, admin/src-dev/web-visual code or a second entry in production, .reference-* output or folders in wwwroot
result: pass
source: automated
coverage_id: 02-33/D3
requirement: PERF-01
verified_by: web/scripts/budget.test.ts#evaluateBudgets: no dev code in production (D-20, CWE-489); web/scripts/vite-budget-plugin.test.ts#budgetPlugin: the admin topology and the web root (D-20)

### 167. [02-33] npm run verify runs build:budget after build; the full gate passes warning-free
expected: npm run verify runs build:budget after build; the full gate passes warning-free
result: pass
source: automated
coverage_id: 02-33/D4
requirement: PERF-01
verified_by: web/scripts/verify.test.ts#runs typecheck, lint, format:check, test:coverage, build, build:budget, license:check and notices:check in that order; npm --prefix web run verify (exit 0; 95 files, 2313 tests)

### 168. [02-34] @/ui exports the 37 App. D.3 components, the six constants/hooks, the SPEC-GAP primitives and the csps helpers, each identical to its area barrel export
expected: @/ui exports the 37 App. D.3 components, the six constants/hooks, the SPEC-GAP primitives and the csps helpers, each identical to its area barrel export
result: pass
source: automated
coverage_id: 02-34/D1
requirement: WEB-06
verified_by: web/src/ui/index.test.ts (63 cases)

### 169. [02-34] Every component name in every scenario tree resolves in the implementation kit
expected: Every component name in every scenario tree resolves in the implementation kit
result: pass
source: automated
coverage_id: 02-34/D2
requirement: WEB-02
verified_by: web/src/dev/kit.test.ts (189 cases)

### 170. [02-34] /dev/components renders the showcase (page head, sections in order, every non-layout scenario, icon names, live demos) inside the admin shell with no current sidebar item
expected: /dev/components renders the showcase (page head, sections in order, every non-layout scenario, icon names, live demos) inside the admin shell with no current sidebar item
result: pass
source: automated
coverage_id: 02-34/D3
requirement: WEB-06
verified_by: web/src/dev/ComponentShowcase.test.tsx (23 cases) + showcaseSections.test.ts (4); npm --prefix web run e2e -- --grep \"@showcase|@admin|@public\" (105 passed, 25 of them @showcase)

### 171. [02-34] Page-level axe, console and CSP clean on /dev/components in Blush and Espresso in all five projects; open Delete Order dialog axe-clean
expected: Page-level axe, console and CSP clean on /dev/components in Blush and Espresso in all five projects; open Delete Order dialog axe-clean
result: pass
source: automated
coverage_id: 02-34/D4
requirement: A11Y-01
verified_by: web/e2e/showcase.spec.ts#@showcase /dev/components in Blush|Espresso

### 172. [02-35] Lighthouse on the production public shell, real host, mobile profile: every category >= 0.95, LCP < 2000 ms, CLS < 0.05, TBT < 200 ms, enforced by a tested assertion
expected: Lighthouse on the production public shell, real host, mobile profile: every category >= 0.95, LCP < 2000 ms, CLS < 0.05, TBT < 200 ms, enforced by a tested assertion
result: pass
source: automated
coverage_id: 02-35/D1
requirement: PERF-02
verified_by: web/scripts/lighthouse-assert.test.ts (34 cases: boundaries, precision, missing, order, planSteps, executeSteps); npm --prefix web run lighthouse (a11y 0.98, best-practices 1, performance 0.99, seo 1, agentic-browsing 1; LCP 1961.9 ms, CLS 0, TBT 6 ms)

### 173. [02-35] Route preload and Optimal compression that brought LCP under 2000 ms
expected: Route preload and Optimal compression that brought LCP under 2000 ms
result: pass
source: automated
coverage_id: 02-35/D2
requirement: PERF-02
verified_by: web/scripts/vite-route-preload-plugin.test.ts (8 cases); tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#CompressesAtTheOptimalLevel

### 174. [02-35] Responsive sweep: every page at 320-1920 px portrait and landscape, no sideways scroll (Topbar owner item asserted per engine), one h1, skip link, named landmarks, axe, 16px phone inputs, no zoom lock
expected: Responsive sweep: every page at 320-1920 px portrait and landscape, no sideways scroll (Topbar owner item asserted per engine), one h1, skip link, named landmarks, axe, 16px phone inputs, no zoom lock
result: pass
source: automated
coverage_id: 02-35/D3
requirement: PERF-03
verified_by: web/e2e/responsive.spec.ts (@responsive, 13 pages x 5 projects)
note: Passes only through the TOPBAR_MIN_PAGE_WIDTH exemption in web/e2e/responsive.spec.ts; the underlying no-sideways-scroll truth is open as test 7 (verifier gap 1).

### 175. [02-35] ₱ renders in Archivo Variable; one font preload; same-origin woff2 only
expected: ₱ renders in Archivo Variable; one font preload; same-origin woff2 only
result: pass
source: automated
coverage_id: 02-35/D4
requirement: PERF-05
verified_by: web/e2e/fonts.spec.ts (@fonts, 15 of 15 in 5 projects)

### 176. [02-35] Owner WCAG rulings on computed styles: D-02, D-03, D-05, D-BL-02, O-3, O-6
expected: Owner WCAG rulings on computed styles: D-02, D-03, D-05, D-BL-02, O-3, O-6
result: pass
source: automated
coverage_id: 02-35/D5
requirement: A11Y-04
verified_by: web/e2e/a11y-rulings.spec.ts (@a11y-rulings, 52 tests per project)

### 177. [02-35] Keyboard journeys: skip link, Tabs, SegmentedControl, Modal and slide-over trap and return, ConfirmDialog focus, toast Dismiss
expected: Keyboard journeys: skip link, Tabs, SegmentedControl, Modal and slide-over trap and return, ConfirmDialog focus, toast Dismiss
result: pass
source: automated
coverage_id: 02-35/D6
requirement: A11Y-02
verified_by: web/e2e/keyboard.spec.ts + admin-keyboard.spec.ts (@keyboard, all 5 projects); web/src/dev/ComponentShowcase.test.tsx#opens the Delete Payment confirm (no type-to-confirm field) with focus on Cancel; it deletes nothing

### 178. [02-35] Full parity matrix with no filter (motion and touch passes included) in Chromium, Firefox and WebKit
expected: Full parity matrix with no filter (motion and touch passes included) in Chromium, Firefox and WebKit
result: pass
source: automated
coverage_id: 02-35/D7
requirement: QUAL-04
verified_by: npm --prefix web run parity (452 of 452, 29.9 min)

### 179. [02-37] npm run typecheck runs TypeScript 7.0.2 with zero errors over the scaffold under the PRD 17.2 strict set, while require('typescript').version is 6.0.3 for tooling
expected: npm run typecheck runs TypeScript 7.0.2 with zero errors over the scaffold under the PRD 17.2 strict set, while require('typescript').version is 6.0.3 for tooling
result: pass
source: automated
coverage_id: 02-37/D1
requirement: QUAL-02
verified_by: npm --prefix web run typecheck (exit 0, 0 'error TS' lines); npx --prefix web tsc --version -> Version 7.0.2; tsc6 -p both configs exit 0; web/src/test/build-config.node.test.ts#TypeScript alias pair (D-15)

### 180. [02-37] Every Vite mode is pinned by test: port 5180, strictPort, /api proxy to http://localhost:5115, per-mode outDir, __DEV_ROUTES__ true only in development/e2e/budget, license false, no source maps, assetsInlineLimit 0
expected: Every Vite mode is pinned by test: port 5180, strictPort, /api proxy to http://localhost:5115, per-mode outDir, __DEV_ROUTES__ true only in development/e2e/budget, license false, no source maps, assetsInlineLimit 0
result: pass
source: automated
coverage_id: 02-37/D2
requirement: WEB-01
verified_by: web/src/test/build-config.node.test.ts#vite.config.ts (11 cases)

### 181. [02-37] The production build copies robots.txt (User-agent: *, Allow: /) into wwwroot and leaves git status clean
expected: The production build copies robots.txt (User-agent: *, Allow: /) into wwwroot and leaves git status clean
result: pass
source: automated
coverage_id: 02-37/D3
requirement: WEB-01
verified_by: web/src/test/build-config.node.test.ts#web/public/robots.txt allows every crawler; npm --prefix web run build; src/Csps.Server/wwwroot/robots.txt exists; git status --porcelain empty

### 182. [02-37] tools/openapi-gen installs exactly openapi-typescript 7.13.0 and typescript 5.9.3 from the committed lockfile, audits clean, no deprecation
expected: tools/openapi-gen installs exactly openapi-typescript 7.13.0 and typescript 5.9.3 from the committed lockfile, audits clean, no deprecation
result: pass
source: automated
coverage_id: 02-37/D4
requirement: QUAL-02
verified_by: npm --prefix tools/openapi-gen ci (no npm warn); npm --prefix tools/openapi-gen audit --audit-level=high (0); npm --prefix tools/openapi-gen ls --depth=0

### 183. [02-38] One data-only scenario list discovered from groups/*.ts with unique ids, group equal to file name, and button-primary-md (primary md 'Save Order', light+dark, four states, parity)
expected: One data-only scenario list discovered from groups/*.ts with unique ids, group equal to file name, and button-primary-md (primary md 'Save Order', light+dark, four states, parity)
result: pass
source: automated
coverage_id: 02-38/D1
requirement: WEB-02
verified_by: web/src/dev/scenarios/index.test.ts (15 tests)

### 184. [02-38] assertSerializable rejects functions, class instances, symbols, undefined, bigint and non-finite numbers, naming the scenario id and the prop path
expected: assertSerializable rejects functions, class instances, symbols, undefined, bigint and non-finite numbers, naming the scenario id and the prop path
result: pass
source: automated
coverage_id: 02-38/D2
requirement: WEB-02
verified_by: web/src/dev/scenarios/index.test.ts#assertSerializable

### 185. [02-38] renderNode renders button-primary-md as one 'Save Order' button, nested nodes as elements, handler props as functions, and an unknown component as a 'Missing component: <name>' alert
expected: renderNode renders button-primary-md as one 'Save Order' button, nested nodes as elements, handler props as functions, and an unknown component as a 'Missing component: <name>' alert
result: pass
source: automated
coverage_id: 02-38/D3
requirement: WEB-02
verified_by: web/src/dev/renderScenario.test.tsx (4 tests)

### 186. [02-38] extract-spec.mjs writes App. A, A.2, A.3, B, C, D.1, D.3, D.4 and D.5 byte for byte (LF) into git-ignored web/visual/.reference-src/ and exits 1 when the appendix SHA-256 differs from the committed pin
expected: extract-spec.mjs writes App. A, A.2, A.3, B, C, D.1, D.3, D.4 and D.5 byte for byte (LF) into git-ignored web/visual/.reference-src/ and exits 1 when the appendix SHA-256 differs from the committed pin
result: pass
source: automated
coverage_id: 02-38/D4
requirement: WEB-02
verified_by: web/visual/reference/extract-spec.test.ts (24 tests); node web/visual/reference/extract-spec.mjs (exit 0, nine files); sed+tr -d '\\r' of each spec range cmp-equal to each output file; sha256sum of the concatenated files = pin

### 187. [02-39] QUERY_DEFAULTS are exactly staleTime 30 s, gcTime 5 min, retry false, refetchOnWindowFocus true, mutation retry false, and createQueryClient() applies them with its own cache
expected: QUERY_DEFAULTS are exactly staleTime 30 s, gcTime 5 min, retry false, refetchOnWindowFocus true, mutation retry false, and createQueryClient() applies them with its own cache
result: pass
source: automated
coverage_id: 02-39/D1
requirement: WEB-08
verified_by: web/src/lib/query/queryClient.test.ts (4 cases)

### 188. [02-39] A list query keys on listKey(resource, parsed params), forwards its AbortSignal, keeps the previous page visible with isPlaceholderData true until the next page arrives, and aborts the in-flight request on unmount
expected: A list query keys on listKey(resource, parsed params), forwards its AbortSignal, keeps the previous page visible with isPlaceholderData true until the next page arrives, and aborts the in-flight request on unmount
result: pass
source: automated
coverage_id: 02-39/D2
requirement: WEB-08
verified_by: web/src/lib/query/useListQuery.test.tsx (5 cases)

### 189. [02-39] The search key settles 300 ms after the last keystroke, restarts on a change within 300 ms, fetches once per settled value and aborts the superseded 'jer' request when it settles on 'jersey'
expected: The search key settles 300 ms after the last keystroke, restarts on a change within 300 ms, fetches once per settled value and aborts the superseded 'jer' request when it settles on 'jersey'
result: pass
source: automated
coverage_id: 02-39/D3
requirement: WEB-08
verified_by: web/src/lib/query/useDebouncedValue.test.tsx (6 cases, fake timers, one input event per character)

### 190. [02-39] Intent prefetch fires queryClient.query once after 100 ms of focus or mouse hover, is cancelled by blur/pointerleave, ignores touch pointers, swallows a rejection (error kept in the cache), adds no markup and never calls prefetchQuery
expected: Intent prefetch fires queryClient.query once after 100 ms of focus or mouse hover, is cancelled by blur/pointerleave, ignores touch pointers, swallows a rejection (error kept in the cache), adds no markup and never calls prefetchQuery
result: pass
source: automated
coverage_id: 02-39/D4
requirement: WEB-08
verified_by: web/src/lib/query/prefetchOnIntent.test.tsx (12 cases)

### 191. [02-40] tw(classes) is an identity marker; every class string in this plan's files is a complete literal in tw('…') or className, and the class gate reports zero findings across src
expected: tw(classes) is an identity marker; every class string in this plan's files is a complete literal in tw('…') or className, and the class gate reports zero findings across src
result: pass
source: automated
coverage_id: 02-40/D1
requirement: WEB-02
verified_by: web/scripts/tailwind-classes.test.ts (26 cases, real-source sweep) and node web/scripts/class-gate.mjs (exit 0)

### 192. [02-40] <Icon name size label? /> renders one lucide svg with the App. D.3 wrapper (size default 20 -> width/height, viewBox 0 0 24 24, fill none, stroke currentColor, stroke-width 2, round caps/joins), the .csp-icon look, lucide's own classes, role img + aria-label when labelled, else aria-hidden; strokeWidth and className pass through
expected: <Icon name size label? /> renders one lucide svg with the App. D.3 wrapper (size default 20 -> width/height, viewBox 0 0 24 24, fill none, stroke currentColor, stroke-width 2, round caps/joins), the .csp-icon look, lucide's own classes, role img + aria-label when labelled, else aria-hidden; strokeWidth and className pass through
result: pass
source: automated
coverage_id: 02-40/D2
requirement: WEB-02
verified_by: web/src/ui/brand/Icon.test.tsx (Icon describe, 10 cases)

### 193. [02-40] ICONS holds exactly the 56 App. D.5 names, IconName is exactly that union, trash-2 is lucide's Trash and filter is lucide's Funnel (D-32), and every name renders a lucide svg with a drawing
expected: ICONS holds exactly the 56 App. D.5 names, IconName is exactly that union, trash-2 is lucide's Trash and filter is lucide's Funnel (D-32), and every name renders a lucide svg with a drawing
result: pass
source: automated
coverage_id: 02-40/D3
requirement: WEB-02
verified_by: web/src/ui/brand/Icon.test.tsx (ICONS describe, 59 cases incl. it.each over the 56 names)

### 194. [02-40] A labelled Icon passes expectNoAxeViolations with zero violations
expected: A labelled Icon passes expectNoAxeViolations with zero violations
result: pass
source: automated
coverage_id: 02-40/D4
requirement: A11Y-01
verified_by: web/src/ui/brand/Icon.test.tsx#has no axe violations when labelled (A11Y-01)

### 195. [02-40] srOnlyClasses and pageRootClasses equal the .csp-sr and .s-page transcriptions, pass the class gate and compile to their declarations (clip: rect(0 0 0 0); container-type inline-size, container-name pg)
expected: srOnlyClasses and pageRootClasses equal the .csp-sr and .s-page transcriptions, pass the class gate and compile to their declarations (clip: rect(0 0 0 0); container-type inline-size, container-name pg)
result: pass
source: automated
coverage_id: 02-40/D5
requirement: WEB-02
verified_by: web/src/ui/layout/layout.recipe.node.test.ts (5 cases)

### 196. Focus and timer fixes on /dev/components (R2-21)
expected: On /dev/components - open a dialog from another dialog and close them in turn (each closes on top, focus goes back to what opened it); show a toast while a dialog is open and reach it with the keyboard; dismiss a toast and focus lands somewhere sensible; change the Pagination page and focus stays on the pagination.
result: pass
source_plans: [02-VERIFICATION human item 5, 999.1 R2-21]
why_human: Focus feel is a hands-on judgment.

### 197. Ctrl/Cmd+K inside fields goes to the admin search (WR-01)
expected: On an admin page (e.g. /admin/orders), click into any text field and press Ctrl+K (Cmd+K on a Mac) - the cursor jumps to the top-bar search, and the browser's address bar does NOT take focus. Press it again while in the search box - focus stays and the search text is selected. On a Mac, Ctrl+K inside a text field still deletes to the end of the line.
result: pass
source_plans: [quick-261013-lgi WR-01]
why_human: Browser-level shortcut handling differs per browser and OS; jsdom cannot press the real browser shortcut.

### 198. Amount box paste message (WR-02, WR-03, WR-04)
expected: On /dev/components, paste text like "abc" into an amount box - the message "Enter an amount like 1250.50..." appears and (with a screen reader on) is read once. Type a valid amount - the message and the red look go away. A read-only amount box ignores a paste completely.
result: pass
source_plans: [quick-261013-lgi WR-02/WR-03/WR-04]
why_human: What a real screen reader announces cannot be tested in jsdom. The screen-reader part may be skipped to the A11Y-05 pass in Phase 14.

### 199. Dialogs fit and can be used in a short browser window
expected: Any dialog (e.g. Open Delete Order on /dev/components) sits centred on the screen and, when the browser window is short (a laptop at 125-150% zoom), the whole dialog, including its Cancel and Delete buttons, can be seen or scrolled to.
result: issue
reported: "pass, but the \"Open Delete Order\" isnt dialog isnt showing center horizontally" (owner screenshot: Chrome, 1911x880 screen px at about 150% zoom; the Delete Order dialog's buttons are cut off at the bottom)
severity: major
found_during: test 196
diagnosis_note: |
  Measured in the browser pane. Horizontal: the dialog is centred on the whole window (centre 720 of 1440; in the owner's screenshot 952 of 1911), as App. C .s-overlay draws it (fixed inset-0, justify-center). It looks left of centre because the admin sidebar takes the left part of the screen and the dialog is not centred on the content area. Vertical: the overlay pins the dialog 140px from the top (pt-[140px], items-start), has overflow-y visible, and the page scroll is locked, while the dialog has no max-height. At 1274x585 CSS px (the owner's window) the dialog runs from 140 to 630 and its Cancel / Delete Order buttons end at 613, below the 585px window, with no way to scroll to them. A mouse user cannot reach them; WCAG 1.4.10 Reflow (400% zoom) fails the same way.


## Summary

total: 199
passed: 198
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-2-199
  truth: "Any dialog is fully visible or scrollable in a short window (laptop at 125-150% zoom, WCAG 1.4.10), and its horizontal position matches what the owner expects"
  status: failed
  reason: "User reported: pass, but the \"Open Delete Order\" isnt dialog isnt showing center horizontally"
  severity: major
  test: 199
  root_cause: "overlayClasses (web/src/ui/overlays/overlays.recipe.ts, App. C .s-overlay) pins every dialog 140px below the top (pt-[140px], items-start) with overflow-y visible, and useBodyScrollLock stops the page scrolling; the dialog has no max-height. When 140px + dialog height > window height (e.g. 1274x585 CSS px: Delete Order dialog 140..630, buttons end at 613), the bottom of the dialog, including Cancel / Delete Order, is off screen and cannot be reached. Horizontal position is by design: centred on the window."
  owner_decision: "2026-10-13 (UAT): keep dialogs centred on the whole window (no change). On a short window, move the dialog up toward the top so the whole dialog is visible (the 140px top gap shrinks, down to the normal 16px edge gap); on tall windows the approved 140px position is unchanged. If the window is too short even then, the backdrop scrolls so the buttons can still be reached (WCAG 1.4.10). Desktop overlay only; the phone bottom-sheet layout (pg-phone) is out of scope unless it has the same defect."
  artifacts:
    - path: "web/src/ui/overlays/overlays.recipe.ts"
      issue: "fixed 140px top padding, items-start, no overflow-y and no shrinking top gap"
    - path: "web/visual/reference/rulings.css"
      issue: "the frozen reference needs the same ruled rule (D-08) so parity stays equal"
  missing:
    - "A top gap that shrinks from 140px to 16px when the dialog would not fit, e.g. a shrinkable spacer in a column flex overlay"
    - "overflow-y auto on the overlay as the last-resort fallback"
    - "A Playwright check at a short window (e.g. 1274x585 and 1280x500) that the dialog's buttons are inside the window or reachable by scrolling, in all engines"
    - "Unit/recipe test for the new overlay classes; rulings.css entry and an intentional-differences row (D-08)"
  debug_session: ""
  fix_plan: "02-41-PLAN.md, 02-42-PLAN.md (gap_ids: [G-2-199])"
  fix_state: "layout implemented by 02-41; backdrop close rule completed by 02-42 (overlay scrollbars, middle and right presses; real-scrollbar Chromium projects); awaiting /gsd-verify-work 2 and the owner's re-check of test 199"
  phone_check: "same defect before the fix (393x659: Delete Order ends at 680 > 659; 320x568: 759; 659x393: 618; 412x839 fits); fixed by the same D-42 rule (96px gap shrinks to 0, backdrop scrolls)"

