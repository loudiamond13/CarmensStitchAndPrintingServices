---
created: "2026-10-17T10:15:00-05:00"
updated: "2026-10-17T10:15:00-05:00"
phase: 03-ci-cd-staging-deploy
kind: api-coverage
---

# API Coverage: Phase 3 external services

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Phase 3 adds no outside service to the app itself. The pipeline talks to two: GitHub (Actions, the REST API through `gh`, Dependabot and the free security features) and the SmarterASP.NET Web Deploy endpoint (`msdeploy`). All of it is free on GitHub Free with a public repo and on the existing Basic hosting plan; paid GitHub Code Security is out under the free-only rule.

## GitHub (Actions, REST API via `gh`, Dependabot)

| capability | decision | reason |
|---|---|---|
| actions-workflows-ci-and-deploy | INTEGRATE | |
| actions-workflow-dispatch | INTEGRATE | |
| actions-environment-approval | OPT-OUT | not needed: the manual approval is the owner starting deploy.yml by hand (workflow_dispatch) |
| actions-secrets | INTEGRATE | |
| actions-artifacts-and-cache | INTEGRATE | |
| actions-scheduled-runs | INTEGRATE | |
| rest-pull-requests-merge | INTEGRATE | |
| rest-repository-rulesets | INTEGRATE | |
| dependabot-version-and-security-updates | INTEGRATE | |
| dependency-review | INTEGRATE | |
| codeql-code-scanning | INTEGRATE | |
| github-code-security-paid | OPT-OUT | explicitly out of scope: paid feature (free-only rule); gitleaks, zizmor, CodeQL and npm/NuGet audit cover it |
| github-pages-and-releases | OPT-OUT | not needed: the app is hosted on SmarterASP.NET and deploy packages are workflow artifacts |
| actions-self-hosted-runners | OPT-OUT | not needed: GitHub-hosted ubuntu and windows runners are enough |
| auto-merge | OPT-OUT | explicitly forbidden: merges go only through Merge-PullRequest.ps1 on the owner's instruction (D-08) |
| deployments-and-staging-environments | OPT-OUT | explicitly out of scope: the Basic plan has no staging slot; production deploys need manual approval |

## SmarterASP.NET Web Deploy (msdeploy)

| capability | decision | reason |
|---|---|---|
| webdeploy-sync-package | INTEGRATE | |
| webdeploy-branded-app-offline-upload | INTEGRATE | |
| webdeploy-delete-stale-files | INTEGRATE | |
| webdeploy-skip-rules | INTEGRATE | |
| webdeploy-basic-auth-over-https | INTEGRATE | |
| webdeploy-dbfullsql-provider | OPT-OUT | explicitly forbidden: production schema changes are reviewed idempotent scripts the owner applies, never pushed by deploy |
| webdeploy-appoffline-rule | OPT-OUT | not needed: a branded app_offline.htm is uploaded first instead of msdeploy's generic AppOffline rule |
| host-control-panel-api | OPT-OUT | not needed: host settings are a one-time owner checklist (no API on the Basic plan) |
