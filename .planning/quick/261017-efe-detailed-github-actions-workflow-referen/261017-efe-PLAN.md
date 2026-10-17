---
created: 2026-10-17T10:32:34-05:00
updated: 2026-10-17T10:32:34-05:00
phase: quick-261017-efe
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/operations/ci.md
autonomous: true
requirements: [OPS-02, OPS-03, OPS-04]

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "docs/operations/ci.md ends with a '## Workflows at a glance' section. It opens with a summary table that names every workflow file (ci.yml, weekly.yml, codeql.yml, hygiene.yml, deploy.yml) plus dependabot.yml, and every job check name in backticks: classify, gate (fast), gate (docs), gate (full), gate (package), gate result, weekly all engines, analyze (csharp), analyze (javascript-typescript), secret scan, commit messages, actionlint, zizmor, dependency review, deploy"
    - "Each workflow has a ### subsection whose heading names its file in backticks. It states the trigger, permissions, concurrency, runner and time limit as written in the YAML, and lists every step by its exact YAML name: in backticks, what it checks, what a failure means and how to fix it"
    - "The five Hygiene jobs are explained in plain English: what gitleaks scans and over which commits, the Conventional Commits types and how to fix a title, what actionlint and zizmor look for, and the dependency review severity and license allow-list"
    - "The Dependabot subsection covers the three ecosystems, monthly grouped pull requests, the 14-day cool-down, security updates arriving at once, and why NuGet/npm bumps fail '3 architecture tests' until docs/dependencies.json records the owner's approval (and Actions bumps until ApprovedActions does)"
    - "The deploy.yml subsection gives the trigger, inputs, permissions, concurrency and steps, and links to deploy.md instead of restating the runbook. It names secrets only, never their values, and no hosting server, database or site name appears"
    - "Nothing in the existing sections is duplicated: the new section links to 'The pipeline, in order', 'Pushes to main', 'Weekly run', 'How to read a failed run' and the others where they already explain something, and every in-page and cross-file anchor resolves"
    - "ci.md has no long dash, its header keeps Created 2026-10-16T01:12:00-05:00 and its Updated is a 2026-10-17 time, and the CodeQL weekly time reads 19:23 UTC (the cron '23 19 * * 0')"
    - "Only docs/operations/ci.md is committed; the untracked files already in the tree stay uncommitted"
  artifacts:
    - path: docs/operations/ci.md
      provides: "The '## Workflows at a glance' per-workflow reference (summary table, CI, Weekly, CodeQL, Hygiene, Deploy and Dependabot subsections), the intro pointer, the corrected CodeQL time and the updated timestamp"
      contains: "## Workflows at a glance"
  key_links:
    - from: docs/operations/ci.md
      to: .github/workflows/*.yml
      via: "Each step name in backticks equals a YAML step 'name:' exactly, so the owner can search the Actions log for it"
      pattern: "`[0-7] [a-z]"
    - from: docs/operations/ci.md
      to: docs/operations/deploy.md
      via: "Relative links with anchors such as deploy.md#how-to-deploy and deploy.md#secrets-and-variables"
      pattern: "deploy\\.md#"
    - from: docs/operations/ci.md
      to: docs/operations/branch-rules.md
      via: "Links to branch-rules.md#the-rules-github-enforces-on-main and branch-rules.md#how-to-merge for required checks and merges"
      pattern: "branch-rules\\.md#"
    - from: docs/operations/ci.md
      to: docs/dependencies.md
      via: "Link to ../dependencies.md#adding-a-dependency for the approval steps that unblock a Dependabot pull request"
      pattern: "dependencies\\.md#adding-a-dependency"
---

<objective>
Add a detailed per-workflow reference, "Workflows at a glance", to `docs/operations/ci.md`. It covers every GitHub Actions workflow (`ci.yml`, `weekly.yml`, `codeql.yml`, `hygiene.yml`, `deploy.yml`) and Dependabot (`.github/dependabot.yml`). For each one: the trigger, permissions, concurrency, runner and time limit, then every job and step, what it checks, what a failure means and how to fix it.

Purpose: the owner (a non-developer who reads plain English) asked for the workflows to be explained "in details". Today the five Hygiene jobs are only named, and Dependabot is not in ci.md at all.

Output: one edited file, `docs/operations/ci.md`, committed alone on the current branch `gsd/phase-03-ci-cd-staging-deploy` (no worktree).
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md
@docs/operations/ci.md
@docs/operations/deploy.md
@docs/operations/branch-rules.md
@.github/workflows/ci.yml
@.github/workflows/weekly.yml
@.github/workflows/codeql.yml
@.github/workflows/hygiene.yml
@.github/workflows/deploy.yml
@.github/dependabot.yml

There is no `.github/actions` folder (no composite actions).

<interfaces>
Facts the planner read from the YAML on 2026-10-17. Re-read the YAML before you write; if anything differs, the YAML wins.

ci.yml, name CI. Triggers: pull_request to main with types opened, synchronize, reopened, ready_for_review; push to main; workflow_dispatch (no inputs); workflow_call with the input all-engines (boolean, default false). No path filter. Top-level permissions are empty. classify: contents read, pull-requests read, checks read, timeout 5. gate: contents read, timeout 60, needs classify, sets DOTNET_NOLOGO and DOTNET_CLI_TELEMETRY_OPTOUT. result ("gate result"): no permissions, timeout 2, needs classify and gate, runs with always(). Concurrency group ci-<workflow>-<PR number or sha>; only pull_request runs cancel an older run. All jobs run on ubuntu-24.04. Step if-conditions: "3 integration tests", every "5 ..." step and every "6 ..." step except the upload run only in full mode. "6 upload failure reports" runs only on failure in full mode. "5 playwright browsers" and "5 playwright" run when all-engines is off; the "all engines" variants run when it is on. Every "7 ..." step runs in full or package mode, except "7 package upload", which also needs a push event. ci-classify.mjs: pull_request gives fast (draft), docs or full; push gives package (proven tree) or full; any other event (workflow_dispatch, schedule) gives full.

weekly.yml, name Weekly. Triggers: schedule cron "0 18 * * 0" (Sunday 18:00 UTC, Monday 02:00 Manila) and workflow_dispatch. Empty top-level permissions. One job, id all-engines, name "weekly all engines". It uses ./.github/workflows/ci.yml with all-engines: true and grants contents read, pull-requests read, checks read. It has no concurrency block, no timeout of its own and no steps.

codeql.yml, name CodeQL. Triggers: pull_request to main (default types), push to main, schedule cron "23 19 * * 0" (Sunday 19:23 UTC, Monday 03:23 Manila). Empty top-level permissions. Job name "analyze (${{ matrix.language }})", which is "analyze (csharp)" (build-mode manual) and "analyze (javascript-typescript)" (build-mode none). fail-fast false, timeout 30, ubuntu-24.04, permissions contents read and security-events write. Concurrency group codeql-...; only pull_request runs cancel. Steps: checkout; setup dotnet (csharp only, global.json); initialize codeql (github/codeql-action/init v4.38.2); build csharp (csharp only: locked restore, then build with no incremental build and no shared compiler); analyze (category /language:<language>). The YAML has no setting that fails the job on a finding.

hygiene.yml, name Hygiene. Triggers: pull_request to main with types opened, synchronize, reopened, ready_for_review, edited; push to main. No path filter. Empty top-level permissions; every job has contents read only. Concurrency group hygiene-...; only pull_request runs cancel. All jobs run on ubuntu-24.04.
- secrets, name "secret scan", timeout 10. Steps: checkout (full history); "install gitleaks 8.30.1 (checksum verified)" (downloads the release, sha256sum -c against the pinned checksum); "scan commits" (on a PR, base sha..head sha; on a push, before..sha; when before is all zeros or unknown, only the pushed commit; uses .gitleaks.toml, --redact).
- commits, name "commit messages", PR only, timeout 5. Steps: checkout (full history); setup node (24.21.0); "check subjects" (node web/scripts/commit-lint.mjs: the PR title and every non-merge commit subject must read type(scope)!: summary or be a git Revert "..." subject; types feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert).
- actionlint, name "actionlint", timeout 10. Steps: checkout; "install actionlint 1.7.12 (checksum verified)"; "lint workflows" (actionlint -color over every file in .github/workflows, using the runner's shellcheck for run scripts).
- zizmor, name "zizmor", timeout 10. Steps: checkout; "zizmor 1.30.1" (zizmorcore/zizmor-action v0.6.4, advanced-security false, annotations true, so findings show as annotations).
- dependency-review, name "dependency review", PR only, timeout 10. One step, "review dependency changes" (actions/dependency-review-action v5.0.0, fail-on-severity low, allow-licenses MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, MPL-2.0, OFL-1.1, comment-summary-in-pr never). It has no checkout step.

deploy.yml, name Deploy. Trigger: workflow_dispatch only, with inputs action (choice deploy, online, hostprobe; default deploy), sha (string, default empty, the full 40-character sha of a main build that passed CI, needed for deploy), dry_run (boolean, default false), probe_rewrite (boolean, default false, hostprobe only). Empty top-level permissions. Concurrency group deploy-production with cancel-in-progress false. Job deploy: if github.ref is refs/heads/main, windows-2025, timeout 30, permissions contents write (creates the deploy release) and actions read (finds the CI package). Steps: checkout; setup node; setup dotnet (hostprobe only); deploy (node web/scripts/deploy.mjs; secrets by name WEBDEPLOY_SERVER, WEBDEPLOY_SITE, WEBDEPLOY_USERNAME, WEBDEPLOY_PASSWORD, WEBDEPLOY_CERT_SHA256, HOSTPROBE_KEY; variable SITE_ORIGIN).

dependabot.yml. Three entries, all with interval monthly, cooldown default-days 14 and one group with pattern "*": nuget (directory /, group nuget, commit prefix build), npm (directories /web and /tools/openapi-gen in one entry, group npm, prefix build), github-actions (directory /, group actions, prefix ci). Every entry has include: scope. The file header says security updates still arrive at once (the cool-down applies to version updates only), a NuGet or npm bump fails CI until docs/dependencies.json records the new version with the owner's approval, and a NuGet bump may need dotnet restore --force-evaluate on its branch if packages.lock.json is left stale. Repository settings (branch-rules.md) show Dependabot alerts on and security updates enabled.

Where a bump fails: DependencyRegistryTests (tests/Csps.ArchitectureTests, run by "3 architecture tests") checks docs/dependencies.json against every NuGet, tool and npm pin. CiWorkflowTests in the same project only accepts action pins listed in its ApprovedActions dictionary (repo/action@sha mapped to the version comment), so a GitHub Actions bump fails there until that list is updated with the owner's OK. web/scripts/license-gate.mjs ("6 web licenses") also reads docs/dependencies.json.

Required checks on main (branch-rules.md): gate result, secret scan, commit messages, actionlint, zizmor, dependency review, analyze (csharp), analyze (javascript-typescript). No workflow merges anything: merges go only through tools/scripts/Merge-PullRequest.ps1, on the owner's instruction.

Doc tests: no test scans docs/operations/ci.md. web/src/test/no-long-dash.node.test.ts scans web/src only. The ArchitectureTests doc tests (HostingRecordTests, RepoRulesTests, DeployWorkflowTests, CutoverRunbookTests) read other files. The plan's own node checks are the real gate for ci.md, and the two suites run as a regression check.
</interfaces>
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Tracer: section skeleton, summary table, and the Hygiene and Dependabot subsections end to end</name>
  <files>docs/operations/ci.md</files>
  <read_first>
    - docs/operations/ci.md (all of it: headings, tone, the stage table, and the header timestamp line 3)
    - .github/workflows/hygiene.yml and .github/dependabot.yml (every line, including comments)
    - .github/workflows/ci.yml, weekly.yml, codeql.yml and deploy.yml (job names only, for the summary table)
    - docs/operations/branch-rules.md ("Repository settings applied (plan 03-16)" and "The rules GitHub enforces on main")
    - .gitleaks.toml lines 1 to 8 (allowlists name single files only; a real secret is never allowlisted)
    - web/scripts/commit-lint.mjs lines 1 to 30 (the accepted subject shape and the type list)
    - docs/dependencies.md ("Adding a dependency")
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs lines 9 to 30 (ApprovedActions) and DependencyRegistry.cs lines 9 to 20
  </read_first>
  <action>
Red step first (TDD mode): run the Task 1 section check from verify and confirm it fails with "no Workflows at a glance section". Then write the section so the check passes.

1. Header (memory rule: md timestamps): on line 3, keep Created as it is. Set Updated to the current local time in the same format (for example from `date +%Y-%m-%dT%H:%M:%S%:z`; the offset is -05:00 on this date). Keep the middle dot separator unchanged.

2. Intro pointer: at the end of the intro paragraph (line 5), add one sentence: the last section, "Workflows at a glance", describes every workflow file and Dependabot one by one, including when each runs, what rights it has and what every job and step checks.

3. CodeQL time fix: in the "Security scans (public repository)" bullet for CodeQL, change the weekly time to 19:23 UTC (Monday 03:23 in Manila). That is what the cron `23 19 * * 0` means; the current text rounds it down to the hour. Change nothing else in the existing sections.

4. Append a new last section `## Workflows at a glance`, after "When the minutes run out (D-16)". Placement is Claude's discretion: the end of the page keeps the existing "when does what run" story first and every existing anchor unchanged. The section opens with:
   - Two or three plain sentences. A workflow is one file under `.github/workflows`. A job is one box on the run page, and its name is the check name on a pull request. A step is one line in a job's log, and the step names below are written exactly as the log shows them, so you can search for them.
   - A summary table with the columns Workflow file, Name on the Actions tab, When it runs, Jobs (check names), and Required on `main`. One row each for `ci.yml`, `weekly.yml`, `codeql.yml`, `hygiene.yml`, `deploy.yml` and `dependabot.yml`. Put every job check name in backticks: `classify`; the gate with all four of its names (`gate (fast)`, `gate (docs)`, `gate (full)`, `gate (package)`), linking to [The pipeline, in order](#the-pipeline-in-order) for what the modes mean; `gate result`; `weekly all engines`; `analyze (csharp)`; `analyze (javascript-typescript)`; `secret scan`; `commit messages`; `actionlint`; `zizmor`; `dependency review`; `deploy`. The dependabot.yml row says it is not a workflow: it is GitHub's update bot, which opens pull requests. Take the Required column from branch-rules.md and link it to [the rules](branch-rules.md#the-rules-github-enforces-on-main).
   - A short "Rules every workflow follows" list. The token starts with no rights (`permissions: {}`) and each job asks only for what it needs. Every outside action is pinned to a full commit id with its version in a comment. Every job that runs steps has a time limit. Event text (titles, commit ids) reaches scripts only through environment variables. There is no path filter, so a check always reports. Runners are ubuntu-24.04, except Deploy on windows-2025. No workflow merges anything: merges go only through `tools/scripts/Merge-PullRequest.ps1`, on the owner's instruction ([How to merge](branch-rules.md#how-to-merge)). Say that `CiWorkflowTests`, run by `3 architecture tests`, checks these rules.

5. Subsection `### Hygiene (`hygiene.yml`)`. The heading must contain the file name in backticks; the check finds subsections that way. Start with a facts list: Runs when (pull requests to main on opened, synchronize, reopened, ready for review and edited, plus pushes to main; explain that "edited" means changing the pull request's title, description or base re-runs it without a push); Permissions (read the repository only); Concurrency (a newer push cancels the older scan; main is never cancelled); Runner and time limits per job. Then one `####` heading per job, using its check name in backticks (`secret scan`, `commit messages`, `actionlint`, `zizmor`, `dependency review`), each saying whether it runs on pushes too or on pull requests only (on a push to main the two PR-only jobs show as skipped, which is normal). Give each job a table with the columns Step, What it does and checks, and If it fails, and list every step by its exact YAML name in backticks, including each `checkout` and `setup node`. Explain the details in plain words:
   - `secret scan`: gitleaks looks for passwords, keys and tokens in every commit of the pull request (base to head), or of the push, with the project rules in `.gitleaks.toml`, and hides the value in the log. The tool is checked against a fixed checksum before use. If it fails: treat a real secret as leaked. Tell the owner and replace the secret where it was issued. A later commit that deletes it does not clear the check, because every commit is scanned, so the developer rewrites the pull request's commits. A false alarm on a test file is fixed only by a single-file allowlist entry, with the owner's OK.
   - `commit messages`: the type(scope): summary shape, the eleven types, and why the title matters (it becomes the squash commit on main). Fix a bad title by editing it on GitHub (the edited trigger re-runs this check). A bad commit subject needs the developer to reword the commit.
   - `actionlint`: checks every workflow file for YAML mistakes, wrong expressions and shell script mistakes (through shellcheck). The log gives file, line and rule. The tool is checksum-verified.
   - `zizmor`: looks for known workflow security mistakes, for example untrusted text placed straight into a script, more token rights than needed, or unpinned actions. Findings show as notes (annotations) on the run page, not in the Security tab. An ignore comment needs a written reason; `weekly.yml` has the one existing example.
   - `dependency review`: fails when a pull request adds or changes a package with a known security problem of any severity (low and up), or with a license outside the allow-list. List the eight licenses exactly as in the YAML. GitHub Actions show as an unknown license and are let through (the SHA-pin tests cover them). The summary is on the run page, not posted as a comment. Fix: choose another version (any new version needs the owner's approval) or drop the change. Never widen the allow-list to make it pass.
   Link to [Security scans](#security-scans-public-repository) instead of repeating it, and say the measured times are in [Measured (2026-10-16)](#measured-2026-10-16).

6. Subsection `### Dependabot (`dependabot.yml`)`. Use the words NuGet, npm and GitHub Actions, "monthly", "14 days", `docs/dependencies.json` and `3 architecture tests`; the check requires them. Cover:
   - The three ecosystems and where each reads its versions: NuGet in `Directory.Packages.props`; npm in `web` and `tools/openapi-gen`, in one entry so one grouped pull request arrives; GitHub Actions in the workflows.
   - Monthly checks with one grouped pull request per ecosystem.
   - The cool-down: a version is proposed only 14 days after its release (the project's release cool-down). Security updates arrive at once, because the cool-down covers version updates only and security updates are enabled in the repository settings.
   - Titles start with `build` (NuGet, npm) or `ci` (Actions) plus a scope, so they pass `commit messages`.
   - Why a bump fails CI by design. NuGet and npm bumps fail `3 architecture tests` (`DependencyRegistryTests`) until `docs/dependencies.json` records the new version with the owner's approval. An npm bump can also fail `6 web licenses` and `6 web notices`. A NuGet bump can fail `1 restore (locked)` when Dependabot leaves `packages.lock.json` stale; the fix is `dotnet restore --force-evaluate` on its branch. An Actions bump fails `3 architecture tests` (`CiWorkflowTests`) until the new commit id and version are added to `ApprovedActions` with the owner's OK. Dependency review also runs on these pull requests.
   - What to do: the owner checks each new version (age, publisher, license, known problems) and says OK. The developer records it as in [Adding a dependency](../dependencies.md#adding-a-dependency), pushes to the Dependabot branch and waits for green, then merges with the merge script on the owner's instruction. If the owner says no, close the pull request.

Style for everything you write (OR-4 and project docs rules): plain English and short sentences. No em dash, en dash or other long dash anywhere; use a colon, a period or "to". No secret values and no hosting server, database or site names; secret names are fine. Keep it concise (OR-2). Do not restate the stage table, the modes or the failed-run steps: link to them.

Commit, staging only this file: `git add docs/operations/ci.md`, then `git commit` with the subject "docs(quick-261017-efe): add the workflows reference with Hygiene and Dependabot to the CI guide" and the Co-Authored-By trailer. Never use `git add -A` or `git add .`: other untracked files in the tree must stay uncommitted.
  </action>
  <verify>
    <automated>node -e 'const fs=require("fs"),path=require("path");const [docPath,...want]=process.argv.slice(1);const doc=fs.readFileSync(docPath,"utf8").replace(/\r\n/g,"\n");const fail=[];const at=doc.indexOf("\n## Workflows at a glance\n");if(at<0){console.error("FAIL: no Workflows at a glance section");process.exit(1);}const rest=doc.slice(at+1),nx=rest.indexOf("\n## ",3),sec=nx<0?rest:rest.slice(0,nx);const subs=sec.split(/\n(?=### )/);const sub=f=>subs.find(s=>s.split("\n")[0].includes("`"+f+"`"));const all=["ci.yml","weekly.yml","codeql.yml","hygiene.yml","deploy.yml","dependabot.yml"];const detail=want.includes("all")?all:want;for(const f of all){if(!sec.includes(f))fail.push("section does not name "+f);if(f==="dependabot.yml")continue;const y=fs.readFileSync(".github/workflows/"+f,"utf8").replace(/\r\n/g,"\n");const jobs=[...y.matchAll(/^    name: (.+)$/gm)].map(m=>m[1].trim()).flatMap(j=>j.includes("matrix.language")?["analyze (csharp)","analyze (javascript-typescript)"]:j.includes("classify.outputs.mode")?["gate (fast)","gate (docs)","gate (full)","gate (package)"]:[j]);for(const j of jobs)if(!sec.includes("`"+j+"`"))fail.push(f+": section lacks job `"+j+"`");if(!detail.includes(f))continue;const s=sub(f);if(!s){fail.push("no ### subsection naming `"+f+"`");continue;}for(const n of [...y.matchAll(/^\s+- name: (.+)$/gm)].map(m=>m[1].trim()))if(!s.includes("`"+n+"`"))fail.push(f+": subsection lacks step `"+n+"`");}if(detail.includes("dependabot.yml")){const d=sub("dependabot.yml");if(!d)fail.push("no ### subsection naming `dependabot.yml`");else for(const w of ["NuGet","npm","GitHub Actions","monthly","14 days","docs/dependencies.json","3 architecture tests"])if(!d.includes(w))fail.push("dependabot.yml subsection lacks: "+w);}const slug=h=>h.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,"").replace(/\s/g,"-");const heads=file=>new Set([...fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n").matchAll(/^#{1,6} (.+)$/gm)].map(m=>slug(m[1])));for(const m of sec.matchAll(/\]\(([^)#\s]*)#([^)\s]+)\)/g)){const file=m[1]?path.join(path.dirname(docPath),m[1]):docPath;if(!fs.existsSync(file))fail.push("link to missing file "+m[1]);else if(!heads(file).has(m[2]))fail.push("broken anchor "+m[1]+"#"+m[2]);}if(fail.length){console.error("FAIL\n"+fail.join("\n"));process.exit(1);}console.log("OK: "+(detail.length?detail.join(", "):"summary only"));' docs/operations/ci.md hygiene.yml dependabot.yml && node -e 'const t=require("fs").readFileSync(process.argv[1]||"docs/operations/ci.md","utf8").replace(/\r\n/g,"\n");const f=[];const d=t.match(/[\u2012\u2013\u2014\u2015\u2E3A\u2E3B\uFE31\uFE32\uFE58]/g);if(d)f.push(d.length+" long dash(es)");if(!/^\*Created: 2026-10-16T01:12:00-05:00 \u00B7 Updated: 2026-10-17T\d\d:\d\d:\d\d-05:00\*$/m.test(t))f.push("header Updated timestamp is not 2026-10-17");if(!t.includes("19:23 UTC")||/19:00 UTC/.test(t))f.push("CodeQL weekly time must read 19:23 UTC");if(/site4now|csptailoring|msdeploy\.axd/i.test(t))f.push("hosting server or site name found");if(f.length){console.error("FAIL: "+f.join("; "));process.exit(1)}console.log("OK: no long dash, header updated, CodeQL time 19:23 UTC, no hosting names")' && test "$(git show --name-only --format= HEAD)" = "docs/operations/ci.md"</automated>
  </verify>
  <done>
    The section check prints "OK: hygiene.yml, dependabot.yml". The summary table names every workflow file and every job check name. Every Hygiene step name appears exactly, and the Dependabot subsection has every required term. Every anchor resolves. The guard check prints OK: no long dash, Updated is a 2026-10-17 time, the CodeQL time reads 19:23 UTC, and no hosting names appear. The last commit contains only docs/operations/ci.md.
  </done>
</task>

<task type="auto">
  <name>Task 2: Expand: CI, Weekly, CodeQL and Deploy subsections, then run the doc suites</name>
  <files>docs/operations/ci.md</files>
  <read_first>
    - docs/operations/ci.md (the section from Task 1, to match its format)
    - .github/workflows/ci.yml, weekly.yml, codeql.yml and deploy.yml (every line, including comments and if-conditions)
    - web/scripts/ci-classify.mjs lines 1 to 20 and the decide function (which event gives which mode)
    - web/scripts/verify.mjs (the local command that repeats stages 4 and 5)
    - web/scripts/package-check.mjs lines 1 to 12 (what the package check refuses and requires)
    - tools/scripts/Invoke-CoverageGate.ps1 help block (the .NET thresholds) and web/vitest.config.ts thresholds (the web ones)
    - tools/scripts/Initialize-DevSecrets.ps1 help block
    - Directory.Build.props lines 1 to 20 (warnings are errors; NuGet audit at level low; locked restore when CI is true)
    - docs/operations/deploy.md (headings only, for the links)
  </read_first>
  <action>
Add the four remaining subsections in the summary table's order: `### CI (`ci.yml`)`, `### Weekly (`weekly.yml`)` and `### CodeQL (`codeql.yml`)` before the Hygiene subsection, and `### Deploy (`deploy.yml`)` between Hygiene and Dependabot. Use the same pattern as Task 1: a facts list (Runs when, Permissions, Concurrency, Runner and time limit, Required on main), then a `####` heading per job with a step table. List every step by its exact YAML name in backticks, including each `checkout`, `setup node`, `setup dotnet` and cache step.

CI subsection:
- Triggers: include `workflow_dispatch` (the Run workflow button on the Actions tab, which gives full mode, uses Chromium and the phone viewport, and uploads no package) and `workflow_call` with the `all-engines` input that `weekly.yml` uses. For the four modes, link to [The pipeline, in order](#the-pipeline-in-order), [Drafts](#drafts), [Docs-only pull requests](#docs-only-pull-requests) and [Pushes to main](#pushes-to-main); do not explain them again.
- Per-job permissions: classify reads the repository, pull requests and checks; gate reads the repository only; gate result has none.
- Explain what the 60-minute limit means: GitHub stops the gate, and `gate result` then fails.
- The gate step table has the columns Step, Runs in (all modes / full only / full and package / push to main only / only after a failure, taken from each step's if-condition), What it checks, and If it fails. Give each step its real meaning, using the read_first files:
  - `2 build`: any compiler warning fails it, because warnings are errors.
  - `1 restore (locked)`: a lock file that disagrees, or a NuGet package with a known problem at level low and up.
  - `3 integration tests`: `CSPS_TEST_SQL=container`, and confirm in tests/ how container mode starts its database before you describe it.
  - `3 architecture tests`: the layer rules plus the repository rule tests; name the main test classes.
  - `5 sql container`: the throwaway SQL Server, waiting up to 60 checks 2 seconds apart; link to [What the CI database is](#what-the-ci-database-is).
  - `5 lighthouse`: the dummy mail settings, so no mail is sent; link to the LCP note in the pipeline section rather than repeating it.
  - `6 coverage gate`: the thresholds as written in the script.
  - `7 package publish`: self-contained win-x64.
  - `7 package check`: what it refuses and requires.
  - `7 package upload`: `csps-package-<commit sha>`, kept 14 days, which Deploy downloads.
  For "If it fails", name the local command that repeats the step where one exists (for example `npm --prefix web run lint`, `dotnet format Csps.slnx`, `npm --prefix web run notices`). For Playwright, link to [How to read a failed run](#how-to-read-a-failed-run) and do not repeat its steps. For the start-up of the SQL container, say a download or start-up problem (not a test failure) may be re-run once.
- `gate result`: one sentence on the case rule, then link to the existing paragraph under the pipeline section.

Weekly subsection: the cron in plain words (Sunday 18:00 UTC, Monday 02:00 Manila), the hand-run button, and the one job `weekly all engines`, which runs the whole of `ci.yml` with `all-engines` on. Its jobs appear under that name on the run page. The classifier gives full mode for a scheduled or hand-started run, and no package is uploaded, because that needs a push. Explain the permissions it grants and why (the classify job reads pull requests and checks). It has no concurrency or time limit of its own; ci.yml's job limits apply. It blocks no pull request: a red weekly run is a warning to fix on a normal branch. Link to [Weekly run](#weekly-run) for the seven projects instead of listing them again.

CodeQL subsection: triggers, including the cron at 19:23 UTC; the matrix with `fail-fast: false` (one language failing does not stop the other); and `security-events: write` (needed to send the results to the Security tab). C# is built by hand with the pinned SDK, with no incremental build and no shared compiler, so CodeQL watches the whole compile. TypeScript is read without a build. Failure: the job fails when the C# build fails or the analysis itself errors. Findings are listed under the Security tab. Do not claim that a finding fails the job, because the YAML sets no such option. Both jobs are required checks.

Deploy subsection: only `workflow_dispatch`, with a table of the four inputs (name, type, default, what it does, in plain words). The job runs only from main (from another branch it is skipped). Cover windows-2025 (Web Deploy ships with it), the 30-minute limit, contents write (to create the deploy release) and actions read (to find the CI package), and concurrency `deploy-production` (two deploys never overlap, and a running deploy is never cancelled). The step table lists `checkout`, `setup node`, `setup dotnet` (hostprobe only) and `deploy`. For `deploy`, name the secrets and the `SITE_ORIGIN` variable by name only and link to [Secrets and variables](deploy.md#secrets-and-variables). For how to run it, dry runs, rollback and recovery, link to [How to deploy](deploy.md#how-to-deploy), [Dry run first](deploy.md#dry-run-first), [What the automatic rollback does](deploy.md#what-the-automatic-rollback-does), [Recover with the online action](deploy.md#recover-with-the-online-action) and [Who can deploy](deploy.md#who-can-deploy). Do not restate the runbook. Say a merge never deploys.

Same style rules as Task 1: plain English, no long dash, no secret values, no hosting server, database or site names, concise, link instead of duplicating. If the codeql.yml header comment disagrees with its cron about the weekly time, do not edit the YAML (this plan changes only ci.md); note it in the SUMMARY as a follow-up.

Then run the doc suites (verify). No preflight is needed: they open no port and no database. Commit, staging only this file, with the subject "docs(quick-261017-efe): add the CI, Weekly, CodeQL and Deploy workflow references to the CI guide" and the Co-Authored-By trailer. Never `git add -A` or `git add .`.
  </action>
  <verify>
    <automated>node -e 'const fs=require("fs"),path=require("path");const [docPath,...want]=process.argv.slice(1);const doc=fs.readFileSync(docPath,"utf8").replace(/\r\n/g,"\n");const fail=[];const at=doc.indexOf("\n## Workflows at a glance\n");if(at<0){console.error("FAIL: no Workflows at a glance section");process.exit(1);}const rest=doc.slice(at+1),nx=rest.indexOf("\n## ",3),sec=nx<0?rest:rest.slice(0,nx);const subs=sec.split(/\n(?=### )/);const sub=f=>subs.find(s=>s.split("\n")[0].includes("`"+f+"`"));const all=["ci.yml","weekly.yml","codeql.yml","hygiene.yml","deploy.yml","dependabot.yml"];const detail=want.includes("all")?all:want;for(const f of all){if(!sec.includes(f))fail.push("section does not name "+f);if(f==="dependabot.yml")continue;const y=fs.readFileSync(".github/workflows/"+f,"utf8").replace(/\r\n/g,"\n");const jobs=[...y.matchAll(/^    name: (.+)$/gm)].map(m=>m[1].trim()).flatMap(j=>j.includes("matrix.language")?["analyze (csharp)","analyze (javascript-typescript)"]:j.includes("classify.outputs.mode")?["gate (fast)","gate (docs)","gate (full)","gate (package)"]:[j]);for(const j of jobs)if(!sec.includes("`"+j+"`"))fail.push(f+": section lacks job `"+j+"`");if(!detail.includes(f))continue;const s=sub(f);if(!s){fail.push("no ### subsection naming `"+f+"`");continue;}for(const n of [...y.matchAll(/^\s+- name: (.+)$/gm)].map(m=>m[1].trim()))if(!s.includes("`"+n+"`"))fail.push(f+": subsection lacks step `"+n+"`");}if(detail.includes("dependabot.yml")){const d=sub("dependabot.yml");if(!d)fail.push("no ### subsection naming `dependabot.yml`");else for(const w of ["NuGet","npm","GitHub Actions","monthly","14 days","docs/dependencies.json","3 architecture tests"])if(!d.includes(w))fail.push("dependabot.yml subsection lacks: "+w);}const slug=h=>h.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,"").replace(/\s/g,"-");const heads=file=>new Set([...fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n").matchAll(/^#{1,6} (.+)$/gm)].map(m=>slug(m[1])));for(const m of sec.matchAll(/\]\(([^)#\s]*)#([^)\s]+)\)/g)){const file=m[1]?path.join(path.dirname(docPath),m[1]):docPath;if(!fs.existsSync(file))fail.push("link to missing file "+m[1]);else if(!heads(file).has(m[2]))fail.push("broken anchor "+m[1]+"#"+m[2]);}if(fail.length){console.error("FAIL\n"+fail.join("\n"));process.exit(1);}console.log("OK: "+(detail.length?detail.join(", "):"summary only"));' docs/operations/ci.md all && node -e 'const t=require("fs").readFileSync(process.argv[1]||"docs/operations/ci.md","utf8").replace(/\r\n/g,"\n");const f=[];const d=t.match(/[\u2012\u2013\u2014\u2015\u2E3A\u2E3B\uFE31\uFE32\uFE58]/g);if(d)f.push(d.length+" long dash(es)");if(!/^\*Created: 2026-10-16T01:12:00-05:00 \u00B7 Updated: 2026-10-17T\d\d:\d\d:\d\d-05:00\*$/m.test(t))f.push("header Updated timestamp is not 2026-10-17");if(!t.includes("19:23 UTC")||/19:00 UTC/.test(t))f.push("CodeQL weekly time must read 19:23 UTC");if(/site4now|csptailoring|msdeploy\.axd/i.test(t))f.push("hosting server or site name found");if(f.length){console.error("FAIL: "+f.join("; "));process.exit(1)}console.log("OK: no long dash, header updated, CodeQL time 19:23 UTC, no hosting names")' && npm --prefix web test -- run src/test/no-long-dash.node.test.ts && dotnet test --project tests/Csps.ArchitectureTests && test "$(git show --name-only --format= HEAD)" = "docs/operations/ci.md"</automated>
  </verify>
  <done>
    The section check prints "OK: ci.yml, weekly.yml, codeql.yml, hygiene.yml, deploy.yml, dependabot.yml": every workflow has its subsection, every job and step name matches the YAML exactly, and every anchor resolves. The guard check prints OK. The no-long-dash Vitest file and the ArchitectureTests project (including HostingRecordTests, RepoRulesTests and DeployWorkflowTests) pass. The last commit contains only docs/operations/ci.md, and `git status --short` still shows the untracked files that were there before, uncommitted.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repository to public internet | The repository is public, so everything committed to ci.md is readable by anyone |
| working tree to commit | The tree holds untracked local files (launch config, UAT and coverage notes, UI reviews) that must not reach the public history |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261017-efe-01 | Information disclosure | docs/operations/ci.md deploy subsection | high | mitigate | Secrets are named, never valued. The guard check in both tasks fails on host, site or Web Deploy endpoint strings. The action forbids hosting server, database and site names (public-repo guard memory) |
| T-261017-efe-02 | Information disclosure | git staging | medium | mitigate | Each task stages `docs/operations/ci.md` by path only (never `git add -A` or `.`), and verify asserts the last commit contains only that file |
| T-261017-efe-03 | Tampering | step names in the doc vs the YAML | low | mitigate | The section check compares every backticked step and job name with the YAML `name:` lines, so the owner cannot be sent to a step that does not exist |
| T-261017-efe-04 | Repudiation | doc claims about failures | low | accept | The doc only describes checks; it changes no workflow, so a wrong sentence cannot weaken a gate. The YAML stays the source of truth |
| T-261017-efe-SC | Tampering | npm/pip/cargo installs | high | accept | This plan installs no package and changes no manifest; the tasks use only Node, npm test and dotnet test, which are already set up |
</threat_model>

<verification>
1. Section coverage: the first node command in Task 2's verify, run with `all`, prints "OK: ci.yml, weekly.yml, codeql.yml, hygiene.yml, deploy.yml, dependabot.yml". It proves every workflow file and every job check name appears in the section, every step name of each workflow appears exactly in that workflow's subsection, Dependabot has its required terms, and every anchor resolves.
2. Guard: the second node command prints OK. No long dash is in ci.md (the same character set as no-long-dash.node.test.ts), Created is unchanged, Updated is a 2026-10-17 time, the CodeQL weekly time reads 19:23 UTC, and no hosting names appear.
3. Doc suites: `npm --prefix web test -- run src/test/no-long-dash.node.test.ts` and `dotnet test --project tests/Csps.ArchitectureTests` both exit 0.
4. Commit scope: `git show --name-only --format= HEAD` and `git show --name-only --format= HEAD~1` each print only `docs/operations/ci.md`.
5. Manual read-through (owner, optional): open ci.md on GitHub and check that the tables render and the links jump to the right headings.
</verification>

<success_criteria>
- ci.md has a "Workflows at a glance" section with a summary table and one subsection each for CI, Weekly, CodeQL, Hygiene, Deploy and Dependabot.
- Every job and step name in the doc matches the YAML exactly, with what it checks, what a failure means and how to fix it, in plain English.
- The Hygiene and Dependabot gaps are filled in detail, deploy.yml is summarized and linked to deploy.md, and nothing already in ci.md is repeated.
- No long dash, an updated timestamp, the CodeQL time corrected, and no secrets or hosting names.
- Two commits, each containing only docs/operations/ci.md.
</success_criteria>

<output>
Create `.planning/quick/261017-efe-detailed-github-actions-workflow-referen/261017-efe-SUMMARY.md` when done, with created/updated timestamps. Note any follow-up the executor saw but did not fix because only ci.md is in scope. One example: a YAML header comment whose weekly time disagrees with its cron.
</output>
