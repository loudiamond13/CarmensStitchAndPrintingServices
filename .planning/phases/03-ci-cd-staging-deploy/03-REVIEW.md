---
created: 2026-10-16T15:30:00-05:00
updated: 2026-10-16T15:30:00-05:00
phase: 03-ci-cd-staging-deploy
reviewed: 2026-10-16T15:30:00-05:00
depth: standard
files_reviewed: 108
files_reviewed_list:
  - .claude/CLAUDE.md
  - .gitattributes
  - .githooks/pre-commit
  - .github/CODEOWNERS
  - .github/dependabot.yml
  - .github/pull_request_template.md
  - .github/workflows/ci.yml
  - .github/workflows/codeql.yml
  - .github/workflows/deploy.yml
  - .github/workflows/hygiene.yml
  - .github/workflows/weekly.yml
  - .gitleaks.toml
  - CLAUDE.md
  - Directory.Build.props
  - LICENSE
  - README.md
  - docs/dependencies.json
  - docs/dependencies.md
  - docs/development.md
  - docs/operations/branch-rules.md
  - docs/operations/ci.md
  - docs/operations/cutover-runbook.md
  - docs/operations/deploy.md
  - docs/operations/main-ruleset.json
  - docs/web/budgets.md
  - docs/web/e2e.md
  - docs/web/release-gates.md
  - src/Csps.Infrastructure/Email/EmailSenderOptions.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Server/Controllers/InviteController.cs
  - src/Csps.Server/Controllers/PasswordController.cs
  - src/Csps.Server/Csps.Server.csproj
  - src/Csps.Server/web.config
  - tests/Csps.Application.UnitTests/Auth/ListSessionsHandlerTests.cs
  - tests/Csps.ArchitectureTests/CiWorkflowTests.cs
  - tests/Csps.ArchitectureTests/CutoverRunbookTests.cs
  - tests/Csps.ArchitectureTests/DeployWorkflowTests.cs
  - tests/Csps.ArchitectureTests/HygieneWorkflowTests.cs
  - tests/Csps.ArchitectureTests/PublishOutputTests.cs
  - tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs
  - tests/Csps.ArchitectureTests/RepoRulesTests.cs
  - tests/Csps.ArchitectureTests/SecurityWorkflowTests.cs
  - tests/Csps.ArchitectureTests/WorkflowText.cs
  - tests/Csps.Domain.UnitTests/Time/TimeZoneResolverTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Content/SiteSettingsReaderTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Email/MailKitTransportTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs
  - tests/Csps.Server.IntegrationTests/Auth/ResendCodeEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Auth/SignInEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs
  - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
  - tools/Csps.HostProbe/README.md
  - tools/deploy/app_offline.htm
  - tools/scripts/Install-Gitleaks.ps1
  - tools/scripts/Invoke-CoverageGate.ps1
  - tools/scripts/Merge-PullRequest.ps1
  - tools/scripts/Restore-LegacyReceipt.ps1
  - web/e2e/a11y-rulings.spec.ts
  - web/e2e/fixtures.ts
  - web/e2e/public.spec.ts
  - web/e2e/smoke.spec.ts
  - web/e2e/sweep.ts
  - web/playwright.config.ts
  - web/scripts/budget.test.ts
  - web/scripts/budget.ts
  - web/scripts/ci-classify.mjs
  - web/scripts/ci-classify.test.ts
  - web/scripts/commit-lint.mjs
  - web/scripts/commit-lint.test.ts
  - web/scripts/deploy.mjs
  - web/scripts/deploy.test.ts
  - web/scripts/e2e.mjs
  - web/scripts/e2e.test.ts
  - web/scripts/font-metrics.test.ts
  - web/scripts/lighthouse-assert.mjs
  - web/scripts/lighthouse-assert.test.ts
  - web/scripts/lighthouse.mjs
  - web/scripts/merge-gate.mjs
  - web/scripts/merge-gate.test.ts
  - web/scripts/owner-review.mjs
  - web/scripts/package-check.mjs
  - web/scripts/package-check.test.ts
  - web/scripts/smoke.mjs
  - web/scripts/smoke.test.ts
  - web/scripts/vite-budget-plugin.test.ts
  - web/scripts/vite-route-preload-plugin.test.ts
  - web/src/components/overlays/Modal.test.tsx
  - web/src/components/overlays/Modal.tsx
  - web/src/core/routes/ErrorBoundary.test.tsx
  - web/src/core/routes/ErrorBoundary.tsx
  - web/src/core/routes/QueryRoot.test.tsx
  - web/src/core/routes/QueryRoot.tsx
  - web/src/core/routes/router.tsx
  - web/src/dev/ComponentShowcase.test.tsx
  - web/src/layouts/AdminLayout.test.tsx
  - web/src/layouts/PublicLayout.test.tsx
  - web/src/modules/admin/routes.test.tsx
  - web/src/modules/public/copy.ts
  - web/src/modules/public/pages/HoldingPage.test.tsx
  - web/src/modules/public/pages/HoldingPage.tsx
  - web/src/test/build-output.node.test.ts
  - web/src/test/publicLayoutRoutes.ts
  - web/src/ui/base.css
  - web/visual/reference/rulings.css
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-16T15:30:00-05:00
**Depth:** standard
**Files Reviewed:** 108
**Status:** issues_found

