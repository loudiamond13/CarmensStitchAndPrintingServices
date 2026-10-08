---
created: 2026-10-07T19:01:31-05:00
updated: 2026-10-07T19:01:31-05:00
phase: quick-261007-qde
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .gitignore
  - .planning/PROJECT.md
  - .claude/CLAUDE.md
autonomous: true
requirements:
  - WEB-02

estimate:
  tokens: 15000
  raw_tokens: 15000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "git check-ignore reports both Claude Design exports (.planning/design/CSPS Website Public Face.html and .planning/design/CSPS Website Admin and Manager.html) as ignored, and git status no longer lists .planning/design/"
    - "No path under .planning/design/ is tracked, staged or present in any commit made by this task; both HTML files are still on disk, unchanged"
    - "The .planning/PROJECT.md Canonical Source Documents table has a .planning/design/ row that says local-only, never commit, visual reference for look and feel and // SPEC-GAP items, and that CSPS-UI-SPEC.md wins where the two disagree unless the owner rules otherwise"
    - "The .claude/CLAUDE.md Project section 'Full detail:' line points agents to .planning/design/ with the same never-commit and spec-wins rule"
    - "Every edited .md carries ISO 8601 timestamps with offset: PROJECT.md keeps its Created value and gets a new Updated value; .claude/CLAUDE.md gains a Created/Updated line under its first heading"
  artifacts:
    - path: ".gitignore"
      provides: "Ignore rule for the local-only design folder, inside the 'Production data and local-only files' section"
      contains: ".planning/design/"
    - path: ".planning/PROJECT.md"
      provides: "Canonical Source Documents row for the design folder with precedence rule"
      contains: ".planning/design/"
    - path: ".claude/CLAUDE.md"
      provides: "Agent-facing pointer to the design folder on the 'Full detail:' line"
      contains: ".planning/design/"
  key_links:
    - from: ".gitignore"
      to: ".planning/design/*.html"
      via: "directory ignore pattern; proven by git check-ignore -q on both file names"
      pattern: "^\\.planning/design/$"
    - from: ".planning/PROJECT.md (Canonical Source Documents)"
      to: "CSPS-UI-SPEC.md precedence (Appendix › tables › prose)"
      via: "the new row states the spec stays the source of truth and the HTML is a visual reference"
      pattern: "SPEC-GAP"
---

<objective>
Keep the owner's two Claude Design exports in `.planning/design/` out of git for good, and record the folder as a local-only visual UI reference so the UI researcher, planner, executors and UI auditor know to open it next to `CSPS-UI-SPEC.md`.

Purpose: the owner said the HTML exports must never be committed (unreleased design and business content). Today `git status` shows `?? .planning/design/`, so one careless `git add` would publish them. Phase 2 (WEB-02, design system import) and every later UI phase need to know the files exist, what they are for, and that `CSPS-UI-SPEC.md` still wins.

Output: an ignore rule in `.gitignore`, a new row in the `.planning/PROJECT.md` Canonical Source Documents table, an extended "Full detail:" line in `.claude/CLAUDE.md`, and two atomic commits that contain no path under `.planning/design/`.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md
@.gitignore

Facts verified at planning time (base commit `0361a67`, branch `gsd/phase-2-web-foundation-design-system`):
- `.planning/design/` holds `CSPS Website Admin and Manager.html` (4.2 MB) and `CSPS Website Public Face.html` (1.5 MB). It is untracked and NOT ignored (`git check-ignore` exits 1). Nothing else in the working tree is dirty.
- `.gitignore` opens with the section header `# Production data and local-only files (CSPS-PRD.md §0, §16.1, §18). Never commit.` followed by `_local/`, `*.bak`, `*.mdf`, `*.ldf`, then a blank line. The file uses CRLF line endings in the working tree (`core.autocrlf=true`).
- `.planning/PROJECT.md` line 3 is the timestamp line `*Created: 2026-10-06T23:20:28-05:00 · Updated: <value>*` (separator is the middle dot U+00B7). The `## Canonical Source Documents (read these; PROJECT.md summarizes them)` table (3 columns: Document | Role | Notes) has rows for `CSPS-PRD.md`, `CSPS-UI-SPEC.md` and `CLAUDE.md` (repo root), followed by a blank line and `## Requirements`.
- `.claude/CLAUDE.md` has no timestamp line. Line 1 is `<!-- GSD:project-start source:PROJECT.md -->`, line 2 blank, line 3 `## Project`, line 4 blank, line 5 starts `**CSPS — Carmen's Stitch & Printing Services**`. Line 13 is the "Full detail:" line. Everything between other `<!-- GSD:...-start/end -->` markers is GSD-generated: do not touch it.

