---
phase: 01-hosting-verification-backend-foundation
plan: 07
subsystem: api
tags: [serilog, logging, correlation-id, masking, cwe-532, cwe-117, compact-json, request-context, forwarded-headers, tdd]

requires:
  - phase: 01-hosting-verification-backend-foundation
    provides: "Plan 01-06: CorrelationId.For (W3C trace id), CspsProblemDetails traceId, status-code pages, CspsApiFactory test host"
provides:
  - "LoggingRegistration.AddCspsLogging: Serilog with ReadFrom.Configuration (levels only), ReadFrom.Services, FromLogContext, masking enricher, destructuring policy, D-21 file sink and Development console"
  - "One request-completion event per request (UseSerilogRequestLogging) whose TraceId is the client's ProblemDetails traceId"
  - "SensitiveDataMasking.IsSensitive (exact names plus Password/Token/Secret suffixes) and Mask \"***\""
  - "SensitiveDataMaskingEnricher (top level plus captured structures, dictionaries and sequences) and SensitiveDataDestructuringPolicy ({@x} objects)"
  - "LogFileSettings.For(contentRoot): {contentRoot}/logs/csps-.json, daily, 30 files, 30 days, 10 MB roll-over, shared, 2 s flush"
  - "Csps.Application.Ports.IRequestContext and Csps.Server.Http.HttpRequestContext (scoped): sub claim, Connection.RemoteIpAddress only, raw User-Agent, correlation id"
  - "Config keys Serilog:MinimumLevel:* and CspsLogging:WriteToFile (LoggingRegistration.WriteToFileKey)"
  - "Test infrastructure: Csps.Testing.CollectingSink, CspsApiFactory.Sink, CspsApiFactory.LogFileSwitchKey"
affects: [01-08 auth (sub claim, MapInboundClaims false), 01-09 audit trail (IRequestContext feeds IpPrefix/UserAgentFamily), 01-12 FND-13 hosting record (forwarded headers stay off until proven), phase 3 Web Deploy logs exclusion]

actuals:
  tokens: 12900
  tasks: 3
  commits: 7
plan_head_before: 4c7c61a77fbfdd147c94245c95fdacb10cca2aab
plan_head_after: 79222519f22a7e8cadfce77b537686b0c2f5c423

tech-stack:
  added: []
  patterns:
    - "Serilog is registered with preserveStaticLogger: true and UseSerilogRequestLogging gets this host's Serilog.ILogger, so no code writes through the process-wide static Log.Logger"
    - "Tests read log output from CspsApiFactory.Sink (an ILogEventSink in DI picked up by ReadFrom.Services); the file sink is off in tests through CspsLogging:WriteToFile=false"
    - "Request-completion events are found by Serilog's template \"HTTP {RequestMethod} {RequestPath} responded {StatusCode}\"; framework events can also carry RequestPath and StatusCode"
    - "Request facts reach Application code only through IRequestContext; nothing under src/ may enable or read forwarded headers (ForwardedHeadersTests)"

key-files:
  created:
    - src/Csps.Server/Composition/LoggingRegistration.cs
    - src/Csps.Server/Logging/SensitiveDataMasking.cs
    - src/Csps.Server/Logging/SensitiveDataMaskingEnricher.cs
    - src/Csps.Server/Logging/SensitiveDataDestructuringPolicy.cs
    - src/Csps.Server/Logging/LogFileSettings.cs
    - src/Csps.Server/Http/HttpRequestContext.cs
    - src/Csps.Application/Ports/IRequestContext.cs
    - tests/Csps.Testing/CollectingSink.cs
    - tests/Csps.Server.IntegrationTests/Logging/LogEvents.cs
    - tests/Csps.Server.IntegrationTests/Logging/RequestLoggingTests.cs
    - tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs
    - tests/Csps.Server.IntegrationTests/Logging/LogFileTests.cs
    - tests/Csps.Server.IntegrationTests/Http/HttpRequestContextTests.cs
    - tests/Csps.ArchitectureTests/ForwardedHeadersTests.cs
  modified:
    - src/Csps.Server/Program.cs
    - src/Csps.Server/appsettings.json
    - src/Csps.Server/appsettings.Development.json
    - tests/Csps.Testing/CspsApiFactory.cs

