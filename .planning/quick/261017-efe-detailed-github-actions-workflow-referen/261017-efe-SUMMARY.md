---
created: 2026-10-17T10:43:00-05:00
updated: 2026-10-17T10:43:00-05:00
phase: quick-261017-efe
plan: 01
subsystem: ci-docs
tags: [docs, github-actions, dependabot, ci]
requires: []
provides:
  - "docs/operations/ci.md section 'Workflows at a glance': per-workflow reference for ci.yml, weekly.yml, codeql.yml, hygiene.yml, deploy.yml and dependabot.yml"
affects: [docs/operations/ci.md]
tech-stack:
  added: []
  patterns: ["step names in backticks equal the YAML name: values, checked by a node script"]
key-files:
  created: []
  modified: [docs/operations/ci.md]
decisions:
  - "Appended the new section at the end of ci.md so the existing story and anchors stay unchanged"
  - "Linked to existing sections and to deploy.md instead of restating them"
metrics:
  duration: "about 10 minutes"
  completed: 2026-10-17
status: complete
actuals:
  tokens: 6800
  tasks: 2
  commits: 2
plan_head_before: 656895ffddf3e4c1021e91ae4730c0cd4bc73982
plan_head_after: 0fd2f112a588a9e6a5d30fac0a8337f53babfb23
---

# Phase quick-261017-efe Plan 01: Detailed GitHub Actions workflow reference Summary

A new last section, "Workflows at a glance", in `docs/operations/ci.md` explains every workflow and Dependabot in plain English: trigger, permissions, concurrency, runner, time limit, and every job and step with what it checks, what a failure means and how to fix it.

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Tracer: skeleton, summary table, Hygiene and Dependabot subsections, header and CodeQL time fix | 685967c | docs/operations/ci.md |
| 2 | Expand: CI, Weekly, CodeQL and Deploy subsections, then the doc suites | 0fd2f11 | docs/operations/ci.md |

## What changed in ci.md

- Header: Updated is now a 2026-10-17 time; Created is unchanged.
- Intro: one sentence pointing to the new last section.
- Security scans bullet: the CodeQL weekly time now reads 19:23 UTC (Monday 03:23 in Manila), matching the cron `23 19 * * 0`.
- New `## Workflows at a glance`: summary table (every workflow file and every job check name), the rules every workflow follows, and subsections for CI, Weekly, CodeQL, Hygiene, Deploy and Dependabot. Step names match the YAML `name:` values exactly.
- Existing sections are linked, not repeated. Deploy links to `deploy.md`; secrets are named, never valued.

## Verification

- Section check (`all`): OK for ci.yml, weekly.yml, codeql.yml, hygiene.yml, deploy.yml, dependabot.yml. Every job and step name, the Dependabot terms and every anchor resolve. It failed first with "no Workflows at a glance section" (red step), and also caught a missing lowercase "monthly" before the tracer commit (fixed).
- Guard check: no long dash, header Updated is 2026-10-17, CodeQL time 19:23 UTC, no hosting names.
- `web/src/test/no-long-dash.node.test.ts`: 1 passed.
- `dotnet test --project tests/Csps.ArchitectureTests`: 217 passed, 0 failed (preflight showed no TheBETSLLC test processes and the ports free).
- gitleaks (`--pre-commit --staged`) found nothing before each commit.
- Both commits contain only `docs/operations/ci.md`. The untracked files and the modified `.planning/state.json` that were already in the tree are still uncommitted.

## Deviations from Plan

None. The plan was executed as written. The two verify node commands were saved as script files in the scratchpad (same code) to avoid shell quoting, and run from there.

## Follow-ups (not fixed, out of scope)

- `.github/workflows/codeql.yml` header comment (line 5) still says "Sunday 19:00 UTC", but the cron is `23 19 * * 0` (19:23 UTC). ci.md now says 19:23. The comment should be rounded the same way in a later change that is allowed to touch the workflow.

## Known Stubs

None.

## Threat Flags

None. Documentation only; no new endpoints, auth paths or trust boundaries.

## Self-Check: PASSED

- docs/operations/ci.md exists and contains `## Workflows at a glance`.
- Commits 685967c and 0fd2f11 are ancestors of HEAD.