Planner decisions:
- Requirement mapping: WEB-02 (UI-spec design system import), because the folder is the visual source the spec was derived from. No code changes, so tasks are standard (not `tdd="true"`): config and documentation are a listed TDD exception.
- Root `CLAUDE.md` is NOT edited (orchestrator ruling). `.planning/STATE.md` is NOT edited by the executor: the quick workflow updates its Quick Tasks table itself.
- The `.claude/CLAUDE.md` Project block is marked `source:PROJECT.md`, so a future GSD regeneration may rewrite it. The PROJECT.md row is the durable record; the CLAUDE.md line is the fast pointer.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Ignore .planning/design/ in the local-only section and prove git can no longer see it</name>
  <files>.gitignore</files>
  <action>
Do not open, read, move, rename or delete either HTML file in `.planning/design/`; they are large and owner-owned. Only `.gitignore` changes in this task.

In `.gitignore`, inside the first section (the one headed `# Production data and local-only files (CSPS-PRD.md §0, §16.1, §18). Never commit.`), add two lines directly after the `*.ldf` line and before the existing blank line that ends the section:
- a comment line: `# Claude Design exports: local-only visual UI reference behind CSPS-UI-SPEC.md (owner, 2026-10-07). Never commit.`
- the rule line: `.planning/design/`

Keep the file's CRLF line endings and leave every other line unchanged (no reordering, no other new patterns, no `!` negations).

Then prove the rule works before committing: run `git check-ignore -q` on both file names (each must exit 0), and confirm `git status --porcelain --untracked-files=all -- .planning/design` prints nothing.

Commit safely: stage by explicit path only with `git add -- .gitignore` (never `git add -A`, `git add .`, `git add -f`, or any pattern that could reach `.planning/design/`). Before committing, run `git diff --cached --name-only` and confirm the list is exactly `.gitignore`; if any other path is staged, or any path under `.planning/design/` appears, stop and report instead of committing. Commit with message `chore(quick-261007-qde): ignore the local-only Claude Design exports in .planning/design/` and end the message with the attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stay on branch `gsd/phase-2-web-foundation-design-system`.
  </action>
  <verify>
    <automated>git check-ignore -q ".planning/design/CSPS Website Public Face.html" && git check-ignore -q ".planning/design/CSPS Website Admin and Manager.html" && test -f ".planning/design/CSPS Website Public Face.html" && test -f ".planning/design/CSPS Website Admin and Manager.html" && S=$(git status --porcelain --untracked-files=all -- .planning/design) && test -z "$S" && T=$(git ls-files -- .planning/design) && test -z "$T" && tr -d '\r' < .gitignore | sed -n '1,/^$/p' | grep -Fqx '.planning/design/' && N=$(git diff 0361a67 --numstat -- .gitignore) && test "$(printf '%s\n' "$N" | cut -f1,2)" = "$(printf '2\t0')" && L=$(git log 0361a67..HEAD --name-only --format=) && ! printf '%s\n' "$L" | grep -qF '.planning/design/' && echo TASK1_OK</automated>
  </verify>
  <done>Both HTML files are ignored and still on disk; `git status` no longer shows `.planning/design/`; `.gitignore` gained exactly two lines (comment + rule) inside the local-only section; one commit on the phase-2 branch contains only `.gitignore`; no commit since `0361a67` touches any path under `.planning/design/`.</done>
</task>

<task type="auto">
  <name>Task 2: Record .planning/design/ as the local-only visual UI reference in PROJECT.md and .claude/CLAUDE.md</name>
  <files>.planning/PROJECT.md, .claude/CLAUDE.md</files>
  <action>
Again, do not open or copy the HTML files; this task only writes text that points to them.