key-decisions:
  - "Serilog uses preserveStaticLogger: true and the request-logging middleware gets the host's own Serilog.ILogger; the defaults write through the static Log.Logger, which parallel test hosts (and any second host) would share"
  - "CspsLogging:WriteToFile defaults to on when the key is missing; only CspsApiFactory turns it off, so a missing setting can never silently disable production logs"
  - "The masking enricher also walks captured structures, dictionaries and sequences, so a secret key inside a logged dictionary is masked too (the destructuring policy alone skips collections)"
  - "LogFileSettings.For rejects a blank or relative content root, so the file path is always absolute (research A8)"
  - "HttpRequestContext outside a request uses Activity.Current's trace id when one exists, otherwise a random W3C id, stable for the scope"
  - "The dead Microsoft.Extensions.Logging \"Logging\" sections were removed from appsettings.json and appsettings.Development.json; Serilog's \"Serilog:MinimumLevel\" section is the one source of levels"

patterns-established:
  - "LogEvents.RequestCompletionAsync(sink, path, ct) waits for the one request-completion event (TestServer returns the response before the middleware logs)"
  - "Shared log files are read with FileShare.ReadWrite | FileShare.Delete and a short retry; temp content roots are deleted with a retry"
  - "Source-scan architecture tests carry detector self-tests (positive and negative theories) so the scan cannot pass vacuously"

requirements-completed: [FND-07]

coverage:
  - id: D1
    description: "Every request writes one Serilog request-completion event whose TraceId equals the ProblemDetails traceId; ten parallel requests each log their own id"
    requirement: "FND-07"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*RequestLoggingTests\" (2 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Secrets (exact names Password, Code, Otp, ApiKey, Authorization, Cookie, ConnectionString, CertificatePassword, CertificateBase64, SigningKey, Secret, Token, or names ending in Password, Token, Secret) are written as *** at top level, in {@x} objects, nested objects and dictionaries, through the real API logger; StatusCode, ZipCode, RequestPath, TokenCount and Elapsed stay intact; the query string is never logged"
    requirement: "FND-07"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*SensitiveDataMaskingTests\" (28 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Compact JSON escapes CR/LF, so a value containing \\r\\n stays on one log line (CWE-117)"
    requirement: "FND-07"
    verification:
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs#CompactJsonEscapesNewlines"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-21 file sink: {contentRoot}/logs/csps-<yyyyMMdd>.json compact JSON with @tr = traceId, daily roll, 30 files, 30 days, 10 MB roll-over, shared, 2 s flush; tests never write into src/Csps.Server/logs; no log line contains the client IP or raw User-Agent"
    requirement: "FND-07"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*LogFileTests\" (6 passed)"
        status: pass
      - kind: other
        ref: "test ! -d src/Csps.Server/logs after dotnet test --solution Csps.slnx"
        status: pass
    human_judgment: false
  - id: D5
    description: "IRequestContext: user id from the sub claim (null when anonymous or malformed), Connection.RemoteIpAddress only (spoofed X-Forwarded-For, X-Real-IP and CF-Connecting-IP ignored), raw User-Agent, CorrelationId.For; registered in DI; nothing under src/ enables or reads forwarded headers"
    requirement: "FND-07"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*HttpRequestContextTests\" (10 passed)"
        status: pass
      - kind: unit
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class \"*ForwardedHeadersTests\" (11 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "During an IIS overlapped recycle, two worker processes append to the same daily log file without errors (shared: true)"
    requirement: "FND-07"
    verification:
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/Logging/LogFileTests.cs#LogFileSettingsHasD21Values (Shared is true)"
        status: pass
    human_judgment: true
    rationale: "Plan marks this truth as a backstop: two real IIS worker processes on the host can only be observed on SmarterASP.NET (FND-13 / Phase 3 deploy); the test proves only that the sink is opened shared."

