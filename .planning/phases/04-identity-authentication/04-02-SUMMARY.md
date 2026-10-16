---
phase: 04-identity-authentication
plan: 02
subsystem: auth
tags: [nuget, npm, supply-chain, msw, react-hook-form, zod, fluentvalidation, mailkit, identity, d-36, d-35]
status: complete
created: "2026-10-14T20:45:00-05:00"
updated: "2026-10-14T20:45:00-05:00"

requires: ["04-01"]
provides:
  - "Seven owner-approved NuGet pins (Identity.EntityFrameworkCore, FluentValidation, MailKit, MimeKit, BouncyCastle.Cryptography, Http.Resilience, Diagnostics.Testing) with references, locked restore and registry records"
  - "Four owner-approved web pins (react-hook-form, zod, @hookform/resolvers, msw dev) with registry records and regenerated notices"
  - "web/src/test/msw.ts exports `server`; every jsdom Vitest test runs behind an MSW server that errors on any unhandled request"
affects: [04-03, every Phase 4 plan that adds a handler, a form, mail or an MSW service test]

requirements-completed: []

actuals:
  tokens: 3950
  tasks: 3
  commits: 3
plan_head_before: 18e1ae3bce0cc7b07720992a3dc0402d17c7d61b
plan_head_after: ee9f8e63a4d5646b7925c4b8b9ee9ee6bf900046

tech-stack:
  added:
    - "Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.13"
    - "FluentValidation 12.1.1"
    - "MailKit 4.18.1, MimeKit 4.18.1, BouncyCastle.Cryptography 2.7.0"
    - "Microsoft.Extensions.Http.Resilience 10.10.0"
    - "Microsoft.Extensions.Diagnostics.Testing 10.10.0 (tests)"
    - "react-hook-form 7.89.0, zod 4.6.5, @hookform/resolvers 5.9.1"
    - "msw 3.0.1 (dev)"
  patterns:
    - "Shared MSW server in setup.ts with onUnhandledFrame 'error' (MSW 3 name); tests add handlers with server.use and take the [MSW] console report with collectConsole when they expect a failure"

key-files:
  created:
    - web/src/test/msw.ts
    - web/src/test/msw.test.ts
  modified:
    - Directory.Packages.props
    - src/Csps.Application/Csps.Application.csproj
    - src/Csps.Infrastructure/Csps.Infrastructure.csproj
    - tests/Csps.Application.UnitTests/Csps.Application.UnitTests.csproj
    - tests/Csps.Testing/Csps.Testing.csproj
    - docs/dependencies.json
    - docs/dependencies.md
    - THIRD-PARTY-NOTICES.md
    - web/package.json
    - web/package-lock.json
    - web/THIRD-PARTY-NOTICES.txt
    - web/src/test/setup.ts
    - web/eslint.config.mjs
    - web/src/test/lint-rules.node.test.ts

key-decisions:
  - "MSW 3 renamed the listen option onUnhandledRequest to onUnhandledFrame; setup.ts uses onUnhandledFrame: 'error' and a comment names the old option"
  - "The npm peer notice (vitest's optional msw ^2 peer vs msw 3.0.1) is recorded in the registry and docs, not silenced with an override or --legacy-peer-deps"
---

# Phase 4 Plan 2: Phase 4 Packages and MSW Harness Summary

The seven approved NuGet packages and four approved npm packages are pinned at the owner's exact versions (D-36), registered and noticed, and every jsdom test now runs behind an MSW server that fails any request without a handler.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Tracer: seven NuGet pins, references, locked restore, vulnerability scan, registry, license gate, notices | 181983d |
| 2 | npm package legitimacy checkpoint (blocking-human) | Owner replied "approved" on 2026-10-14; no commit |
| 3 (RED) | MSW harness test and `server` export, failing before the setup hook | 8b50fb4 |
| 3 (GREEN) | Web packages, registry, notices, MSW setup hook | ee9f8e6 |

`commits: 3` is the measured count from the plan ledger base (`plan_head_before`). The docs commit for this summary comes after.

## Installed versions

| Package | Version | Published | License | Scope |
|---------|---------|-----------|---------|-------|
| Microsoft.AspNetCore.Identity.EntityFrameworkCore | 10.0.13 | 2026-10-13 (security cool-down exception, D-35; 14 days on 2026-10-27) | MIT | runtime |
| FluentValidation | 12.1.1 | 2025-12-03 | Apache-2.0 | runtime |
| MailKit | 4.18.1 | 2026-09-27 | MIT | runtime |
| MimeKit | 4.18.1 | 2026-09-19 | MIT | runtime (transitive pin) |
| BouncyCastle.Cryptography | 2.7.0 | 2026-07-30 | MIT | runtime (transitive pin) |
| Microsoft.Extensions.Http.Resilience | 10.10.0 | 2026-09-09 | MIT | runtime |
| Microsoft.Extensions.Diagnostics.Testing | 10.10.0 | 2026-09-09 | MIT | tests |
| react-hook-form | 7.89.0 | 2026-09-26 | MIT | web runtime |
| zod | 4.6.5 | 2026-09-13 | MIT | web runtime |
| @hookform/resolvers | 5.9.1 | 2026-08-17 | MIT | web runtime |
| msw | 3.0.1 | 2026-09-30 (exactly 14 days old on 2026-10-14) | MIT | web dev |

