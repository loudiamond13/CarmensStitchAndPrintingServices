---
phase: 01-hosting-verification-backend-foundation
plan: 05
subsystem: auditing
tags: [audit-log, data-minimization, ra-10173, ip-truncation, user-agent, cwe-1333, domain, tdd]

requires:
  - phase: 01-hosting-verification-backend-foundation
    provides: "Plan 01-02: BCL-only Csps.Domain, Csps.Domain.UnitTests (xUnit v3 + Shouldly), ArchUnitNET LayerTests"
provides:
  - "Csps.Domain.Auditing.AuditEntry: append-only audit record with column-length constants and a validating Create factory"
  - "Csps.Domain.Auditing.IpPrefix.From: IPv4 /24 and IPv6 /48 truncation (IPv4-mapped treated as IPv4, scope id dropped)"
  - "Csps.Domain.Auditing.UserAgentFamily.Classify: regex-free UA family classifier (11 labels, 512-character read cap)"
affects: [01-09 audit persistence and AuditLog table, phase 4 auth audit events, phase 12 visitor analytics]

actuals:
  tokens: 7900
  tasks: 3
  commits: 6
plan_head_before: b2e9906652fa4097886e4bbffa828420d12234e3
plan_head_after: 44592d74a393c793d3457948d90e14e99ffcd96e

tech-stack:
  added: []
  patterns:
    - "Domain records are built only through a static Create factory that validates and throws ArgumentException for programming errors; an EF-bindable private constructor and private setters"
    - "Attacker-controlled text is parsed with character loops or ordered span Contains checks, never Regex (CWE-1333), and read only up to a fixed cap"
    - "Raw personal data (client IP, User-Agent) is minimized before the record exists, so no raw value is ever on the entity"

key-files:
  created:
    - src/Csps.Domain/Auditing/AuditEntry.cs
    - src/Csps.Domain/Auditing/IpPrefix.cs
    - src/Csps.Domain/Auditing/UserAgentFamily.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditEntryTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/IpPrefixTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/UserAgentFamilyTests.cs
  modified: []

key-decisions:
  - "AuditEntry.Create throws ArgumentNullException for a null action or correlation id, and ArgumentException for every other rule; messages are plain English and never echo the rejected value"
  - "IpPrefix chooses the prefix length from AddressFamily (InterNetwork gives /24, anything else /48), because IPAddress can only hold 4 or 16 bytes; the plan's 'other family gives null' branch would be unreachable and would break Domain 100% branch coverage"
  - "UserAgentFamily reads the first 512 characters as a span; a header that is blank within those 512 characters is Unknown, so no step scans the whole header"
  - "Inside AuditEntry, the helpers are called as Auditing.IpPrefix.From and Auditing.UserAgentFamily.Classify because the properties IpPrefix and UserAgentFamily share the type names"

patterns-established:
  - "Audit actions are dotted lowercase codes (two or more segments of a-z, 0-9 and '-'), for example auth.sign-in-failed"
  - "Correlation ids are W3C trace ids: exactly 32 lowercase hex characters"

requirements-completed: [FND-10]

coverage:
  - id: D1
    description: "AuditEntry.Create turns raw request facts into a minimized record (UTC time, actor, action, target, /24 or /48 IP prefix, UA family, 32-hex correlation id, optional detail) and never keeps the raw IP or UA"
    requirement: "FND-10"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Auditing/AuditEntryTests.cs#CreateMinimizesRequestFacts"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Auditing/AuditEntryTests.cs#CreateNeverKeepsTheRawIpOrUserAgent"
        status: pass
    human_judgment: false
  - id: D2
    description: "AuditEntry.Create rejects a non-UTC timestamp, empty, over-length or malformed action, bad correlation id and over-length target type, target id or detail; null optional fields are allowed"
    requirement: "FND-10"
    verification:
      - kind: unit
        ref: "dotnet test --project tests/Csps.Domain.UnitTests --filter-class \"*AuditEntryTests\" (39 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "IpPrefix.From truncates IPv4 to /24, IPv4-mapped IPv6 as IPv4, IPv6 to /48 with the scope id dropped, null to null, and every result fits 45 characters (D-24)"
    requirement: "FND-10"
    verification:
      - kind: unit
        ref: "dotnet test --project tests/Csps.Domain.UnitTests --filter-class \"*IpPrefixTests\" (18 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "UserAgentFamily.Classify maps a User-Agent to one of 11 labels with ordered, case-insensitive, regex-free checks over at most the first 512 characters (D-24, CWE-1333)"
    requirement: "FND-10"
    verification:
      - kind: unit
        ref: "dotnet test --project tests/Csps.Domain.UnitTests --filter-class \"*UserAgentFamilyTests\" (35 passed)"
        status: pass
      - kind: other
        ref: "grep -rn Regex src/Csps.Domain (no matches)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Csps.Domain still references only System assemblies and stays at 100% line and branch coverage"
    requirement: "FND-10"
    verification:
      - kind: unit
        ref: "dotnet test --project tests/Csps.ArchitectureTests (61 passed, including LayerTests)"
        status: pass
      - kind: other
        ref: "coverlet.MTP cobertura run (temporary reference): package Csps.Domain line-rate 1, branch-rate 1"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 05: Audit Entry, IP Prefix and User-Agent Family Summary