duration: 18min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 07: Structured, Privacy-Safe Logging and the Request Context Summary

**The API now logs with Serilog. Each request writes one completion event carrying the same 32-hex W3C trace id the client sees as `traceId`. Secrets are masked by exact name or suffix (top level, in `{@x}` objects, nested objects and dictionaries). Production logs are compact JSON files in `{contentRoot}/logs` with D-21 retention. The `IRequestContext` port gives Application code the user, the direct-connection IP, the User-Agent and the correlation id, and never trusts forwarded headers.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-07T15:43:06Z
- **Completed:** 2026-10-07T16:01:24Z
- **Tasks:** 3 (tracer + 2)
- **Files modified:** 18 (14 new, 4 changed)

## Accomplishments

- **Correlated request logging (FND-07).** `AddCspsLogging` registers Serilog with:
  - levels from the `Serilog:MinimumLevel` section
  - DI-registered sinks (`ReadFrom.Services`)
  - `FromLogContext`, then the masking enricher and destructuring policy
  - the file sink, and a console sink in Development only

  `UseSerilogRequestLogging` sits right after status-code pages. Assumption A9 holds: the event's `TraceId` equals the ProblemDetails `traceId`, also for ten parallel requests.
- **Secret masking (CWE-532).**
  - `IsSensitive` matches exact names (OrdinalIgnoreCase) or the `Password`/`Token`/`Secret` suffixes, never substrings.
  - The enricher masks top-level properties and secret keys inside captured structures, dictionaries and sequences.
  - The policy destructures `{@x}` objects with secret properties already masked, handing nested values back to Serilog (depth limit kept).
  - The real API logger masks both, and the query string never reaches the logs.
- **Log forging (CWE-117).** Compact JSON escapes CR/LF, so `"line1\r\nFAKE ENTRY"` stays on one line.
- **D-21 file sink.** `LogFileSettings.For` builds an absolute `{contentRoot}/logs/csps-.json` path with these settings:
  - daily roll, 30 files and 30 days
  - 10 MB roll-over
  - `shared: true`
  - 2 s flush

  A content-root test confirms `csps-<yyyyMMdd>.json` holds `"@tr":"<traceId>"`. No log line contains the client IP `203.0.113.45` or the User-Agent.
- **Request context.** `IRequestContext` (Application, BCL types only) is implemented by `HttpRequestContext` (scoped, through `IHttpContextAccessor`):
  - `sub` claim parsed as a Guid
  - `Connection.RemoteIpAddress` only
  - raw `User-Agent`
  - `CorrelationId.For`

  `ForwardedHeadersTests` scans `src/` and checks Server's type dependencies, so forwarded-header processing cannot appear before FND-13.
- **No alerting, e-mail or database sink (D-22).**

## Task Commits

1. **Task 1 (tracer): a failing API request is logged with the client's correlation id**
   - RED: `6e37bdd` (test)
   - GREEN: `8171f5d` (feat)
2. **Task 2: secret masking and log-forging safety**
   - RED: `8e34b6a` (test, with compile-only stubs)
   - GREEN: `915c9af` (feat)
3. **Task 3: D-21 file sink and the IRequestContext port**
   - RED: `581516a` (test, with compile-only stubs)
   - GREEN: `fb8ef5c` (feat)
   - Fix: `7922251` (flaky shared-file read in `LogFileTests`)

No REFACTOR commits were needed.

## TDD Gate Compliance

Every task has a `test(01-07)` RED commit before its `feat(01-07)` GREEN commit. Each RED run used `--report-xunit-junit` and was checked with `gsd check tdd-red-evidence`, which returned `RED_EVIDENCE_OK` (`target_test_failed`, exit 2).

