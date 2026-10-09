---
gsd_state_version: "1.0"
current_phase: 02
current_phase_name: Web Foundation & Design System
status: executing
stopped_at: Completed 02-22-PLAN.md
last_updated: "2026-10-09T00:27:54.033Z"
last_activity: 2026-10-08
last_activity_desc: Phase 02 execution started
state_head: f2eb952db1b35dd44bc770e1adcd8b892bae3a9c
progress:
  total_phases: 17
  completed_phases: 1
  total_plans: 53
  completed_plans: 39
  percent: 6
created: "2026-10-07T00:08:54-05:00"
updated: "2026-10-08T18:49:27-05:00"
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-07)

**Core value:** Staff can record every order (items, payments, discounts, expenses, images) and always see correct, server-computed totals and balances. Existing production data is carried over with zero loss.
**Current focus:** Phase 02 — Web Foundation & Design System

## Current Position

Phase: 02 (Web Foundation & Design System) — EXECUTING
Plan: 27 of 40
Status: Ready to execute
Last activity: 2026-10-08 — Phase 02 execution started

Progress: [█░░░░░░░░░] 6%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 13 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 14 min | 3 tasks | 43 files |
| Phase 01 P02 | 25 min | 3 tasks | 39 files |
| Phase 01 P03 | 13 min | 3 tasks | 12 files |
| Phase 01 P04 | 29 min | 3 tasks | 22 files |
| Phase 01 P05 | 9 min | 3 tasks | 6 files |
| Phase 01 P06 | 17 min | 3 tasks | 22 files |
| Phase 01 P07 | 18 min | 3 tasks | 18 files |
| Phase 01 P12 | 10min | 3 tasks | 10 files |
| Phase 01 P08 | 17 min | 3 tasks | 26 files |
| Phase 01 P09 | 15 min | 3 tasks | 18 files |
| Phase 01 P10 | 23min | 3 tasks | 15 files |
| Phase 01 P11 | 29min | 3 tasks | 13 files |
| Phase 01 P13 | 4 min | 2 tasks | 2 files |
| Phase 02 P01 | 13 min | 2 tasks | 13 files |
| Phase 02 P02 | 11 min | 2 tasks | 15 files |
| Phase 02 P03 | 10 min | 2 tasks | 9 files |
| Phase 02 P37 | 4 min | 2 tasks | 12 files |
| Phase 02 P04 | 17 min | 3 tasks | 21 files |
| Phase 02 P05 | 12 min | 2 tasks | 5 files |
| Phase 02 P38 | 8 min | 2 tasks | 9 files |
| Phase 02 P06 | 22 min | 3 tasks | 15 files |
| Phase 02 P07 | 14 min | 3 tasks | 16 files |
| Phase 02 P08 | 6 min | 2 tasks | 2 files |
| Phase 02 P09 | 11 min | 2 tasks | 7 files |
| Phase 02 P10 | 9 min | 3 tasks | 7 files |
| Phase 02 P12 | 10 min | 2 tasks | 8 files |
| Phase 02 P13 | 15 min | 2 tasks | 23 files |
| Phase 02 P39 | 8 min | 2 tasks | 9 files |
| Phase 02 P40 | 8min | 2 tasks | 7 files |
| Phase 02 P11 | 14 min | 2 tasks | 9 files |
| Phase 02 P14 | 36 min | 2 tasks | 27 files |
| Phase 02 P15 | 15min | 2 tasks | 10 files |
| Phase 02 P16 | 11 min | 2 tasks | 8 files |
| Phase 02 P17 | 1h 27m | 2 tasks | 14 files |
| Phase 02 P18 | 28 min | 2 tasks | 16 files |
| Phase 02 P19 | 36 min | 3 tasks | 21 files |
| Phase 02 P20 | 30 min | 2 tasks | 13 files |
| Phase 02 P21 | 25 min | 3 tasks | 13 files |
| Phase 02 P22 | 30min | 2 tasks | 18 files |

## Accumulated Context

### Decisions

Decisions are logged in the PROJECT.md Key Decisions table. Recent decisions that affect current work:

