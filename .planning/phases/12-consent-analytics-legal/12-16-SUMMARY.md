---
phase: 12-consent-analytics-legal
plan: 16
subsystem: web-analytics
tags: [web-vitals, core-web-vitals, consent, lazy-chunk, keepalive, analytics]
created: "2026-11-17T10:45:00-06:00"
updated: "2026-11-17T10:45:00-06:00"

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-14 POST /api/v1/analytics/vitals; 12-15 analyticsService and the dynamic-import pattern; 12-09 consentStore (statsAllowed, gpc)"
provides:
  - "web-vitals 6.2.3 (exact pin), recorded in the registry, notices and budget notes"
  - "speedReport.ts: startSpeedReport(report), the only importer of web-vitals, in its own lazy chunk"
  - "useSpeedReport(pathname): consent-gated, one keepalive POST of the landing path and the latest LCP, CLS, INP when the page is hidden"
  - "analyticsService.vitals(body, { keepalive })"
affects: [12-17 stats page (speed numbers now arrive), public first-download budget (0.93 KB left on Privacy)]

actuals:
  tokens: 7700
  tasks: 3
  commits: 5
plan_head_before: 52b60601acb82dd22565b4a1dea440424ec4a51b
plan_head_after: 7fb21eb45db7c374f9ef2bd36fa57517d1187909

tech-stack:
  added: ["web-vitals 6.2.3 (Apache-2.0, owner-approved D-38)"]
  patterns: ["lazy reader behind a consent gate", "hide listener added after the reader starts so web-vitals' own hide handlers run first", "one load per page held in a ref (StrictMode safe)"]

key-files:
  created:
    - web/src/modules/public/speedReport.ts
    - web/src/modules/public/hooks/useSpeedReport.ts
    - web/src/modules/public/hooks/useSpeedReport.test.tsx
  modified:
    - web/package.json
    - web/package-lock.json
    - web/THIRD-PARTY-NOTICES.txt
    - web/src/modules/public/services/analyticsService.ts
    - web/src/modules/public/services/analyticsService.test.ts
    - web/src/layouts/PublicLayout.tsx
    - docs/dependencies.json
    - docs/dependencies.md
    - docs/web/budgets.md

key-decisions:
  - "The hide listener is added only after startSpeedReport has run, so web-vitals' capture-phase hide handlers fire first and the final LCP, CLS and INP are in when the report is built"
  - "One report per page load: the first hidden event with at least one metric sends, and later hidden events send nothing (a second send would count the same visit twice in the p75)"
  - "No metric reported means no request, rather than an empty body"
  - "Landing path and stats state are re-checked at send time: the listener is removed when stats go off, and the send also re-reads consentStore"

requirements-completed: [ANL-05]

duration: 55min
completed: 2026-11-17
status: complete

