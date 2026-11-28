---
phase: 14-hardening-release-readiness
plan: 01
subsystem: analytics, security-tooling
tags: [analytics, bot-filter, owasp-zap, dependency-registry]
requires: []
provides:
  - "OWASP-ZAP token in the analytics-only bot list (scanner visits are not counted, 14 D-06)"
  - "Owner ruling 14 D-45: ZAP container image approved by digest"
  - "docs/dependencies.json approvals entry for the ZAP image"
affects: [14-12, 14-19, 14-20]
actuals:
  tokens: 1400
  tasks: 3
  commits: 3
plan_head_before: 66c2bc7652b20b9e4504485cf1921882db4c15c0
plan_head_after: 0110b488adc77c3bd471261d5a2136fd12d8b3d9
tech-stack:
  added: []
  patterns: ["Literal ordinal token list for the bot filter, no regular expression (CWE-1333)"]
key-files:
  created: []
  modified:
    - src/Csps.Domain/Analytics/AnalyticsBots.cs
    - tests/Csps.Domain.UnitTests/Analytics/AnalyticsBotsTests.cs
    - docs/dependencies.json
key-decisions:
  - "14 D-45: ZAP image ghcr.io/zaproxy/zaproxy:2.17.0@sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af approved (owner, 2026-11-27)"
requirements-completed: [SEC-05]
status: complete
duration: 25min
completed: 2026-11-27
created: "2026-11-27T18:00:26-06:00"
updated: "2026-11-27T18:00:26-06:00"
---

# Phase 14 Plan 01: Scanner visits are not counted, and the owner rules on the ZAP image Summary

*Created: 2026-11-27T18:00:26-06:00 · Updated: 2026-11-27T18:00:26-06:00*

**The bot filter now drops ZAP scanner visits (token `OWASP-ZAP`, Lighthouse was already covered), and the owner approved the ZAP 2.17.0 container image pinned by digest.**

## Owner ruling

14 D-45: ZAP image ghcr.io/zaproxy/zaproxy:2.17.0@sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af approved (owner, 2026-11-27)

The owner chose "Approve 2.17.0 (Recommended)". Any later ZAP version needs a new owner yes. ZAP runs only on GitHub runners (the CI scan and the owner-started live audit), never on this PC.

Check findings (read only, made 2026-11-27):

- Latest stable release is v2.17.0, published 2025-12-15. Only weekly pre-releases are newer.
- The ghcr.io manifest digest for 2.17.0 is the sha256 above and matches RESEARCH.
- License Apache-2.0 (free, no copyleft).
- The repository is not archived (last push 2026-11-27). No published security advisories.
- No open regression issues since 2025-12-15.
- Open bug #9506 (zip-slip in language-pack import, opened 2026-10-23) is judged not relevant, because scans never import a language pack.

## User agent constant for the ZAP plans

Plans 14-12, 14-19 and 14-20 must set exactly this user agent in every ZAP plan file:

`Mozilla/5.0 (compatible; OWASP-ZAP/2.17.0; CSPS security scan)`

## Task results

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 RED | ZAP and Lighthouse visits are bots, failing test first | db6ca71e |
| 1 GREEN | `OWASP-ZAP` added to the analytics-only bot list | 07de754c |
| 2 | Owner yes for the ZAP image (14 D-45), recorded in this file | (this file) |
| 3 | Approval recorded in `docs/dependencies.json` | 0110b488 |

### Task 1 evidence

- RED: `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AnalyticsBotsTests"` gave total 25, failed 2 (the ZAP cases).
- GREEN: same command gave total 25, failed 0. `dotnet build src/Csps.Domain` gave 0 warnings, 0 errors.
- gitleaks clean on both commits.

### Task 3 evidence

- `docs/dependencies.json` parses as valid JSON; `grep -c zaproxy docs/dependencies.json` is now at least 1 (baseline 0).
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"`: `Test run summary: Passed!`, total 76, failed 0, succeeded 76, skipped 0.
- gitleaks clean on the staged change.

## Deviations from Plan

None. The plan was executed as written. One small note: the preflight script was not run, because no dev server, Playwright run or database was started (only a unit-test class and an architecture-test class that read files).

## Known Stubs

None.

## Threat Flags

None. T-14-01 is covered by the existing 512-character cap, which has its own test (`ScannerTokenPastCharacter512IsNotRead`). T-14-02 is covered by the owner yes on an exact tag and digest.

## Self-Check: PASSED

- `src/Csps.Domain/Analytics/AnalyticsBots.cs`, `tests/Csps.Domain.UnitTests/Analytics/AnalyticsBotsTests.cs` and `docs/dependencies.json` exist.
- Commits db6ca71e, 07de754c and 0110b488 are ancestors of HEAD.
