# API Coverage: GitHub REST API (through the gh CLI) and the ghcr.io registry

*Created: 2026-11-27T08:52:00-06:00 · Updated: 2026-11-27T08:52:00-06:00*

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Phase 14 adds no new third-party service to the app. The detector fired on the GitHub API, which Phase 14 uses from tooling only: `deploy.mjs` looks up a ZAP run for a commit (14 D-38), the same way it already looks up the CI package, and a few one-off evidence and triage steps read or update repository security state on the owner's word. The scanners (ZAP, Lighthouse) only read this project's own app.

| capability | decision | reason |
|---|---|---|
| List workflow runs of zap.yml by commit and status (deploy.mjs findZapRun, plan 14-21) | INTEGRATE | |
| Read open code-scanning alerts for the pull request head (plan 14-27) | INTEGRATE | |
| Read open secret-scanning alerts (plan 14-27) | INTEGRATE | |
| Download workflow run artifacts (ZAP and live-audit reports, plan 14-27) | INTEGRATE | |
| Dismiss Dependabot alert 6 with the owner-approved reason (plan 14-14) | INTEGRATE | |
| Read the ghcr.io manifest digest of the ZAP image (plan 14-01 check, read only) | INTEGRATE | |
| Dispatch workflows from scripts | OPT-OUT | explicitly out of scope: the owner starts zap.yml, the deploy and the live audit from the Actions page (14 D-01, D-38) |
| Write GitHub issues or pull request comments from a scanner | OPT-OUT | explicitly out of scope: the repository is public and ZAP findings must not be filed as public issues (RESEARCH Alternatives Considered) |
| Dismiss code-scanning alerts | OPT-OUT | not needed: alerts are fixed in code (plan 14-03, 14 D-39); any dismissal needs a named owner ruling first |