coverage:
  - id: D1
    description: "web-vitals 6.2.3 installed with an exact pin, recorded in docs/dependencies.json (entry and owner approval), docs/dependencies.md and the third-party notices, and passing the license, notices, audit and registry gates"
    requirement: ANL-05
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class *DependencyRegistryTests (76 passed)"
        status: pass
      - kind: other
        ref: "npm --prefix web run license:check; notices:check; audit:check -- --today 2026-11-17 (all exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "With a saved stats yes, the reader loads lazily and one keepalive POST sends { path, lcp?, cls?, inp? } when the page is hidden; a metric that never reported is left out"
    requirement: ANL-05
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/useSpeedReport.test.tsx (13 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/public/services/analyticsService.test.ts#analyticsService.vitals"
        status: pass
    human_judgment: false
  - id: D3
    description: "Before a choice, after Reject All and under GPC the reader is never imported and nothing is sent; stats turned off before the page is hidden sends nothing"
    requirement: ANL-05
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/useSpeedReport.test.tsx#useSpeedReport without a stats yes"
        status: pass
    human_judgment: false
  - id: D4
    description: "web-vitals sits in its own lazy chunk; every public route stays within 150 KB; the chunk and the before and after figures are recorded in docs/web/budgets.md"
    requirement: ANL-05
    verification:
      - kind: other
        ref: "npm --prefix web run build:budget and npm --prefix web run build (exit 0; speedReport-D-sSOfWr.js 8.04 KB raw, 3.09 KB gzip, in no route list)"
        status: pass
    human_judgment: true
    rationale: "The hook adds about 0.8 KB gzip to every public first download (Privacy 149.07 KB, 0.93 KB left). Whether that is acceptable, or a reserve option should be used, is the owner's call."
---

# Phase 12 Plan 16: With consent, real visitors' page speed is measured on their own phones Summary

**Owner-approved web-vitals 6.2.3, loaded in its own lazy chunk only while visitor stats are allowed, sends one keepalive report of the landing path and the latest LCP, CLS and INP when the page is hidden.**

## Performance

- **Duration:** about 55 min
- **Tasks:** 3 (1 tracer, 2 auto), 5 commits
- **Files modified:** 12 (3 new)

## Accomplishments

- `web-vitals` 6.2.3 is installed with an exact pin (no caret) and recorded in the registry, plain-words docs, notices and budget notes. All gates pass.
- `startSpeedReport(report)` in `speedReport.ts` is the only file that imports web-vitals. It loads only by dynamic import, so web-vitals is a separate chunk (`speedReport-D-sSOfWr.js`, 8.04 KB raw, 3.09 KB gzip) that no route counts.
- `useSpeedReport(pathname)` (called once in `PublicLayout`) starts the reader only while `statsAllowed` is true. It keeps the landing path and the latest value per metric and sends one `analyticsService.vitals(..., { keepalive: true })` when the page is hidden, if stats are still allowed.
- Before a choice, after Reject All and under GPC, the reader is never imported and nothing is sent. A yes saved later in the same page load starts it. A failed send logs nothing and is not retried.

## Package check (owner rule, quoted)

Approval record: `12-CONTEXT.md` D-38 ("`web-vitals` 6.2.3 is approved ... Exact version pinned", OQ 3 A, owner, 2026-11-15). It now also sits under `approvals` in `docs/dependencies.json`.

Re-check of the exact version before install (2026-11-17), all matching the record:

- `npm view web-vitals@6.2.3`: version 6.2.3, license Apache-2.0, not deprecated, no `dependencies`, no install scripts, modified 2026-10-05.
- `dist-tags`: `latest` is 6.2.3. No newer web-vitals exists, so there is nothing to record for the owner.
- Published 2026-10-05; adopted 2026-11-17, 43 days later, so the 14-day cool-down is met (`coolDown: aged`).
- After install `npm audit` reports 28 moderate advisories in dev tools already accepted in `docs/audit-exceptions.json` (glob, minimatch and others); none names web-vitals. `audit:check` passes ("no unaccepted advisories").
- `git diff` of `package.json` and the lockfile shows only the one `web-vitals` line and its lock entry.

## Task Commits

1. **Task 1 tracer: a consented visitor's speed reaches the server**
   - RED `d3757c02` (test): tracer hook test plus three `analyticsService.vitals` tests, with stubs so they run.
   - GREEN `97b91e95` (feat): install, `speedReport.ts`, the hook, `vitals`, the `PublicLayout` call.
2. **Task 2: without a yes, the reader never loads**
   - RED `0eec42cd` (test): 12 more hook tests.
   - GREEN `187e69a0` (feat): one send, a stats re-check, measured-only, drop failed sends, one load per page.
3. **Task 3: the package is on record**
   - `7fb21eb4` (chore): registry, owner approval, plain-words doc, notices, budget notes.

**Tracer gate:** the tracer `<verify>` (the two test files) was re-run after GREEN and passed (8 tests). Logged: Tracer verified end-to-end, expanding.

## TDD Gate Compliance

RED then GREEN commits exist for both TDD tasks (`test(12-16)` before `feat(12-16)`). The plan is `type: execute`, so `tdd-red-evidence` was not required; I did the semantic check by hand.

- RED 1 (`d3757c02`): `vitest --run useSpeedReport.test.tsx analyticsService.test.ts` exited non-zero, 4 failed, 4 passed. The target `useSpeedReport tracer` test failed with `expected "vi.fn()" to be called 1 times, but got 0 times` (the stub hook never starts the reader). The three `vitals` tests failed on `expected ... toHaveLength(1)` (0 requests) and `keepalive` undefined. Assessment: the target tests ran and failed on the planned assertions, not on syntax or import errors.
- RED 2 (`0eec42cd`): 3 failed, 10 passed, plus one unhandled rejection. Failures: `sends nothing when no metric has reported` (`got 1`), `sends one report for the page load` (`got 3`), `starts the reader once in React StrictMode` (reader not reached), and the failed-send test raised `HttpError: We couldn't reach the server` as an unhandled rejection. Assessment: all on planned behavior.
- Already-green tests at RED 2: the five "without a stats yes" tests passed at once. This is expected: Task 1's action already specifies the `statsAllowed` gate, so the gate existed after the tracer. The new tests lock it in rather than drive it. I did not weaken any assertion to get this.
- GREEN 2: `useSpeedReport.test.tsx` 13 passed (run alone twice), with `no-long-dash.node.test.ts` 14 passed.

## Verification (real output)

- `npm --prefix web run test -- --run src/modules/public/hooks/useSpeedReport.test.tsx src/test/no-long-dash.node.test.ts`: 2 files, 14 tests passed.
- `npm --prefix web run typecheck`: exit 0. `npm --prefix web run lint` (`--max-warnings 0`): exit 0. `npm --prefix web run format:check`: all files use Prettier code style.
- `npm --prefix web run license:check`: production web/ 29 packages, 0 problems; dev/build/tool 564 packages, 0 problems; "License gate passed."
- `npm --prefix web run notices` then `notices:check`: "up to date (29 packages)".
- `npm --prefix web run audit:check -- --today 2026-11-17`: "no unaccepted advisories."
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"`: total 76, failed 0.
- `npm --prefix web run build:budget` (exit 0) and `npm --prefix web run build` (exit 0, no warnings). Public rows (budget build, gzip -9): home 147.53, products 144.24, gallery 145.58, contact 147.60, privacy 149.07, cookies 147.00, terms 148.18, accessibility 147.74, not found 140.30 KB; admin 220.69 KB (limits 150 and 250 KB, all "ok"). Production: home 147.45, products 144.15, gallery 145.50, contact 147.51, privacy 148.99, cookies 146.92, terms 148.10, accessibility 147.66, not found 140.22 KB; admin 218.79; CSS 20.42 KB.
- `artifacts/budget/budget.budget.json`: no file named `speedReport` and no web-vitals file in any route's list.
- Full web suite (`npm --prefix web run test -- --run`, with other worktrees running): 416 files, 11,156 tests, 11,155 passed and 1 failed. The failure was `src/modules/admin/routes.test.tsx > an Admin who opens /admin/site-content lands on the dashboard at /admin`, a 10,053 ms timeout in an admin test this plan does not touch. Re-run alone: 73 of 73 passed. Recorded as a load flake, not hidden.
- Acceptance greps: `p.dependencies['web-vitals']==='6.2.3'` exits 0; `import('../speedReport')` count 1; `statsAllowed` count 4; `"id": "web-vitals"` count 1; `web-vitals` in the notices count 2.

## Decisions Made

See `key-decisions`. No decision that changes behavior, scope, wording, security posture or cost was taken beyond the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React StrictMode imported the reader twice**
- **Found during:** Task 2 (StrictMode test)
- **Issue:** StrictMode runs the effect twice, so two concurrent `import()` calls were made per mount.
- **Fix:** the load promise is held in a ref, so each page loads the chunks once (also removes a rejected-load retry trap: a failed load clears the ref).
- **Files modified:** `web/src/modules/public/hooks/useSpeedReport.ts`
- **Verification:** `starts the reader once in React StrictMode` passes.
- **Committed in:** `187e69a0`

**2. [Rule 3 - Blocking] Missing node_modules in the fresh worktree**
- **Found during:** start, and again at `license:check` (needed `tools/openapi-gen`)
- **Fix:** `npm ci` in `web/` and in `tools/openapi-gen/` (installs the already-approved lockfile versions; no new package).

**Total deviations:** 1 auto-fixed bug, 1 environment fix. **Impact:** none on scope.

Notes that are not deviations: the plan text says `npm run audit:check -- --today 2026-11-15`; I used 2026-11-17 (the real date, and `adopted` is 2026-11-17). The plan's `gitleaks protect --staged` is deprecated; I ran `gitleaks git --pre-commit --staged --redact --config .gitleaks.toml --no-banner` (the repo hook's command) before each commit: no leaks. The first commit trailer says Claude Opus 5.5 (as the plan instructed); the later four say Claude Sonnet 5.5, which is the model that actually ran them.