Timestamp rule (owner, binding): every .md created or edited carries Created/Updated timestamps in ISO 8601 with offset (for example 2026-10-07T19:05:00-05:00). Files with YAML frontmatter update `updated:` and keep `created:`. Files without frontmatter use a `*Created: … · Updated: …*` line under the title; on edit only Updated changes. Get the current time from the real clock with `date +%Y-%m-%dT%H:%M:%S%:z` in Git Bash. Never invent or bump a time: if the existing Updated value happens to sort later than the clock (it was written ahead of the clock earlier today), still write the real clock time.

Step A, `.planning/PROJECT.md`:
1. On line 3, replace only the timestamp after `Updated: ` with the current clock time. Keep the Created value, the middle-dot separator and the surrounding asterisks exactly as they are.
2. In the `## Canonical Source Documents` table, insert one new row directly after the `CSPS-UI-SPEC.md` row (before the root `CLAUDE.md` row), using the table's existing pipe style. Cell contents:
   - Document: `` `.planning/design/` (local-only, git-ignored) ``
   - Role: Visual UI reference: the owner's Claude Design exports `CSPS Website Public Face.html` and `CSPS Website Admin and Manager.html`, from which `CSPS-UI-SPEC.md` was derived
   - Notes: Never commit, upload or deploy (owner, 2026-10-07). The UI researcher, planner, executors and UI auditor open it next to `CSPS-UI-SPEC.md` for look and feel and to resolve `// SPEC-GAP:` items. `CSPS-UI-SPEC.md` stays the source of truth (Appendix › tables › prose); where the two disagree the spec wins unless the owner rules otherwise. Missing on fresh clones and in CI: ask the owner, never recreate it. The files are large (4.2 MB and 1.5 MB), so search them rather than reading them whole.
   No other line in PROJECT.md changes.

Step B, `.claude/CLAUDE.md` (edit only the hand-written Project section; leave every `<!-- GSD:... -->` marker and every other section untouched):
1. It has no timestamp line yet, so add one under its first heading (`## Project`): insert the line `*Created: <C> · Updated: <U>*` followed by one blank line, directly before the `**CSPS — Carmen's Stitch & Printing Services**` paragraph, so the file reads: heading, blank, timestamp line, blank, paragraph. Use the middle dot U+00B7 as the separator. `<C>` is the file's first-commit time from `git log --diff-filter=A --follow --format=%cI -- .claude/CLAUDE.md | tail -1`; `<U>` is the current clock time.
2. Replace the "Full detail:" line with the same text plus one more entry appended after the `CSPS-UI-SPEC.md` entry, so it reads: Full detail: `.planning/PROJECT.md` · `CSPS-PRD.md` (behavior, security, a11y, data) · `CSPS-UI-SPEC.md` (visuals, copy, markup) · `.planning/design/` (local-only Claude Design HTML the UI spec came from; git-ignored, never commit; a visual reference for look and feel and `// SPEC-GAP` items, and the UI spec wins where they disagree unless the owner rules otherwise).

Run the verify command before committing. Commit safely: stage by explicit path only with `git add -- .planning/PROJECT.md .claude/CLAUDE.md` (never `git add -A`, `git add .` or `git add -f`). Before committing, run `git diff --cached --name-only` and confirm it lists exactly those two paths and nothing under `.planning/design/`; otherwise stop and report. Commit with message `docs(quick-261007-qde): record .planning/design/ as the local-only visual UI reference` and end it with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  </action>
  <verify>
    <automated>sed -n '/^## Canonical Source Documents/,/^## Requirements/p' .planning/PROJECT.md | grep -F '`.planning/design/`' | grep -F 'CSPS-UI-SPEC.md' | grep -F 'SPEC-GAP' | grep -qi 'never commit' && grep '^Full detail:' .claude/CLAUDE.md | grep -F '.planning/design/' | grep -F 'SPEC-GAP' | grep -qi 'never commit' && D=$(git diff 0361a67 -- .planning/PROJECT.md) && printf '%s\n' "$D" | grep -Eq '^\+\*Created: 2026-10-06T23:20:28-05:00 .* Updated: [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}\*$' && sed -n '5p' .claude/CLAUDE.md | grep -Eq '^\*Created: [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2} .* Updated: [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}\*$' && NP=$(git diff 0361a67 --numstat -- .planning/PROJECT.md) && test "$(printf '%s\n' "$NP" | cut -f1,2)" = "$(printf '2\t1')" && NC=$(git diff 0361a67 --numstat -- .claude/CLAUDE.md) && test "$(printf '%s\n' "$NC" | cut -f1,2)" = "$(printf '3\t1')" && test "$(grep -c '<!-- GSD:' .claude/CLAUDE.md)" = "14" && T=$(git ls-files -- .planning/design) && test -z "$T" && L=$(git log 0361a67..HEAD --name-only --format=) && ! printf '%s\n' "$L" | grep -qF '.planning/design/' && echo TASK2_OK</automated>
  </verify>
  <done>PROJECT.md has the new `.planning/design/` row (local-only, never commit, visual reference, spec wins) and a new Updated time with Created unchanged (2 lines added, 1 removed vs `0361a67`); `.claude/CLAUDE.md` has a Created/Updated line under `## Project` and the extended "Full detail:" line (3 added, 1 removed), all 14 GSD markers intact; one docs commit contains exactly those two files; nothing under `.planning/design/` is tracked or committed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Local working tree → git history / GitHub remote (private repo, default branch `dev`) | Anything staged and committed leaves the machine on the next push and stays in history; unreleased design and business content must not cross it |
