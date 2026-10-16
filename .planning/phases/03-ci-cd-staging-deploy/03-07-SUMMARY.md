---
phase: 03-ci-cd-staging-deploy
plan: 07
subsystem: infra
tags: [smoke-test, node, iis, https, csp, hsts, problemdetails, hostprobe, d-06, d-13]
created: "2026-10-15T23:03:00-05:00"
updated: "2026-10-15T23:03:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-CONTEXT decisions D-06 and D-13 (smoke runs against the live site after every deploy and decides keep or roll back)"
provides:
  - "web/scripts/smoke.mjs: twelve read-only production checks, the probe reader and the CLI (exit 0 pass, 1 fail, 2 usage)"
  - "web/scripts/smoke.test.ts: 96 cases on a fake send and a fake clock, one per failure mode"
affects: [03-06, 03-21, deploy-workflow]

actuals:
  tokens: 17400
  tasks: 2
  commits: 4
plan_head_before: 02c7ef554774e3142dd301eb3ce834137d85c6fd
plan_head_after: 49671407d62a70d233a21d2df04b552f317669ce

tech-stack:
  added: []
  patterns:
    - "Injected send({ method, url, headers, body, servername, insecureTls }) with a node:https/node:http default that never follows redirects and sets SNI separately from the Host header"
    - "Checks are { name, run(ctx) } in a frozen ordered list; a check that throws becomes a failed result, so one broken check never hides the others"

key-files:
  created:
    - web/scripts/smoke.mjs
    - web/scripts/smoke.test.ts
  modified: []

key-decisions:
  - "A connection closed while the 1.5 MB body is being sent (ECONNRESET, EPIPE, ECONNABORTED) counts as a refusal by IIS; any other connection error fails the request-limit check, because it proves nothing."
  - "host-filter treats no answer as a failure: a refusal must be seen as a status, not guessed from a dropped connection."
  - "The host-filter and request-limit responses are not kept for the no-banners check, because HTTP.sys can refuse a request with its own Server header before IIS removes it."
  - "The http://host/probe redirect report is information only and never fails the probe."
  - "The probe key is checked before any request, sent over https only, and replaced by [hidden] in every printed line as a second guard."

requirements-completed: [OPS-04, OPS-05]

coverage:
  - id: D1
    description: "Health check passes only on 200 JSON, no-store, status Healthy and self, database, time-zone Healthy; it retries a 503, a missing check, a non-JSON body or a connection error with 2, 4, 8, 15 second backoff and gives up before 90 seconds naming the last status"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "web/scripts/smoke.test.ts#health"
        status: pass
      - kind: integration
        ref: "node web/scripts/smoke.mjs --origin https://localhost:7028 --only health,unknown-api,default-deny --insecure-tls"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unknown API path, anonymous site-settings and a missing static file must be real ProblemDetails; an IIS HTML page or the SPA shell fails"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "web/scripts/smoke.test.ts#unknown-api, default-deny, missing-file"
        status: pass
    human_judgment: false
  - id: D3
    description: "OPS-05 hosting checks: http redirects 301/307/308 to https without following, HSTS and a CSP with script-src 'self' and no unsafe-, no Server or X-Powered-By, shell no-cache, first hashed asset immutable with br or gzip, /health JSON never compressed"
    requirement: OPS-05
    verification:
      - kind: unit
        ref: "web/scripts/smoke.test.ts#https-redirect, security-headers, no-banners, shell-cache, hashed-asset, json-not-compressed"
        status: pass
    human_judgment: false
  - id: D4
    description: "First-deploy host checks: Host smoke.invalid with the real SNI is not 2xx, a 1.5 MB POST is never 2xx and the detail names IIS or the app"
    requirement: OPS-05
    verification:
      - kind: unit
        ref: "web/scripts/smoke.test.ts#host-filter, request-limit"
        status: pass
    human_judgment: false
  - id: D5
    description: "Probe reader: X-Probe-Key sent, key under 32 characters or missing exits 2 before any request, facts printed, key never printed, http redirect reported"
    requirement: OPS-05
    verification:
      - kind: unit
        ref: "web/scripts/smoke.test.ts#readProbe, main probe"
        status: pass
      - kind: integration
        ref: "node web/scripts/smoke.mjs probe --origin https://localhost:7029 --insecure-tls (against tools/Csps.HostProbe on this machine)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The twelve checks against the real SmarterASP.NET host (IIS compression, AllowedHosts, requestLimits, cold start timing) cannot be seen until the first deploy"
    requirement: OPS-05
    verification: []
    human_judgment: true
    rationale: "This plan proves the checks against fakes and the local API. Whether the real host passes them is shown by the first deploy (plan 03-21), not by this plan."

