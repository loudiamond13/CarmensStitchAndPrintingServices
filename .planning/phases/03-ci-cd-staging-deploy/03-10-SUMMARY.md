---
phase: 03-ci-cd-staging-deploy
plan: 10
subsystem: secret-scanning
tags: [gitleaks, secret-scan, pre-commit, github-actions, checksum, ops-03, d-10, tracer]
created: "2026-10-16T00:40:00-05:00"
updated: "2026-10-16T00:40:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "Plan 03-01: WorkflowText reader and CiWorkflowTests rules that hygiene.yml must satisfy; owner approval of gitleaks 8.30.1 with both SHA-256 values in docs/dependencies.json"
provides:
  - ".github/workflows/hygiene.yml: workflow Hygiene, job secrets (check name 'secret scan') running a SHA-256 verified gitleaks 8.30.1 over the PR base..head or the pushed commit"
  - ".gitleaks.toml: default rules plus four file-scoped generic-api-key allowlists (15 named files); full history scans clean"
  - "tools/scripts/Install-Gitleaks.ps1 [-SetHooksPath]: pinned, hash-checked Windows installer into artifacts/tools/gitleaks/8.30.1"
  - ".githooks/pre-commit: scans staged changes; warns and passes without gitleaks; blocks on a finding"
  - "HygieneWorkflowTests (6 facts) and a developer-guide section 'Secret scan before every commit (D-10)'"
affects: [03-15, 03-11, ci-workflow, hygiene-workflow]

actuals:
  tokens: 5900
  tasks: 2
  commits: 4
plan_head_before: c83d1a505fb886b6fd22e2e4407ced31b43d31ed
plan_head_after: a6710561f6a1383a436bd4eec4ef57ba1ff32574

tech-stack:
  added: []
  patterns:
    - "A downloaded CI binary is used only after sha256sum -c (CI) or Get-FileHash (Windows) matches the owner-approved value; the same version and hashes are asserted by an architecture test"
    - "Allowlists are tables of exact file paths with a description and targetRules; a test rejects broad or path-less entries"
    - "Hooks live in .githooks (LF-pinned by .gitattributes); the installer sets only the repository-local core.hooksPath"

key-files:
  created:
    - .github/workflows/hygiene.yml
    - .gitleaks.toml
    - .githooks/pre-commit
    - tools/scripts/Install-Gitleaks.ps1
    - tests/Csps.ArchitectureTests/HygieneWorkflowTests.cs
  modified:
    - .gitattributes
    - docs/development.md

key-decisions:
  - "gitleaks is put on PATH for later steps ($GITHUB_PATH) after the checksum passes, so the scan step reads 'gitleaks git ...' and the download stays in $RUNNER_TEMP, outside the checked-out tree."
  - "The scan range comes from env only. A zero or unknown 'before' (new branch, rewritten history) scans the pushed commit alone (-1 HEAD) instead of failing on a missing object."
  - "Allowlist entries are scoped to rule generic-api-key and to exact files, grouped in four described tables, so any other rule firing in those files still fails the scan."
  - "The hook defines a shell function 'gitleaks' that calls the pinned local exe when present, otherwise uses gitleaks on PATH, so one command line serves both."

patterns-established:
  - "Plan 03-15 adds commit-lint and workflow lint jobs to the same hygiene.yml; CiWorkflowTests already apply to them."

requirements-completed: [OPS-03]

