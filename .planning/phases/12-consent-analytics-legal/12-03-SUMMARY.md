---
phase: 12-consent-analytics-legal
plan: 03
subsystem: analytics-consent
tags: [consent, cookie, codec, gpc, tdd, shared-fixture]
created: "2026-11-16T20:45:00-06:00"
updated: "2026-11-16T20:45:00-06:00"
requires:
  - phase: 11-public-site-content
    provides: "the shared-fixture pattern (tests/fixtures/*.json read by .NET and Vitest)"
provides:
  - "tests/fixtures/consent-cookie-cases.json: 6 valid, 29 invalid, 20 needsChoice and 11 allowsStats cases"
  - "Csps.Domain.Analytics.ConsentCookie: CookieName, LifetimeMonths, TryParse, Format, AllowsStats"
  - "web consentCookie.ts: CONSENT_COOKIE_NAME, parseConsentCookie, formatConsentCookie, readConsentCookie, needsChoice"
affects: [12-08 consent server, 12-09 consent bar, 12-14 collect pipeline]
actuals:
  tokens: 7200
  tasks: 3
  commits: 6
plan_head_before: e72dfe711eb4862e77b6fb20bb78ba7afaaa5f24
plan_head_after: 61fbd64a7c848ccada3d7254c5caac50e3c7c0ae
tech-stack:
  added: []
  patterns:
    - "one fixture, two codecs: C# and TS read the same cases and must agree"
    - "no clock: today is an argument on both sides"
key-files:
  created:
    - tests/fixtures/consent-cookie-cases.json
    - src/Csps.Domain/Analytics/ConsentCookie.cs
    - tests/Csps.Domain.UnitTests/Analytics/ConsentCookieTests.cs
    - web/src/modules/public/consentCookie.ts
    - web/src/modules/public/consentCookie.test.ts
  modified:
    - tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj
key-decisions:
  - "A decision dated in the future is read as it is (no rejection): a day of clock or time zone difference must not re-ask, and the server never issues a visitor id from this cookie alone (T-12-06)."
  - "The last representable year (9999) saturates the 12-month expiry instead of throwing, so a crafted cookie can never make AllowsStats throw."
  - "Year 0000 is refused on both sides (DateOnly has no year 0; the TS date check mirrors it)."
requirements-completed: [ANL-01, ANL-07]
status: complete
---

# Phase 12 Plan 03: Consent cookie codec Summary

*Created: 2026-11-16T20:45:00-06:00 · Updated: 2026-11-16T20:45:00-06:00*

**One compact cookie format for the saved choice, read the same way by a C# codec and a TypeScript codec from one shared fixture, plus the re-ask rule (`needsChoice`) with GPC never asking.**

## What was built

- **Fixture** `tests/fixtures/consent-cookie-cases.json`: the pinned cookie name `__Host-csps_consent`, 6 valid cases (Accept All, Reject All, map-only `-`, pending `_p`, version `1.0`, a 100-character boundary), 29 invalid cases (wrong prefix, five fields, 31 and 33 character ids, uppercase hex, versions `1`, `v1.0`, `1.0.0`, `.1`, `1.`, s `2`, m `-`, days `20260230`, month 13, year 0000, a trailing `_x`, `_P`, `_p_p`, `;`, space, comma, quote, backslash, non-ASCII digits, 101 characters), 20 `needsChoice` cases and 11 `allowsStats` cases.
- **C#** `ConsentCookie` (Domain, BCL only, no regex): character checks only. `TryParse` never throws, `Format` round-trips, `AllowsStats` is true only for s 1, the current version, under 12 months.
- **TS** `consentCookie.ts`: one strict anchored pattern per the plan, a real-date check without a device-time-zone `Date`, `readConsentCookie` (exact name match), and `needsChoice` using date-part arithmetic that clamps month ends. Imports nothing.
- Both test files read the one fixture. The fixture is linked into the Domain test project (`Csps.Domain.UnitTests.csproj`) like the phone cases.

## TDD gate sequence

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 (tracer) | 2ea76124 | 7ab71e6c |
| 2 | 2f950dc1 | eef1f3c4 |
| 3 | 5a3b90f6 | 61fbd64a |

RED evidence (real runs, genuine assertion failures, not build or load errors; the stubs compile and return wrong answers):