**A pure-Domain, append-only `AuditEntry` factory that stores only a /24 or /48 IP prefix and one of 11 user-agent family labels, and rejects malformed actions, correlation ids and over-length fields. All the parsing uses character loops and span checks, with no regex.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-07T15:11:10Z
- **Completed:** 2026-10-07T15:20:15Z
- **Tasks:** 3
- **Files modified:** 6 (all new)

## Accomplishments

- `AuditEntry` has `Id`, `OccurredAtUtc`, `ActorUserId`, `Action`, `TargetType`, `TargetId`, `IpPrefix`, `UserAgentFamily`, `CorrelationId` and `Detail`. It has private setters, an EF-bindable private constructor, and length constants that match the research Pattern 9 columns (64/64/64/45/32/32/400).
- `AuditEntry.Create` checks four things:
  - The time is in UTC.
  - The action is a dotted lowercase code, at most 64 characters.
  - The correlation id is exactly 32 lowercase hex characters.
  - The target type, target id and detail fit their lengths.

  It then stores `IpPrefix.From(remoteIp)` and `UserAgentFamily.Classify(userAgent)`. The raw values are never kept.
- `IpPrefix.From` rules:
  - `203.177.12.45` becomes `203.177.12.0`, and `::ffff:203.177.12.45` also becomes `203.177.12.0`.
  - `2001:db8:abcd:12::1` becomes `2001:db8:abcd::`, `fe80::1%3` becomes `fe80::`, and `::1` becomes `::`.
  - `null` stays `null`.
- `UserAgentFamily.Classify` checks families in this order:
  1. Bot
  2. Facebook in-app
  3. Instagram in-app
  4. Edge
  5. Opera
  6. Samsung Internet
  7. Firefox
  8. Chrome
  9. Safari (needs both `Safari` and `Version/`)
  10. Other

  A null or blank header gives Unknown. Only the first 512 characters are read. A `Firefox/` token that ends exactly at character 512 counts, and one that crosses it does not.

## Task Commits

1. **Task 1 (tracer): AuditEntry.Create minimizes a raw request into an audit record**
   - RED: `7162c37` (test)
   - GREEN: `9a2aac3` (feat)
2. **Task 2: IpPrefix /24 and /48 truncation**
   - RED: `4ca09bd` (test)
   - GREEN: `8286858` (feat)
3. **Task 3: UserAgentFamily regex-free classifier**
   - RED: `17d67fc` (test)
   - GREEN: `44592d7` (feat)

No REFACTOR commits: none were needed.

## TDD Gate Compliance

Every task has a `test(01-05)` RED commit before its `feat(01-05)` GREEN commit. Each RED was a target-only run with `--report-xunit-junit`, checked by `gsd check tdd-red-evidence`, and every one returned `RED_EVIDENCE_OK` (reason `target_test_failed`, exit 2). C# needs the types to exist before a test can compile, so each RED commit carries compile-only stubs (Task 3: just the label constants). Without them the build would fail, which is INVALID_RED.

- **Task 1 RED:** the target was `AuditEntryTests.CreateMinimizesRequestFacts`. The stub `Create` did no validation, `IpPrefix.From` returned null and `Classify` returned "Unknown". The test failed with `entry.IpPrefix should be "203.177.12.0" but was null`. In the whole class, 30 of 39 tests failed.
- **Task 2 RED:** the tracer `IpPrefix` handled only IPv4. Two records were checked:
  - `DropsTheIpv6ScopeId` failed with `IpPrefix.From(linkLocal) should be "fe80::" but was null`.
  - `TreatsIpv4MappedIpv6AsIpv4(address: "::ffff:203.177.12.45", ...)` failed with null.

  12 of 18 tests failed.
- **Task 3 RED:** the tracer classifier only checked `Chrome/`. Two records were checked:
  - `GooglebotIsBotEvenThoughItSaysChrome` got "Chrome" instead of "Bot".
  - `EdgeDesktopIsEdgeEvenThoughItSaysChrome` got "Chrome" instead of "Edge".

  23 of 35 tests failed.
- **Tracer gate (auto mode):** after Task 1 GREEN, `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AuditEntryTests"` passed (39/39), and so did the ArchitectureTests `LayerTests` (8/8). Expansion went ahead after that.

## Files Created/Modified

- `src/Csps.Domain/Auditing/AuditEntry.cs`: the append-only audit record, its field limits and the validating `Create` factory.
- `src/Csps.Domain/Auditing/IpPrefix.cs`: /24 and /48 truncation.
- `src/Csps.Domain/Auditing/UserAgentFamily.cs`: 11 label constants and the ordered, regex-free `Classify`.
- `tests/Csps.Domain.UnitTests/Auditing/AuditEntryTests.cs`: minimization, null optionals, the UTC rule, action and correlation-id rules (including boundary characters for branch coverage), and length limits.
- `tests/Csps.Domain.UnitTests/Auditing/IpPrefixTests.cs`: every listed vector, plus `255.255.255.255`, an all-ones IPv6 address, the column-length check and the AuditEntry IPv6 path.
- `tests/Csps.Domain.UnitTests/Auditing/UserAgentFamilyTests.cs`: every listed vector, plus case-insensitivity, the 512-character boundaries, the label set and lengths, and AuditEntry storing the family.

