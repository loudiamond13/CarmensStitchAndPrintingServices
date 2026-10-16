---
phase: 03-ci-cd-staging-deploy
plan: 05
subsystem: repo-rules
tags: [github, codeowners, pull-request-template, dependabot, ruleset, d-08, d-09, d-10, d-16]
created: "2026-10-15T22:48:00-05:00"
updated: "2026-10-15T22:48:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-CONTEXT decisions D-08, D-09, D-10, D-16 and the shared PR-body headings contract with plan 03-03"
provides:
  - ".github/CODEOWNERS naming @loudiamond13 for every path and /.github/"
  - ".github/pull_request_template.md with the 12 PRD section 22 Definition of Done items and the D-16 Local full gate section"
  - ".github/dependabot.yml: nuget, npm (two manifests) and github-actions, monthly, grouped, 14-day cooldown"
  - "docs/operations/branch-rules.md and docs/operations/main-ruleset.json: intended rules, ready for gh api"
  - "RepoRulesTests: 11 facts that keep all of the above from drifting"
affects: [03-03, 03-16, merge-gate, ci-workflow]

actuals:
  tokens: 6300
  tasks: 3
  commits: 6
plan_head_before: 056c577419abb968e42be951bb5c60495164b07b
plan_head_after: fd798dcbc391f2195f40251cc760e52b8e4eb608

tech-stack:
  added: []
  patterns:
    - "Repository rules asserted by line-based architecture tests (no YAML package): a missing file reads as no lines, so a test fails on its assertion rather than an IO error"

key-files:
  created:
    - .github/CODEOWNERS
    - .github/pull_request_template.md
    - .github/dependabot.yml
    - docs/operations/branch-rules.md
    - docs/operations/main-ruleset.json
    - tests/Csps.ArchitectureTests/RepoRulesTests.cs
  modified:
    - CLAUDE.md
    - .claude/CLAUDE.md

key-decisions:
  - "The PR template carries its timestamps in one HTML comment on line 1 so they never render into a PR body (owner-visible exception to the timestamp rule)."
  - "The ruleset leaves require_code_owner_review false: with 0 approvals and a single owner, requiring a code owner review would block every PR."
  - "branch-rules.md does not pick the /gsd-ship [ci skip] rule; it points to the owner ruling that plan 03-03 records in merge-gate.mjs."
  - "The template's Local full gate lines carry no pre-filled exit code; the test refuses an 'exit 0' on any command line there."

requirements-completed: [OPS-01, OPS-03]

coverage:
  - id: D1
    description: "CODEOWNERS names @loudiamond13 for every path and for /.github/"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/RepoRulesTests.cs#CodeownersNamesTheOwner"
        status: pass
    human_judgment: false
  - id: D2
    description: "The PR template has the 12 unticked PRD section 22 items in PRD order, the CodeQL clause replaced, a Conventional Commits title line, the Local full gate section, and timestamps only in an HTML comment"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "RepoRulesTests#TemplateCarriesTheDefinitionOfDone, TemplateHasTheLocalGateSection, TemplateKeepsTimestampsOutOfThePrBody, TemplateAsksForAConventionalTitle"
        status: pass
    human_judgment: false
  - id: D3
    description: ".gitignore keeps every PRD section 18 entry"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "RepoRulesTests#GitignoreHasThePrdEntries"
        status: pass
    human_judgment: false
  - id: D4
    description: "branch-rules.md, main-ruleset.json and the CLAUDE.md merge rule describe the process gate and the rules ready to switch on"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "RepoRulesTests#BranchRulesDocCoversTheProcessGate, RulesetIsReadyToApply, ClaudeFilesStateTheMergeRule"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dependabot covers nuget, npm (both manifests in one entry) and github-actions, monthly, grouped, Conventional Commits prefixes, 14-day cooldown on each"
    requirement: OPS-03
    verification:
      - kind: unit
        ref: "RepoRulesTests#DependabotCoversEveryEcosystem, DependabotWaitsFourteenDays"
        status: pass
    human_judgment: false
  - id: D6
    description: "GitHub-enforced protection of main is not met (GitHub Free private repo); it is met by the owner-accepted process gate plus squash-only merges"
    requirement: OPS-01
    verification: []
    human_judgment: true
    rationale: "Enforcement happens in merge-gate.mjs (plan 03-03) and repo settings (plan 03-16); this plan only writes the rules down. The verifier should treat GitHub-enforced protection as not applicable, not as passed."