coverage:
  - id: D1
    description: "Every PR to main and push to main runs the secret scan job, which downloads gitleaks 8.30.1, refuses to run unless sha256sum -c matches the approved checksum, and scans base..head (or the pushed commit) with .gitleaks.toml and --redact"
    requirement: OPS-03
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/HygieneWorkflowTests.cs#CiScanIsPinnedAndChecked, HygieneTriggers"
        status: pass
      - kind: unit
        ref: "CiWorkflowTests (17 of 17) still pass with hygiene.yml present"
        status: pass
    human_judgment: true
    rationale: "The job's first run on GitHub is the integration proof; see the push and PR check result recorded in the plan close-out."
  - id: D2
    description: "The full repository history scans clean (1081 commits) with allowlists limited to named fixture and sample files, each with a description"
    requirement: OPS-03
    verification:
      - kind: command
        ref: "artifacts/tools/gitleaks/8.30.1/gitleaks.exe git --config .gitleaks.toml --redact . -> 'no leaks found', exit 0"
        status: pass
      - kind: unit
        ref: "HygieneWorkflowTests#AllowlistsAreNarrow"
        status: pass
    human_judgment: false
  - id: D3
    description: "Install-Gitleaks.ps1 downloads the pinned Windows zip, refuses it unless its SHA-256 is d29144de..., and with -SetHooksPath sets only the repository-local core.hooksPath"
    requirement: OPS-03
    verification:
      - kind: unit
        ref: "HygieneWorkflowTests#LocalInstallerMatchesCi"
        status: pass
      - kind: command
        ref: "Install-Gitleaks.ps1 -SetHooksPath ran; git config --local --get core.hooksPath prints .githooks"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pre-commit hook passes when nothing is staged, warns and passes when gitleaks is missing, and blocks the commit on a finding"
    requirement: OPS-03
    verification:
      - kind: unit
        ref: "HygieneWorkflowTests#HookScansStagedChanges, HookHasLfEndings"
        status: pass
      - kind: command
        ref: "Scratch repository run: nothing staged exit 0; fake AWS-style key staged exit 1 (2 findings, redacted); clean file exit 0; gitleaks missing prints the Install-Gitleaks.ps1 warning and exit 0. The scratch repository was deleted."
        status: pass
    human_judgment: true
    rationale: "The owner confirms once, in a scratch copy with the hook installed, that git commit is refused for a fake key (VALIDATION manual row)."

duration: 20min
completed: 2026-10-16
status: complete
---

# Phase 3 Plan 10: Secret scan in CI and before every commit Summary

**A checksum-verified gitleaks 8.30.1 scans every PR and push to main (`secret scan` check), the whole 1081-commit history scans clean under four file-scoped allowlists, and a pinned installer plus `.githooks/pre-commit` stop a staged secret before it becomes a commit.**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-10-16T05:15:00Z (approximate)
- **Completed:** 2026-10-16T05:36:00Z (approximate)
- **Tasks:** 2 (Task 1 tracer, Task 2 auto)
- **Files modified:** 7 (5 new, 2 edited)

## Accomplishments

- `hygiene.yml` (workflow `Hygiene`, job `secrets`, check name `secret scan`): top-level `permissions: {}`, job `contents: read`, 10-minute timeout, checkout with `fetch-depth: 0` and `persist-credentials: false`. It downloads `gitleaks_8.30.1_linux_x64.tar.gz` into `$RUNNER_TEMP`, runs `sha256sum -c` against `551f6fc8...470eb` before extracting, then runs `gitleaks git --config .gitleaks.toml --redact --verbose --log-opts=<range>`. Event values pass through `env:` only.
- Tracer result: the first full-history scan found 20 findings in 15 files (all rule `generic-api-key`), every one a sample password, token or phrase in a test, a fixture or a planning document. None was a real secret. After the allowlists the scan reports `no leaks found` (exit 0).
- `Install-Gitleaks.ps1` was run for real: it downloaded the zip, the SHA-256 matched `d29144de...afc4e`, and `gitleaks.exe` 8.30.1 was extracted to `artifacts/tools/gitleaks/8.30.1` (git-ignored). `-SetHooksPath` set the repository-local `core.hooksPath` to `.githooks`; the hook then ran on its own commit (`no leaks found`).
- Hook proof in a throwaway repository (deleted afterwards): nothing staged exit 0; a staged file with a fake AWS-style key pair was blocked (exit 1, 2 findings, values redacted); a clean file passed; with gitleaks absent the hook printed one warning naming `Install-Gitleaks.ps1` and exited 0.

## Allowlisted files (rule `generic-api-key` only; matched text is never recorded)

| File | Why it is allowlisted |
|------|-----------------------|
| `tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs` | fake test passwords for account creation |
| `tests/Csps.Infrastructure.IntegrationTests/Passwords/HibpPwnedPasswordsTests.cs` | fake password for the breached-password client test |
| `tests/Csps.Server.IntegrationTests/Auth/BreachRecheckTests.cs` | fake password for the breach re-check test |
| `tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs` | fake reset token argument |
| `tests/Csps.Server.IntegrationTests/Auth/MustChangePasswordTests.cs` | fake temporary password |
| `tests/Csps.Server.IntegrationTests/Auth/PasswordResetTests.cs` | fake new password and fake token |
| `tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs` | a sample value used to prove log masking |
| `tests/fixtures/password-policy-cases.json` | sample passwords for the shared password-policy cases |
| `web/scripts/smoke.test.ts` | fake key-like constants for a mocked API |
| `web/src/modules/admin/pages/AcceptInvitePage.test.tsx` | fake invite token |
| `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` | fake reset token |
| `.planning/phases/02-web-foundation-design-system/02-20-PLAN.md` | the hyphenated word "D-01-compliant" looks like a key |
| `.planning/phases/04-identity-authentication/04-08-PLAN.md` | plan text quoting a sample test password |
| `.planning/phases/04-identity-authentication/04-19-PLAN.md` | plan text quoting a sample new password |
| `.planning/phases/04-identity-authentication/04-CONTEXT.md` | a "temporary password example style" sample |

