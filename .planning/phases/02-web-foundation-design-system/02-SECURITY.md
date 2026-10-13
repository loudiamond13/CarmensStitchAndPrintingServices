---
phase: "02"
slug: "web-foundation-design-system"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
scope: "all 40 executed plans 02-01..02-40, after the phase code-review fixes (code as of ee6ec9c; HEAD 46779e9 adds docs only)"
created: "2026-10-13T11:11:26-05:00"
updated: "2026-10-13T11:11:26-05:00"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Result: SECURED at ASVS level 1, block_on high.** The register has 84 threats: T-02-01 to T-02-83, plus T-02-SC (package installs), which every one of the 40 plans declares and which is counted once here. All 84 are closed: 81 mitigated, 2 accepted (T-02-20, T-02-59) and 1 transferred (T-02-57). `threats_open` is 0.

- **Depth (L1):** each mitigation was found in the cited code, config or test. Nothing was traced deeper than that.
- **Paths:** every path below is relative to the repository root, `C:\Work\CarmensStitchAndPrintingServices\`.
- **Supersedes:** `superseded-2026-10-08/02-SECURITY.md`, the partial audit of the plans before the D-33 replan. That file is kept unchanged as history.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → ASP.NET Core static files and SPA fallbacks (02-01, 02-03, 02-29) | Untrusted, encoded, cased and aliased paths and any method reach the file lookup and the anonymous fallbacks under a default-deny policy | Request paths and methods (untrusted); public app files |
| HTTPS response compression (02-03) | Compressed responses can leak secrets through their length (BREACH) | html, css, js and svg only; JSON and ProblemDetails are never compressed |
| test host → web root (02-01) | Tests must never depend on build output that may hold anything | Fixture web root files |
| npm registry → web/ and tools/openapi-gen/ → shipped bundle (02-02, 02-06, 02-37, 02-40) | Third-party code and its licenses enter at install time and ship to the browser | Package code, licenses (supply chain) |
| build output and build mode → deployable wwwroot (02-02, 02-13, 02-14, 02-31, 02-33, 02-34, 02-37) | Whatever lands in wwwroot ships in Phase 3; dev-only routes, the showcase, the parity page, the reference and seed data must never get there | Build artefacts, dev-only code and seed data |
| developer code and class strings → shipped bundle and generated CSS (02-04, 02-05, 02-19, 02-40) | Lint and the class gate are the barriers against unsafe patterns and silent no-CSS class names | Markup patterns, class tokens |
| client preview and API figures → staff decision (02-07, 02-23) | Staff read totals on screen; a wrong preview or client-side arithmetic misleads | Order money figures (financial) |
| keyboard and clipboard → money, code and password fields (02-08, 02-20, 02-27) | Untrusted text becomes an amount, a sign-in code or a password | Amounts, OTP codes, passwords (sensitive) |
| test runner and test tooling → shared machine (02-09, 02-35, 02-36) | Test and review hosts share ports, LocalDB and processes with TheBETSLLC | Ports 5180/5115/7028/5199, processes |
| E2E host → database (02-09) | Seeding must never touch a non-test database | Seed writes to CSPS_E2E only |
| browser → own API (02-10, 02-39) | Every request leaves through one client; responses are untrusted; any keystroke or hover could become a request | Query strings, Idempotency-Keys, (Phase 4) tokens |
| URL query string → app state and list filters (02-11, 02-30) | Any link, bookmark or attacker can craft the query string | List params, free-text search |
| build → CSP font-src 'self' (02-12) | Fonts must load from the app origin only | Font files |
| spec document, owner rulings and scenario list → parity reference (02-13, 02-38) | An unreviewed spec edit or a non-serializable scenario could move or skew the visual yardstick | Approved design code (test-only) |
| approved design → implementation (02-14) | The look must not drift silently | Rendered pixels and computed styles |
| API contract → web types (02-15) | Hand-written or stale types hide breaking changes | OpenAPI snapshot, generated types |
| user action → write and destructive requests (02-16, 02-17, 02-22) | Repeated clicks and retries reach money-changing and delete endpoints in later phases | Order, payment and delete requests (financial) |
| API data and server messages → DOM (02-18, 02-21, 02-24, 02-28, 02-29, 02-30) | Untrusted text and error detail are rendered in cells, labels, toasts and banners | Customer and team text, error text, traceId |
| local files → uploader (02-25) | Users choose files; the uploads themselves arrive in Phase 9 | User-chosen image files |
| navigation → routes (02-26) | Links and the Logout control drive navigation and sign-out | Paths, sign-out action |
| localStorage → theme (02-31) | Client storage anyone can change | The `csps-theme` value |
| keyboard and touch → overlay navigation (02-32) | Focus must never escape or be lost | Focus, Esc and scrim events |
| local design exports → repository and CI (02-36) | The owner's design files are private, local-only material | Design HTML and its renders |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|----------|-------------|------------|--------|----------|
| T-02-01 | Elevation of privilege | Anonymous SPA/static fallbacks under the fallback policy | high | mitigate | Only the five SPA keys are AllowAnonymous, each with a matrix row and an allow-list entry; the discovery test fails on any other anonymous endpoint (CWE-862) | closed | `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs:52-81`: the allow-list holds the 5 SPA keys plus the earlier /health and /api fallback. `AuthorizationMatrixTests.cs:34` DiscoveredEndpointsAreFullyCovered. `src/Csps.Server/Endpoints/SpaHosting.cs:53-69` |
| T-02-02 | Information disclosure | Shell fallback swallowing `/api/*` | medium | mitigate | Literal `/api/{**path}` fallback outranks `{*path:nonfile}` | closed | `src/Csps.Server/Endpoints/ApiRouting.cs:14,27` (literal `/api/{**path}`); `SpaHostTests.cs:59` UnknownApiRouteIsStillProblem404 |
| T-02-03 | Information disclosure | `/openapi`, `/scalar` in production | medium | mitigate | Reserved-prefix 404 fallbacks outside Development (D-29) | closed | `SpaHosting.cs:40,55-64`; `SpaHostTests.cs:112`; `OpenApiExposureTests.cs:59` ProductionHasNoApiDocs |
| T-02-04 | Spoofing | POST to page paths reaching the shell | low | mitigate | MapFallbackToFile is GET/HEAD only; any other method meets default-deny | closed | `SpaHosting.cs:68` (MapFallbackToFile answers GET/HEAD only); `AuthorizationFailureTests.cs:163` UnservedMethodOnAPagePathIsChallenged (401) |
| T-02-05 | Tampering | index.html / built HTML under the strict CSP | medium | mitigate | No inline script, style or style attribute; a build-output test asserts it | closed (see W-1) | `web/src/test/build-output.node.test.ts:46-53`. Second layer: the E2E CSP guard `web/e2e/fixtures.ts:54` |
| T-02-06 | Information disclosure | Source maps and `.vite/license.md` in wwwroot | medium | mitigate | `sourcemap: false`, `license: false` (D-35); the build-output test asserts no `.map` and no `.vite` | closed | `web/vite.config.ts:100-102`; `build-config.node.test.ts:104-112`; `build-output.node.test.ts:113-118`; HiddenSegmentFileProvider hides `.vite` on the server |
| T-02-07 | Tampering | Built output committed or mixed with tracked files | low | mitigate | The whole wwwroot is git-ignored; dev-route builds use separate ignored dist folders | closed | `.gitignore:38` (all of wwwroot) and `:40-46` (dist folders); `git ls-files src/Csps.Server/wwwroot` is empty |
| T-02-08 | Information disclosure | Build internals and dot folders in the web root (CWE-200/538/497, CWE-41/58) | high | mitigate | HiddenSegmentFileProvider refuses `.` and `~` segments on `/` and `\`; identical 404 with no file metadata (CWE-204) | closed | `src/Csps.Server/Composition/HiddenSegmentFileProvider.cs:42-64`; `Program.cs:59` wraps `WebRootFileProvider` itself (NET-WR-03); `HiddenSegmentFileProviderTests.cs:41` covers encoded, cased, `%5C` and `VITE~1` paths, with no ETag, Last-Modified or Accept-Ranges; `:216` TheHostsWebRootProviderIsTheWrapper |
| T-02-09 | Information disclosure | Response compression of dynamic JSON (BREACH) | medium | mitigate | MIME list limited to html/css/js/svg | closed | `SpaRegistration.cs:32,51-52` (html/css/js/svg only); `SpaHostTests.cs:147` NeverCompressesJson |
| T-02-10 | Denial of service | Stale cached shell after a deploy | low | mitigate | index.html and non-hashed files `no-cache`; only hashed `/assets/*` immutable | closed | `SpaRegistration.cs:60-66`; `SpaHosting.cs:90-91`; tests AssetsAreImmutable and OtherStaticFilesRevalidate |
| T-02-11 | Tampering | Raw HTML injection via `dangerouslySetInnerHTML` (CWE-79) | high | mitigate | Lint ban in syntaxBans, proven in every override block; strict CSP second layer | closed | `web/eslint.config.mjs:102-145` syntaxBans, widened by TOOL-WR-12 to innerHTML/outerHTML, insertAdjacentHTML, setHTMLUnsafe, document.write, DOMParser, createElement props and srcdoc; `lint-rules.node.test.ts:212-245` and `:377-415` (every override block); StrictCsp `SecurityHeadersMiddleware.cs:16-17`; a grep finds 0 raw-HTML sinks in `web/src` |
| T-02-12 | Tampering | Inline styles pressuring a CSP relaxation | medium | mitigate | `style` limited to `--*` custom properties; `cssText` and `setAttribute("style")` banned | closed | `eslint.config.mjs:59-70` and `:151-157` (cssText, setAttribute style); `lint-rules.node.test.ts:247-301` |
| T-02-13 | Repudiation | Silencing a rule with disable comments | low | mitigate | `reportUnusedDisableDirectives: "error"`, `--max-warnings 0`, reasons on deliberate disables | closed | `eslint.config.mjs:410` reportUnusedDisableDirectives "error"; `web/package.json:15` `--max-warnings 0`; `eslint-config.node.test.ts:80`; every eslint-disable in src carries a `-- reason` |
| T-02-14 | Information disclosure | Direct `fetch` bypassing the single HTTP client | medium | mitigate | `no-restricted-globals`, member selector and import patterns; only src/lib/http/** and src/lib/api.ts exempt | closed | `eslint.config.mjs:53-56,214-217`, import patterns; exemptions limited to `:227-243` (src/lib/http/**, api.ts); `lint-rules.node.test.ts:74-126` |
| T-02-15 | Tampering | Class tokens built from data or concatenation | medium | mitigate | Class gate compiles every literal token; lint bans template and concatenated class names | closed | `eslint.config.mjs:72-91`; `web/scripts/class-gate.mjs` (follows identifiers and imports, TOOL-WR-06); `scripts/tailwind-classes.test.ts:101-290` |
| T-02-16 | Tampering | Hand-written CSS re-entering | low | mitigate | Stylesheet contract test: exactly two files, allowed constructs only | closed | `web/src/styles/stylesheet-contract.node.test.ts:206-211` (exactly app.css and base.css), `:256-300` |
| T-02-17 | Tampering | Unregistered or unpinned npm packages (T1195) | high | mitigate | Registry test fails on any unregistered pin or range; overrides count as pins | closed | `tests/Csps.ArchitectureTests/PackagePins.cs:32-35` (deps, devDeps, optional, peer, overrides, bundled; NET-WR-05); `:114-118` an unknown section fails closed; `DependencyRegistryTests.cs:154,243,265,300,344` |
| T-02-18 | Repudiation | License drift into the shipped tree | medium | mitigate | License gate in verify; production tree allow-list only; stale-exception failure | closed | `web/scripts/license-gate.mjs:110-112,148`; `license-policy.mjs:65,129-135` (WITH allow-list, TOOL-WR-01) and `:347` (guessed licenses fail, TOOL-WR-02); `verify.mjs:18` |
| T-02-19 | Tampering | Client/server rounding disagreement (Core Value) | high | mitigate | Shared golden vectors in both suites; integer centavos; drift check; Domain 100% coverage | closed | `tests/fixtures/order-math-golden-vectors.json` (220 cases); `OrderMathGoldenVectorTests.cs:101`; `web/src/lib/csps.golden.test.ts:35`; `scripts/gen-golden-vectors.test.ts:108-135` (drift); Domain coverage 100% (REVIEW-FIX-dotnet); an unknown DiscountKind now throws (NET-WR-01) |
| T-02-20 | Repudiation | A preview mistaken for a saved figure | low | accept | Documented in the csps.ts header; Phase 8 screens replace previews with server figures | closed (accepted) | Rationale at `web/src/lib/csps.ts:4-7`; follow-up at `.planning/ROADMAP.md:950-956` (999.2, Test 6). See AR-02-03 |
| T-02-21 | Tampering | Pasted or typed amounts (CWE-20) | medium | mitigate | MONEY_TEXT allow-list, minus rejected, exact integer conversion; the server re-validates later | closed | `web/src/lib/format.ts:65` MONEY_TEXT; `:86-98` grouping only in valid positions (LIB-WR-06); `:117` exact centavos |
| T-02-22 | Information disclosure | Wrong-day dates around midnight UTC | low | mitigate | Business-zone formatting with year-boundary tests | closed | `format.ts:7,47-50` (Asia/Manila); `format.test.ts:42-47` |
| T-02-23 | Denial of service | Killing or reusing a server of another project | medium | mitigate | Preflight, busy-port refusal, `reuseExistingServer: false`; no kill commands | closed | `web/playwright.config.ts:47` reuseExistingServer false; `scripts/e2e.mjs:59,337`; `scripts/shared-machine.mjs:28` (TOOL-WR-08); only its own child is killed (`lighthouse.mjs:193-227,295`) |
| T-02-24 | Tampering | Seeding the wrong database | high | mitigate | Only through tools/Csps.DevSeed and DevSeedTargetGuard (CSPS_Dev/CSPS_E2E on `(localdb)\CSPS` only) | closed | `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs`; `tools/Csps.DevSeed/Program.cs:28`; `e2e.mjs:64-70` and `owner-review.mjs:181-186` seed only through this tool |
| T-02-25 | Information disclosure | Secrets in committed config or env | medium | mitigate | Secrets from user-secrets (Development); env vars set on the child process only | closed | `playwright.config.ts:50-54`: env is set on the child process only and holds no secret |
| T-02-26 | Information disclosure | Secrets in query strings (CWE-598) | high | mitigate | Secret-named params rejected before sending; tested | closed | `web/src/lib/http/httpClient.ts:132-140,202-209` checks the built URL (LIB-WR-08); `:431` runs it on every attempt; 100% coverage gate at `vitest.config.ts:40` |
| T-02-27 | Tampering | Duplicate writes from retries | high | mitigate | Only keyed POSTs retried; the same key on every attempt; capped retries; Query retry false | closed | `httpClient.ts:120,128,383` (at most 2 retries); `:454-464` (a POST retries only with a key; a keyed FormData body never retries, LIB-CR-02); `:404`; `lib/query/queryClient.ts:10,14` retry false |
| T-02-28 | Spoofing | Cross-origin credential leakage | medium | mitigate | `credentials: "same-origin"`; baseURL relative to the app origin | closed | `httpClient.ts:286` credentials "same-origin"; `lib/api.ts:58` baseURL "/api/v1" |
| T-02-29 | Denial of service | Refresh storms on mass 401 | low | mitigate | Single-flight refresh; one onUnauthorized call | closed | `httpClient.ts:392-394,495-545`: single flight, stale-401 handling (LIB-WR-04), skipAuthRefresh (LIB-WR-03) |
| T-02-30 | Tampering | Untrusted query params (CWE-20) | medium | mitigate | Allow-list parsers for every param; defaults on invalid input; one canonical rewrite | closed | `lib/url-state/parsers.ts:16-35,73,103`; `createListParams.ts:94-110` canonical rewrite; `createListParams.test.tsx:90-153` |
| T-02-31 | Spoofing | Open redirect through params (CWE-601) | medium | mitigate | No param reaches `href`, `navigate()` or a redirect without a parser; no `<Navigate>` for query params | closed | Rule stated at `UrlStateLayout.tsx:6`; a grep finds no `<Navigate>` or `navigate()` fed by a param (the only navigate is the constant at `SiteHeader.tsx:60`) |
| T-02-32 | Information disclosure | Personal data and secrets in URLs and history (CWE-598) | medium | mitigate | Privacy key names refused at definition; only free-text `q` | closed | `createListParams.ts:63-79`: forbidden key names throw at definition |
| T-02-33 | Tampering | Inlined data: fonts violating the CSP `font-src` self rule | low | mitigate | `assetsInlineLimit: 0`; build-output test rejects `data:font` | closed | `vite.config.ts:99` assetsInlineLimit 0; `build-config.node.test.ts:104-112`; `build-output.node.test.ts:95-99` |
| T-02-34 | Denial of service | Layout shift from font swap (CLS budget) | low | mitigate | Metric-matched fallbacks with a drift test; one preload | closed | `scripts/font-metrics.mjs` and its test; `vite-preload-font-plugin.ts` (exactly one preload); `build-output.node.test.ts:76` (residual R-6) |
| T-02-35 | Information disclosure | Test-only reference or dev scenarios shipped (CWE-489) | medium | mitigate | Reference in web/visual with its own outDir; reference folders git-ignored; budget plugin asserts wwwroot holds none | closed | `visual/vite.reference.config.ts:17`; `.gitignore:42-43`; `vite-budget-plugin.ts:120-131`; `budget.ts:98,219-225` |
| T-02-36 | Tampering | The yardstick changing with an unreviewed spec edit | low | mitigate | SHA-256 pin of the extracted appendices; `--repin` is manual; a one-character change is caught | closed | `visual/reference/spec-appendix.sha256` now has a second, framed line (TOOL-WR-03); `extract-spec.test.ts:132,155,214,223` |
| T-02-37 | Tampering | CSP weakened for the harness | low | mitigate | The harness reads the production StrictCsp from source; no bypassCSP | closed | `visual/serve.ts:19-33` reads StrictCsp from the C# source; a grep finds no `bypassCSP` anywhere in web |
| T-02-38 | Information disclosure | parity.html / dev scenarios in wwwroot (CWE-489) | medium | mitigate | Parity input only in dev-route builds; checked on the production build; budget plan asserts it again | closed | `vite.config.ts:35-42,111-118` (the mode alone decides, TOOL-CR-01); `budget.ts:210-216` an unexpected entry fails; `build-config.node.test.ts:66-79` |
| T-02-39 | Tampering | Silent visual drift hidden by tolerances | medium | mitigate | maxDiffPixels 0, exact styles, fixed normalization list, self-test; overrides need a decision ID | closed | `visual/intentional-differences.ts:136` TOLERANCE_OVERRIDES is empty; `:148-218` assertRegistry with maxDiffPixels 0; icon mask narrowed (TOOL-WR-05); fragment shadowing throws (TOOL-WR-04) |
| T-02-40 | Tampering | CSP-unsafe styling in components | low | mitigate | Utilities only; `style` limited to `--*`; parity serves the app with the real StrictCsp and fails on violations | closed | Lint style bans; `visual/guard.ts:37-42` securitypolicyviolation listener; real StrictCsp (residual R-4) |
| T-02-41 | Tampering | Stale or hand-edited API types | medium | mitigate | Snapshot test plus check.mjs drift chain; generated file never edited by hand | closed | `OpenApiSnapshotTests.cs:14-54`; `tools/openapi-gen/check.mjs` and `check.test.mjs`; the generated file is in the ESLint and Prettier ignores (residual R-3) |
| T-02-42 | Information disclosure | OpenAPI exposure outside Development | low | mitigate | Snapshot taken from the Development host only; D-29 404s stay | closed | `OpenApiSnapshotTests.cs:46-47` (Development host only); D-29 404s per T-02-03 |
| T-02-43 | Tampering | Duplicate writes (double-submit, retry with a new key) | high | mitigate | One in-flight submission; key reused for identical retries; server dedupe arrives with SEC-06 (Phase 4) | closed | `web/src/lib/forms/useSubmission.ts:165-215`: lock after success (LIB-CR-01), plain-JSON compare or `identity` (LIB-CR-02), key reuse only when the first attempt may have run (`mayHaveRun`, `:124,184`, LIB-WR-01) |
| T-02-44 | Information disclosure | Error text leaking internals (CWE-209) | low | mitigate | Fixed plain-English copy; only the traceId reference is shown | closed | `lib/errors/describeHttpError.ts:13-63`: fixed copy plus the traceId |
| T-02-45 | Spoofing | Predictable keys | low | mitigate | crypto.randomUUID / getRandomValues only; Math.random banned by test | closed | `lib/forms/idempotencyKey.ts:13-29`; `idempotencyKey.test.ts:25-29` Math.random spy |
| T-02-46 | Tampering | Double activation of a pending submit | medium | mitigate | Pending ignores click/Enter/Space with aria-disabled; useSubmission also ignores re-submits | closed | `ui/actions/Button.tsx:81-100` |
| T-02-47 | Spoofing | Link targets built from untrusted data (CWE-601) | low | mitigate | UiLink/ButtonLink take typed `to` values; URL params never reach `to` unparsed (WEB-10 rule) | closed | `ui/actions/UiLink.tsx:10-12,34` (residual R-7) |
| T-02-48 | Tampering | Mark via an HTML string (CWE-79) | medium | mitigate | JSX paths only; lint ban; criterion grep | closed | 0 `dangerouslySetInnerHTML` in web/src; lint ban |
| T-02-49 | Tampering | Unknown status from data producing a missing class | low | mitigate | `Record<OrderStatus, …>` maps; unknown strings fall back to the neutral tone through a typed guard | closed | `ui/status/tones.ts:11,43`; `StatusBadge.tsx:17` |
| T-02-50 | Information disclosure | Password visible or autofilled into the wrong field | low | mitigate | Explicit toggle (aria-pressed); `autocomplete` passes through; no logging of values | closed | `ui/forms/PasswordField.tsx:86` aria-pressed; no-console lint |
| T-02-51 | Repudiation | A danger message vanishing before it is read | low | mitigate | Danger and warning toasts persist (D-04, O-7); trim protects persistent toasts | closed | `ui/feedback/toastQueue.ts:19-21,116-126` |
| T-02-52 | Tampering | HTML in toast text | low | mitigate | React text nodes only; no HTML sinks (lint) | closed | Text nodes only; lint; a grep finds no sinks |
| T-02-53 | Tampering | Accidental or repeated destructive confirm | high | mitigate | Type-to-confirm exact match; one confirm per attempt while pending; retry reuses the Idempotency-Key | closed | `ui/overlays/ConfirmDialog.tsx:84-97,112-124` (exact trimmed match, one confirm per attempt) |
| T-02-54 | Information disclosure | Server error detail in the dialog (CWE-209) | low | mitigate | describeHttpError fixed copy plus traceId only | closed | `ConfirmDialog.tsx:11` uses describeHttpError |
| T-02-55 | Tampering | Display computing money differently from the server | medium | mitigate | Components only format figures from csps.ts; no component arithmetic | closed | `ui/money/OrderTotals.tsx:6-11`; a grep for `* 100` or `/ 100` finds 0 |
| T-02-56 | Tampering | Customer/team text injected into markup | low | mitigate | React text nodes only; no HTML sinks; class names never built from data | closed | Text nodes only; lint; no sinks |
| T-02-57 | Tampering | File input accepting unexpected types | low | transfer | Phase 9 validates type and size server-side with signed uploads (IMG-01); Phase 2 only renders the `accept` list | closed (transferred) | `.planning/REQUIREMENTS.md:155,431` (IMG-01 → Phase 9, `ROADMAP.md:536`); `ImageUploader.tsx:213` accept="image/*". See Transferred Risks |
| T-02-58 | Spoofing | Logout rendered as `href="#"` navigating unexpectedly | low | mitigate | Logout is a button (D-27); Phase 4 wires real sign-out | closed | `ui/navigation/Sidebar.tsx:151-163` is a button |
| T-02-59 | Elevation of privilege | Manager-only nav items shown to Admin | low | accept | Visibility only; the server enforces roles (default-deny, SEC-02); Phase 5 adds role-gated routes | closed (accepted) | Server default-deny at `src/Csps.Server/Composition/SecurityRegistration.cs:46-48`; admin UI compiled out of production. See AR-02-04 |
| T-02-60 | Tampering | Amount entry (CWE-20) | medium | mitigate | MONEY_TEXT allow-list, ASCII digits only, exact centavo conversion; server re-validates later | closed | `ui/entry/MoneyInput.tsx:25,66-86`; `format.ts:65,86-98` |
| T-02-61 | Information disclosure | OTP autofill and paste | low | mitigate | `autocomplete="one-time-code"` on the first box only; paste allowed; values never logged | closed | `ui/entry/OtpInput.tsx:41,192` |
| T-02-62 | Information disclosure | Error banners leaking internals (CWE-209) | low | mitigate | Fixed copy plus traceId only | closed | `ui/states/ErrorState.tsx:5,28` uses describeHttpError |
| T-02-63 | Tampering | Image sources outside the CSP | low | mitigate | `img-src` stays self, data: and res.cloudinary.com; LazyImage never relaxes it | closed | `SecurityHeadersMiddleware.cs:16-17` img-src unchanged; UI-CR-01 was fixed with FileReader `data:` previews, with no CSP relaxation |
| T-02-64 | Information disclosure | Error boundary or console revealing stack traces (CWE-209) | low | mitigate | Friendly copy only; production createRoot callbacks are no-ops; E2E fails on console errors | closed | `app/ErrorBoundary.tsx:19-24`; `main.tsx:25-35` (no-op callbacks, RouterProvider onError); E2E console, pageerror and requestfailed guard (TOOL-WR-14) |
| T-02-65 | Elevation of privilege | Admin routes reachable in production | high | mitigate | Admin branch only behind compile-time `__DEV_ROUTES__`; production `/admin/*` renders the placeholder; budget plan asserts no admin chunk | closed | `app/router.tsx:41`; `vite.config.ts:36,84`; `budget.ts:219-225`; `build-output.node.test.ts:101-111` |
| T-02-66 | Tampering | Hostile list URLs (CWE-20) | medium | mitigate | Only createListParams parsers feed state; one canonical rewrite; integration test | closed | `createListParams.ts`; `createListParams.test.tsx:90-153` |
| T-02-67 | Information disclosure | Search text in URLs (CWE-598) | low | mitigate | Only free-text `q`, capped at 100; privacy keys refused; Referrer-Policy strict-origin-when-cross-origin | closed | `parsers.ts:46` (max 100); `SecurityHeadersMiddleware.cs:66` Referrer-Policy |
| T-02-68 | Tampering | Cell text injection | low | mitigate | Text nodes only; `data-label` from column definitions, never from row data | closed | `ui/lists/ResponsiveTable.tsx:15,218,231` (data-label comes from column definitions) |
| T-02-69 | Elevation of privilege | Admin/dev routes in production (CWE-489) | high | mitigate | Compile-time `__DEV_ROUTES__`; build-output assertion on copy strings; budget plugin asserts no admin chunk | closed | `vite.config.ts:35-58` (the mode alone decides; a production build throws on any VITE_DEV_ROUTES, TOOL-CR-01); `build-config.node.test.ts:62-64,83-90`; `budget.ts:219-225`; `build-output.node.test.ts:101-111` |
| T-02-70 | Tampering | `localStorage` theme value | low | mitigate | Only light/dark accepted; try/catch; no other data stored | closed | `app/admin/theme.ts:24-39` |
| T-02-71 | Denial of service | Keyboard trap without exit (WCAG 2.1.2) | medium | mitigate | Esc, scrim and navigation always close; E2E keyboard journeys in every engine | closed | `ui/overlays/Modal.tsx:90-100` (Esc, scrim, top-of-stack only, UI-WR-01/02); `e2e/keyboard.spec.ts`, `admin-keyboard.spec.ts` |
| T-02-72 | Information disclosure | Dev/admin/parity modules in production (CWE-489) | high | mitigate | Plugin fails the production build on any src/app/admin, src/dev or web/visual module | closed | `budget.ts:98,219-225`; `vite-budget-plugin.ts:106-131` (this.error); production profile keyed to the mode (TOOL-CR-01) |
| T-02-73 | Denial of service | Bundle growth breaking LCP on phones | low | mitigate | Hard limits fail the build; JSON summary for review | closed | `budget.ts:73` BUDGETS; `vite-budget-plugin.ts:108-115` |
| T-02-74 | Information disclosure | Showcase with seed data in wwwroot (CWE-489) | medium | mitigate | Route only behind `__DEV_ROUTES__`; build-output test and budget plugin assert absence | closed | `__DEV_ROUTES__` gate; `build-output.node.test.ts:101-111`; budget DEV_ONLY prefixes include `src/dev/` |
| T-02-75 | Information disclosure | Lighthouse error reporting / report upload | low | mitigate | `--no-enable-error-reporting`; reports only in git-ignored artifacts/ | closed | `scripts/lighthouse.mjs:33,85-88`; `.gitignore:61` |
| T-02-76 | Denial of service | Disturbing processes of another project | medium | mitigate | Preflight and busy-port refusal; the script stops only the child it started | closed | `lighthouse.mjs:55,193-227,401`; `shared-machine.mjs` |
| T-02-77 | Information disclosure | Design exports or their renders committed or uploaded | medium | mitigate | git check-ignore and tracked-file guards; refuses in CI; output only in ignored artifacts/ | closed | `design-side-by-side.mjs:112-131`; `owner-review.mjs:748-753`; `.gitignore:2,7,61`; `git ls-files .planning/design artifacts _local` is empty |
| T-02-78 | Denial of service | Review host colliding with another project | low | mitigate | Preflight and busy-port refusal; stops only its own child | closed | `owner-review.mjs:6-8,174`; stops only its own child |
| T-02-79 | Information disclosure | Dev routes enabled in a production build through an env file (CWE-489) | medium | mitigate | Committed env files exist only for the e2e and budget modes (no plain, local or production env file); build-config.node.test.ts asserts `__DEV_ROUTES__` is false for production | closed | `.gitignore:11-15`; `vite.config.ts:53-57`; `build-config.node.test.ts:62-64,83-95` |
| T-02-80 | Tampering | A function-valued or non-serializable scenario skewing the parity proof | low | mitigate | `assertSerializable` over the whole list at load; one `renderNode` for both sides; unknown components render a visible alert | closed | `src/dev/scenarios/collect.ts:51,83`; `index.test.ts:111`; `renderScenario.tsx:39-43` |
| T-02-81 | Denial of service | Request storms against the 256 MB host (CWE-400) | low | mitigate | 300 ms debounce; superseded request aborted; Query retry false; prefetch only after 100 ms intent, errors swallowed | closed | `useDebouncedValue.ts`; `useListQuery.ts:25` (signal); `queryClient.ts:10,14`; `prefetchOnIntent.ts:6,46` |
| T-02-82 | Tampering | `tw` used to assemble class names from data | low | mitigate | `tw` takes one string and returns it; lint bans template literals and `+` inside `tw(…)`; class gate compiles every literal | closed | `ui/tw.ts:8-10`; `eslint.config.mjs:79-91`; class gate |
| T-02-83 | Tampering | Icon drawings changing under the app without review | low | mitigate | lucide-react pinned exactly at 1.53.0 with a committed lockfile; per-icon named imports; drawings approved in D-32 | closed | `web/package.json:39` lucide-react 1.53.0; `package-lock.json:5978-5981` integrity hash; named imports in `ui/brand/icons.ts:65` (residual R-1) |
| T-02-SC | Tampering | npm/NuGet installs (declared in all 40 plans) | high | mitigate | Exact owner-approved pins, `min-release-age=14`, committed lockfiles, `npm audit --audit-level=high`; any other install stops for a blocking owner decision | closed | Since the replan, lockfiles changed only in 02-02 (8fef5ce) and 02-37 (3d903a0). `web/.npmrc:1-3` (save-exact, min-release-age=14); `tools/openapi-gen/.npmrc:1-3` (no exclusions); DependencyRegistryTests. `npm audit --audit-level=high` re-run 2026-10-13: 0 for web/ and 0 for tools/openapi-gen (residual R-1) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*
*Evidence paths under `web/src/` are sometimes shortened to `ui/…`, `lib/…` and `app/…`; test files sit next to the code they cover unless a folder is given.*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-03 | T-02-20 | A browser money figure could be mistaken for the saved one. The browser figures (`orderTotals`, `discountAmount`, `round2` in `web/src/lib/csps.ts`) are previews only, and the server (`Csps.Domain.Orders.OrderMath`) is authoritative (D-09). The 220 shared golden vectors prove both sides agree to the centavo. Once a save returns, screens show the server totals (`web/src/lib/csps.ts:4-7`). No Phase 2 screen saves an order. The check that Phase 8 order screens replace the preview with server totals is tracked as backlog 999.2 Test 6 (`.planning/ROADMAP.md:950-956`). Low severity, below the high threshold. | Plan-time disposition in `02-07-PLAN.md` (threat model); no separate owner ratification is recorded | 2026-10-08 |
| AR-02-04 | T-02-59 | The Manager-only Users nav item is visible to an Admin. This is display only: the server enforces roles through the default-deny fallback policy and the named Staff and Manager policies (`src/Csps.Server/Composition/SecurityRegistration.cs:46-48`, SEC-02). The admin shell exists only in dev-route builds (D-20), so nothing ships to production before Phase 4 adds sign-in. Phase 5 adds role-gated routes. Low severity, below the high threshold. | Plan-time disposition in `02-26-PLAN.md` (threat model); no separate owner ratification is recorded | 2026-10-08 |

*Accepted risks do not resurface in future audit runs.*

*AR-02-01 and AR-02-02 belong to the superseded 2026-10-08 audit and to `.planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md`. AR-02-02 (a future `/.well-known/` file needs an explicit, tested exception) is still cited in `HiddenSegmentFileProvider.cs`. Both IDs stay reserved, so the entries here start at AR-02-03.*

---

## Transferred Risks

| Threat Ref | Transferred To | Record | Phase 2 Scope |
|------------|----------------|--------|---------------|
| T-02-57 | IMG-01, Phase 9 (Order Images & Maintenance Jobs) | `.planning/REQUIREMENTS.md:155` (IMG-01: uploads go through the server only, multipart → validation → Cloudinary signed upload, and the Cloudinary secret never reaches the browser) and `:431` (traceability: IMG-01 → Phase 9); `.planning/ROADMAP.md:536` | `web/src/ui/media/ImageUploader.tsx:213` renders `accept="image/*"` only. Nothing in Phase 2 uploads a file. Type and size are validated server-side in Phase 9 |

---

## Code-Review Fixes That Changed Mitigations

The phase code review (`02-REVIEW.md`, fixes in `02-REVIEW-FIX-{dotnet,tooling,weblib,webui}.md`) changed these mitigations. None of them weakened a mitigation.

- **TOOL-CR-01** strengthens T-02-38/65/69/72/74/79. The mode alone now turns dev routes on, a production build throws when VITE_DEV_ROUTES is set anywhere, and the production budget profile no longer depends on the flag.
- **NET-WR-03** strengthens T-02-08. The web root itself is wrapped, so `MapFallbackToFile` is covered too.
- **NET-WR-05** strengthens T-02-17 and T-02-SC. Optional, peer and bundled sections are pinned, and an unknown section fails closed.
- **LIB-CR-01, LIB-CR-02 and LIB-WR-01** replace the T-02-43 and T-02-27 key rules:
  - the same data is locked after a success;
  - a non-JSON payload never reuses a key;
  - a keyed FormData body is never auto-retried;
  - a definitive 4xx gets a new key.
- **LIB-WR-08** strengthens T-02-26. The secret-name check runs on the built URL.
- **LIB-WR-03/04** strengthen T-02-29 (`skipAuthRefresh`, stale-401 handling).
- **LIB-WR-06 and UI-WR-09** strengthen T-02-21 and T-02-60 (strict grouping, ₱ or PHP prefix on paste).
- **TOOL-WR-12** strengthens T-02-11/48/52/56 (all raw-HTML sinks banned, not only the JSX attribute).
- **TOOL-WR-01/02** strengthen T-02-18 (WITH exceptions allow-listed, guessed licenses fail).
- **TOOL-WR-06/07** strengthen T-02-15 and T-02-82 (identifiers and imports followed, every colour syntax banned).
- **TOOL-WR-03** strengthens T-02-36 (framed hash line).
- **TOOL-WR-04/05** strengthen T-02-39 (fragment shadowing throws, icon mask narrowed).
- **TOOL-WR-08/09/10** strengthen T-02-23/76/78 (the shared-machine gate waits, stale locks are taken over, POSIX hosts are stopped on a signal).
- **TOOL-WR-14** strengthens T-02-64 (network failures and every page of the context are guarded).
- **UI-CR-01** keeps T-02-63 intact: previews are FileReader `data:` URLs and the CSP is unchanged.
- **NET-WR-04** puts request logging back for static files. That is FND-07 work and maps to no registered threat.

---

## Warnings and Residual Risks (non-blocking)

- **W-1 (auditor finding, gate ordering).** `web/scripts/verify.mjs:11-20` runs `test:coverage` before `build`. So `web/src/test/build-output.node.test.ts` (the T-02-05, T-02-06, T-02-33 and T-02-69/74 output checks) inspects the `src/Csps.Server/wwwroot` of the previous run, not the build that verify just made.
  - Effect: a regression is caught one run late, and a fresh checkout or a future CI run fails at "writes index.html".
  - No threat opens, because the build-time layers stand on their own: the config test, the budget plugin, the E2E and parity CSP guards, and the HiddenSegmentFileProvider.
  - Fix: run the build-output test after `build`, for example as its own verify step.
- **R-1 (TOOL-WR-13, owner decision pending).** `web/.npmrc:6-14` waives the 14-day cool-down by package name (vite, source-map-js, http-cache-semantics, lucide-react), with no version and no expiry. Exact pins and the lockfile limit the exposure. The source-map-js and http-cache-semantics lines age out on 2026-10-14 and 2026-10-18 (T-02-SC, T-02-83).
- **R-2 (LIB-IN-10, open).** `HttpError.message` carries the ProblemDetails title written by the server. Today describeHttpError is the only copy path, so nothing leaks. Any future code that renders `error.message` would break CWE-209 (T-02-44/54/62).
- **R-3 (TOOL-IN-01, TOOL-IN-02, open).** The license gate never checks that each tree was actually read (T-02-18). The OpenAPI drift check (`npm --prefix tools/openapi-gen run check`) is not part of `npm run verify` (T-02-41).
- **R-4 (TOOL-IN-07, open).** The WebKit screenshot discount could hide one real inline-style CSP violation. Chromium and Firefox would still catch it (T-02-40).
- **R-5 (deferred to Phase 4, `deferred-items.md`).**
  - SEC-06 must hash multipart bodies from their parsed parts, not their raw bytes.
  - The `refresh` call must pass `skipAuthRefresh`; the LIB-WR-04 deadlock guard is documentation plus a regression test.
  - A 401 shows no message until Phase 4 wires the session (LIB-WR-03 part 2).
- **R-6 (TOOL-WR-11, owner decision pending).** The Barlow Condensed fallback tries Arial Narrow first but is sized for Arial. On machines that have Arial Narrow this risks a layout shift (T-02-34).
- **R-7 (UI-IN-05, open).** UiLink passes `target` without enforcing `rel` (CWE-1022). Current browsers already apply noopener to `target="_blank"` (T-02-47).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-13 | 84 | 84 | 0 | gsd-security-auditor (`/gsd-secure-phase 2`, ASVS L1, block_on high) |

## Security Audit 2026-10-13

| Metric | Count |
|--------|-------|
| Threats found | 84 |
| Closed | 84 |
| Open | 0 |

- **Breakdown:**
  - Closed: 81 mitigated, 2 accepted (AR-02-03, AR-02-04), 1 transferred (T-02-57).
  - Open: 0 blocking and 0 below the threshold.
  - By severity: 14 high (13 numbered plus T-02-SC), 30 medium, 40 low.
- **Inputs:**
  - the 40 `<threat_model>` blocks in `02-01-PLAN.md` to `02-40-PLAN.md`;
  - the SUMMARY `## Threat Flags` sections, where every flag maps to a registered ID and there are no unregistered flags;
  - `02-REVIEW.md` and the four `02-REVIEW-FIX-*.md` reports;
  - `02-VERIFICATION.md` and `deferred-items.md`.
- **Method:** each mitigation was located in the cited code, config or test. `npm audit --audit-level=high` was re-run for `web/` and `tools/openapi-gen/` (0 and 0). No servers or test suites were started for this audit.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-13 (gsd-security-auditor, ASVS L1). The two accepted risks are low severity and below the block threshold. They were accepted at plan time, and no separate owner ratification is recorded.