duration: 20min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 07: Production smoke test Summary

**A dependency-free `smoke.mjs` that judges a live site with twelve read-only HTTP checks (cold-start health retry, ProblemDetails through IIS, HTTPS redirect without following, HSTS and CSP, removed server banners, immutable compressed assets, uncompressed JSON, Host filtering, request limit) plus a `probe` subcommand for the one-time HostProbe, all covered by 96 fake-send tests.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-16T03:40:00Z
- **Completed:** 2026-10-16T04:03:00Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments

- `CHECKS` runs in order: health, unknown-api, default-deny, missing-file, https-redirect, security-headers, no-banners, shell-cache, hashed-asset, json-not-compressed, host-filter, request-limit. One plain line per check (`PASS name: detail` or `FAIL name: detail`), exit 0, 1 or 2, `--only` and `--insecure-tls` (refused unless the origin host is `localhost`), and a Markdown table in `GITHUB_STEP_SUMMARY` when it is set.
- The health check retries for up to about 90 seconds on a fake clock: attempts at 0, 2, 6, 14, 29, 44, 59, 74 and 89 seconds, then it stops without sleeping past the deadline and names the last status.
- The default `send` was exercised on a loopback server: a 301 is returned as a 301 (not followed), a custom Host header reaches the server, and a connection reset during the 1.5 MB body is reported as a refusal.
- Tracer verified end to end: the three Task 1 checks passed against the local API on https://localhost:7028. The remaining checks were also run there: missing-file, security-headers, no-banners, json-not-compressed and request-limit (413 from the app) passed, and host-filter failed as it should, because the development `AllowedHosts` is `*`.
- `smoke.mjs probe` read the real `tools/Csps.HostProbe` on https://localhost:7029 (200 JSON facts printed, key absent from output); a 20-character key exited 2 with no request; a wrong 40-character key exited 1 on the 401.

## Task Commits

1. **Task 1: Tracer, health with cold-start retry, unknown API path, default deny** - `252cca1` (test, RED), `f9a70ab` (feat, GREEN)
2. **Task 2: OPS-05 hosting checks, first-deploy host checks, probe reader** - `261e2f0` (test, RED), `4967140` (feat, GREEN)

**Plan metadata:** recorded in the docs(03-07) commit that adds this file.

## TDD Gate Compliance

RED and GREEN commits exist for both tasks, in order; no refactor commit was needed.

- **RED, cycle 1 (`252cca1`):** target `health > passes on 200 JSON, no-store, status Healthy and self, database and time-zone all Healthy`. The skeleton `runSmoke` returned no results, so the target failed on `expected [] to have a length of 1`. Classifier verdict `RED_EVIDENCE_OK`. Semantic assessment: the target ran and failed on the planned assertion for the intended reason (behaviour absent). 32 of 35 cases failed on assertions.
- **RED, cycle 2 (`261e2f0`):** target `host-filter > passes when a request for Host smoke.invalid is refused, sent with the real server name`. `runSmoke` had no host-filter check. Classifier verdict `RED_EVIDENCE_OK`. Semantic assessment: intended assertion failure. 55 of 96 cases failed; the other 41 are Task 1 cases plus "fails when ..." cases that a missing check also satisfies by construction.
- A first attempt at cycle 2 used a target whose multi-line assertion message the TAP adapter rejected (`INVALID_RED`, `invalid_record`); a target with a one-line assertion gave a valid verdict, as plan 03-04 recorded.