- **Task 1 RED:** target `RequestLoggingTests.RequestEventTraceIdMatchesProblemTraceId`. It failed with `should have single item but had 0 items` (no request-completion event existed). Both tests failed.
- **Task 2 RED:** target `SensitiveDataMaskingTests.EnricherMasksTopLevelProperties`. It failed with `LogEvents.Scalar(logEvent, "Password") should be "***" but was "hunter2-SECRET"`. 20 of 28 failed. The 8 that passed were the six negative `IsSensitive` cases, `CompactJsonEscapesNewlines` and `QueryStringIsNotLogged`, which characterize existing library behaviour.
- **Task 3 RED:** two records.
  - `LogFileTests.LogFileSettingsHasD21Values` failed with `settings.Path should be "...\site\logs\csps-.json" but was "...\site"`. 5 of 6 failed; `LogsNeverContainClientIpOrUserAgent` passed as a prohibition guard.
  - `HttpRequestContextTests.RemoteIpIgnoresForwardedFor` failed with `For(context).RemoteIp should be 10.0.0.5 but was null`. 6 of 10 failed.
  - `ForwardedHeadersTests` (11) passed at RED by design: it guards an absence.
- **Tracer gate (interactive, end-of-phase, automated-only verify):** after Task 1 GREEN, `*RequestLoggingTests` was run again and passed 2/2. Expansion went ahead after that.

## Files Created/Modified

- `src/Csps.Server/Composition/LoggingRegistration.cs`: `AddCspsLogging` and `WriteToFileKey`.
- `src/Csps.Server/Logging/SensitiveDataMasking.cs`: the exact-name and suffix rules, and `Mask`.
- `src/Csps.Server/Logging/SensitiveDataMaskingEnricher.cs`: masks top-level and captured nested values.
- `src/Csps.Server/Logging/SensitiveDataDestructuringPolicy.cs`: masks secret properties while destructuring objects.
- `src/Csps.Server/Logging/LogFileSettings.cs`: the D-21 sink settings with an absolute path.
- `src/Csps.Server/Http/HttpRequestContext.cs`: `IRequestContext` from `HttpContext`, without forwarded headers.
- `src/Csps.Application/Ports/IRequestContext.cs`: the request-facts port.
- `src/Csps.Server/Program.cs`:
  - `AddCspsLogging`
  - `UseSerilogRequestLogging` with the host's logger
  - `AddHttpContextAccessor` and the scoped `IRequestContext`
- `src/Csps.Server/appsettings.json`: `Serilog:MinimumLevel` (Information; Microsoft.AspNetCore and Microsoft.EntityFrameworkCore at Warning) and `CspsLogging:WriteToFile` true. The dead `Logging` section was removed.
- `src/Csps.Server/appsettings.Development.json`: the dead `Logging` section was removed.
- `tests/Csps.Testing/CollectingSink.cs` and `CspsApiFactory.cs`: the `Sink` property, the file sink turned off, and `LogFileSwitchKey`.
- Tests:
  - `RequestLoggingTests` (2)
  - `SensitiveDataMaskingTests` (28)
  - `LogFileTests` (6)
  - `HttpRequestContextTests` (10)
  - `ForwardedHeadersTests` (11)
  - the `LogEvents` helper

## Verification