- [Roadmap]: Took the 14-phase structure from research/SUMMARY.md and renumbered its Phase 1a/1b/1c as Phases 1–3. Inquiries were split out of the public-site phase into Phase 13, giving 17 phases. Legacy discovery, legacy import and cutover stay last (Prime Directive 11).
- [Roadmap]: Company Expenses (Phase 6) comes before Orders to prove the slice pattern. Orders are split three ways: domain & API (7), screens (8), images & jobs (9). The Admin Dashboard is added as Phase 10.
- [Roadmap]: Cross-cutting QUAL/SEC/A11Y/PERF requirements map to the phase where their gate is first built. The PRD §22 Definition of Done enforces them in every later phase.
- [Phase 01]: Owner approved the full Phase 1 package list (01-01 Task 1 legitimacy gate) on 2026-10-07 before first restore; recorded in docs/dependencies.json approvals
- [Phase 01]: Dependency registry scopes are runtime|build|test|tool|font; D-18 exceptions MPL-2.0->test, OFL-1.1->font; pin/registry mismatch fails DependencyRegistryTests
- [Phase 01]: xUnit v3 MTP: zero-match filter exits 8 (A14 first half confirmed); report switches are --report-xunit-junit/--report-xunit-trx
- [Phase 01]: CspsApiFactory keeps one public ctor (xUnit1056); the (string) ctor is protected and CspsApiFactory.ForDatabase(connectionString) is the public entry for real databases
- [Phase 01]: LocalDB (localdb)\CSPS 17.0 connects with Integrated Security and no TrustServerCertificate (A12 confirmed); CSPS_Dev is created by dotnet ef at compat 170 while EF SQL and test DBs are pinned to 160
- [Phase 01]: TestDatabaseName.IsDisposable also checks exact length because .NET $ matches before a trailing newline
- [Phase 01]: BusinessClock (Domain, pure) gives business day/month/calendar-year ranges as [StartUtc, EndUtcExclusive); DST-gap midnight starts at the first valid minute, ambiguous midnight at the first occurrence
- [Phase 01]: Both database-backed /health checks (database, time-zone) share a 3 s timeout: on a cold cache the time-zone check reads SiteSettings and SqlClient retries a failed login after 10 s
- [Phase 01]: AddInfrastructure calls AddLogging (TryAdd only) so the health service validates on a plain ServiceCollection
- [Phase 01]: MinimalHealthWriter sends no body for HEAD; status, Content-Type and Cache-Control: no-store are kept
- [Phase 01]: Dev-seed CLI (tools/Csps.DevSeed) creates the database and pins it to SqlCompatibility.Level before migrating; CSPS_Dev is now at 160
- [Phase 01]: DevSeedTargetGuard allows only CSPS_Dev/CSPS_E2E (OrdinalIgnoreCase) and only on `(localdb)\CSPS` or a loopback container (`127.0.0.1,<port>` / `localhost,<port>`); refuses every other server (incl. MSSQLLocalDB, named-pipe aliases, remote hosts), Failover Partner, AttachDBFilename, empty/unparseable; reasons never echo the connection string (WR-04 fixed, quick 261007-p98)
- [Phase 01]: Seed steps implement ISeedStep with a unique Order and are appended to DevSeedSteps.All by the phase that creates their entity; DevSeeder rejects duplicate Order before running
- [Phase 01]: ArchUnitNET rules against types from unloaded assemblies must use NotDependOnAnyTypesThat(); NotDependOnAny(Types().That()...) misses them
- [Phase 01]: CspsDatabase.ResetAsync (Respawn) ignores __EFMigrationsHistory and SiteSettings; plan 09 must add AuditLog and AuditLogTruncateGuard
- [Phase 01]: AuditEntry.Create (Domain) stores only IpPrefix.From (/24, /48) and UserAgentFamily.Classify labels; throws ArgumentNullException/ArgumentException for programming errors and never echoes rejected values
- [Phase 01]: IpPrefix picks /24 vs /48 from AddressFamily; IPAddress holds only 4 or 16 bytes, so there is no unreachable third-family branch (keeps Domain at 100% branch)
- [Phase 01]: UserAgentFamily reads only the first 512 chars as a span; blank within them is Unknown; Edge/Opera/Samsung precede Chrome and bots precede everything
- [Phase 01]: tdd-red-evidence matches theory target names against raw JUnit text, so theory targets must use &quot; entities
- [Phase 01]: Serilog uses preserveStaticLogger: true and UseSerilogRequestLogging gets the host's own Serilog.ILogger, so parallel hosts never share the static Log.Logger
- [Phase 01]: CspsLogging:WriteToFile defaults on; only CspsApiFactory turns it off (LogFileSwitchKey = LoggingRegistration.WriteToFileKey)
- [Phase 01]: Request-completion events are matched by Serilog's template 'HTTP {RequestMethod} {RequestPath} responded {StatusCode}'; framework events also carry RequestPath and StatusCode
- [Phase 01]: The masking enricher also walks captured structures, dictionaries and sequences; the destructuring policy masks {@x} objects before capture
- [Phase 01]: IRequestContext uses Connection.RemoteIpAddress only; ForwardedHeadersTests blocks forwarded-headers setup or proxy-header reads under src/ until FND-13
- [Phase 01]: Shared log files are read in tests with FileShare.ReadWrite|Delete and a short retry (a sharing violation on fresh %TEMP% files is transient)
- [Phase 01]: D-28 decision: option-a (2026-10-07). The owner may create one temporary probe site next to the live site (never inside it) and run SELECT-only queries on the live database in the control panel; the probe site is deleted afterwards and its key never enters chat or git
- [Phase 01]: tools/Csps.HostProbe is a throwaway key-protected probe (503 without a 32+ char key, 401 empty body without a match, fixed-time SHA-256 compare); never referenced by src/ or deployed with the site
- [Phase 01]: HOSTING-RECORD.md Facts rows start Unverified and are doc-linted by HostingRecordTests (valid statuses, Verified needs result and date, no secrets, D-28 line)
- [Phase 01]: Default deny: fallback RequireAuthenticatedUser plus named Staff/Manager policies; every endpoint needs an AuthorizationMatrix row and either an allow-listed AllowAnonymous or a Policies constant (DiscoveredEndpointsAreFullyCovered)
- [Phase 01]: JwtBearer challenge is a bare Bearer (IncludeErrorDetails false, CWE-209); MapInboundClaims false keeps the raw sub and role claims
- [Phase 01]: Jwt:SigningKey (base64, >= 32 bytes) comes only from user-secrets (UserSecretsId 7d33a131-9aea-4f9c-90eb-213d2b59cbee, tools/scripts/Initialize-DevSecrets.ps1) or host settings; ValidateOnStart fails startup otherwise
- [Phase 01]: Test JWT keys are SHA-384 digests of fixed labels computed in-process (TestJwt), so no key literal is committed
- [Phase 01]: Unknown non-API paths answer 401 to anonymous callers (A3 confirmed); Phase 2 must map and allow-list the SPA host anonymously
- [Phase 01]: D-25/D-32 resolved as option-a with 8-month retention (owner, 2026-10-07): TR_AuditLog_AppendOnly refuses every UPDATE (51000) and DELETE (51001) except a DELETE with read-only session flag csps.audit_purge = 1 where every row is older than 8 months; mixed statements fail as a whole; TRUNCATE blocked by AuditLogTruncateGuard FK
- [Phase 01]: AddInfrastructure requires a host-registered IRequestContext (AuditTrail depends on it); plain-ServiceCollection callers (tests, tools) must register one
- [Phase 01]: Append-only audit log enforced in three layers: DB trigger, FK truncate guard, EF AuditLogAppendOnlyInterceptor registered once in CspsDbContextOptions.Configure; Respawn never resets AuditLog/AuditLogTruncateGuard
- [Phase 01]: 01-10: AddCspsDataProtection loads the DP certificates from IConfiguration at registration (XmlKeyDecryptionOptions is internal); ValidateOnStart still stops the host on any bad secret
- [Phase 01]: 01-10: A refusing XML encryptor is installed when no certificate loads, so no composition can store a key unencrypted
- [Phase 01]: 01-10: No-database test hosts keep the (certificate-encrypted) key ring in memory; DB-backed hosts use dbo.DataProtectionKeys
- [Phase 01]: 01-11: Owner approved (2026-10-07, Option A) a narrow version-pinned license exception: Microsoft.Data.SqlClient.SNI.runtime 6.0.2 and Microsoft.Identity.Client.NativeInterop 0.20.6 (Microsoft Software License Terms; free, not open source, shipped unmodified inside the app only, Microsoft notices kept). Recorded in docs/license-exceptions.json; any other version fails the license gate.
- [Phase 01]: 01-11: License gate fails on stale exceptions (an entry matching no package), so an SqlClient/EF upgrade that moves either package needs a new owner approval.
- [Phase 01]: D-33 (owner, 2026-10-07): target production DB is SQL Server 2025 (host is 2022 today); the 2025 move happens at cutover after a fresh backup; SqlCompatibility.Level stays 160 provisional, re-pin to 170 after the 2025 DB exists and is verified
- [Phase 01]: 01-13: Host facts (2026-10-07): .NET Basic, 1/1 DB, 1000 MB, SQL Server 2022 16.0.x Web, app login db_owner; probe impossible (no extra site) so runtime/in-process/proxy/tz/PFX facts are verified on the Phase 3 first deploy
- [Phase 01]: 01-13: cspstailoring.com SPF ends -all and DMARC is p=reject; Phase 4 mail must use SmarterASP.NET mail servers (include:_spf.site4now.net) with aligned DKIM; Gmail D2 check still due
- [Phase 02]: 02-01: test hosts turn static web assets off (StaticWebAssetsKey points at a manifest that does not exist); the build-time manifest always names src/Csps.Server/wwwroot and the Development loader throws without it, so WebRootKey alone did not close L-06
- [Phase 02]: 02-01: auth and 500 probes target GET /api/v1/site-settings with an in-memory ISiteSettingsReader, never an unmatched page path, because the SPA shell now matches every GET/HEAD page path (L-03)
- [Phase 02]: 02-02: Tailwind scan root is source("../../src") relative to web/src/styles/app.css (the research skeleton's ../src assumed a higher stylesheet); plan 02-05's stylesheet-contract test must accept it
- [Phase 02]: 02-02: vitest 5.0.1 installed (before the 5.0.2 cut-off); no rolldown exclusion (R-2); nuqs stays 2.10.1 (2.10.2 published 2026-10-08, eligible 2026-10-22, owner OK still required)
- [Phase 02]: 02-03: The web-root 404 for files (and the reserved /openapi, /scalar 404s) answers HEAD with 404 + application/problem+json and no content (RFC 9110); Kestrel drops HEAD bodies, the test host does not
- [Phase 02]: 02-03: HiddenSegmentFileProvider refuses any segment starting with '.' or containing '~' (split on / and \); a future /.well-known/ file needs an explicit, tested exact-path exception (AR-02-02). Listing tests must use an inner PhysicalFileProvider with ExclusionFilters.None
- [Phase 02]: 02-03: Response compression MIME list is html/css/text+application javascript/svg only (replaces defaults, never JSON); /assets/* immutable for a year, every other static file no-cache
- [Phase 02]: 02-37: tsconfig.app/node carry the PRD 17.2 strict set incl. noUnusedLocals/noUnusedParameters; *.node.test.ts files are checked by tsconfig.node.json (glob) and excluded from tsconfig.app.json, so new node tests need no tsconfig edit
- [Phase 02]: 02-37: tools/openapi-gen installed at openapi-typescript 7.13.0 + typescript 5.9.3 (33 packages, audit 0, min-release-age=14 no exclusions); 02-06 must register both and gate argparse Python-2.0
- [Phase 02]: 02-37: .gitignore keeps the dotenv wildcard ignored and allow-lists only the e2e and budget dotenv files in web/ (VITE_DEV_ROUTES=true, D-20, T-02-79); a session secret-read hook blocks Bash commands that name dotenv paths, so stage the web folder after checking git status
- [Phase 02]: 02-04: type-aware lint rules (prefer-nullish-coalescing with ignorePrimitives, no-deprecated) live in their own csps/type-aware block; the exported restrictions block stays type-free so ESLint's Linter proves every ban on virtual files
- [Phase 02]: 02-04: Prettier owns web/ formatting incl. CSS (CSS keeps double quotes, keyframes expanded); every Vitest test fails on console.error/warn unless it takes the output with collectConsole()
- [Phase 02]: 02-04: better-tailwindcss lints only className and clsx/tw arguments; module-level recipe maps are not covered unless passed through tw(), so the compile() class-gate decision stays open
- [Phase 02]: 02-05: Stylesheet contract is per file - app.css holds only at-rules (Tailwind entry, @source not, base.css layer import, @custom-variant, @theme/@theme inline, @keyframes inside @theme); base.css only the allowed selector blocks, @font-face and the reduced-motion @media
- [Phase 02]: 02-05: Class gate (scripts/class-gate.mjs) compiles every src class token with tailwindcss compile() over the real app.css; group/peer marker classes are accepted; one finding per token (colour-literal, then opacity, then unknown)
- [Phase 02]: 02-05: Every string literal in a *.recipe.ts file is read as class tokens - recipe files hold no other strings; a new D-02 opacity allow-list entry needs a decision ID (test-enforced)
- [Phase 02]: 02-38: Scenario nodes are { kind: 'node', component, props }; handlers inject no-op functions on every node; index.ts rejects wrong group, duplicate ids and non-plain data at load
- [Phase 02]: 02-38: extract-spec.mjs writes the nine appendix files only when the SHA-256 pin matches (exit 1, nothing written otherwise); --repin is manual only
- [Phase 02]: 02-06: npm registry entries are kind npm with a manifest field and match pins as {manifest}:{id}; every npm pin (deps, devDeps, overrides) of web/ and tools/openapi-gen/ must be registered
- [Phase 02]: 02-06: npm license exceptions count for a package when at least one of its installed-for scopes (from package-lock.json + registry scopes of direct deps) is listed; unused exceptions and unused scopes fail as stale
- [Phase 02]: 02-06: exception scopes recorded from the installed tree where the owner gave none: CC-BY-4.0 build+tool, CC0-1.0 test+tool, BlueOak-1.0.0 test+tool, 0BSD tool; owner scopes kept for MPL-2.0, MIT-0, CC-BY-3.0, Python-2.0
- [Phase 02]: 02-06: verify now ends with license:check and notices:check; any production dependency change needs npm run notices and a commit of web/THIRD-PARTY-NOTICES.txt
- [Phase 02]: Order math golden vectors: one shared 220-case file (tests/fixtures/order-math-golden-vectors.json, schema version/kind, quantity integer, amounts strings) read by xUnit OrderMath and Vitest orderTotals; only gen-golden-vectors.mjs --write changes it, --check runs in verify
- [Phase 02]: csps.ts money preview is exact BigInt centavos, half away from zero (D-09); formatPeso formats bigint pesos + 2 centavo digits; NaN/Infinity read as 0; *.golden.test.ts files in src belong to tsconfig.node.json
- [Phase 02]: 02-08: formatBusinessDate accepts only RFC 3339 instants with Z or an offset and real date/clock parts (zone-less, bare dates, Feb 30, 24:00 -> em dash); calendar dates go through formatCalendarDate (UTC round-trip)
- [Phase 02]: 02-08: Money entry stays text; '' and '.' are valid partial input but empty amounts (moneyTextToCentavos throws TypeError 'empty amount'); centavos come from digit strings, centavosToMoneyText throws RangeError outside 0..99999999999
- [Phase 02]: 02-09: npm run e2e takes the wx run lock web/.locks/e2e.lock (15 min wait, token-checked release), refuses a busy 5199 with no kill, then preflight, guarded CSPS_E2E seed, vite build --mode e2e, playwright; plans 02-35/02-36 import acquireLock/LOCK_PATH from web/scripts/e2e.mjs
- [Phase 02]: 02-09: E2E tests import test/expect/expectNoAxeViolations from web/e2e/fixtures.ts; guard.expectStatus(urlPart, status) must precede an expected failed request and also suppresses the Chromium/WebKit 'Failed to load resource ... status of N' console line; page scripts are strings (node TS program has no DOM lib); phone projects skip fixture-selftest.spec.ts
- [Phase 02]: 02-10: createHttpClient takes sleep as a top-level option; retry holds only optional max/baseDelayMs/maxDelayMs
- [Phase 02]: 02-10: secret query params rejected before sending include code (case-insensitive); a non-secret code param must be renamed (e.g. orderCode)
- [Phase 02]: 02-10: Idempotency-Key comes only from config.idempotencyKey, set before interceptors, so retries and the 401 replay resend the same key; api.ts (02-15) must pass one per POST submission and set Query retry false
- [Phase 02]: 02-12: woff2OnlyPlugin (enforce pre) strips the Fontsource .woff fallback so the web root ships woff2 only; preloadFontPlugin injects one Archivo latin woff2 preload and fails the build via this.error on zero or two matches
- [Phase 02]: 02-12: Arial metrics are recorded constants in web/scripts/font-metrics.mjs (Arial 7.06, 2048 upm); font-metrics.test.ts recomputes the base.css fallback faces from the installed woff2 files within 0.01 points and never reads a system font
- [Phase 02]: 02-13: parity reference entry has its own TS program (tsconfig.reference.json: DOM, react-jsx, vite/client); main.tsx/kit.ts/fragments are excluded from tsconfig.node.json and typecheck runs three programs
- [Phase 02]: 02-13: kit.ts loads the frozen App. D.3 namespace via import.meta.glob, so the verbatim spec code is never type-checked or linted and CI does not need the extraction; layout fragments go in web/visual/reference/fragments/<Name>.tsx
- [Phase 02]: 02-13: recorded D-33 ESLint exception - only visual/reference/main.tsx may import ./reference.css (csps/restrictions/visual-reference-entry); no dangerouslySetInnerHTML override needed since D.4 stays in ignored .reference-src
- [Phase 02]: 02-13: parity harness API for 02-14 - routeDist/readStrictCsp/REFERENCE_ORIGIN from visual/serve.ts, test/expect/expectCases from visual/guard.ts, selectScenarios (?theme/?group/?case; typo or empty selects nothing -> data-parity-empty fails) from visual/reference/select.ts; O-6 rulings also stop the .csp-overlay fade
- [Phase 02]: 02-39: useListQuery({ key, params, fetcher }) - key is the resource; full key is listKey(key, params); fetcher must forward the signal; search reaches params only via useDebouncedValue(q, 300)
- [Phase 02]: 02-39: prefetchOnIntent keeps one 100 ms intent timer per element (module WeakMap keyed by currentTarget), ignores touch pointerenter, and calls queryClient.query(options).catch(() => undefined), never prefetchQuery
- [Phase 02]: 02-40: Icon keeps the App. D.3 className prop (context colour from a src/ui parent); no other svg props are spread; an empty label hides the icon like no label
- [Phase 02]: 02-40: src tests that run the class gate are *.node.test.ts (tsconfig.app.json cannot import scripts/*.mjs); recipe tests compare sorted token sets because Prettier reorders tw() literals
- [Phase 02]: 02-11: list state keys are the URL keys (page, size, q, then the list's own); createListParams(parsers) returns [values, { setPage (push), setPageSize, setSearch, setFilter, setFilters, clampPage, reset (replace + page reset) }]
- [Phase 02]: 02-11: createListParams throws at definition on key names containing email/phone/mobile/password/passwd/secret/token or equal to otp/code/pin/name/firstname/lastname/fullname/customername/address
- [Phase 02]: 02-11: date filters use dateRangeParsers + setFilters(dateRangeValues(choice)) + resolveDateRange(values, businessToday(now)); presets stored by name, from/to only for custom; UrlStateLayout mounts via route.lazy with a HydrateFallback on the root route
- [Phase 02]: Parity harness live (02-14): reference = page, implementation = guarded appPage fixture in the same context; parity.html is a dev-route-only Vite entry (rolldownOptions.input), never in production; pixels compare with maxDiffPixels 0 and threshold 0, updateSnapshots none
- [Phase 02]: Button (02-14): App. D.3 props API with explicit props plus pending; D.3 loading gets the WEB-09 behaviour (aria-disabled, aria-busy, spinner, swallowed activation); recipe applies labelled padding OR icon-only width, never both. Pending parity scenarios use loading: true (the reference spreads unknown props)
- [Phase 02]: Visual specs take screenshots only through screenshotLocator/screenshotPage (visual/guard.ts): in WebKit the guard discounts exactly one CSP-blocked Playwright <style>body {}</style> per screenshot; matrix rows only Chromium runs carry @chromium-only (grepInvert in firefox/webkit); suite timeout 120 s
- [Phase 02]: 02-15: API contract drift chain is live: OpenApiSnapshotTests (CSPS_WRITE_OPENAPI_SNAPSHOT=1 per command to refresh) -> tools/openapi-gen/openapi.v1.json -> npm --prefix tools/openapi-gen run generate/check -> web/src/types/api.generated.ts -> api.ts; commit snapshot and types together
- [Phase 02]: 02-15: api.ts declares all eight groups as empty PlannedGroup objects (only site.settings has a call); api.test.ts shares api.ts's lib/http ESLint exception; tools/openapi-gen tests run on node:test via npm --prefix tools/openapi-gen test
- [Phase 02]: 02-16: useSubmission(send(key, data), { onSuccess, onFailure }) is the one form submission path: one in-flight promise per form, the key is reused only for a JSON-equal retry of a failed submission (submit() with no data uses a sentinel), and send gets no AbortSignal
- [Phase 02]: 02-16: onFailure(copy, error) runs only for failures without field errors whose describeHttpError copy is not null; a 400 with field errors fills fieldErrors (server casing) and the caller calls focusFirstInvalid(form); a 401 or aborted request calls nothing
- [Phase 02]: 02-16: describeHttpError ends the body with 'Reference: {traceId}' for every HttpError copy that carries a traceId (UI-SPEC ErrorState), not only 5xx; the 400 field-errors banner is { title: 'Check the highlighted fields.', body: '' }
- [Phase 02]: 02-17: parity reference CSS is built unminified (cssMinify false) because the minifier rewrote background: transparent into background: 0 0; parity repaints each page (root opacity 0.99 and back) after FREEZE because the reference raster was nondeterministic at clipped edges
- [Phase 02]: 02-17: visual suite trace keeps the action log only (full snapshots made one WebKit 1440 row 5.3 min instead of 42 s; use --trace on to debug); each parity row timeout is rowTimeout(row) = max(120 s, 60 s + 12 s per case)
- [Phase 02]: 02-17: UiLink renders react-router Link for in-app paths and a plain anchor for https/mailto/tel/# targets; LinkProvider is a pass-through (SPEC-DEVIATION Flag 2); icon-only Button requires aria-label by type (SPEC-DEVIATION A11Y-04); ButtonLink shares buttonClasses and buttonIconSize
- [Phase 02]: 02-18: Mark renders App. D.4 MARK_SVG as JSX children (no dangerouslySetInnerHTML, WEB-02); MediaPlaceholder label={false} hides the chip (research row 21) and --ratio is read by aspect-(--ratio) in the same component
- [Phase 02]: 02-18: parity cases needing a wrapper App. D.3 lacks use a same-named dev-only pair (src/dev/previews + visual/reference/fragments): IconSet and MediaPlaceholderNoChip; React CSSProperties is augmented with --* keys (src/types/react-css-custom-properties.d.ts)
- [Phase 02]: 02-19: Tabs take a required idBase; tab ids are {idBase}-tab-{id}; screens render the selected panel as <div {...getTabPanelProps(idBase, id)}> right after the Tabs (axe fails a selected tab whose aria-controls names a missing panel)
- [Phase 02]: 02-19: SegmentedControl and Tabs use a roving tabIndex with automatic activation through rovingItem (web/src/ui/choice/roving.ts): radios Right/Down and Left/Up, tabs Right/Left plus Home/End, all wrapping; the first item is the Tab stop when the value matches none
- [Phase 02]: 02-19: PAYMENT_TONE/EXPENSE_TONE are keyed by the PaymentMethod/ExpenseCategory unions; use isOrderStatus before indexing STATUS_TONE with an API string (unknown status = raw text, neutral)
- [Phase 02]: 02-19: the parity comparator reads scrollbar-width (headless Chromium never paints scrollbars); parity cases that need a tabpanel use the TabsWithPanel wrapper pair; focus-visible cases target the selected item of a roving group, hover on an unselected item is a separate -other case
- [Phase 02]: 02-20: Form controls take region looks from data-ui markers (in-data-[ui=s-toolbar|s-item]:) with D-01 as pg-phone:in-data-[ui=…]:text-[16px]; FilterBar/order form only add the marker
- [Phase 02]: 02-20: App. B outline:none is [outline:none] (resets focus-visible width/colour); invalid control border is has-aria-invalid:border-danger! because hover:not-focus-within is (0,3,0)
- [Phase 02]: 02-20: Field/Select/PasswordField keep the native-attribute passthrough (UI-SPEC); the React Compiler cache-hit branches on the rest object are unreachable (ui/forms 93.7/89.4 coverage, global thresholds pass)
- [Phase 02]: 02-21: useToast returns { show, dismiss } (SPEC-DEVIATION D-04); ToastProvider always renders the toast layer (aria-live polite, data-ui s-toast-layer) inside the page root; the pure queue (createToastQueue({ now, schedule })) owns max 3, 4.5 s success/info clocks that pause on hover/focus, persistent danger/warning and the trim order (oldest non-persistent first)
- [Phase 02]: 02-21: EmptyState takes level (2|3|4, default h2, SPEC-DEVIATION A11Y-02); its message margin is 0 because App. C .s-page p beats .csp-empty-msg; Skeleton sizes only via --sk-w/--sk-h/--sk-r (numbers to px, radius default 6px); iconButtonClasses (.csp-iconbtn) is exported from @/ui/feedback
- [Phase 02]: 02-21: parity FREEZE now finishes finite animations (toast/modal entries) and pauses only infinite ones (spinner, shimmer), so a side whose state input took longer no longer reads a half-run entry
- [Phase 02]: 02-22: Overlay (App. C .s-overlay, data-ui=s-overlay) is a production component in @/ui/overlays; screens render dialogs as <Overlay><Modal inline/></Overlay> (mockup layout) or a bare <Modal/> (App. B scrim/bottom sheet)
- [Phase 02]: 02-22: ConfirmDialog.onConfirm may return a promise; a rejection or a resolved useSubmission { ok: false } keeps the dialog open with the describeHttpError line + traceId, Delete re-enabled and focused, no toast; pending blocks further confirms, Esc, scrim and Cancel
- [Phase 02]: 02-22: Modal adds loading (blocks Esc/scrim/Close) and initialFocus (ref); useFocusTrap(ref, {active, initialFocus, returnFocus}) and useBodyScrollLock (overflow-hidden class, holder count) are reusable by MobileNavDrawer

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 → 3/4/17]: Hosting record still has Unverified facts: probe facts (runtime patch, content root, logs, client IP, HTTPS, Manila/en-PH, PFX, memory) verified on the Phase 3 first deploy; Gmail SPF/DKIM/DMARC pass (D2) before Phase 4. SmarterASP.NET confirmed SQL Server 2025 is offered (new DB + `.bak` restore, no in-place upgrade); still ask whether a temporary second database is allowed at no cost (Phase 17 prerequisite, D-33).
- [Phase 4]: Code review WR-02 (IpPrefix 6to4/NAT64 → IPv4 before truncation) is owner-deferred and MUST be fixed before any code path writes audit rows. Also triage the remaining open review items (WR-01, WR-03, WR-05..WR-09, IN-*) before shipping.
- [Phase 2+]: API style is now controller-based (owner, 2026-10-07); `GET /api/v1/site-settings` converts to a controller when a phase touches it.
- [Phase 3]: GitHub repo exists (private, default branch `dev`; PRs target `dev`). The owner must still provide Web Deploy credentials and secrets. C-27 (security tooling cost) must be ruled before CI.
- [Phase 4]: Send the security batch (OD-12, C-4, C-5, C-6, C-7, C-8, C-9, C-19, C-23, C-33) before the phase starts. Email delivery is a hard dependency for sign-in.
- [Phase 7]: All order rulings must close before the first test: OD-3 to OD-7, C-1, C-3, C-13, C-14, C-15/C-24, C-37 to C-39, C-42 to C-44.
- [Phase 9]: Needs a Cloudinary account and credentials, and the OD-9 / C-26 delivery ruling.
- [Phase 13]: The C-36 ruling may defer the whole phase to v2.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261007-j0u | Add staff money requirements (payment Received by, staff balances, coworker transfers, Manager-only transfer delete), idempotent form posts and concurrency guarantees | 2026-10-07 | ac2f224 | [261007-j0u-add-staff-money-requirements-payment-rec](./quick/261007-j0u-add-staff-money-requirements-payment-rec/) |
| 261007-k45 | Add expense Paid by (company and order expenses, deducts from money on hand) and record-level Created by / Updated by on every record | 2026-10-07 | 1bb8dd7 | [261007-k45-add-expense-paid-by-and-record-level-cre](./quick/261007-k45-add-expense-paid-by-and-record-level-cre/) |
| 261007-kz6 | URL query-string UI state with nuqs 2.10.1 (owner-approved): WEB-10, list requirements, analytics query stripping, planned dependency record | 2026-10-07 | 415c7cb | [261007-kz6-url-query-string-ui-state-with-nuqs](./quick/261007-kz6-url-query-string-ui-state-with-nuqs/) |
| 261007-p98 | Fix WR-04: dev-seed guard allows only (localdb)\\CSPS or a loopback container (127.0.0.1/localhost,<port>), refuses Failover Partner | 2026-10-07 | 50a0cd3 | [261007-p98-fix-wr-04-dev-seed-guard-server-allow-li](./quick/261007-p98-fix-wr-04-dev-seed-guard-server-allow-li/) |
| 261007-qde | Gitignore .planning/design/ (local-only Claude Design HTML) and record it as the visual UI reference | 2026-10-08 | 8c2d4f9 | [261007-qde-gitignore-planning-design-local-only-cla](./quick/261007-qde-gitignore-planning-design-local-only-cla/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-09T00:27:53.889Z
Stopped at: Completed 02-22-PLAN.md
Resume file: None
