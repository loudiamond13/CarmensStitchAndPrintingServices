---
phase: 03-ci-cd-staging-deploy
plan: 02
subsystem: ci-harness
tags: [playwright, e2e, devseed, coverage, powershell, ci, ubuntu]
created: "2026-10-15T22:30:00-05:00"
updated: "2026-10-15T22:30:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: web/scripts/e2e.mjs run harness and web/playwright.config.ts
provides:
  - "e2eConnection(env), E2E_CONNECTION_VARIABLE and LOCALDB_E2E_CONNECTION exported from web/scripts/e2e.mjs"
  - "planSteps({ portBusy, extraArgs, env }) seeding with --connection when CSPS_E2E_CONNECTION is set"
  - "Playwright host ConnectionStrings__Csps from the same e2eConnection() as the seed step"
  - "Invoke-CoverageGate.ps1 with forward-slash paths only, runnable unchanged on ubuntu and Windows PowerShell 5.1"
affects: [03-11, ci-workflow, coverage-gates]

actuals:
  tokens: 4200
  tasks: 2
  commits: 3
plan_head_before: 6001bed08b463ac79c47e13e52d7b794c9b267e7
plan_head_after: 9131105921f72012a27ae0872a9a2fee6ec43687

tech-stack:
  added: []
  patterns:
    - "Per-process CI override read through one function shared by the seed step and the Playwright host"
    - "Harness output prints step names and exit codes only (CWE-532)"

key-files:
  created: []
  modified:
    - web/scripts/e2e.mjs
    - web/scripts/e2e.test.ts
    - web/playwright.config.ts
    - tools/scripts/Invoke-CoverageGate.ps1
    - docs/web/e2e.md

key-decisions:
  - "A blank or whitespace-only CSPS_E2E_CONNECTION counts as unset, so a CI job that exports an empty variable keeps the LocalDB default."
  - "The seed uses --database CSPS_E2E whenever the resolved connection is the LocalDB literal, so local behaviour is byte-for-byte unchanged."
  - "playwright.config.ts imports e2eConnection from ./scripts/e2e.mjs directly; the inline fallback was not needed because Playwright's loader accepts the module."

patterns-established:
  - "One exported function decides the E2E connection for every consumer, so seed and host cannot drift apart."

requirements-completed: [OPS-02]

coverage:
  - id: D1
    description: "CSPS_E2E_CONNECTION drives both the E2E seed (--connection) and the E2E host (ConnectionStrings__Csps); unset or blank keeps CSPS_E2E on LocalDB"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "web/scripts/e2e.test.ts#CSPS_E2E_CONNECTION (CI override)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @smoke --project chromium"
        status: pass
    human_judgment: false
  - id: D2
    description: "A failing seed reports only the step name and exit code, never the connection value"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "web/scripts/e2e.test.ts#reports a failing seed by step name and exit code only"
        status: pass
    human_judgment: false
  - id: D3
    description: "Invoke-CoverageGate.ps1 passes no backslash path literal to dotnet and still passes locally under Windows PowerShell 5.1"
    requirement: OPS-02
    verification:
      - kind: other
        ref: "powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1"
        status: pass
    human_judgment: true
    rationale: "The ubuntu / PowerShell 7 run is proven only by the CI job in plan 03-11; no Linux runner exists locally."

duration: 18min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 02: CI-ready E2E and coverage harnesses Summary

**One per-process CSPS_E2E_CONNECTION override now points both the E2E seed and the Playwright host at a CI container, the local LocalDB default is unchanged, and the coverage gate uses forward-slash paths so it runs on ubuntu as written.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-16T03:06:00Z
- **Completed:** 2026-10-16T03:24:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `e2eConnection(env)` in `web/scripts/e2e.mjs` returns the trimmed `CSPS_E2E_CONNECTION` or the LocalDB literal. `planSteps` seeds with `--connection <value>` when it is set and with `--database CSPS_E2E` otherwise. `playwright.config.ts` sets `ConnectionStrings__Csps` from the same function.
- `executeSteps` is unchanged and prints only `e2e: seed failed with exit code N.`; a test proves neither the password nor the host appear in stderr (T-03-09).
- DevSeedTargetGuard was not touched, so the value still has to name `CSPS_E2E` or `CSPS_Dev` on LocalDB or a loopback container (T-03-08).
- `Invoke-CoverageGate.ps1` uses `'../..'`, `'artifacts/coverage'`, `'tests/Csps.Domain.UnitTests'` and `'tests/Csps.Application.UnitTests'`. The local gate passes: Domain 100% line and branch, Application 99.4% line.
- `docs/web/e2e.md` documents the override in the database section and in step 4.

## Task Commits

1. **Task 1 (tracer, RED): E2E seed and host follow CSPS_E2E_CONNECTION** - `20a69fc` (test)
2. **Task 1 (tracer, GREEN): one CSPS_E2E_CONNECTION override for the E2E seed and host** - `f3cd219` (feat)
3. **Task 2: Linux-safe paths in the coverage gate; document the override** - `9131105` (fix)

**Plan metadata:** recorded in the docs commit that follows this summary.

## Files Created/Modified

- `web/scripts/e2e.mjs` - `E2E_CONNECTION_VARIABLE`, `LOCALDB_E2E_CONNECTION`, `e2eConnection`, `planSteps` env parameter, header comment.
- `web/scripts/e2e.test.ts` - nine cases for the override (default, override, blank, seed args, CWE-532 output, process.env default).
- `web/playwright.config.ts` - host connection string from `e2eConnection()`.
- `tools/scripts/Invoke-CoverageGate.ps1` - forward-slash path literals and the CI help line.
- `docs/web/e2e.md` - the override, its guard and its CI-only scope.

## Decisions Made

- Blank or whitespace-only override counts as unset.
- The seed keeps `--database CSPS_E2E` whenever the resolved value is the LocalDB literal, since DevSeedOptions refuses `--database` together with `--connection`.
- Direct import of `e2e.mjs` from `playwright.config.ts` works, so the plan's text-test fallback was not needed.

## Deviations from Plan

None - plan executed exactly as written.

Tracer gate: the `@smoke` chromium run on LocalDB passed after the GREEN commit (`1 passed`), and the unit file passed 35 of 35, so expansion to Task 2 went ahead.

## Issues Encountered

- An ESLint `no-unsafe-assignment` error on `expect.arrayContaining` inside `toMatchObject` was fixed by asserting the trailing seed args with `toEqual`. No deviation.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the CI-only environment variable, already covered by T-03-08 and T-03-09.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-11 can set `CSPS_E2E_CONNECTION` for the Playwright step and call `Invoke-CoverageGate.ps1` under `pwsh` on ubuntu.
- The ubuntu / PowerShell 7 behaviour of the gate and the container seed are first exercised in that CI job; nothing here was run against a container (no Docker locally).

## Self-Check: PASSED

- Files found: `web/scripts/e2e.mjs`, `web/scripts/e2e.test.ts`, `web/playwright.config.ts`, `tools/scripts/Invoke-CoverageGate.ps1`, `docs/web/e2e.md`.
- Commits found on this branch: `20a69fc`, `f3cd219`, `9131105`.
- Acceptance greps: `export function e2eConnection` 1, `CSPS_E2E_CONNECTION` in e2e.mjs 3, `e2eConnection` in playwright.config.ts 2, test-project paths 2 and 2, e2e.md mentions 2; `npm --prefix web run typecheck` and `lint` exit 0.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-15*