## Summary

The workflows, deploy/merge/classify/smoke scripts, PowerShell tools, web.config and the public-entry split were read in full. Test files, docs and CSS were read selectively (docs for secrets, infra ids and contradictions with the code).

The pipeline is in good shape on the points that matter most:

- All workflows start from `permissions: {}`, and every `uses:` is pinned to a full SHA.
- There is no `pull_request_target`, and no `${{ }}` of event data or inputs inside a `run:` (the PR title, SHAs, dispatch inputs and secrets all reach the scripts through `env:`).
- `deploy.mjs` spawns `msdeploy`, `gh`, `tar` and `node` directly with no shell, redacts the password, and validates the sha and the msdeploy-separator characters.
- The merge gate, the classifier and the package check all fail closed.
- No secret, host name, database name or infra id leaked into the reviewed files. The cutover runbook masks them as `sql####`, `win####` and `db_...`. The repo owner handle and ruleset ids in `branch-rules.md` are already public.

There are no blockers. The findings below are one real contract bug in the deploy script, two safety gaps in the deploy path, one smoke check that cannot fail on what it claims to prove, one place where a local tool can write production table facts into a now-public repo, and one coverage gap in the package pipeline.

## Warnings

### WR-01: `online` action ignores `dry_run` and really deletes `app_offline.htm`

**File:** `web/scripts/deploy.mjs:295-300` (also `.github/workflows/deploy.yml:20-23`, `docs/operations/deploy.md:41`)
**Issue:** `planDeploy` returns the one-step `online` plan before it looks at `dryRun`. The workflow input says `dry_run`: "Read-only check ... nothing is changed", and the runbook promises a dry run "changes nothing on the site". Running `-f action=online -f dry_run=true` therefore performs the real msdeploy delete. No test covers this combination (`deploy.test.ts` only plans `online` with `dryRun: false`). The harm is small because the action is a recovery step, but it breaks a stated safety contract of the one workflow that touches production.
**Fix:** Honour the flag for `online` too, either by refusing or by running a whatif delete:
```js
if (action === 'online') {
  if (dryRun) {
    throw new Error('dry_run does not apply to the online action; it only deletes app_offline.htm.');
  }
  return Object.assign([msdeployStep('online', onlineArgs({ ...connection, allowUntrusted }))], { rollback: null, onFailure: 'none' });
}
```
Add a test for `online` with `dryRun: true`.

### WR-02: Certificate pin is checked on a separate connection, then `-allowUntrusted` turns off all validation for msdeploy