duration: 11min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 05: Repository rules Summary

**CODEOWNERS, a PR template carrying the PRD Definition of Done and the D-16 local gate, the intended branch rules as docs plus an exact ruleset JSON, a "merge only through Merge-PullRequest.ps1" rule in both CLAUDE.md files, and Dependabot with a 14-day cooldown on NuGet, npm and Actions, all locked by 11 architecture-test facts.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-16T03:37:00Z
- **Completed:** 2026-10-16T03:48:00Z
- **Tasks:** 3
- **Files modified:** 8 (6 new, 2 edited)

## Accomplishments

- Every new PR opens with the 12 PRD section 22 items unticked under `## Definition of Done` (the shared heading `merge-gate.mjs` reads) and a `## Local full gate` section listing the five D-16 commands with no pre-filled exit code.
- The CodeQL clause is replaced with ".NET analyzers and ESLint clean (CodeQL is not available on the free private repo, D-10)".
- `docs/operations/branch-rules.md` states what is enforced today (CI on every PR, the merge gate, squash-only), the rules written down for later, how to merge, and what to do when CI minutes run out. `main-ruleset.json` is the exact ruleset for `gh api`.
- Dependabot: one npm entry covers `/web` and `/tools/openapi-gen`; every entry has `default-days: 14`.
- The tracer (Task 1) was verified end to end by `RepoRulesTests` (6/6), then expansion continued. The whole architecture suite passes (139/139) and `dotnet build Csps.slnx` has 0 warnings.

## Task Commits

1. **Task 1: Tracer, Definition of Done and CODEOWNERS** - `ef9963f` (test, RED), `5bc72cc` (feat, GREEN)
2. **Task 2: Intended branch rules, ruleset, merge rule** - `4b1aac4` (test, RED), `bb9946f` (docs, GREEN)
3. **Task 3: Dependabot with 14-day cooldown** - `f68446a` (test, RED), `fd798dc` (feat, GREEN)

**Plan metadata:** recorded in the docs(03-05) commit that adds this file.

## Files Created/Modified

- `.github/CODEOWNERS` - owner for every path and `/.github/`
- `.github/pull_request_template.md` - Summary, Requirements, Definition of Done, Local full gate
- `.github/dependabot.yml` - three ecosystems, monthly, grouped, cooldown 14
- `docs/operations/branch-rules.md` - runbook for the process gate and the rules for later
- `docs/operations/main-ruleset.json` - ruleset (linear history, 0 approvals, `gate (full)`, no deletion or force push, no bypass)
- `tests/Csps.ArchitectureTests/RepoRulesTests.cs` - the 11 facts
- `CLAUDE.md`, `.claude/CLAUDE.md` - merge rule line and bumped timestamps

## Decisions Made

- **For the owner (timestamp choice):** `.github/pull_request_template.md` carries `Created:`/`Updated:` in a single HTML comment on line 1 instead of a visible line or front matter, so they never render into a PR body. A test (`TemplateKeepsTimestampsOutOfThePrBody`) holds it that way.
- `require_code_owner_review` is false in the ruleset because a single owner with 0 required approvals would otherwise block every PR.
- `branch-rules.md` describes the `/gsd-ship` ship-note case only by pointing to plan 03-03's ruling, because that decision is not executed yet.
- The Security item in the template is the only item containing "Security" and the only one naming CodeQL; the test pins this.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shouldly string assertions are case-insensitive by default**
- **Found during:** Task 2 RED
- **Issue:** `string.ShouldContain(x)`, `ShouldStartWith` and `ShouldEndWith` ignore case, which would let a wrongly cased phrase pass.
- **Fix:** Added `Case.Sensitive` to every string assertion in `RepoRulesTests`.
- **Files modified:** tests/Csps.ArchitectureTests/RepoRulesTests.cs
- **Verification:** the RED run for Task 2 and all 12 tests green after.
- **Committed in:** 4b1aac4 (RED)