- Task 1: dotnet `total: 3, failed: 2` ("ConsentCookie.TryParse(value, out var cookie) should be True but was False"); vitest `2 failed | 1 passed (3)` ("expected null to deeply equal { ... }").
- Task 2: dotnet `total: 43, failed: 13`; vitest `28 failed | 20 passed (48)` (17 "expected { ... } to be null" on invalid cases, map-only and pending mismatches, `readConsentCookie` undefined).
- Task 3: dotnet `total: 56, failed: 6` (all `AllowsStatsFollowsTheSharedCase`); vitest `4 failed | 67 passed (71)` ("expected false to be true" on needsChoice).

Semantic assessment: each target test ran and failed on the planned assertion for the planned reason. The machine classifier (`gsd_run check tdd-red-evidence`) was not run: no machine-readable report was persisted for the dotnet runs, so the evidence above is quoted from the console output.

GREEN evidence:

- `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ConsentCookieTests"`: `total: 56, failed: 0, succeeded: 56`.
- Whole Domain unit project: `total: 1956, failed: 0`. Architecture tests: `total: 290, failed: 0`.
- `npm --prefix web run test -- --run src/modules/public/consentCookie.test.ts src/test/no-long-dash.node.test.ts`: `Test Files 2 passed (2), Tests 72 passed (72)`.
- `npm --prefix web run lint` (`--max-warnings 0`): exit 0. `npm --prefix web run typecheck`: exit 0. Prettier clean on the two web files.
- Acceptance greps: `needsChoice` export 1, `AllowsStats` 1, `new Date()` 0, `readConsentCookie` export 1, fixture invalid length 29 (>= 14), fixture name pinned.

The tracer gate for Task 1 passed (verify re-run green) before Tasks 2 and 3 expanded the codec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Linked the fixture into the Domain test project**
- **Found during:** Task 1
- **Issue:** the C# test reads the fixture from the output folder, and `Csps.Domain.UnitTests.csproj` (not in the plan's file list) must copy it there, as it does for the phone cases.
- **Fix:** added one `Content ... Link="Fixtures\consent-cookie-cases.json"` item.
- **Files modified:** `tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj`
- **Commit:** 2ea76124

**2. [Rule 3 - Blocking] `// @vitest-environment node` in the TS test**
- **Found during:** Task 1 RED
- **Issue:** under jsdom `new URL(..., import.meta.url)` is not a file URL, so `readFileSync` threw "The URL must be of scheme file".
- **Fix:** the same two header lines `siteContentSchemas.test.ts` uses.
- **Commit:** 2ea76124

**3. [Rule 3 - Blocking] `web/node_modules` was missing in the worktree**
- **Fix:** `npm ci` against the committed lockfile (no package added or bumped; `git status` shows no change to package files).

### Notes

- One `npx eslint` call ran from the wrong folder (the shell does not keep `cd` between calls) and npx offered to fetch `eslint@10.15.0` into its own cache. It touched no project file. All later runs used the project's own installed eslint.
- The per-plan HEAD ledger file under the git dir could not be written (the sandbox refuses git-dir paths from this worktree), so the base `e72dfe71` was recorded here from the spawn-time assertion. `commits: 6` was measured with `git rev-list --count e72dfe71..HEAD`.

## Known Stubs

None. (The temporary RED-phase stubs were replaced in each GREEN commit.)

## Threat Flags

None new. T-12-05 (tampering, strict codec and 100 character cap), T-12-06 (stats cookie alone never enough; `AllowsStats` is one gate) and T-12-07 (`__Host-` prefix pinned in the fixture and asserted on both sides) are mitigated as planned. T-12-SC: no package added or bumped.

## Notes for plans 12-08, 12-09

- `needsChoice` takes the parsed cookie, so the bar calls `needsChoice(parseConsentCookie(readConsentCookie(document.cookie)), { currentVersion, today, gpc })`. `today` must be a `YYYY-MM-DD` business-day string (no Date, no device zone).
- A pending cookie is treated like any other for `needsChoice` and `AllowsStats`; the server must still never issue a visitor id from the cookie alone.
- A cookie dated in the future is read as current. If the owner wants those refused, it is one extra check on each side plus fixture cases (not decided here; no behavior change was made).

## Self-Check: PASSED

- Files found: `tests/fixtures/consent-cookie-cases.json`, `src/Csps.Domain/Analytics/ConsentCookie.cs`, `tests/Csps.Domain.UnitTests/Analytics/ConsentCookieTests.cs`, `web/src/modules/public/consentCookie.ts`, `web/src/modules/public/consentCookie.test.ts`.
- Commits found on the branch: 2ea76124, 7ab71e6c, 2f950dc1, eef1f3c4, 5a3b90f6, 61fbd64a.
- STATE.md and ROADMAP.md untouched.