- Preflight was clean (ports 5180, 5115, 7028 and 5199 free, no other dev/test processes) before every test run.
- `dotnet build Csps.slnx -tl:off --no-incremental`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`: 420 passed, 0 failed.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- The plan's per-class verify commands all passed:
  - RequestLogging 2
  - SensitiveDataMasking 28
  - LogFile 6
  - HttpRequestContext 10
  - ForwardedHeaders 11
- The Server suite passed 5 runs in a row after the flaky-read fix.
- Acceptance greps passed: `ReadFrom.Services`, `UseSerilogRequestLogging`, `Destructure.With<SensitiveDataDestructuringPolicy>`, `RetainedFileCountLimit` and `Connection.RemoteIpAddress`.
- `test ! -d src/Csps.Server/logs` passed after every suite run, and no `csps-logtest-*` folder was left in `%TEMP%`.

## Decisions Made

- **Per-host logger:** `preserveStaticLogger: true` plus an explicit `options.Logger` for request logging. Both Serilog defaults write through the static `Log.Logger`, which parallel test hosts would share. Events would then land in another host's sink, and disposing one host would replace the static logger for all.
- **The file sink defaults on:** a missing `CspsLogging:WriteToFile` keeps production logging on. Only the test factory sets it false.
- **Deeper masking:** the enricher also masks inside captured structures, dictionaries and sequences, as defence in depth beyond the policy.
- **Absolute log path enforced:** `LogFileSettings.For` throws `ArgumentException` for a blank or relative content root.
- **Background correlation id:** outside a request, `HttpRequestContext` uses the ambient `Activity` trace id, or else a random W3C id cached for the scope.
- **One source of levels:** the MEL `Logging` sections were removed from both appsettings files, because Serilog replaces the MEL providers and ignores them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Static-logger sharing between hosts**
- **Found during:** Task 1 (GREEN design)
- **Issue:** `AddSerilog` sets the static `Log.Logger` by default, and `RequestLoggingOptions.Logger` defaults to the static `Log`. Every host in the process would then write through whichever logger was registered last.
- **Fix:** `preserveStaticLogger: true`, plus `UseSerilogRequestLogging(options => options.Logger = <host Serilog.ILogger>)`.
- **Files modified:** src/Csps.Server/Composition/LoggingRegistration.cs, src/Csps.Server/Program.cs
- **Verification:** `ParallelRequestsKeepTheirOwnIds`, plus all 117 Server tests running hosts in parallel.
- **Committed in:** `8171f5d`

**2. [Rule 2 - Missing Critical] Masking inside dictionaries and captured structures**
- **Found during:** Task 2
- **Issue:** the policy skips collections, so `{@Values}` with a `Password` key would leak (CWE-532).
- **Fix:** the enricher walks `StructureValue`, `DictionaryValue` and `SequenceValue`. `EnricherMasksDictionaryEntriesByKey` was added.
- **Files modified:** src/Csps.Server/Logging/SensitiveDataMaskingEnricher.cs
- **Committed in:** `8e34b6a` / `915c9af`

**3. [Rule 2 - Missing Critical] Extra wiring and guard tests**
- **Found during:** Tasks 2 and 3
- **Issue:** the plan's tests exercised the classes in isolation, not their registration.
- **Fix:** added these tests:
  - `ApiPipelineMasksSecrets` (the real host logger masks)
  - `QueryStringIsNotLogged`
  - `PipelineResolvesRequestContextFromTheConnection` (DI registration, spoofed `X-Forwarded-For` ignored end to end)
  - `LogFileSettingsRequiresAnAbsoluteContentRoot`
  - an ArchUnit rule plus detector self-tests in `ForwardedHeadersTests`
- **Committed in:** `8e34b6a`, `581516a`

**4. [Rule 1 - Bug] Request-event lookup matched framework events**
- **Found during:** Task 3 RED
- **Issue:** with a temp content root there is no `appsettings.json`, so ASP.NET Core Information events were logged. They carry `RequestPath` (hosting scope) and `StatusCode`, and the helper found 3 "completion" events.
- **Fix:** `LogEvents` matches Serilog's completion template instead.
- **Files modified:** tests/Csps.Server.IntegrationTests/Logging/LogEvents.cs
- **Committed in:** `581516a`

**5. [Rule 1 - Bug] Flaky shared-file read**
- **Found during:** final Task 3 verification
- **Issue:** `WritesCompactJsonUnderContentRoot` sometimes hit a sharing violation reading the fresh file in `%TEMP%`. A temporary probe sink, not committed, showed that host disposal does dispose the Serilog pipeline, so the sink was not leaking.
- **Fix:** read with `FileShare.ReadWrite | FileShare.Delete` and a short retry, and retry the temp cleanup.
- **Files modified:** tests/Csps.Server.IntegrationTests/Logging/LogFileTests.cs
- **Verification:** 5 consecutive green Server runs, plus the full solution (420).
- **Committed in:** `7922251`

**6. [Rule 3 - Cleanup] Dead MEL `Logging` configuration removed**
- **Issue:** after Serilog replaced the providers, the `Logging:LogLevel` sections in `appsettings.json` and `appsettings.Development.json` were ignored and misleading.
- **Fix:** removed them. `appsettings.Development.json` was not in the plan's file list.
- **Committed in:** `8171f5d`

---

**Total deviations:** 6 auto-fixed (3 Rule 1, 2 Rule 2, 1 Rule 3).
**Impact on plan:** all of them are needed for correctness, isolation or a stable suite. There is no scope creep and no new packages; Serilog.AspNetCore, Sinks.File and their transitive Formatting.Compact, Settings.Configuration and Sinks.Console were already pinned and approved in plan 01.

## Issues Encountered

- **Process note:** the GREEN commit `fb8ef5c` was made in the same shell chain as a Server suite run that showed 1 failure: the flaky read above. The chain did not gate the commit on the test result. The cause was investigated and fixed in `7922251` before the SUMMARY, and every later run is green.
- **RED target naming:** `tdd-red-evidence` needs the fully qualified JUnit test name (`Namespace.Class.Method`), not the bare method name.

## Threat Model Coverage

- **T-01-23 (information disclosure, Serilog pipeline):** the masking enricher and destructuring policy use exact/suffix rules, and no header or body logging exists. `SensitiveDataMaskingTests` proves it.
- **T-01-24 (tampering, log files):** compact JSON escapes CR/LF. `CompactJsonEscapesNewlines` proves it.
- **T-01-25 (spoofing, client IP):** `Connection.RemoteIpAddress` is the only source. `HttpRequestContextTests` checks spoofed `X-Forwarded-For`, `X-Real-IP` and `CF-Connecting-IP`, and `ForwardedHeadersTests` (source scan plus ArchUnit) blocks forwarded-headers setup.
- **T-01-26 (log location):** logs live in `{contentRoot}/logs`, outside `wwwroot`, and `logs/` is git-ignored. The Web Deploy exclusion is Phase 3.
- **T-01-27 (disk usage):** 10 MB per file, 30 files, 30 days (`LogFileSettingsHasD21Values`).
- **T-01-SC (supply chain):** no packages were added.
- **RA 10173 prohibition (resolved, test):** `LogsNeverContainClientIpOrUserAgent`.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Plan 08 (auth):** keep `MapInboundClaims = false`, because `HttpRequestContext.UserId` reads the raw `sub` claim.
- **Plan 09 (audit):** inject `IRequestContext`, and pass `RemoteIp` and `UserAgent` to `AuditEntry.Create`, which reduces them to `IpPrefix`/`UserAgentFamily`. Never log them.
- **Plan 12 / FND-13:** forwarded headers stay off. If the hosting record proves a proxy, update `ForwardedHeadersTests` and `HttpRequestContext` together. The HostProbe under `tools/` is outside the `src/` scan.
- **Phase 3:** exclude `logs/` from Web Deploy sync (`-skip:Directory=\\logs`). The overlapped-recycle shared-file behaviour (D6) is observed on the host.
- No blockers.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 14 created files and the 4 modified files exist on disk.
- Commits `6e37bdd`, `8171f5d`, `8e34b6a`, `915c9af`, `581516a`, `fb8ef5c` and `7922251` exist on `gsd/phase-1-hosting-verification-backend-foundation`.
- The ledger count (`4c7c61a..HEAD`) is 7, which matches `actuals.commits`.
