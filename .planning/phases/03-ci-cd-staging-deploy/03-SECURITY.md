---
phase: "03"
slug: "ci-cd-staging-deploy"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-10-17T11:21:53-05:00"
updated: "2026-10-17T11:21:53-05:00"
---

# Phase 03: Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The repo is public. This file holds no secrets, host names, database or server names, connection strings or certificate hashes.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| PR content → GitHub runner | Branch names, PR titles, commit messages and code from a PR reach workflows | Untrusted free text and code |
| Third-party action code → runner | Pinned actions and CI binaries run with the job token | Job token, repo contents |
| Runner → repository | The job token can read the repo, and the deploy job can create releases | Repo contents, releases |
| GitHub API / gh output → gate and classify decisions | API answers decide merge, skip and full-suite choices | Check states, tree ids, PR file lists |
| Dependabot → repository | Automated PRs propose new third-party versions | Dependency versions |
| Process environment → seed and bootstrap tools | A connection string chooses which database a tool writes to | Connection strings (secret) |
| Runner → loopback SQL container | CI test data and a generated SA password stay inside the run | Generated password (secret) |
| Runner → artifacts and releases | Failure reports and deploy packages leave the runner | Test reports, deploy package |
| GitHub runner → host Web Deploy (port 8172) | Credentials and the package cross the internet | Web Deploy credentials (secret), package |
| Workflow dispatch inputs → deploy script | The owner's inputs choose what is deployed | Action name, commit sha |
| Smoke runner → live site | Read-only checks from GitHub's network; the verdict keeps or rolls back a deploy | HTTP statuses and headers |
| Public visitor → holding page | Anyone reads the page and follows its links | Public contact facts |
| Developer → git history | Anything committed is kept forever and is public | All committed content |
| Owner's .bak → shared LocalDB | Production data restored on an instance TheBETSLLC also uses | Legacy production data (sensitive) |
| Host database → owner's PC | Legacy data copied off the host before its deletion | Legacy production data (sensitive) |
| Owner → host control panel and GitHub secrets | Production secrets typed into the host and GitHub only | Certificate, connection string, deploy credentials (secret) |
| Claude → project contract and repo settings | ROADMAP, REQUIREMENTS, PROJECT and repo settings change with owner approval | Planning text, settings |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | Mutable action tags (CWE-829) | high | mitigate | Full SHA pins with version comments; `EveryUsesIsAnApprovedShaPin`; live `sha_pinning_required` | closed |
| T-03-02 | Elevation of Privilege | GITHUB_TOKEN scope (CWE-250) | high | mitigate | Top-level `permissions: {}`; gate `contents: read`; `CiJobsNeverGrantWrite` | closed |
| T-03-03 | Information Disclosure | Token left in .git/config | medium | mitigate | `persist-credentials: false` on every checkout; `CheckoutNeverPersistsCredentials` | closed |
| T-03-04 | Tampering | Template injection via event data (CWE-77) | high | mitigate | Event data only through `env:`; `NoExpressionSinkInRun` | closed |
| T-03-05 | Information Disclosure | `pull_request_target` with secrets | high | mitigate | Banned; `NoWorkflowUsesPullRequestTarget` | closed |
| T-03-06 | Denial of Service | Runaway job spending minutes | medium | mitigate | `timeout-minutes` on every job; PR runs cancel superseded runs; `EveryJobHasATimeout` | closed |
| T-03-07 | Repudiation | Unreviewed Phase 4 work reaching main | low | mitigate | Owner decision `ship-phase-4-first` (03-01-SUMMARY) | closed |
| T-03-08 | Tampering | E2E connection pointing the seed at a real server | high | mitigate | `DevSeedTargetGuard.Check` before any connection (`tools/Csps.DevSeed/Program.cs`) | closed |
| T-03-09 | Information Disclosure | Container password in logs (CWE-532) | medium | mitigate | `executeSteps` prints names and exit codes only; `::add-mask::` in `ci.yml` | closed |
| T-03-10 | Elevation of Privilege | Merging with red, pending or zero checks | high | mitigate | Fail-closed `decide()` in `merge-gate.mjs`; unit-tested | closed |
| T-03-11 | Tampering | Push between gate check and merge (TOCTOU) | medium | mitigate | `--match-head-commit` in `Merge-PullRequest.ps1` | closed |
| T-03-12 | Spoofing | Skip-token head smuggling untested code | high | mitigate | Skip only for `.planning/`-only, single-parent heads (`merge-gate.mjs`) | closed |
| T-03-13 | Repudiation | Local-gate mode misuse | low | accept | See Accepted Risks Log AR-03-01 | closed |
| T-03-14 | Tampering | Code change classified as docs (CWE-693) | high | mitigate | Strict docs matcher; any doubt gives full (`ci-classify.mjs`) | closed |
| T-03-15 | Tampering | main skipping the suite for an unproven tree | high | mitigate | `findProvenTree`: equal tree id plus successful `gate (full)` on the PR head | closed |
| T-03-16 | Elevation of Privilege | Unreviewed changes to .github/ | low | mitigate | CODEOWNERS covers `/.github/`; ruleset has no bypass | closed |
| T-03-17 | Tampering | Dependabot adopting a fresh malicious release | high | mitigate | 14-day cooldown per ecosystem; `DependencyRegistryTests` | closed |
| T-03-18 | Information Disclosure | Repo public with planning data | low | accept | See Accepted Risks Log AR-03-02 | closed |
| T-03-19 | Information Disclosure | Secrets committed (CWE-798, CWE-312) | high | mitigate | gitleaks on every PR and push plus pre-commit hook; full-history scan clean | closed |
| T-03-20 | Tampering | Binary download without integrity check (CWE-494) | high | mitigate | SHA-256 verified before extraction in CI and locally | closed |
| T-03-21 | Information Disclosure | Over-broad gitleaks allowlist | medium | mitigate | Single-file, described allowlists; `AllowlistsAreNarrow` | closed |
| T-03-22 | Elevation of Privilege | Installer changing machine settings | medium | mitigate | Only `git config --local core.hooksPath`; `LocalInstallerMatchesCi` | closed |
| T-03-23 | Tampering | Unknown workflow attack patterns | medium | mitigate | actionlint and zizmor on every PR, pinned, required checks | closed |
| T-03-24 | Tampering | PR title injected into a shell (CWE-77) | high | mitigate | Title through `env:`; `CommitMessagesJob` | closed |
| T-03-25 | Information Disclosure | Web Deploy password in logs (CWE-532) | high | mitigate | `redact()` on every printed command; live deploy log masked | closed |
| T-03-26 | Spoofing | Unverified Web Deploy TLS (CWE-295) | high | mitigate | `allowUntrusted` only after a SHA-256 pin match; live deploy used verified TLS | closed |
| T-03-27 | Denial of Service | Site broken after a failed deploy | high | mitigate | Rollback to last good release, offline page, `online` action; tested | closed |
| T-03-28 | Tampering | Deploying a build that never passed CI | high | mitigate | `findPackage` takes only a successful main push run for that sha or a deploy release | closed |
| T-03-29 | Tampering | msdeploy argument injection (CWE-88) | medium | mitigate | 40-hex sha check, `assertPlain`, pure argument builder, no shell | closed |
| T-03-30 | Information Disclosure | Probe key leaked or probe reachable | medium | mitigate | Key from a secret, redacted, temp folder only; 401 without key; probe replaced | closed |
| T-03-31 | Tampering | Sync deleting host logs | medium | mitigate | `-skip` for logs and `app_offline.htm`; seen in the live log | closed |
| T-03-32 | Repudiation | Vacuous smoke pass | high | mitigate | No redirect following; content-type, status and field checks (`smoke.mjs`) | closed |
| T-03-33 | Information Disclosure | Bodies or probe key in CI logs | low | mitigate | Statuses and needed headers only; key shown as `[hidden]` | closed |
| T-03-34 | Information Disclosure | Dev logs and settings in the package (CWE-200) | high | mitigate | csproj removes `logs\**` and dev settings; `PublishOutputTests` sentinel | closed |
| T-03-35 | Information Disclosure | BREACH through IIS JSON compression | medium | mitigate | `urlCompression` off; smoke `json-not-compressed` passed live | closed |
| T-03-36 | Information Disclosure | Server and X-Powered-By banners | low | mitigate | `removeServerHeader`, X-Powered-By removed; smoke `no-banners` passed live | closed |
| T-03-37 | Tampering | Lock-file drift or unreviewed RID packages | medium | mitigate | Only the `net10.0/win-x64` section added; locked restore in CI | closed |
| T-03-38 | Spoofing | Wrong contact facts on the holding page | medium | mitigate | Owner-supplied facts; tests refuse placeholders and `#` links | closed |
| T-03-39 | Tampering | Reverse tabnabbing | low | mitigate | `rel="noopener noreferrer"`, tested | closed |
| T-03-40 | Tampering | Inline style breaking strict CSP | medium | mitigate | Utilities only; no `[style]` test; E2E CSP listener | closed |
| T-03-41 | Information Disclosure | Container SA password (CWE-798) | medium | mitigate | Generated per run, masked, bound to 127.0.0.1; tested | closed |
| T-03-42 | Information Disclosure | Failure artifacts carrying secrets | low | mitigate | Playwright report and results only, on failure, 7 days; tested | closed |
| T-03-43 | Tampering | CI reaching the production database | high | mitigate | No production secret outside `deploy.yml`; `NoWorkflowCarriesAProductionSecret` | closed |
| T-03-44 | Information Disclosure | Secrets or dev files in the package (CWE-312) | high | mitigate | Fail-closed `package-check.mjs` plus `gitleaks dir` before upload | closed |
| T-03-45 | Denial of Service | `app_offline.htm` shipped in a package | medium | mitigate | Package check refuses it at the root, any case | closed |
| T-03-46 | Denial of Service | Artifact pool filling up | low | accept | See Accepted Risks Log AR-03-03 | closed |
| T-03-47 | Elevation of Privilege | Deploy triggered by anyone but the owner | high | mitigate | `workflow_dispatch` only, main-only job; `DeployIsManualOnly`, `DeployRunsOnlyFromMain` | closed |
| T-03-48 | Tampering | Injection through dispatch inputs (CWE-77) | high | mitigate | Inputs through `env:`; script validates action and sha | closed |
| T-03-49 | Elevation of Privilege | `contents: write` used beyond releases | medium | mitigate | Granted to the deploy job only; `DeployHasLeastPrivilege` | closed |
| T-03-50 | Elevation of Privilege | Repo secrets readable by any workflow | medium | accept | See Accepted Risks Log AR-03-04 | closed |
| T-03-51 | Denial of Service | Concurrent deploys | medium | mitigate | Group `deploy-production`, never cancels; `DeployNeverCancels` | closed |
| T-03-52 | Information Disclosure | Legacy values copied into git via the receipt | high | mitigate | Catalog metadata only; `ReceiptScriptReadsMetadataOnly` | closed |
| T-03-53 | Tampering | Restoring over the wrong database | high | mitigate | Fixed server and database, exact-name drop; `ReceiptScriptHasFixedTargets` | closed |
| T-03-54 | Information Disclosure | The .bak leaving `_local/` | high | mitigate | Path refused outside `_local`; `_local/` and `*.bak` git-ignored | closed |
| T-03-55 | Tampering | Repo settings changed without approval | low | mitigate | Owner-approved items, read back from the API (03-16-SUMMARY) | closed |
| T-03-56 | Repudiation | Flaky gate "fixed" by lowering thresholds | medium | mitigate | `retries: 0`; thresholds unchanged; LCP report-only is an owner decision | closed |
| T-03-57 | Elevation of Privilege | Merge without green checks or owner go | high | mitigate | All PRs via `Merge-PullRequest.ps1` after the owner's "merge"; ruleset requires 8 checks | closed |
| T-03-58 | Denial of Service | Losing legacy data on host delete | high | mitigate | .bak in two off-host places, verified restore, owner "confirmed-go" (03-CUTOVER-LOG) | closed |
| T-03-59 | Information Disclosure | Host details pasted with secrets | high | mitigate | Names masked; `HostingRecordTests.ContainsNoSecrets` | closed |
| T-03-60 | Elevation of Privilege | App runs as db_owner | medium | accept | See Accepted Risks Log AR-03-05 | closed |
| T-03-61 | Denial of Service | Certificate value cut off in settings | low | accept | See Accepted Risks Log AR-03-06 | closed |
| T-03-62 | Information Disclosure | Probe key leaked or probe reachable | medium | mitigate | Key never printed; `HOSTPROBE_KEY` deleted; probe gone after first deploy | closed |
| T-03-63 | Spoofing | Accepting an untrusted Web Deploy cert (CWE-295) | high | mitigate | Conditional path not taken: verified TLS succeeded; no pin secret exists | closed |
| T-03-64 | Denial of Service | First deploy failing with nothing to roll back to | high | mitigate | Host proven first; first deploy passed 12 of 12 smoke checks; failure path tested | closed |
| T-03-65 | Information Disclosure | Hosted connection string exposed while bootstrapping | medium | mitigate | `--connection` rejected; env var or hidden prompt; masked in messages | closed |
| T-03-66 | Tampering | Wrong or unreviewed schema script applied | high | mitigate | CI-built idempotent script of the deployed sha; applied count matched (03-CUTOVER-LOG) | closed |
| T-03-67 | Repudiation | Contract text changed without approval | medium | mitigate | Owner approval recorded verbatim (03-23-SUMMARY) | closed |
| T-03-68 | Tampering | Wide replacement dropping phases or rows | medium | mitigate | Scoped edits; commits limited to ROADMAP, REQUIREMENTS, PROJECT | closed |
| T-03-69 | Information Disclosure | Legacy or host details in planning docs | low | mitigate | Only approved blocks written; receipt stays in `_local`; gitleaks clean | closed |
| T-03-SC | Tampering | Supply chain (actions, CI binaries, packages) | high | mitigate | Owner approvals in `docs/dependencies.json` before any pin; SHAs and checksums match upstream | closed |

