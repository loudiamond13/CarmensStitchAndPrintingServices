---
phase: 12-consent-analytics-legal
plan: 02
subsystem: analytics
tags: [domain, tdd, privacy, user-agent, referrer]
requires: []
provides:
  - "AnalyticsPath.Cut and PageKeys (ANL-05)"
  - "ReferrerName.From (D-28, D-37)"
  - "DeviceClass.From and DeviceKind"
  - "OsFamily.From"
  - "AnalyticsBots.IsBot"
affects: [12-10, 12-14]
tech-stack:
  added: []
  patterns: ["pure static Domain reducers", "ordered case-insensitive substring checks, no regex", "512 character scan cap"]
key-files:
  created:
    - src/Csps.Domain/Analytics/AnalyticsPath.cs
    - src/Csps.Domain/Analytics/PageKeys.cs
    - src/Csps.Domain/Analytics/ReferrerName.cs
    - src/Csps.Domain/Analytics/DeviceClass.cs
    - src/Csps.Domain/Analytics/OsFamily.cs
    - src/Csps.Domain/Analytics/AnalyticsBots.cs
    - tests/Csps.Domain.UnitTests/Analytics/AnalyticsPathTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/ReferrerNameTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/DeviceClassTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/OsFamilyTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/AnalyticsBotsTests.cs
  modified: []
decisions:
  - "iPod counts as iOS (OsFamily) and as Phone (DeviceClass); the plan listed only iPhone for the OS label"
  - "Google hosts match google.<com or a 2-letter country>, or google.com / google.co plus one 2-letter country label, with any subdomains in front; google.xyz is its own host"
  - "Messenger in-app tokens are FBAN/Messenger and FB_IAB/MESSENGER (covers MessengerForiOS and Messenger Lite)"
metrics:
  duration: "about 25 minutes"
  completed: 2026-11-16
status: complete
actuals:
  tokens: 8700
  tasks: 3
  commits: 6
plan_head_before: e72dfe711eb4862e77b6fb20bb78ba7afaaa5f24
plan_head_after: 81aef73328b22c18806db0bcabc5984ce4a2fb06
commits: 6
created: "2026-11-16T20:35:00-06:00"
updated: "2026-11-16T20:35:00-06:00"
---

# Phase 12 Plan 02: Analytics reducers Summary

*Created: 2026-11-16T20:35:00-06:00 · Updated: 2026-11-16T20:35:00-06:00*

Six pure Domain functions turn a beacon path, a referrer host and a User-Agent into the small fixed values the analytics tables store: a cut path and page key, a friendly referrer name, a device class, an OS family and a bot flag. No regex, every header scan capped at 512 characters, 100% line and branch coverage.

## What was built

- **AnalyticsPath.Cut** slices at the first `?` or `#` before the prefix and 2,048 length checks, so a long query never rejects a short path. No Uri parser.
- **PageKeys**: the nine lowercase page names, `MaxLength` 32.
- **ReferrerName.From**: validates the host character by character (1 to 253 ASCII letters, digits, dot, hyphen), lowercases it, drops one leading `www.`, then groups Facebook, Messenger, Instagram and Google on label boundaries (look-alikes such as `notgoogle.com` and `google.evil.example` stay as their own host). The site's own host counts as no referrer. With no referrer it falls back to the in-app header: Messenger first (its header also carries FBAN), then Facebook, then Instagram. Android app hosts `com.facebook.katana`, `com.facebook.orca` and `com.instagram.android` map to the same names.
- **DeviceClass.From** and **DeviceKind**: Tablet, then Phone, then Computer, else Other.
- **OsFamily.From**: iOS, iPadOS, Android, ChromeOS, Windows, macOS, Linux, Other, in the safe order.
- **AnalyticsBots.IsBot**: `UserAgentFamily.Classify` says Bot or Unknown, or the header holds HeadlessChrome, Lighthouse or PTST. The audit log's labels are unchanged.

## TDD record

