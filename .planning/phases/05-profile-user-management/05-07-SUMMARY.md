---
phase: 05-profile-user-management
plan: 07
subsystem: auth-infrastructure
tags: [openapi, hibp, bootstrap-guard, app-links, outbox-retention, review-carry-over]
created: 2026-10-17T20:58:00-05:00
updated: 2026-10-17T20:58:00-05:00

requires:
  - phase: 04-identity-authentication
    provides: sign-in and resend endpoints, HIBP client, AppLinksOptions, BootstrapTargetGuard, email outbox (review notes IN-07..IN-12)
provides:
  - one ResendWaitResponse record shared by sign-in and code resend, in the API contract and the web types
  - 1 MB cap on the breach-check answer (PROF-03 password change reuses this client)
  - email links built only from a clean https origin (USER-07, PROF-02)
  - bootstrap guard that recognises every loopback and local named-pipe form
  - written outbox retention rule (purge deferred to Phase 9 JOB-01)
affects: [05-12 profile password change, 05-26 user delete scrub, 05-37 review disposition, phase-09 maintenance job]

actuals:
  tokens: 9100
  tasks: 3
  commits: 6
plan_head_before: 5de7c175548716ecf6abd672129cac71e9b16875
plan_head_after: 32ffd26df9bdb1808677306e7c0dc1667ea38485

tech-stack:
  added: []
  patterns:
    - "Registered-client tests: build the real registration with a stub primary handler and resolve the typed client, so the HttpClient settings are exercised, not just the class"
    - "A rename that crosses the API contract commits the snapshot and generated types in the same commit as the controller"

key-files:
  created:
    - src/Csps.Application/Auth/ResendWaitResponse.cs
    - .planning/phases/05-profile-user-management/deferred-items.md
  modified:
    - src/Csps.Server/Controllers/SignInController.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/services/authService.ts
    - web/src/modules/admin/services/authService.test.ts
    - web/src/modules/admin/pages/SignInPage.tsx
    - web/src/modules/admin/pages/VerifyCodePage.tsx
    - src/Csps.Infrastructure/Passwords/HibpPwnedPasswords.cs
    - src/Csps.Infrastructure/Passwords/PasswordCheckRegistration.cs
    - tests/Csps.Infrastructure.IntegrationTests/Passwords/HibpPwnedPasswordsTests.cs
    - src/Csps.Infrastructure/Email/AppLinksOptions.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/AppLinksOptionsTests.cs
    - src/Csps.Infrastructure/Seeding/BootstrapTargetGuard.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs
    - docs/operations/mail-setup.md

key-decisions:
  - "IN-12: the shared response record lives in Csps.Application.Auth, not the Server project, so both actions and the contract name one schema"
  - "IN-09: the cap is set with the named client's MaxResponseContentBufferSize and relies on the existing catch-all; no new error path was added"
  - "IN-10: a clean origin means no user info and an absolute path of exactly '/'; the start-up failure message names the rules but never the value"
  - "IN-07: a pipe on a non-local server stays remote even if the pipe name starts with LOCALDB#; only the server part decides"
  - "IN-08: outbox purge is deferred to Phase 9 JOB-01 because the host has no scheduler and the job runner is built there"

requirements-completed: [PROF-03, USER-07]