*Status: open · closed · open, below high threshold (non-blocking)*
*Severity: critical > high > medium > low. Only open threats at or above `workflow.security_block_on` count toward threats_open.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-13 | Local-gate merge only when CI minutes run out. It prints a loud warning and needs the pasted local gate output in the PR body (`merge-gate.mjs`, `docs/operations/branch-rules.md`). Moot while the repo is public, since runners are free. | Owner (plan 03-03) | 2026-10-17 |
| AR-03-02 | T-03-18 | No plan changes repo visibility. The owner made the repo public on 2026-10-16 as a deliberate decision. Compensating controls: gitleaks on every PR and push, the pre-commit hook, `HostingRecordTests` detectors, masked database names. | Owner (plan 03-05; public on 2026-10-16) | 2026-10-17 |
| AR-03-03 | T-03-46 | 14-day artifact retention (`ci.yml`). The package grew to about 60 MB once self-contained; measured storage is well under the free pool. | Owner (plan 03-13) | 2026-10-17 |
| AR-03-04 | T-03-50 | GitHub Free private repos had no environment secrets; the owner is the only writer and CODEOWNERS covers `.github/`. Recorded in `docs/operations/deploy.md` "Who can deploy". Revisit if anyone else gets write access. | Owner (plan 03-12) | 2026-10-17 |
| AR-03-05 | T-03-60 | The Basic plan's hosting login owns the database (`HOSTING-RECORD.md`). Since reduced: the live site connects as a read and write user, not the owner login. | Owner (plan 03-19) | 2026-10-17 |
| AR-03-06 | T-03-61 | The app refuses to start on a bad certificate (fail closed) and the first smoke would catch it. Actual outcome: the value saved in full and the live site decrypts with its key ring. | Owner (plan 03-20) | 2026-10-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags (non-blocking)

