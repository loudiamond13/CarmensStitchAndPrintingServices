---
phase: 03-ci-cd-staging-deploy
plan: 06
subsystem: infra
tags: [web-deploy, msdeploy, app-offline, rollback, hostprobe, node, tdd, d-11, d-12, d-13, d-05]
created: "2026-10-15T23:58:00-05:00"
updated: "2026-10-15T23:58:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-07 smoke.mjs CLI contract (exit 0 pass, 1 fail; `probe` subcommand reading HOSTPROBE_KEY)"
provides:
  - "web/scripts/deploy.mjs: msdeploy argument builders, the deploy plan as data, an executor with rollback, the package lookup, the certificate pin and the CLI"
  - "web/scripts/deploy.test.ts: 90 cases on a fake spawn, clock and filesystem; nothing reaches a host"
  - "The one-time `hostprobe` action and the amended HostProbe README safety rule (owner decision allow-probe)"
affects: [03-12, 03-14, 03-20, 03-21, deploy-workflow]

actuals:
  tokens: 20500
  tasks: 3
  commits: 4
plan_head_before: d4088190cb06aea548072f19f33678a77e1f6be4
plan_head_after: b2df8f65be364b1c88c129caccacde2afa28b2c1

tech-stack:
  added: []
  patterns:
    - "A run is data: planDeploy returns a frozen-shape step list that also carries `rollback` (steps for the last good release) and `onFailure` (rollback | offline | none); executeDeploy only interprets it"
    - "msdeploy spawned with windowsVerbatimArguments plus a hand-quoted argv0, because the program path holds spaces"
    - "Every logged line, including tool output, goes through redact() with the password, the probe key and the gh token"

key-files:
  created:
    - web/scripts/deploy.mjs
    - web/scripts/deploy.test.ts
  modified:
    - tools/Csps.HostProbe/README.md

key-decisions:
  - "Owner decision (Task 1, relayed by the orchestrator, 2026-10-15T22:05-05:00): allow-probe. The one-time HostProbe may go on the CSPS site root after the legacy site is retired and before the first CSPS deploy. The hostprobe action and the README amendment were built for that branch."
  - "A set WEBDEPLOY_CERT_SHA256 that does not match the server's leaf certificate stops the run before anything is deployed; it does not fall back to verified TLS. A pin is the owner saying which certificate to expect, so a mismatch is a signal, not a hint to try another route."
  - "If the last good release cannot be downloaded, nothing is deployed. Going ahead without a rollback target would turn a recoverable failure into the first-deploy case."
  - "A failed release step after a passing smoke test exits 1 but never rolls back: the site is live and good, only the record is missing, and the message says to run the deploy again."
  - "If the offline page itself cannot be uploaded, the run stops, tries to delete any half-uploaded page, and says the site was not changed."

requirements-completed: [OPS-04]

coverage:
  - id: D1
    description: "Deploy order: branded app_offline.htm, wait 5 seconds, msdeploy sync (skips the logs folder and app_offline.htm, 10 retries every 3 seconds, stale files deleted, no -enableRule), delete app_offline.htm, smoke, then the release deploy-<UTC>-<sha7> holding site.zip. A dry run is one -whatif sync; online is one delete."
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "web/scripts/deploy.test.ts#syncArgs, offlineArgs and onlineArgs, planDeploy, executeDeploy happy path"
        status: pass
      - kind: command
        ref: "INPUT_ACTION=deploy ... node web/scripts/deploy.mjs --plan (exit 0, lists app_offline, never prints the dummy password)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-13 rollback: a failed sync or smoke re-runs offline, sync, online, smoke with the last good package and exits 1 naming the release; a failed rollback or the first deploy puts app_offline.htm back and points to the D-05 kit in docs/operations/deploy.md; the last good release never equals the sha being deployed"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "web/scripts/deploy.test.ts#executeDeploy failure paths, main failure paths and actions, releaseTag and selectLastGood"
        status: pass
    human_judgment: false
  - id: D3
    description: "Package comes only from a successful push run of ci.yml on main for that exact sha (artifact csps-package-<sha>) or the existing deploy release for it; a malformed or empty sha is refused before any gh call"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "web/scripts/deploy.test.ts#findPackage"
        status: pass
    human_judgment: false
  - id: D4
    description: "Secrets: the password is redacted from every printed line and from tool output, credentials with a comma, quote, semicolon, space or control character are refused without echoing them, and -allowUntrusted is added only after the certificate SHA-256 pin matches"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "web/scripts/deploy.test.ts#buildDestination, redact, certificatePinOk, main"
        status: pass
    human_judgment: false
  - id: D5
    description: "hostprobe action: key under 32 characters refused before publishing, key written only into the runner's published appsettings.json, urlCompression (and optionally one HTTPS rewrite rule) injected into the probe web.config, then offline, sync, online and the probe reader; no release; offline page back on failure"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "web/scripts/deploy.test.ts#hostprobe action, injectProbeWebConfig, withProbeKey"
        status: pass
      - kind: integration
        ref: "dotnet publish tools/Csps.HostProbe to a scratch folder, then injectProbeWebConfig and withProbeKey on the real web.config and appsettings.json"
        status: pass
    human_judgment: false
  - id: D6
    description: "How the real SmarterASP.NET Web Deploy endpoint answers (quoted computerName, Basic auth, the app_offline.htm file sync, the certificate) cannot be seen until a real host is reached"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "This plan contacts no host by design. The first real call is the dry run in plan 03-20. The program-name quoting was proven against the local msdeploy.exe with -verb:dump, but not the remote endpoint."