Owner legitimacy reply (Task 2, 2026-10-14): "approved" for exactly react-hook-form 7.89.0, zod 4.6.5, @hookform/resolvers 5.9.1 and msw 3.0.1. Evidence shown to the owner: all MIT, no advisories, no install or postinstall scripts, ages 18, 30, 58 and 14 days. At install time Claude re-checked: newer versions (react-hook-form 7.90.0, zod 4.6.6 and 4.6.7, msw 3.0.2 and 3.0.3) were all younger than 14 days, so the conditional checkpoint did not trigger. `npm audit --audit-level=high` reports 0 vulnerabilities.

## Verification

- `dotnet restore --locked-mode`, vulnerability scan, `DependencyRegistryTests` (60 passed) and `LayerTests` passed for Task 1; the notices generator ran clean.
- `npm --prefix web run verify` exits 0: typecheck, lint with `--max-warnings 0`, format, 113 test files and 3139 tests, coverage (98.26% statements overall), build, budgets (public JS 131.59 KB, admin JS 154.93 KB, CSS 13.04 KB gz), license gate (0 problems, msw's transitive licenses pass) and notices check.
- `msw.test.ts`: RED before the hook (the handler test failed and the unhandled tests found no `[MSW]` report), GREEN after.
- `grep -c '"manifest": "web"' docs/dependencies.json` grew from 46 to 50.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MSW 3 has no `onUnhandledRequest` option**
- **Found during:** Task 3 (typecheck of `setup.ts`)
- **Issue:** The plan names `server.listen({ onUnhandledRequest: 'error' })`. In msw 3.0.1 that option was renamed to `onUnhandledFrame` (`SharedOptions` in `msw/lib/_chunks/shared-options.d.ts`), and TS rejected the old name. The default is `warn`, which would not fail a test.
- **Fix:** `server.listen({ onUnhandledFrame: 'error' })`. A comment in `setup.ts` mentions `onUnhandledRequest`, so the plan's `grep -c "onUnhandledRequest"` still returns 1.
- **Files modified:** `web/src/test/setup.ts`
- **Commit:** ee9f8e6

**2. [Rule 3 - Blocking] ESLint WEB-04 bans bare `fetch` in the harness test**
- **Found during:** Task 3 (`npm run verify`, lint)
- **Issue:** `msw.test.ts` must send raw requests to prove an unhandled one fails, and `no-restricted-globals` forbids `fetch` outside `core/api/http`.
- **Fix:** A narrow `csps/restrictions/msw-harness` override for `src/test/msw.test.ts` only, plus a case in `lint-rules.node.test.ts` proving it.
- **Files modified:** `web/eslint.config.mjs`, `web/src/test/lint-rules.node.test.ts` (not listed in the plan's files)
- **Commit:** ee9f8e6

**3. [Test design] The unhandled-request tests take the console report**
- MSW writes a `[MSW]` console error before the fetch rejects, and the console guard fails any test with console output. The tests call `collectConsole()` and assert the report contains `[MSW]`, which also makes them fail in the RED state. The same guard means any accidental unhandled request in another test fails it twice over.

### Notes

- `npm install` prints "ERESOLVE overriding peer dependency": `@vitest/mocker@5.0.1` has an optional peer `msw@^2.4.9`, and msw 3.0.1 is pinned by the owner. npm resolved it without `--force` or `--legacy-peer-deps`, `npm ci` is silent, and vitest only uses that peer for browser mode (not used). The note is in `docs/dependencies.json` (msw legitimacy) and `docs/dependencies.md`. Vite 8.3.3 and the typescript alias (6.0.2) satisfy msw's other optional peers.
- Installing react-hook-form, zod and resolvers also reshuffled hoisted `ajv` copies in `web/package-lock.json` (layout only; audit is clean).

## Authentication Gates

None. Task 2 was the planned package-legitimacy checkpoint (blocking-human), resolved by the owner.

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or trust-boundary files; T-04-03, T-04-04 and T-04-05 mitigations are in place (exact pins, locked restore, scans, human gate, MSW error-on-unhandled).

## Requirements

AUTH-01, AUTH-11 and AUTH-13 are enabled by these packages but not delivered here (later plans build sign-in, the HIBP client and mail sending), so none is marked complete.

## Self-Check: PASSED