coverage:
  - id: D1
    description: "Sign-in and code resend answer one ResendWaitResponse schema in the API, the OpenAPI snapshot, the generated types and the web screens (IN-12)"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests Http/OpenApiSnapshotTests (9 tests); SignInEndpointTests and ResendCodeEndpointTests (20 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/services/authService.test.ts; npm --prefix web run typecheck; npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D2
    description: "Breach check refuses answers over 1 MB as 'unavailable' and the registered client carries the cap (IN-09)"
    requirement: PROF-03
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests Passwords/HibpPwnedPasswordsTests#AnOversizedAnswerIsUnavailableAndLogsNoBody, #TheRegisteredClientCapsTheAnswerAtOneMegabyte"
        status: pass
    human_judgment: false
  - id: D3
    description: "Public base URL with user info or a sub-path fails the start-up check without echoing the value (IN-10)"
    requirement: USER-07
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests Email/AppLinksOptionsTests#UnsafeOrMalformedBaseUrlsFailWithoutEchoingTheValue"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bootstrap guard treats bracketed IPv6 loopback and local named pipes as this machine, so the CSPS_* allow-list applies (IN-07)"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests Seeding/BootstrapManagerTests#GuardAllowsOnlyTheCspsDatabasesOnThisMachine, #GuardAllowsAConfirmedDatabase"
        status: pass
    human_judgment: false
  - id: D5
    description: "Outbox retention rule written in mail-setup.md; purge recorded as deferred to Phase 9 JOB-01 (IN-08)"
    verification: []
    human_judgment: true
    rationale: "A written policy; a human reads it to confirm the 30-day rule is what the owner wants"

duration: 13min
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 07: Phase 4 review carry-overs IN-07, IN-08, IN-09, IN-10, IN-12 Summary

**One ResendWaitResponse schema from API to screen, a 1 MB cap on the breach-check answer, a clean-origin-only email base URL, a loopback-aware bootstrap guard, and a written outbox retention rule.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-18T01:44:17Z
- **Completed:** 2026-10-18T01:57:21Z (code); SUMMARY and state updates follow
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- **IN-12 fixed.** `SignInResponse` and `ResendCodeResponse` are gone. `ResendWaitResponse(int ResendAfterSeconds)` sits in `Csps.Application.Auth`, both actions return it, the OpenAPI snapshot holds one schema (3 references: schema, sign-in response, resend response), and the generated types, `authService.ts`, `SignInPage.tsx` and `VerifyCodePage.tsx` use the new name. Behaviour is unchanged: all 20 sign-in and resend endpoint tests stay green.
- **IN-09 fixed.** The named HIBP client sets `MaxResponseContentBufferSize` to 1,048,576 bytes. An oversized answer makes `HttpClient` throw before the body is held, the existing catch-all returns `Unavailable`, and the log holds only the exception type. Both awaits use `ConfigureAwait(false)`.
- **IN-10 fixed.** `AppLinksOptions.IsValid` now also refuses user info and any path other than `/`. The failure message names the rules ("no user info, no path, no query and no fragment") and still never contains the value.
- **IN-07 fixed.** `IsLocalServer` trims brackets from the host, handles `np:` and `\\server\pipe\...` sources, and counts `.`, `localhost`, loopback addresses and `LOCALDB#` server names as this machine. The class summary states the rule. A pipe on a remote server stays remote.
- **IN-08 recorded.** `docs/operations/mail-setup.md` has an "Outbox retention" section (closed rows keep recipient and metadata, deleted 30 days after closing, a deleted user's rows scrubbed at delete time in 05-26). The purge itself is recorded in `deferred-items.md` as deferred to Phase 9 JOB-01.

## RED evidence (TDD)

| Task | RED commit | What failed and why (semantic assessment) |
|------|------------|-------------------------------------------|
| 1 (IN-12) | `0d51707` | `tsc` error TS2305: `ResendWaitResponse` is not exported from `authService`. A type-only change cannot fail at runtime in Vitest (types are erased), so the type check is the RED instrument. It failed on the planned name. |
| 2 (IN-09, IN-10) | `6172d97` | 7 targeted failures: `AnOversizedAnswerIsUnavailableAndLogsNoBody` (got NotBreached, the body was valid and read whole), `TheRegisteredClientCapsTheAnswerAtOneMegabyte` (default buffer, not 1 MB), the failure-message test, and the four new invalid base URLs (accepted). The 40 existing cases stayed green. |
| 3 (IN-07) | `22c8d1e` | 4 targeted failures: `tcp:[::1],1433`, `[::1],1433`, `np:\\.\pipe\LOCALDB#...` and `np:\\localhost\pipe\...` with `Other_Db` were wrongly allowed as remote. The 4 added remote/allowed cases passed already and guard against over-matching. |

GREEN commits: `4f64b03` (IN-12), `e9c32dc` (IN-09, IN-10), `32ffd26` (IN-07, IN-08). No REFACTOR commit was needed.

## Task Commits

1. **Task 1: tracer, one ResendWaitResponse (IN-12)** - `0d51707` (test, RED), `4f64b03` (refactor)
2. **Task 2: breach cap and clean link origin (IN-09, IN-10)** - `6172d97` (test, RED), `e9c32dc` (fix)
3. **Task 3: guard loopback forms and outbox retention (IN-07, IN-08)** - `22c8d1e` (test, RED), `32ffd26` (fix)

**Plan metadata:** added by the final docs commit.

## Review note outcomes (for 05-37 / 04-REVIEW-DISPOSITION.md)

| Note | Outcome | Where |
|------|---------|-------|
| IN-07 | Fixed | `BootstrapTargetGuard.IsLocalServer`, `BootstrapManagerTests` |
| IN-08 | Recorded, purge deferred to Phase 9 JOB-01 | `docs/operations/mail-setup.md`, `deferred-items.md` |
| IN-09 | Fixed | `PasswordCheckRegistration`, `HibpPwnedPasswords`, `HibpPwnedPasswordsTests` |
| IN-10 | Fixed | `AppLinksOptions.IsValid`, `AppLinksOptionsTests` |
| IN-12 | Fixed | `ResendWaitResponse`, snapshot, generated types, web screens |

## Verification run

- `dotnet test` Infrastructure.IntegrationTests: 454 total, 453 passed, 1 skipped (the existing live HIBP test, which needs the internet).
- `dotnet test` Server.IntegrationTests: 660 passed. ArchitectureTests: 217 passed.
- `npm --prefix tools/openapi-gen run check`, `npm --prefix web run typecheck` and `npm --prefix web run lint` pass with no warnings.
- `authService.test.ts` and `routes.test.tsx` pass when run together. See Issues Encountered for the full-folder run.
- Acceptance greps: no `SignInResponse`/`ResendCodeResponse` in the controller or generated types; `ResendWaitResponse` 3 times in the snapshot; `MaxResponseContentBufferSize` once in the registration; `UserInfo` once in `AppLinksOptions`; `LOCALDB#` 3 times in the guard; "Outbox retention" once in `mail-setup.md`; `JOB-01` once in `deferred-items.md`.
- The pre-commit gitleaks scan found no leaks on any of the 6 task commits. Tests use `example` names, `localhost`, `.` and `LOCALDB#ABC123` only.

## Decisions Made

- The IN-12 record lives in Application, so the contract name does not depend on the Server project.
- The size cap relies on the existing catch-all in `HibpPwnedPasswords`; adding a second error path was not needed and would have duplicated the log call.
- For pipes, only the server part decides locality; a `LOCALDB#` pipe name on a remote server does not make it local.

## Deviations from Plan

None - plan executed exactly as written.

One note on method, not a deviation: the plan asked for the RED web test to fail "(type and name missing)". Vitest does not type check, so RED for Task 1 was proven with `npm --prefix web run typecheck` (TS2305), which fails on exactly that name.

**Total deviations:** 0.

## Issues Encountered

- **Full-folder web run times out two lazy-route tests.** `npm --prefix web run test -- --run src/modules/admin` (24 parallel workers) failed one or two tests in `routes.test.tsx` at the 5 s default timeout in each of four runs; the same file passes when run with a few others, and this plan's web changes are type-only. Recorded in `deferred-items.md` for the Phase 5 close-out test review. All other 444 tests in the folder pass.
- A shell layer collapsed doubled backslashes while I wrote test and guard source, which produced wrong pipe strings once. The affected test file was restored (my own file, by path) and rewritten with an explicit placeholder; the RED commit contains the correct strings (verified with `grep`).

## Known Stubs

None.

## Threat Flags

None. The plan's threats T-05-15 (HIBP size cap), T-05-16 (base URL with user info), T-05-17 (bootstrap guard) are mitigated; T-05-18 is transferred as recorded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-12 (profile password change) can reuse the capped breach client as is.
- 05-26 owns the delete-time scrub of a deleted user's outbox rows; this plan's retention section already refers to it.
- 05-37 can copy the outcome table above into `04-REVIEW-DISPOSITION.md`.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*

## Self-Check: PASSED

All created files exist (ResendWaitResponse.cs, deferred-items.md, this SUMMARY) and all six task commits are on the branch (0d51707, 4f64b03, 6172d97, e9c32dc, 22c8d1e, 32ffd26).