HostingRecordTests detector samples, the E2E passwords and the dev-secret scripts named in research Pitfall 11 did not trigger the default rules, so none of them needed an entry.

## Task Commits

1. **Task 1: Tracer, pinned CI scan and clean history**
   - `567bc71` (test, RED): 4 HygieneWorkflowTests facts, all failing because the files did not exist
   - `a40c292` (feat, GREEN): `Install-Gitleaks.ps1`, `.gitleaks.toml`, `hygiene.yml`, regex fix in the test; 4 of 4 and CiWorkflowTests 17 of 17 pass
2. **Task 2: Pre-commit hook and developer guide**
   - `a429cf0` (test, RED): HookScansStagedChanges and HookHasLfEndings, failing
   - `a671056` (feat, GREEN): `.githooks/pre-commit` (mode 100755), `.gitattributes` rule, developer-guide section

**Plan metadata:** the docs(03-10) commits that add this file and update STATE, ROADMAP and REQUIREMENTS.

## Files Created/Modified

- `.github/workflows/hygiene.yml` - Hygiene workflow, `secret scan` job
- `.gitleaks.toml` - `useDefault = true` plus four `[[allowlists]]` tables of exact file paths
- `.githooks/pre-commit` - POSIX sh hook over `gitleaks git --pre-commit --staged`
- `tools/scripts/Install-Gitleaks.ps1` - pinned installer, Windows PowerShell 5.1 and 7
- `tests/Csps.ArchitectureTests/HygieneWorkflowTests.cs` - six facts
- `.gitattributes` - `.githooks/** text eol=lf`
- `docs/development.md` - section "Secret scan before every commit (D-10)"

## Decisions Made

See `key-decisions` above. The scan uses `--log-opts` ranges rather than `--no-git` so only the commits in play are scanned, and a push to `main` is also covered by the PR scan that ran before the merge.

## Deviations from Plan

None - plan executed exactly as written. Two small points inside the plan's latitude: the test's path-shape regex was corrected once (a leading `\.` in `.planning` paths), and the scan step was changed to call `gitleaks` from `$GITHUB_PATH` so the command reads `gitleaks git`.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Issues Encountered

- `gitleaks dir` over the whole working tree (the plan's optional second check) reports 7 findings, all in git-ignored or untracked local folders: `.vs/`, `artifacts/hostprobe/`, `artifacts/tools/gitleaks/` (its own README), and two `bin/` copies of the password fixture. None is tracked, so none can reach history, and none was allowlisted (a path for build output would be a broad entry). The `artifacts/hostprobe/appsettings.json` file is a local host-probe file; the owner may want to check what it holds, but it is outside git and was not opened here.
- The CI job has not yet run on GitHub at the time of this summary; its result is recorded in the plan close-out message.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The new surface (a CI binary download, a local hook) is the plan's threat model: T-03-19 to T-03-22 and T-03-SC are mitigated by the checksum checks, the file-scoped allowlists and the repository-local hooks setting.

## Next Phase Readiness

Ready for plan 03-11. Plan 03-15 adds commit-lint and workflow lint jobs to `hygiene.yml`; the job `secrets` and check name `secret scan` stay as they are so the required-check name does not change.

## Self-Check: PASSED

- Files exist: hygiene.yml, .gitleaks.toml, .githooks/pre-commit, Install-Gitleaks.ps1, HygieneWorkflowTests.cs, .gitattributes edit, development.md edit.
- Commits found in history: 567bc71, a40c292, a429cf0, a671056.
- Acceptance: both SHA-256 greps return 1; `git check-attr eol -- .githooks/pre-commit` reports `eol: lf`; `Install-Gitleaks.ps1` appears twice in `docs/development.md`; `git config --local --get core.hooksPath` prints `.githooks`; ArchitectureTests 163 of 163 pass; full-history scan exit 0.