**2. [Rule 1 - Bug] Local-gate "no pre-filled exit 0" check was too broad**
- **Found during:** Task 1 GREEN
- **Issue:** The explanatory sentence in the template legitimately contains the example "exit 0", which the first version of the check rejected.
- **Fix:** The check now looks only at lines that contain one of the five commands.
- **Files modified:** tests/Csps.ArchitectureTests/RepoRulesTests.cs
- **Committed in:** 5bc72cc

---

**Total deviations:** 2 auto-fixed (2 bugs, both in the new test file)
**Impact on plan:** None on scope.

## TDD Gate Compliance

- **RED (`ef9963f`):** 5 of 6 tests failed on assertions (CODEOWNERS, template DoD, local gate, timestamps, conventional title); each failed because the file was absent and read as no lines. `GitignoreHasThePrdEntries` passed at once because `.gitignore` already held every entry; it is a lock, not a behavior change. Semantic assessment: target tests executed and failed on the planned assertions. The `gsd_run check tdd-red-evidence` classifier was not run (the project report is MTP console output, not a supported format); evidence is the console run above.
- **GREEN (`5bc72cc`):** 6/6 pass.
- **RED (`4b1aac4`):** 4 of 10 failed (doc, ruleset, and both CLAUDE.md files). **GREEN (`bb9946f`):** 10/10.
- **RED (`f68446a`):** 2 of 12 failed (both Dependabot facts). **GREEN (`fd798dc`):** 12/12.
- **REFACTOR:** none needed.

## Issues Encountered

- A shell heredoc collapsed `\n` in a Python edit into a real newline inside a C# char literal; the build failed at once and the two lines were fixed with the Edit tool.

## Known Stubs

None.

## Threat Flags

None. T-03-16 (CODEOWNERS covers `/.github/`) and T-03-17 (14-day cooldown per ecosystem; unapproved pins still fail `DependencyRegistryTests`) are implemented and tested. No package was installed (T-03-SC), and the repository's visibility and settings were not touched.

## User Setup Required

None - no external service configuration required. Plan 03-16 applies the squash-only merge setting after the owner approves it.

## Next Phase Readiness

- Plan 03-03 (merge gate) can rely on the two fixed PR-body headings, `## Definition of Done` and `## Local full gate`, exactly as the template writes them. Its local-gate rule needs `exit 0` on each command line, which the template tells the user to write.
- `Merge-PullRequest.ps1` does not exist yet (plan 03-03); the docs and CLAUDE.md already name it.
- The ruleset's required check is `gate (full)`; docs-only PRs report `gate (docs)`, so the rule must be revisited before it is ever switched on (written in branch-rules.md).

## Self-Check: PASSED

- Files exist: `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/dependabot.yml`, `docs/operations/branch-rules.md`, `docs/operations/main-ruleset.json`, `tests/Csps.ArchitectureTests/RepoRulesTests.cs`.
- Commits `ef9963f`, `5bc72cc`, `4b1aac4`, `bb9946f`, `f68446a`, `fd798dc` are ancestors of HEAD (6 measured since `plan_head_before`).
- Acceptance: CODEOWNERS owner count 2; 12 unticked task lines; template line 1 starts with `<!--`; `Merge-PullRequest.ps1` appears in both CLAUDE.md files; ruleset parses; `default-days: 14` count 3; `package-ecosystem:` count 3.
- Verification: `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*RepoRulesTests"` 12/12; whole architecture project 139/139; `dotnet build Csps.slnx` 0 warnings.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-15*