duration: 45min
completed: 2026-10-16
status: complete
---

# Phase 3 Plan 06: Web Deploy orchestrator Summary

**A dependency-free `deploy.mjs` that turns a deploy into a tested plan (branded app_offline.htm, msdeploy sync, smoke, release), rolls back to the last good release on failure, falls back to the D-05 kit on a first deploy, offers an `online` escape hatch and, with the owner's one-time allowance, a `hostprobe` action, all with the Web Deploy password redacted everywhere.**

## Performance

- **Duration:** about 45 min
- **Completed:** 2026-10-16
- **Tasks:** 3 (Task 1 resolved by the owner before this run)
- **Files modified:** 3 (two new, one edited)

## Owner decision (Task 1)

The orchestrator put the blocking-human checkpoint to the owner in chat. The owner chose **allow-probe** at **2026-10-15T22:05-05:00**. So Task 3 built the `hostprobe` action and amended `tools/Csps.HostProbe/README.md`: the old rule "Never put the probe on the live site" now reads "Only once on the CSPS site root, after the legacy site is retired (D-01) and before the first CSPS deploy, through the deploy workflow's `hostprobe` action; the next CSPS deploy removes it; never while the legacy site is in use", with the decision date, plus a section on the action (secret `HOSTPROBE_KEY`, delete it afterwards).

## Accomplishments

- **Tracer (Task 2):** the CLI plans a real deploy end to end. `node web/scripts/deploy.mjs --plan` printed all six steps (offline, wait, sync, online, smoke, release) and the five rollback steps with `password=***`; the dummy password never appeared. Verified: 55 cases green, lint and typecheck clean, then expansion.
- **Argument safety:** `buildDestination` refuses a comma, double quote, single quote or semicolon (the plan) and, added here, any space or control character (CWE-88: a space would let the rest of a password read as another msdeploy option). The error names the field, never the value.
- **Package selection:** the `csps-package-<sha>` artifact of a successful push run of ci.yml on main for exactly that commit, else the existing `deploy-*` release for that sha (older than the 14-day artifact retention), else "No CI-passed build or deploy release exists for <sha7>."
- **Rollback (D-13):** failed sync or smoke gives `offline, sync(last good), online, smoke` and "Rolled back to <tag>."; a failed rollback or a first deploy ends with the offline page back and the D-05 kit message.
- **Host probe:** publishes `tools/Csps.HostProbe` to the runner's temp folder, writes the key and `<urlCompression ... />` (optionally one HTTP-to-HTTPS rule) into the published copies only, then offline, sync, online and `smoke.mjs probe`. Run against a real `dotnet publish` of the probe locally: the real `web.config` (which starts with a byte order mark) and `appsettings.json` were rewritten correctly.

## Task Commits

1. **Task 1: probe decision** - resolved by the owner (allow-probe), no commit
2. **Task 2: Tracer, plan and arguments** - `906b1ab` (test, RED), `4a873a9` (feat, GREEN)
3. **Task 3: failure paths, online, host probe** - `02a37a3` (test, RED), `b2df8f6` (feat, GREEN)

**Plan metadata:** recorded in the docs(03-06) commits that add this file and update STATE and ROADMAP.

## TDD Gate Compliance

RED then GREEN exists for both tasks, in order; no refactor commit was needed.