## Files Created/Modified

- `web/scripts/smoke.mjs` - checks, `evaluate`, `runSmoke`, `readProbe`, `main`, default `send`, main guard
- `web/scripts/smoke.test.ts` - 96 cases on a fake site and a fake clock

## Decisions Made

- A connection closed while the 1.5 MB body is sent (ECONNRESET, EPIPE, ECONNABORTED) counts as a refusal by IIS in `request-limit`; any other connection error fails the check. IIS may reset the connection rather than answer 404.13 while a large upload is still in flight.
- `host-filter` fails on no answer. A refusal has to be seen as a status.
- `host-filter` and `request-limit` responses are not recorded for `no-banners`: HTTP.sys can refuse with its own `Server: Microsoft-HTTPAPI` header before IIS can remove it. Both run after `no-banners` anyway.
- The `http://host/probe` result is information only (`INFO http-redirect: ...`) and never fails the probe; plain http carries no key.
- The probe key is replaced with `[hidden]` in every returned line, so a probe that echoed it still could not leak it into a CI log.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED skeleton needed for a valid RED**
- **Found during:** Task 1 and Task 2 RED
- **Issue:** A test importing a missing module (or a missing `readProbe`) is a load failure, not RED evidence.
- **Fix:** Both RED commits include a skeleton `smoke.mjs` whose exports have their final shapes and give wrong answers, so target tests fail on assertions.
- **Files modified:** web/scripts/smoke.mjs
- **Verification:** `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for one target in each cycle.
- **Committed in:** `252cca1`, `261e2f0`

---

**Total deviations:** 1 auto-fixed (1 blocking). **Impact on plan:** the same technique plan 03-04 used; no scope change.

## Issues Encountered

- A shell one-liner collapsed `\n` escapes inside two string literals while splicing code; the Edit tool replaced them, and `prettier`, ESLint and the tests confirmed the final file (no NUL bytes, no long dash).
- The local development API has `AllowedHosts: *`, so `host-filter` fails there. That is the expected signal; production must set the real host names (HOSTING-RECORD row, verified at the first deploy in plan 03-21).

## User Setup Required

None - no external service configuration required. The only secret is `HOSTPROBE_KEY`, read from the environment when the owner runs `smoke.mjs probe` against the temporary probe site.

## Known Stubs

None.

## Next Phase Readiness

- Plan 03-06 (`deploy.mjs`) can call `node web/scripts/smoke.mjs --origin <url>` and `... probe --origin <url>` as agreed: exit 0 pass, 1 fail, 2 usage.
- Plan 03-21 runs this script on the first deploy to move the HOSTING-RECORD rows (HTTPS termination, AllowedHosts, requestLimits, IIS compression, static caching) to Verified.
- Not proven here: how the real SmarterASP.NET host answers. `request-limit` records whether IIS or the app refused the body; the cold-start window of 90 seconds is an estimate from research Pitfall 8.

## Self-Check: PASSED

- `web/scripts/smoke.mjs` and `web/scripts/smoke.test.ts` exist; commits `252cca1`, `f9a70ab`, `261e2f0` and `4967140` are on the branch.
- `npm --prefix web test -- --run scripts/smoke.test.ts`: 96 of 96 passed. `npm --prefix web run lint`, `typecheck` and `format:check` exit 0.
- Acceptance: `export const CHECKS` count 1; every import starts with `node:`; `immutable` (4), `smoke.invalid` (1) and `X-Probe-Key` (2) are present.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-15*