## Verification

- `dotnet test --project tests/Csps.Domain.UnitTests`: 122 passed, 0 failed.
- The filtered runs for `*AuditEntryTests`, `*IpPrefixTests` and `*UserAgentFamilyTests` passed (39, 18 and 35).
- `dotnet test --project tests/Csps.ArchitectureTests`: 61 passed. That includes `LayerTests`, so Domain still uses System assemblies only.
- `dotnet build Csps.slnx -tl:off --no-incremental`: 0 warnings, 0 errors.
- Domain coverage, from a temporary `coverlet.MTP` reference that was reverted afterwards: package `Csps.Domain` has line-rate 1 and branch-rate 1, and all three Auditing classes are at 1/1.
- Acceptance greps all pass:
  - `DetailMaxLength = 400`
  - `CorrelationIdLength = 32`
  - `Facebook in-app`
  - `IpPrefix.From` and `UserAgentFamily.Classify` in `AuditEntry.cs`
  - no `Regex` in `src/Csps.Domain`

## Decisions Made

- **Null versus other errors:** a null action or correlation id throws `ArgumentNullException`, and every other rule throws `ArgumentException`. Both are programming errors, as the plan says. Messages are plain English and do not echo the rejected value, since detail may be sensitive.
- **Blank headers:** `UserAgentFamily` treats a header that is blank within its first 512 characters as Unknown. No step reads the whole attacker-supplied header.
- **Name clash:** inside `AuditEntry`, the helpers are called through `Auditing.IpPrefix` and `Auditing.UserAgentFamily`, because the properties have the same names as the static types.
- **Extra test vectors:** beyond the listed ones, the tests cover action and correlation-id boundary characters (`/`, `:`, `{`, `-`, space, `_`), so the character-loop range checks reach full branch coverage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an unreachable "other address family" branch from IpPrefix**
- **Found during:** Task 2 (IpPrefix GREEN)
- **Issue:** the plan says "any other family returns null". `IPAddress` constructors accept only 4-byte (IPv4) or 16-byte (IPv6) addresses, so no test can ever reach a third-family branch. That would leave Domain below the binding 100% branch-coverage target.
- **Fix:** the prefix length now comes from `AddressFamily == InterNetwork ? 3 : 6` bytes. A code comment explains why there is no third family. Null input still gives null.
- **Files modified:** src/Csps.Domain/Auditing/IpPrefix.cs
- **Verification:** all 18 `IpPrefixTests` pass, and Domain branch-rate is 1.
- **Committed in:** `8286858`

---

**Total deviations:** 1 auto-fixed (1 Rule 1).
**Impact on plan:** behavior is unchanged for every address `IPAddress` can represent. No scope creep.

## Issues Encountered

- **Theory names in RED evidence:** `gsd check tdd-red-evidence` compares a theory test's target name with the raw JUnit name, which still has `&quot;` entities. The first record for `TreatsIpv4MappedIpv6AsIpv4` was rejected as `no_target_test_failure` even though both cases had failed on assertions. Writing the entity-encoded name as the target fixed it (`RED_EVIDENCE_OK`). The test and the failure did not change.
- **Coverage measurement:** coverage was measured by temporarily adding `coverlet.MTP` to `Csps.Domain.UnitTests.csproj`. The csproj and `packages.lock.json` were then restored with `git checkout --` on those two files only.

## Threat Model Coverage

- **T-01-16 (information disclosure):** only the /24 or /48 prefix and a fixed family label reach the entity. `CreateNeverKeepsTheRawIpOrUserAgent` and the IpPrefix and UserAgentFamily vectors prove it.
- **T-01-17 (denial of service):** there is no Regex in Csps.Domain. Classification reads at most 512 characters with ordered `Contains` checks, and the 10,000-character and boundary tests prove the cap.
- **T-01-SC (supply chain):** no packages were added. Domain is still BCL-only (LayerTests).

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 01-09 can map `AuditEntry` to the `AuditLog` table using the public length constants. It should add `UseSqlOutputClause(false)`, the append-only trigger, `AuditLogTruncateGuard`, and the Respawn `TablesToIgnore` entries already noted in STATE.
- FND-10 is shared with plan 01-09. It should only read Complete once 01-09's SUMMARY exists, and the shared-ID gate handles that.
- No blockers.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED

- The six created files exist on disk.
- Commits `7162c37`, `9a2aac3`, `4ca09bd`, `8286858`, `17d67fc` and `44592d7` exist on `gsd/phase-1-hosting-verification-backend-foundation`.
- The ledger count (`b2e9906..HEAD`) is 6, which matches `actuals.commits`.