- **RED, cycle 1 (`906b1ab`):** target `redact > replaces every occurrence of each secret with ***`. Classifier verdict `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the target ran and failed on its planned assertion because the skeleton returned the text unchanged. 50 of 55 cases failed on assertions. The full run could not be classified (multi-line `toEqual` messages make the TAP report malformed, as plans 03-04 and 03-07 found), so the target was run alone with `-t`.
- **RED, cycle 2 (`02a37a3`):** target `buildDestination hardening (CWE-88) > refuses a password holding the whitespace " " without echoing it`. Verdict `RED_EVIDENCE_OK`. Semantic assessment: intended assertion failure (no error was thrown). 24 of 88 cases failed; the rest were Task 2 cases that still passed.

## Files Created/Modified

- `web/scripts/deploy.mjs` - builders, `planDeploy`, `planRollback`, `executeDeploy`, `findPackage`, `selectLastGood`, `releaseTag`, `certificatePinOk`, `injectProbeWebConfig`, `withProbeKey`, `main`, default dependencies, main guard
- `web/scripts/deploy.test.ts` - 90 cases on a fake machine
- `tools/Csps.HostProbe/README.md` - safety rule amended, `hostprobe` section added, timestamps added

## Decisions Made

See `key-decisions` in the frontmatter. The two that change behaviour the plan left open are the certificate pin mismatch (refuse, do not fall back) and the last-good download failure (refuse, do not deploy without a rollback target).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `windowsVerbatimArguments` alone cannot start msdeploy**
- **Found during:** Task 2 (checking the plan's spawn recipe before writing the executor)
- **Issue:** With `windowsVerbatimArguments: true`, Node does not quote the program name, and `C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe` has spaces. Run against the local msdeploy with `-verb:dump` on a local folder (no host contacted), it failed with "Unrecognized argument 'Files\IIS\Microsoft'". Quoting the file name instead gives ENOENT.
- **Fix:** spawn with `argv0: '"<program path>"'` as well. The same call then dumped the folder with status 0. A test asserts both options on every msdeploy call.
- **Files modified:** web/scripts/deploy.mjs, web/scripts/deploy.test.ts
- **Commit:** `4a873a9`

**2. [Rule 2 - Missing critical] Whitespace and control characters in credentials**
- **Found during:** Task 3
- **Issue:** The plan refused only `,` `"` `'` `;`, but with verbatim arguments a space in a value ends the argument and the rest reads as another option (CWE-88, T-03-29).
- **Fix:** also refuse `\s` and control characters, with a message that never echoes the value. RED test added in `02a37a3`.
- **Files modified:** web/scripts/deploy.mjs, web/scripts/deploy.test.ts
- **Commit:** `b2df8f6`

**3. [Rule 2 - Missing critical] A pin mismatch refuses the run**
- **Found during:** Task 2
- **Issue:** The plan says `-allowUntrusted` is added only on a match, which leaves a mismatch undefined. Silently carrying on with verified TLS would hide a changed or spoofed certificate (T-03-26).
- **Fix:** a set `WEBDEPLOY_CERT_SHA256` that does not match stops the run before any gh or msdeploy call, with a message to update the secret if the host renewed its certificate. An unreadable certificate stops it too. Tested.
- **Commit:** `4a873a9`

**4. [Rule 2 - Missing critical] A guard against a clean run ending with app_offline.htm in place**
- **Found during:** Task 3
- **Issue:** The plan's `finally` requirement had no test. A plan that ends with the page up reports success.
- **Fix:** the `finally` in `executeDeploy` turns such a run into exit 1 and deletes the page if there is an online step. Two extra tests (this guard and a byte order mark in `appsettings.json`) were added in the GREEN commit, after RED.
- **Commit:** `b2df8f6`

---

**Total deviations:** 4 auto-fixed (1 bug, 3 missing critical). **Impact on plan:** no scope change; item 1 is a real defect the plan's recipe would have hit on the first run.

## Issues Encountered

- A shell heredoc containing escaped quotes and backslashes was cut short; the long test block was written with the Write tool instead and appended.
- The first full-file RED classification returned `invalid_record` (malformed TAP from multi-line assertion messages); resolved by running one target with `-t`, as earlier plans did.

## User Setup Required

None for this plan. Later: `HOSTPROBE_KEY` as a repository secret for the `hostprobe` run, deleted afterwards (documented in the HostProbe README). `tools/deploy/app_offline.htm` and `docs/operations/deploy.md` are created by plans 03-12 and 03-14; `deploy.mjs` reads the first and its failure messages point to the second.

## Known Stubs

None.

## Threat Flags

None. The only new connection is the SHA-256 pin check on port 8172, which is T-03-26 in the plan's register.

## Next Phase Readiness

- Plan 03-12 (`deploy.yml`) can run `node web/scripts/deploy.mjs` with exactly the environment the plan lists, including `INPUT_PROBE_REWRITE` and `HOSTPROBE_KEY`; the `hostprobe` action is available.
- Plan 03-20 makes the first real call (the dry run). Not proven here: the SmarterASP.NET endpoint format, the quoted `computerName`, and the single-file `contentPath` sync of `app_offline.htm`. Residual risk accepted: the pin check and msdeploy open separate connections, so a certificate swapped between them is not caught.
- `tools/deploy/app_offline.htm` does not exist yet (plan 03-12); a real run refuses to start without it.

## Self-Check: PASSED

- `web/scripts/deploy.mjs`, `web/scripts/deploy.test.ts` and `tools/Csps.HostProbe/README.md` exist; commits `906b1ab`, `4a873a9`, `02a37a3` and `b2df8f6` are on the branch (4 commits since `d408819`).
- `npm --prefix web test -- --run scripts/deploy.test.ts`: 90 of 90 passed. `npm --prefix web run lint`, `typecheck` and `format:check` exit 0.
- Acceptance: `windowsVerbatimArguments` (2), `retryAttempts:10` (2), `Rolled back to` (1), `D-05` (1), `injectProbeWebConfig` (2); every import starts with `node:`; the README holds the decision date; no em or en dash in the three files.
- The `--plan` run exits 0, lists app_offline and prints no dummy password.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-16*