**File:** `web/scripts/deploy.mjs:104, 122, 346-352, 804-822`
**Issue:** When `WEBDEPLOY_CERT_SHA256` matches, the script passes `-allowUntrusted` to every msdeploy call. msdeploy then accepts any certificate on its own connections, and the Basic-auth password is sent over them. The pin is verified only on a throwaway `tls.connect`. An on-path attacker who relays the real certificate during the pin probe, and intercepts the later msdeploy connections, is accepted (time-of-check to time-of-use, CWE-295). The runbook (Step 5) recommends this pin as the way to deal with an untrusted host certificate, so this will be the live configuration. It is only a risk to the extent an attacker is on path, but the cost of a leaked deploy credential plus the ability to push code is high.
**Fix:** Prefer a validation that msdeploy itself performs. If the host certificate chain is unusable, trust the pinned certificate on the runner for the msdeploy process (for example import the pinned leaf into the runner's `CurrentUser\Root` for the job, after verifying it matches the pin) instead of `-allowUntrusted`. At minimum, re-check the pin immediately before each msdeploy call, and document the residual risk in `deploy.md`.

### WR-03: `hostprobe` action can replace a running CSPS site with the probe app; nothing enforces "once, before the first deploy"

**File:** `web/scripts/deploy.mjs:319-324, 835-838`; `.github/workflows/deploy.yml:9-15`
**Issue:** The probe is published into the same site root with the normal sync (stale files deleted, no DoNotDeleteRule). The only guard is prose ("may be used only once, after the legacy site is retired and before the first CSPS deploy"). A mis-click of `hostprobe` after go-live would take the live site offline, wipe it, and leave a probe there. `onFailure: 'offline'` leaves the offline page up and there is no rollback, so recovery means another full deploy. This is a destructive operation on production behind a single dropdown.
**Fix:** Refuse by default when the target already looks like CSPS. For example, before planning, request `/health` on `SITE_ORIGIN` and abort if it answers 200 JSON with `status: Healthy`, unless an explicit extra input such as `confirm_replace_live: true` is set. Alternatively, remove the `hostprobe` option from the dispatch menu once the first deploy has happened.

### WR-04: Smoke `request-limit` check passes on any non-2xx answer, so it cannot show that the limit works

**File:** `web/scripts/smoke.mjs:507-528`
**Issue:** The check POSTs 1.5 MB to `/api/v1/__smoke` and passes on any status other than 2xx (and on a reset connection). An anonymous POST to an unknown API route is answered 401 or 404 by default-deny/routing whether or not any body limit exists, and the "refused by the app" label is chosen merely because the 401/404 is `application/problem+json`. A deploy with `maxAllowedContentLength` removed and the app's `RequestBodyLimitMiddleware` disabled would still print PASS. This is the deploy-keeping gate (a failing smoke triggers rollback), so a check that cannot fail is false assurance.
**Fix:** Require the specific refusal. The app's limit is 1 MiB and IIS's backstop 2 MiB, so 1.5 MB must reach the app and get a 413:
```js
if (response.status !== 413) {
  faults.push(`a 1.5 MB POST was answered ${String(response.status)}, expected 413`);
}
```
Keep the closed-connection branch only for the case where it is observed together with a 413 or a known IIS 404.13. Update `smoke.test.ts` accordingly.

### WR-05: `Restore-LegacyReceipt.ps1` drops the existing restore before validating the new `.bak`, and its default receipt path is a tracked file in a public repo

**File:** `tools/scripts/Restore-LegacyReceipt.ps1:101-103, 125-130 vs 133-154`
**Issue:** (a) With `-Replace`, `CSPS_Legacy_Restore` is dropped (lines 125-130) before `RESTORE FILELISTONLY` proves the new `.bak` is readable and restorable (lines 133-154). A corrupt or wrong file leaves no restored copy, and Step 2 of the cutover runbook leans on that copy. (b) The default `-ReceiptPath` is `.planning/phases/03-ci-cd-staging-deploy/03-LEGACY-RECEIPT.md`, a git-tracked folder, and the repository became public on 2026-10-16. The receipt holds every production table name and its row count, plus the `.bak` SHA-256. The script says "no data value", which is true, but schema names and per-table volumes of the live customer database are still business data, and the project rules say the repo is scanned for infra ids and production facts. The root `.gitignore` does not exclude this file. The runbook also tells Claude to paste the table list into chat.
**Fix:** (a) Run `FILELISTONLY` (and ideally `RESTORE VERIFYONLY`) first, then drop. (b) Default the receipt to a git-ignored place such as `_local/legacy-receipt.md`, or add `.planning/phases/03-ci-cd-staging-deploy/03-LEGACY-RECEIPT.md` to `.gitignore`, and let the owner decide what, if anything, is committed.

### WR-06: The whole "7 package" stage runs only on a push to `main`, so it has never run and a failure surfaces after the merge

**File:** `.github/workflows/ci.yml:277-318`; `docs/operations/ci.md:94`
**Issue:** Web rebuild, `dotnet publish -r win-x64 --no-restore`, `dotnet ef migrations script --idempotent`, `package-check.mjs`, the gitleaks directory scan and the artifact upload are all gated on `github.event_name == 'push'`. `ci.md` admits they are "not measured yet" because they need a merge. The first time any of them runs is on `main`, after the merge. Failure modes that nothing before the merge can catch include: `dotnet ef` needing something CI does not provide, `gitleaks dir` (run without `.gitleaks.toml`, over minified JS bundles) reporting a generic-key false positive, `package-check` finding an unexpected file, or the artifact name/path being wrong. `main` would then be red with no deployable package and a ruleset that forbids direct fixes. `PublishOutputTests` covers only the publish shape.
**Fix:** In `full` mode on pull requests, also run the package steps up to (not including) the upload, for example by dropping the `github.event_name == 'push'` condition from the build, publish, migrations script, package check and secret scan steps and keeping it only on `7 package upload`. The extra cost is a few minutes and it moves the first run in front of the merge.

## Info

### IN-01: Pre-commit hook fails open

**File:** `.githooks/pre-commit:16-20`
**Issue:** When gitleaks is not installed the hook prints a warning and exits 0, so a commit with a secret goes through unscanned. CI's secret scan and GitHub push protection are the backstop, but on a public repo a pushed secret is already exposed by the time CI reports.
**Fix:** Exit 1 with the install hint, so the developer has to run `Install-Gitleaks.ps1` or consciously use `--no-verify`.

### IN-02: SQL container password is exported to every later step through `GITHUB_ENV`

**File:** `.github/workflows/ci.yml:177-181`
**Issue:** `SQL_SA_PASSWORD` is masked, which is good, but writing it to `$GITHUB_ENV` puts it in the environment of every later step, including the third-party cache and upload actions. It is a throwaway loopback credential, so the impact is low.
**Fix:** Write it to a file under `$RUNNER_TEMP` and read it only in the three steps that need it, or set it with `env:` on just those steps from a step output.

### IN-03: Test-quality softening in the E2E helpers

**File:** `web/e2e/fixtures.ts:225-229`, `web/e2e/a11y-rulings.spec.ts:129-134`
**Issue:** (a) `expectNoAxeViolations` awaits `animation.finished` for every finite animation; a paused or never-started one would hang until the test timeout with no useful message. (b) The WebKit Tab-stop assertion is skipped for `/` and the `currentSeen` assertion for `/`, so the holding page is no longer checked for those rules at all.
**Fix:** (a) Race the wait against a short timeout and name the animation in the failure. (b) Assert the holding page's own expectation (for example the two links are reachable and focus order starts at the skip link) instead of skipping.

### IN-04: `Directory.Build.props` decides "is a src project" from a substring of the full path

**File:** `Directory.Build.props:21-23`
**Issue:** `$(MSBuildProjectDirectory.Contains('/src/'))` is true for any project whose absolute path contains `/src/`, for example a clone under `C:\src\csps`. That would also give test projects `GenerateDocumentationFile` and the new `RuntimeIdentifiers`, changing lock files. It is harmless on the CI runner and the current machine.
**Fix:** Compare against the repository-relative path, for example `$([MSBuild]::MakeRelative('$(MSBuildThisFileDirectory)', '$(MSBuildProjectDirectory)')).StartsWith('src')`.

### IN-05: Failed redeploy of the live build rolls back to an older release, not to itself

**File:** `web/scripts/deploy.mjs:187-197`
**Issue:** `selectLastGood` skips releases with the same sha suffix "so a failed redeploy never rolls back onto itself". When a redeploy of the live commit X fails half way, the site is left in a mixed state and the rollback target becomes the previous release Y, which is a downgrade, over a database that may already have forward-only migrations (the runbook warns about exactly this). Restoring X's own release is the correct recovery here.
**Fix:** If the sha being deployed has its own release, use it as the rollback target when it is the newest; otherwise use the newest other release.

### IN-06: Dispatching `deploy.yml` from a non-main branch ends in a skipped (not failed) run

**File:** `.github/workflows/deploy.yml:41`, `docs/operations/deploy.md:5, 127`
**Issue:** The docs say the workflow "refuses to run from any other branch". In fact the job is skipped, so the run shows as skipped/neutral and can be mistaken for a deploy that happened. Cosmetic, but the one safe-guard on a production workflow should be loud.
**Fix:** Add a first step (or a tiny always-run job) that fails with "Deploy runs only from main" when `github.ref != 'refs/heads/main'`, or reword the docs to "does nothing".

---

_Reviewed: 2026-10-16T15:30:00-05:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