| Planning docs → downstream agents | Agents act on what PROJECT.md and `.claude/CLAUDE.md` say about the design files; wrong wording could lead an agent to copy the HTML into `web/`, `wwwroot` or a deploy |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261007-qde-01 | Information Disclosure | `.gitignore` / `.planning/design/*.html` | high | mitigate | Directory ignore rule `.planning/design/` in the local-only section; Task 1 verify proves `git check-ignore -q` on both file names, empty `git status` and `git ls-files` for the folder |
| T-261007-qde-02 | Information Disclosure | Commits made by this task | high | mitigate | Stage by explicit path only (no `-A`, `.`, `-f`); `git diff --cached --name-only` must equal the task's own paths before each commit; both verifies assert no commit since `0361a67` touches `.planning/design/` |
| T-261007-qde-03 | Information Disclosure | Downstream agents reading PROJECT.md / `.claude/CLAUDE.md` | medium | mitigate | Recorded text says never commit, upload or deploy, and that the files are a reference to open, not assets to copy; missing files mean ask the owner, never recreate |
| T-261007-qde-04 | Tampering | `CSPS-UI-SPEC.md` precedence | low | mitigate | Recorded rule keeps the spec as source of truth (Appendix › tables › prose); the HTML only informs look and feel and `// SPEC-GAP` items unless the owner rules otherwise |
| T-261007-qde-SC | Tampering | npm/pip/cargo installs | low | accept | No package installs in this plan; nothing to gate |
</threat_model>

<verification>
- Both task verifies print `TASK1_OK` and `TASK2_OK`.
- `git log 0361a67..HEAD --name-only --format=` lists only `.gitignore`, `.planning/PROJECT.md` and `.claude/CLAUDE.md` from this task's two commits (plus any planning files the quick workflow itself commits), and never a path under `.planning/design/`.
- `git status --porcelain` no longer shows `?? .planning/design/`.
- The branch is still `gsd/phase-2-web-foundation-design-system`.
</verification>

<success_criteria>
- The two Claude Design exports can no longer be committed by accident: git ignores the folder, and nothing under it is tracked or in history.
- Any agent starting UI work finds `.planning/design/` from both PROJECT.md and `.claude/CLAUDE.md`, knows it is local-only and never committed, and knows `CSPS-UI-SPEC.md` wins on conflicts unless the owner rules otherwise.
- Edited markdown files carry correct Created/Updated timestamps per the owner's rule.
</success_criteria>

<output>
Create `.planning/quick/261007-qde-gitignore-planning-design-local-only-cla/261007-qde-SUMMARY.md` when done, with `created:`/`updated:` frontmatter timestamps (ISO 8601 with offset). Record both commit SHAs, the `TASK1_OK`/`TASK2_OK` results, the exact `git diff --cached --name-only` output seen before each commit, and a note for the orchestrator that the `.claude/CLAUDE.md` Project block is marked `source:PROJECT.md`, so a future GSD regeneration may drop the hand-added "Full detail:" entry and timestamp line (the PROJECT.md row is the durable record).
</output>