## Issues Encountered

- **Flake, recorded:** in one combined run of `src/layouts src/modules/public src/core/routes`, `PublicLayout.test.tsx` failed 2 tests (one was `sends a pending choice again ... once`, consent probe `expected 1, got 2`) while other worktrees were running. Re-run alone: 58 of 58 passed. Re-run combined: 52 files, 929 tests passed. Not reproduced; I believe it is load timing in the resend path, not this plan, but I could not prove it.
- **Mock quirk:** with `vi.mock('../speedReport')`, two concurrent dynamic imports of the mocked module made the second one return the real module (seen in the StrictMode test). The one-load-per-page ref avoids the second import, so the tests are deterministic.
- `vi.resetModules()` runs before each hook test so the "reader never imported" assertions count real imports (the mock factory runs again on each import).

## Known Stubs

None. `speedReport.ts` and `useSpeedReport.ts` were stubs only at the two RED commits.

## Open questions for the owner

1. **Public first-download room (needs your call, not urgent).** The hook adds about 0.8 KB gzip to every public page (measured by building with and without the call; web-vitals itself adds nothing). Privacy is now 149.07 KB, so 0.93 KB is left; the limit is unchanged. A baseline build of this plan's base measured Privacy at 148.26 KB, not the 148.78 KB in STATE.md, so the wave 4 note and my base differ by 0.5 KB. Options: (A, recommended) accept as is and tell later public plans to measure against 149.07 KB; (B) move the send logic into a second lazy file (saves roughly 0.4 to 0.5 KB, but the plan's tests mock `speedReport` and expect the hook to do the sending, so this needs a plan change); (C) use a reserve option R1/R2/R3 in `docs/web/budgets.md` (each needs your yes).
2. **Browser reach (information).** CLS is Chromium only, so iPhone visitors will give LCP and INP but no CLS. The stats page already handles "no data".

## Threat Flags

None beyond the plan's register. T-12-45 (no measurement before consent) is covered by the tests that prove the reader is never imported before a choice, after Reject All and under GPC. T-12-46 (no third-party script): web-vitals is bundled first party in a lazy chunk, no CSP change. T-12-SC: exact pin, registry, license, notices and audit gates all pass.

## User Setup Required

None.

## Next Phase Readiness

The stats page plan (12-17 onward) can read speed samples that now arrive from real visitors. The public first download has 0.93 KB left on Privacy.

## Self-Check: PASSED

- Files exist: `speedReport.ts`, `useSpeedReport.ts`, `useSpeedReport.test.tsx` (FOUND, each checked on disk).
- Commits exist: `d3757c02`, `97b91e95`, `0eec42cd`, `187e69a0`, `7fb21eb4` (each an ancestor of HEAD).
- `git rev-list --count 52b60601..HEAD` was 5 before this SUMMARY commit.

---
*Phase: 12-consent-analytics-legal*
*Completed: 2026-11-17*
