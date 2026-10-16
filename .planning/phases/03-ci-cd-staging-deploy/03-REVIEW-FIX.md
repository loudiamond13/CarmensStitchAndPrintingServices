---
created: 2026-10-16T17:15:00-05:00
updated: 2026-10-16T16:40:00-05:00
phase: 03-ci-cd-staging-deploy
fixed_at: 2026-10-16T17:15:00-05:00
review_path: .planning/phases/03-ci-cd-staging-deploy/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-16T17:15:00-05:00
**Source review:** .planning/phases/03-ci-cd-staging-deploy/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (0 Critical, 6 Warning; Info findings are out of scope for `critical_warning`)
- Fixed: 5
- Skipped: 1 (WR-02, mitigated in the docs only)

Work ran in the main checkout on `gsd/phase-03-ci-cd-staging-deploy` because `workflow.use_worktrees` is `false`. Nothing was pushed. Every code fix has a RED test commit followed by a GREEN fix commit.

**Verification ran in the main checkout** (reproducible from this tree):
- `npm --prefix web test -- run scripts/deploy.test.ts scripts/smoke.test.ts`: 195 passed.
- `npm --prefix web run lint` (`--max-warnings 0`) and `prettier --check scripts`: clean.
- `dotnet test --project tests/Csps.ArchitectureTests`: 217 passed.
- For WR-06 the stage-7 steps were also run by hand on this PC (web build, `dotnet publish -r win-x64`, `package-check.mjs`, `gitleaks dir`, `dotnet ef migrations script --idempotent`) into the scratchpad folder, and all passed, so the first pull request run is not expected to trip on them. The GitHub-hosted run itself is still unmeasured.
- No restore was run, no deploy was started and no GitHub API write was made.

## Fixed Issues

### WR-01: `online` action ignores `dry_run` and really deletes `app_offline.htm`

**Files modified:** `web/scripts/deploy.mjs`, `web/scripts/deploy.test.ts`, `docs/operations/deploy.md`
**Commits:** 3b8a575 (RED), aac8dae (GREEN)
**Applied fix:** `onlineArgs` takes a `whatIf` flag and `planDeploy` passes `dryRun` to it, so `online` with `dry_run` is a `-whatif` delete and changes nothing. Two tests cover the plan and the end-to-end `main` run. `deploy.md` now says so in "Recover with the online action". Chosen over refusing, because the workflow input text promises a read-only check.

### WR-03: `hostprobe` action can replace a running CSPS site with the probe app; nothing enforces "once, before the first deploy"

**Files modified:** `web/scripts/deploy.mjs`, `web/scripts/deploy.test.ts`, `docs/operations/deploy.md`, `tools/Csps.HostProbe/README.md`
**Commits:** 5f142b8 (RED), 72d0de5 (GREEN)
**Applied fix:** before publishing or touching the host, the action lists the GitHub releases and refuses when any non-draft `deploy-*` release exists. It also refuses when the release list cannot be read (it cannot show CSPS is not live). There is deliberately no override: after the first deploy the `deploy` action is the only way to change the site, and a re-probe would need a reviewed code change on `main`. Documented in `deploy.md` and the probe README. Tests cover refuse, fail-closed, and "drafts and non-deploy tags do not block". The existing hostprobe tests were updated for the extra `gh release list` call.

### WR-04: Smoke `request-limit` check passes on any non-2xx answer, so it cannot show that the limit works

**Files modified:** `web/scripts/smoke.mjs`, `web/scripts/smoke.test.ts`
**Commits:** a463c0c (RED), 8bd3e64 (GREEN)
**Applied fix:** the check now passes only on a 413 (labelled "the app" for ProblemDetails, "IIS" otherwise), or on a connection closed while the body is sent. 200/2xx, 400, 401, 403, 404 and 500 all fail with "expected 413". The healthy-site fixture now answers 413 ProblemDetails.

### WR-05: `Restore-LegacyReceipt.ps1` drops the existing restore before validating the new `.bak`, and its default receipt path is a tracked file in a public repo

**Files modified:** `tools/scripts/Restore-LegacyReceipt.ps1`, `tests/Csps.ArchitectureTests/CutoverRunbookTests.cs`, `docs/operations/cutover-runbook.md`
**Commits:** 0dd9865 (RED), 4405b80 (GREEN)
**Applied fix:** (a) the `-Replace` drop moved after `RESTORE FILELISTONLY` and a new `RESTORE VERIFYONLY` (which checks backup checksums when the backup has them, and fails if the backup is unreadable), so a bad `.bak` never costs the existing restore. I used plain VERIFYONLY rather than `WITH CHECKSUM`, because a host-made backup may carry no checksums and `WITH CHECKSUM` would reject it. (b) The default receipt is now `_local\legacy-receipt.md` (git-ignored), and a `-ReceiptPath` inside the repository but outside `_local` is refused. Targets are unchanged: LocalDB default instance and `CSPS_Legacy_Restore` only. Two architecture tests pin the order and the path, and the runbook (Step 2) names the new path. The script parses cleanly; it was not run against a database, as instructed.

### WR-06: The whole "7 package" stage runs only on a push to `main`, so it has never run and a failure surfaces after the merge

**Files modified:** `.github/workflows/ci.yml`, `tests/Csps.ArchitectureTests/CiWorkflowTests.cs`, `docs/operations/ci.md`, `docs/development.md`
**Commits:** 6ef8e6c (RED), 26badcc (GREEN)
**Applied fix:** the web build, publish, migrations script, package check and gitleaks directory scan now run in `full` and `package` mode on pull requests too. Only `7 package upload` keeps `github.event_name == 'push'`. `CiWorkflowTests.PackageOnlyOnPushToMain` became `PackagePipelineRunsBeforeTheMergeAndOnlyTheUploadWaitsForPush`. Actions stay SHA-pinned, `permissions` unchanged, no new `${{ }}` inside `run:`. Docs describe stage 7 and note that the extra minutes are not yet measured.

## Skipped Issues

### WR-02: Certificate pin is checked on a separate connection, then `-allowUntrusted` turns off all validation for msdeploy

**File:** `web/scripts/deploy.mjs:104, 122, 346-352, 804-822`
**Reason:** skipped (code not changed), mitigated in the docs only (commit 10e154a). The only sound code fix is to make msdeploy validate the pinned certificate itself, for example by importing the verified leaf certificate into the runner's trust store and dropping `-allowUntrusted`. Whether that works depends on host facts that are not verified yet (the certificate chain, whether its name matches the Web Deploy address, and whether the host will ever present a Windows-trusted certificate), and it cannot be tested without a deploy. Re-checking the pin before each msdeploy call was rejected because an on-path attacker can relay the real certificate again each time, so it adds no real protection. Instead `docs/operations/cutover-runbook.md` (Step 5) and `docs/operations/deploy.md` now say plainly that the pin is a stop-gap, what the residual risk is, and that a Windows-trusted certificate (with the pin left unset) is the better outcome. Revisit after the host certificate facts are verified in the cutover.
**Original issue:** with a matching `WEBDEPLOY_CERT_SHA256`, every msdeploy call gets `-allowUntrusted` and sends the Basic-auth password, while the pin was verified only on a throwaway TLS connection (time-of-check to time-of-use, CWE-295).

---

_Fixed: 2026-10-16T17:15:00-05:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