### Task 1 (tracer): AnalyticsPath and PageKeys

- **RED** `0a4543aa`: `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AnalyticsPathTests"` gave `total: 20, failed: 12, succeeded: 8`. Failures were Shouldly assertions such as `AnalyticsPath.Cut(path) should be "/products" but was null` and `keys should satisfy the condition ... ["", "", ...]`. A stub returning null and empty page keys let the tests compile, so the failures are on the planned assertions, not on a build error.
- **GREEN** `d13dfe5f`: `total: 20, failed: 0, succeeded: 20`.
- Semantic assessment: the target tests ran and failed on the planned behavior, for the intended reason (stub behavior), not on setup or compile faults.

### Task 2: ReferrerName

- **RED** `ba28e576`: `total: 80, failed: 75, succeeded: 5` (the 5 passes are the constants test and the "result never holds the header" cases, which a stub returning an empty string also satisfies).
- **GREEN** `a2d5a65c`: `total: 80, failed: 0, succeeded: 80`.

### Task 3: DeviceClass, OsFamily, AnalyticsBots

- **RED** `8be57370`: `total: 62, failed: 52, succeeded: 10`.
- **GREEN** `81aef733`: `total: 62, failed: 0, succeeded: 62`.
- `dotnet build Csps.slnx -warnaserror`: `Build succeeded. 0 Warning(s) 0 Error(s)`.

### REFACTOR

None needed. No `refactor(12-02)` commit.

## Verification evidence

- All new test classes together: `dotnet test --project tests/Csps.Domain.UnitTests --filter-namespace "Csps.Domain.UnitTests.Analytics" --coverlet ...` gave `total: 162, failed: 0, succeeded: 162`.
- Cobertura for `Csps.Domain.Analytics.*`: AnalyticsBots, AnalyticsPath, DeviceClass, OsFamily and ReferrerName all `line-rate="1" branch-rate="1"`; no line with `hits="0"`. PageKeys has no executable code (constants only).
- `grep -rc Regex src/Csps.Domain/Analytics` is 0 for all six files. All plan acceptance greps return 1.
- gitleaks `protect --staged` found no leaks on every commit. Test User-Agent strings are public sample headers only.

## Deviations from Plan

None. The plan was executed as written.

Notes, not deviations:

- The RED commits include a compile-only stub of each production class (returns null, an empty string or a default), so the tests fail on assertions instead of on a build error. The GREEN commits replace the stubs.
- `gsd_run check tdd-red-evidence` was not run. Its supported report formats are TAP, JUnit XML, swift-testing, unittest and go test; xunit.v3 on Microsoft Testing Platform prints a console summary in none of them. The RED runs are quoted from the real command output above instead.
- The plan text says to work in the main checkout on `gsd/phase-12-consent-analytics-legal`. This run was a parallel worktree agent on the branch `worktree-agent-af319f93ba58c33b6`, as the orchestrator dispatched it. The orchestrator merges it.
- The per-plan commit ledger file lives in the shared git dir, which a worktree agent may not write. `plan_head_before` was taken from the dispatch base commit instead, and `commits: 6` is measured with `git rev-list --count e72dfe71..HEAD`.

## Known Stubs

None. The compile-only stubs from the RED commits are gone in HEAD.

## Threat Flags

None. No network endpoint, auth path or file access was added. Mitigations T-12-02 (no regex, capped scans, 253 host cap), T-12-03 (reducers return only fixed labels, page keys or a validated host) and T-12-04 (cut before any other check, crafted-input tests) are in place and tested. ANL-06 prohibition: tests assert the result never holds the raw header, a slash, a question mark or a space.

## Self-Check: PASSED

- All 6 source files and 5 test files exist under `src/Csps.Domain/Analytics/` and `tests/Csps.Domain.UnitTests/Analytics/`.
- Commits 0a4543aa, d13dfe5f, ba28e576, a2d5a65c, 8be57370 and 81aef733 are ancestors of HEAD.
- STATE.md and ROADMAP.md were not changed.
