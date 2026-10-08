---
gsd_state_version: "1.0"
current_phase: 02
current_phase_name: Web Foundation & Design System
status: executing
stopped_at: Completed 02-19-PLAN.md
last_updated: "2026-10-08T09:52:48.480Z"
last_activity: 2026-10-07
last_activity_desc: Phase 02 execution started
state_head: 079ab12a6f5006af697d06f8088abd807b2d1b8c
progress:
  total_phases: 17
  completed_phases: 1
  total_plans: 32
  completed_plans: 26
  percent: 6
created: "2026-10-07T00:08:54-05:00"
updated: "2026-10-08T04:53:04-05:00"
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-07)

**Core value:** Staff can record every order (items, payments, discounts, expenses, images) and always see correct, server-computed totals and balances. Existing production data is carried over with zero loss.
**Current focus:** Phase 02 — Web Foundation & Design System

## Current Position

Phase: 02 (Web Foundation & Design System) — EXECUTING
Plan: 14 of 18
Status: Ready to execute
Last activity: 2026-10-07 — Phase 02 execution started

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
| Phase 02 P01 | 37 min | 3 tasks | 30 files |
| Phase 02 P02 | 15 min | 3 tasks | 21 files |
| Phase 02 P03 | 24min | 2 tasks | 12 files |
| Phase 02 P04 | 22 min | 3 tasks | 16 files |
| Phase 02 P05 | 18 min | 3 tasks | 18 files |
| Phase 02 P06 | 17 min | 2 tasks | 7 files |
| Phase 02 P07 | 18 min | 3 tasks | 8 files |
| Phase 02 P08 | 22 min | 3 tasks | 17 files |
| Phase 02 P09 | 43 min | 2 tasks | 20 files |
| Phase 02 P10 | 20 min | 3 tasks | 15 files |
| Phase 02 P12 | 24 min | 2 tasks | 12 files |
| Phase 02 P13 | 30 min | 3 tasks | 21 files |
| Phase 02 P19 | 12 min | 2 tasks | 7 files |

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
- [Phase 02]: Owner cool-down exceptions (2026-10-07): source-map-js 1.2.2 and http-cache-semantics 4.3.0 (security fixes) and rolldown + @rolldown/binding-* 1.2.11 (vite 8.3.3 engine waiver), pinned via web/package.json overrides
- [Phase 02]: SPA shell keeps GET/HEAD-only registration: matrix keys GET and HEAD {*path:nonfile}; other methods on page paths stay default-deny
- [Phase 02]: D-29 via ReservedPathMetadata: outside Development /openapi/{**path} and /scalar/{**path} are anonymous ProblemDetails 404 fallbacks
- [Phase 02]: Shared ESLint configs pass through escalate(): warn-level rules (react-hooks exhaustive-deps, incompatible-library, unsupported-syntax) become error, never off
- [Phase 02]: Node-side config tests (lint-rules, eslint-config, build-config) are typed by tsconfig.node.json and excluded from tsconfig.app.json, so app code never sees Node types
- [Phase 02]: Prettier pins tabWidth 2 and .editorconfig has a web/** indent_size = 2 section (the repo default is 4)
- [Phase 02]: no-console is off only for src/test/consoleGuard.ts and its test; deliberate a11y violations in tests use per-line eslint-disable with a reason
- [Phase 02]: 02-03: npm pins (incl. exact overrides) registered with folder-qualified ids; license exceptions match license AND scope
- [Phase 02]: 02-04: Pinned D-09 order-math operation order (golden-vector operationOrder): round the items total; round each discount (a percentage applies to the ROUNDED items total); sum the discounts and round the sum; subtract. Server Csps.Domain.Orders.OrderMath (decimal, AwayFromZero) and client csps.ts (exact BigInt centavos) both pass 220 shared vectors in tests/fixtures/order-math-golden-vectors.json; regenerate only with node web/scripts/gen-golden-vectors.mjs (--check for drift)
- [Phase 02]: 02-04: Client previews read numbers through String(n) into BigInt centavos and back through the decimal text; NaN and +/-Infinity count as 0 (SPEC-DEVIATION D-09); toCentavos/centavosToAmount are the MoneyInput string<->centavo conversion
- [Phase 02]: 02-04: A const decimal in Csps.Domain compiles to a static field whose initializer never runs (one uncovered line); use the literal instead
- [Phase 02]: 02-05: D-02 rule applied to five verbatim faded-text selectors (placeholder, Manager tag, CTA lead, pill count, big-button caption), reset to opacity 1 in overrides.css; the opacity scan allows only reasoned exceptions (inactive buttons, D-05 thumb actions, skeleton, entry-animation first frames, two decorations)
- [Phase 02]: 02-05: WEB-09 pending (aria-disabled) buttons also reset every App. B hover/press style, so they look exactly like :disabled
- [Phase 02]: 02-05: PERF-05 fallback faces measured against Windows Arial (Arial Narrow absent): Archivo Fallback 101.85/86.21/20.62/0, Barlow Condensed Fallback 68.92/145.1/29.02/0 (size-adjust/ascent/descent/line-gap %); Barlow fallback skips U+20B1
- [Phase 02]: 02-06: A2 confirmed - `--webroot <abs path>` on dotnet run sets the web root; the E2E host serves web/.e2e-dist directly (never copied into wwwroot). A1 confirmed - addInitScript, exposeBinding, evaluate and AxeBuilder injection work under the strict CSP in Chromium, Firefox and WebKit
- [Phase 02]: 02-06: E2E specs import test/expect/expectNoAxeViolations from web/e2e/fixtures.ts; the automatic guard fails every test on console error/warning, pageerror, CSP violation (binding-reported, survives navigation) and same-origin response >= 400; self-tests consume provoked findings with guard.take()
- [Phase 02]: 02-07: createHttpClient owns retries - max 2 (clamped), 250 ms doubling to a 2 s cap, no jitter, only GET/HEAD/PUT/DELETE/OPTIONS or a POST with idempotencyKey, only after kind network or a 503; TanStack Query must keep retry: false
- [Phase 02]: 02-07: the HTTP client never creates an Idempotency-Key and never sends one on GET/HEAD/OPTIONS; the key comes only from RequestConfig.idempotencyKey, is set before request interceptors, and is resent on every retry and the 401 refresh retry
- [Phase 02]: 02-07: 401 handling - one refresh cycle per client (single flight), each request retries once; no refresh configured, a failed refresh, or a second 401 calls onUnauthorized at most once per cycle
- [Phase 02]: 02-07: HttpError kind network|timeout|aborted|http|parse, status 0 without a response, message = ProblemDetails title or a plain-English kind default; secret param names (token, access_token, refresh_token, password, secret, otp) throw a TypeError before fetch
- [Phase 02]: 02-07: a filtered lib/http coverage run needs --coverage.include=src/lib/http/** (otherwise the global 90% thresholds trip); npm run verify enforces coverage.thresholds['src/lib/http/**'] = 100
- [Phase 02]: 02-08: createListParams(parsers, { urlKeys }) is the one list-state hook: typed + raw nuqs useQueryStates reads; one replace removes invalid, default or non-canonical keys (at most once); setPage pushes, every other setter replaces and writes page: null in the same update; setSearch debounces 300 ms (immediate on Enter); default urlKeys pageSize->size, search->q
- [Phase 02]: 02-08: nuqs shallow writes update window.history only; React Router's useLocation().search stays stale after a list-state change, so list screens read list state only through their list hook (UrlStateLayout tests assert window.location in a browser router)
- [Phase 02]: 02-08: URL key order is page, size, q, then the other keys by name (orderSearchParams as NuqsAdapter processUrlSearchParams); equal values always give one query string
- [Phase 02]: 02-08: prefetchOnIntent uses queryClient.query(options).catch(noop) because TanStack Query 5.103.2 deprecates prefetchQuery (no-deprecated lint); never RR <Link prefetch>
- [Phase 02]: 02-08: createListParams throws a TypeError for URL keys naming personal data or secrets (email, phone, mobile, name variants, address, token variants, password, secret, otp, code); personal data only in free-text q (CWE-598)
- [Phase 02]: 02-08: Range presets today/last-7-days/last-30-days/this-month/last-month/this-year resolve against an injected businessToday(now, 'Asia/Manila'); last-N-days includes today; dates stay plain YYYY-MM-DD strings (parseAsBusinessDate)
- [Phase 02]: 02-09: App. D.3-D.5 reconciled with the strict gates with no DOM change, proven by src/ui/differential.test.tsx (245 seed-data cases, equal-props re-render, handler parity) against frozen src/ui/__reference__ copies; normalizeDom hides only useId, lucide classes, xmlns, attribute order and icon drawings; Sidebar Logout <button> (D-27) is the only listed difference
- [Phase 02]: 02-09: UiLink renders react-router Link directly (LinkProvider kept, unused); Icon renders ICONS[name] (lucide-react 1.52.0, 56 names, IconProps omits color); MarkSvg JSX replaces the MARK_SVG raw-HTML prop; jsx-a11y handler fixes use React 19 callback-ref listeners
- [Phase 02]: 02-09: D-27 compat rule button.csp-nav sets only appearance, border-width, text-align, cursor (unlayered overrides may not set properties layered .csp-nav rules set); measured identical to the link in 34 values
- [Phase 02]: 02-10: API contract pipeline: OpenApiSnapshotTests compares the canonical (ordinal key sort, 2-space, LF) Development /openapi/v1.json with tools/openapi-gen/openapi.v1.json; CSPS_WRITE_OPENAPI_SNAPSHOT=1 (per process) writes it and still fails; npm --prefix tools/openapi-gen run generate/check keep web/src/types/api.generated.ts in step; api.ts types come from components['schemas']
- [Phase 02]: 02-10: useSubmission(submit).run resolves to { ok, value } | { ok, error } and never rejects; one Idempotency-Key per submission, reused only for a JSON-equal (or no-data) retry of a failed submission; success, reset() or changed data mints a new key; a second trigger while pending gets the same promise; signal aborts on unmount; newIdempotencyKey falls back to getRandomValues, never Math.random
- [Phase 02]: 02-10: describeHttpError is the only error-copy module: 400 with field errors -> 'Check the highlighted fields.' with empty body and fieldErrors; 403/404/409/429 UI-SPEC copy; 5xx, unmapped statuses, parse and non-HttpError -> 'Something went wrong' / 'Please try again.' (+ ' Reference: {traceId}'); 401 and aborted -> null
- [Phase 02]: 02-12: SPEC-GAP form primitives live in web/src/ui/gaps/ (MoneyInput, OtpInput, Checkbox, SkipLink), strings in gaps/copy.ts, CSS in one /* SPEC-GAP: <name> */ block of spec-gaps.css each; SPEC-GAP CSS assertions go in src/styles/overrides.test.ts because Vitest stubs CSS imports even with ?raw
- [Phase 02]: 02-12: MoneyInput strips commas and spaces from every change and keeps it only if it matches ^\d{0,9}(\.\d{0,2})?$; normalizeMoneyOnBlur pads to 2 decimals; className text-right on the field right-aligns item-row amounts (SPEC-GAP rule .csp-field.text-right .csp-input)
- [Phase 02]: 02-12: OtpInput value is one character per box with a space for an empty box (trailing spaces dropped); onComplete fires whenever an edit leaves all six filled; Backspace in an empty box moves back and clears that box; direct value writes (Android Unidentified keys, one-time-code autofill) use the same fill as paste
- [Phase 02]: 02-12: SkipLink always prevents the default (focuses the target, no #main in the URL); Checkbox takes explicit props (no rest spread) with onChange(checked), required, hint and error
- [Phase 02]: 02-13: LoadingRegion's single polite status node sits beside the aria-busy region (not inside it) and stays silent after a failed load; the ErrorState alert announces failures
- [Phase 02]: 02-13: SearchBox keeps the typed text and resyncs only when the outside value differs once trimmed, because the list hook stores the trimmed search; the URL stays the single source
- [Phase 02]: 02-13: ResponsiveTable owns the list states (first-load SkeletonTable, ErrorState above kept rows, EmptyState first-use / no matches, .is-refetching after 200 ms of placeholder data); feature lists pass status, isPlaceholderData and the list-hook setters
- [Phase 02]: 02-13: user-event never resolves under vitest fake timers; debounce tests fire input events, other tests use real timers, and axe always runs on real timers
- [Phase 02]: 02-19: G-02-2 closed server-side: HiddenSegmentFileProvider wraps the web root in UseStaticFiles; any segment starting with a dot or containing a tilde (split on / and backslash) reads as missing and gets the anonymous {*path:file} ProblemDetails 404 (Windows backslash and NTFS 8.3 aliases included); D-BL-04 untouched
- [Phase 02]: 02-19: a future /.well-known/ file (security.txt, Android App Links, ACME) needs an explicit, tested exact-path exception inside HiddenSegmentFileProvider, never a relaxed rule

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
- D-BL-01 (backlog 999.1): owner decision pending on MIT-0, CC-BY-3.0, Python-2.0 in the npm dev/build tree; node web/scripts/license-gate.mjs exits 1 until decided; blocks plan 02-16 wiring license:check into verify
- Owner question (D-08): selected Users sidebar row hides the 'Manager' tag (nav-ink on primary, 1.00:1 Blush / 1.43:1 Espresso) in verbatim App. B; see phase 02 deferred-items.md
- 02-11 blocked on D-31/D-32 owner rulings, D-BL-03 (02-09 Task 3 deferred: O-1..O-8, 20 changed lucide icons, D-27 look confirmation, D-BL-02; review pack artifacts/owner-review/phase2-rulings/index.html)

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

Last session: 2026-10-08T09:52:35.709Z
Stopped at: Completed 02-19-PLAN.md
Resume file: None