Found by the code review or the auditor; none maps to a threat ID and none blocks the phase.

| Flag | Source | Status | Note |
|------|--------|--------|------|
| Data Protection private key file can stay on disk after a forced stop or crash, and `BootstrapManager` can leave one behind (CWE-312, CWE-459) | 03-REVIEW WR-01, WR-02 | open in 03-REVIEW-DISPOSITION | No cleanup note in the operations docs yet |
| HTTP-to-HTTPS rule redirects to `https://{HTTP_HOST}/...` (open redirect, CWE-601) | 03-REVIEW IN-02 | open in 03-REVIEW-DISPOSITION | Rule confirmed in `src/Csps.Server/web.config` and the deployed package |
| Two HostProbe runs printed the probe's JSON facts (host content-root path, caller address) into public Actions logs | Auditor | owner action | Owner may delete those two run logs; probe is disabled, so this cannot recur |

Informational: the T-03-26 pin is checked on a separate TLS connection before `-allowUntrusted` applies (skipped review item, documented in `deploy.md`, path unused); `smoke.mjs probe` prints probe facts by design; the pre-commit hook fails open when gitleaks is missing (CI is the backstop).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-17 | 70 | 70 | 0 | gsd-security-auditor (sonnet), ASVS L1, block_on high |

Evidence base: 564 script tests and 169 architecture tests passing; a full-history gitleaks scan of 2233 commits found nothing; the 8 action SHAs and the gitleaks and actionlint checksums match upstream; live ruleset, secrets list and first-deploy log checked; the deployed package passes `package-check.mjs` and `gitleaks dir`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-17
