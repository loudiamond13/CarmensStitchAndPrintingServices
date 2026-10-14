---
phase: 02-web-foundation-design-system
plan: 38
subsystem: testing
tags: [look-equality, parity, scenarios, renderNode, createElement, import-meta-glob, sha256, spec-extraction, vitest, tdd, d-33]
created: "2026-10-08T10:59:00-05:00"
updated: "2026-10-08T10:59:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-02)
    provides: "web/ toolchain, vitest.config.ts (src/**, visual/** test globs, jsdom default), .gitignore entry web/visual/.reference-src/"
  - phase: 02-web-foundation-design-system (plan 02-37)
    provides: "tsconfig.app.json (src) and tsconfig.node.json (visual/**, allowJs) under the strict set"
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "ESLint rule set (visual/reference/** overrides), console guard, verify pipeline"
provides:
  - "web/src/dev/scenarios/types.ts: Scenario, ScenarioNode ({ kind: 'node', component, props }), ScenarioValue, ScenarioProps, ScenarioState, ScenarioPass, ScenarioFrame, Theme"
  - "web/src/dev/scenarios/index.ts: scenarios (glob-discovered, file-name then declaration order), scenarioById, assertSerializable, collectScenarios, GroupModule"
  - "web/src/dev/scenarios/groups/actions.ts: button-primary-md"
  - "web/src/dev/renderScenario.tsx: renderNode(kit, node, handlers, key?) and Kit"
  - "web/visual/reference/extract-spec.mjs: APPENDIX_FILES, extractAppendices, hashAppendices, compareWithPin, runExtract, SPEC_PATH, OUTPUT_DIR, PIN_PATH; CLI with --repin"
  - "web/visual/reference/spec-appendix.sha256: a017ea6d31a305d4f3c2fc8f6211a82429c704e33ab3967b4fbb9a68de9e32fc"
affects: [02-13, 02-14, parity, every-conversion-plan-adding-scenarios]

actuals:
  tokens: 9200    # chars/4 over the realized diff (36,955 chars, 9 files)
  tasks: 2
  commits: 4
plan_head_before: 3cfb78fd86516170d3498d9bcf3fbe44fe86c532
plan_head_after: 5241214c8cafdb4d3bb177464e3f677a3f1f8a6e

tech-stack:
  added: []
  patterns:
    - "Scenario groups: one web/src/dev/scenarios/groups/<group>.ts per group exporting `scenarios`; every scenario's `group` equals the file name, checked at load"
    - "A nested element in scenario props is a ScenarioNode `{ kind: 'node', component, props }`; renderNode turns it into a keyed element"
    - "Spec yardstick: generated files come only from extract-spec.mjs after the SHA-256 pin matches; --repin is a manual, reviewed step"

key-files:
  created:
    - web/src/dev/scenarios/types.ts
    - web/src/dev/scenarios/index.ts
    - web/src/dev/scenarios/index.test.ts
    - web/src/dev/scenarios/groups/actions.ts
    - web/src/dev/renderScenario.tsx
    - web/src/dev/renderScenario.test.tsx
    - web/visual/reference/extract-spec.mjs
    - web/visual/reference/extract-spec.test.ts
    - web/visual/reference/spec-appendix.sha256
  modified: []

key-decisions:
  - "A ScenarioNode is tagged `kind: 'node'`, so renderNode can tell a nested element from a plain-object prop"
  - "Every prop name in `handlers` gets a no-op function on every node in the tree, not only the root, so a nested controlled input (Field > Input) gets its onChange"
  - "ScenarioState holds only the four interaction states (rest, hover, focus-visible, active). Prop states (disabled, selected, current, invalid, collapsed) are separate scenarios"
  - "index.ts rejects, at load, a scenario whose group is not its file name, a duplicate id and non-plain data (collectScenarios). Both builds fail loudly instead of comparing unlike trees"
  - "The pin is the lowercase hex SHA-256 of the nine blocks concatenated in APPENDIX_FILES order. Each block is the lines between the fences, each ending in LF"
  - "On a pin mismatch the CLI writes nothing, so a stale but pinned copy is never replaced by an unreviewed one. --repin writes the pin and the files"

patterns-established:
  - "Conversion plans add parity cases to groups/<group>.ts. A new group is a new file whose name is the group"
  - "Scripts under web/visual follow the class-gate.mjs entry check (path.resolve(argv[1]) === fileURLToPath(import.meta.url)) and take injected paths for tests"

requirements-completed: [WEB-02]

coverage:
  - id: D1
    description: "One data-only scenario list discovered from groups/*.ts with unique ids, group equal to file name, and button-primary-md (primary md 'Save Order', light+dark, four states, parity)"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/dev/scenarios/index.test.ts (15 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "assertSerializable rejects functions, class instances, symbols, undefined, bigint and non-finite numbers, naming the scenario id and the prop path"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/dev/scenarios/index.test.ts#assertSerializable"
        status: pass
    human_judgment: false
  - id: D3
    description: "renderNode renders button-primary-md as one 'Save Order' button, nested nodes as elements, handler props as functions, and an unknown component as a 'Missing component: <name>' alert"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/dev/renderScenario.test.tsx (4 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "extract-spec.mjs writes App. A, A.2, A.3, B, C, D.1, D.3, D.4 and D.5 byte for byte (LF) into git-ignored web/visual/.reference-src/ and exits 1 when the appendix SHA-256 differs from the committed pin"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/visual/reference/extract-spec.test.ts (24 tests)"
        status: pass
      - kind: other
        ref: "node web/visual/reference/extract-spec.mjs (exit 0, nine files); sed+tr -d '\\r' of each spec range cmp-equal to each output file; sha256sum of the concatenated files = pin"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 38: Shared Scenario List, renderNode and the Pinned Spec Appendices Summary

**The look-equality proof now has both of its inputs. One data-only scenario list, discovered by `import.meta.glob`, renders through a single `createElement`-based `renderNode` (first case: `button-primary-md`). A byte-exact, SHA-256-pinned copy of the nine approved spec appendices is extracted into the git-ignored `web/visual/.reference-src/`.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-08T15:50:13Z
- **Completed:** 2026-10-08T15:58:26Z
- **Tasks:** 2
- **Files modified:** 9 (all created)

## Accomplishments

- `web/src/dev/scenarios/` holds the shared data model and the list. `collectScenarios` flattens the group files in file-name order, then declaration order. At load it rejects a wrong group, a duplicate id and any value that is not plain data, so the reference build (02-13) and the showcase (02-14) can only import the same plain tree.
- `renderNode(kit, node, handlers)` builds elements with `createElement`. It turns nested nodes (alone, in arrays or in plain objects) into keyed elements and gives every prop named in `handlers` a no-op function. A component missing from the kit renders `<p role="alert">Missing component: <name></p>`. There is no `any`; the one cast narrows `ComponentType<never>` at the call site.
- `extract-spec.mjs` resolves `CSPS-UI-SPEC.md` from the repo root (it also works when run from another working directory). It normalizes CRLF to LF and writes the nine files only when the SHA-256 matches `spec-appendix.sha256`. An appendix edit exits 1 with a plain-words message that points to the manual `--repin`.
- An independent check passed: each spec line range, extracted with `sed` and stripped of CR, is `cmp`-equal to its output file, and `sha256sum` of the nine files concatenated equals the committed pin `a017ea6d…e32fc`. D.3 has 37 `export function` declarations.

## Task Commits

1. **Task 1: Tracer - `button-primary-md` renders through renderNode as a real button**
   - RED `869d0c2` (test): 12 of 15 tests failed on assertions against an empty list and a `renderNode` that returns null. Both RED records (`src/dev/scenarios/index.test.ts`, `src/dev/renderScenario.test.tsx`) returned `RED_EVIDENCE_OK`.
   - GREEN `534db01` (feat): 19/19 pass, typecheck clean, lint clean.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit (19/19 pass, 0 `error TS`), then started Task 2.
2. **Task 2: Spec appendices extracted byte-exact and pinned by SHA-256**
   - RED `6ed2955` (test): 22 of 23 failed on assertions against a stub that returns an empty map. The RED record returned `RED_EVIDENCE_OK`.
   - GREEN `5241214` (feat): 24/24 pass (a duplicate-heading case was added in GREEN). The pin is committed.

**Plan metadata:** recorded in the docs(02-38) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/dev/scenarios/types.ts`: Scenario data model (plain data only)
- `web/src/dev/scenarios/index.ts`: glob discovery, `collectScenarios`, `scenarios`, `scenarioById`, `assertSerializable`
- `web/src/dev/scenarios/index.test.ts`: list, ordering, group, lookup and guard tests (15)
- `web/src/dev/scenarios/groups/actions.ts`: `button-primary-md`
- `web/src/dev/renderScenario.tsx`: `Kit`, `renderNode`
- `web/src/dev/renderScenario.test.tsx`: renderNode with a test kit (4)
- `web/visual/reference/extract-spec.mjs`: extraction, hash, pin check, CLI
- `web/visual/reference/extract-spec.test.ts`: byte-exactness, CRLF, pin and CLI tests (24, node environment)
- `web/visual/reference/spec-appendix.sha256`: the pin (65 bytes, LF)

## Decisions Made

See `key-decisions` in the frontmatter. The two that matter most to 02-13 and 02-14:
- Nested elements are written as `{ kind: 'node', component, props }`. `handlers` applies to every node in the tree.
- `node web/visual/reference/extract-spec.mjs` exits 1 and writes nothing on a pin mismatch. The reference build should run it first and stop on a non-zero exit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Load-time checks on the scenario list (T-02-80)**
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan checks unique ids and group-equals-file-name only in a unit test. A conversion plan that broke either rule would still build both sides, and the comparison would pair unlike cases.
- **Fix:** The exported `collectScenarios(modules)` runs at module load. It rejects a wrong group, a duplicate id and non-plain data, and four tests cover it. The glob also excludes `groups/*.test.ts`.
- **Files modified:** `web/src/dev/scenarios/index.ts`, `web/src/dev/scenarios/index.test.ts`
- **Committed in:** `534db01`

**2. [Rule 2 - Missing critical] The extraction CLI writes nothing on a mismatch, and its edge cases are tested (T-02-36)**
- **Found during:** Task 2
- **Issue:** The plan says the CLI writes the files and exits 1 on a mismatch, but it does not say whether the unreviewed blocks get written. It also did not cover duplicated headings, fence-less sections or bad arguments.
- **Fix:** On a mismatch nothing is written. The CLI logic is `runExtract({ args, specPath, outDir, pinPath, report })`, tested in temp folders. A duplicated heading, a missing heading or a section with no fence throws and names the heading, and an unknown argument exits 2.
- **Files modified:** `web/visual/reference/extract-spec.mjs`, `web/visual/reference/extract-spec.test.ts`
- **Committed in:** `5241214`

---

**Total deviations:** 2 auto-fixed (2 Rule 2)
**Impact on plan:** Both close silent-failure paths named in the threat register. No scope change and no package change.

## Issues Encountered

- The first `index.ts` had a doc comment that mentioned `import.meta.glob`, which made the acceptance grep count 2. I reworded the comment, and the count is now 1.
- The RED stubs (`void` on unused parameters) failed `no-meaningless-void-operator`. They existed only in the RED commits, and GREEN replaced them. Lint is clean at `5241214`.

## Verification

- `npm --prefix web run test -- --run src/dev visual/reference/extract-spec.test.ts`: 3 files, 43/43 passed
- `npm --prefix web run typecheck`: 0 `error TS`
- `node web/visual/reference/extract-spec.mjs`: exit 0 and all nine files present, including when run from another working directory
- `npm --prefix web run verify` (typecheck, lint, format:check, test:coverage, build): exit 0, 13 files, 218 tests
- `node web/scripts/class-gate.mjs`: exit 0
- Acceptance: `import.meta.glob` in index.ts = 1; `from '@/` = 0 in all four files; `any` patterns in renderScenario.tsx = 0; `git check-ignore web/visual/.reference-src/ui/index.tsx` prints the path; the pin is 65 bytes; `git status --porcelain web/visual` showed only the three task files before the commit

## TDD Gate Compliance

- Task 1: RED `869d0c2` comes before GREEN `534db01`. Both RED records returned `RED_EVIDENCE_OK`.
- Task 2: RED `6ed2955` comes before GREEN `5241214`. The RED record returned `RED_EVIDENCE_OK`.
- No refactor commit was needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **02-13 (reference app):** run `node visual/reference/extract-spec.mjs` before the reference build and stop on a non-zero exit. Import `scenarios` and `renderNode` by relative path. The frozen D.3 components fit `Kit` as they are. Visual/reference ESLint still bans `dangerouslySetInnerHTML` (D.4 `MARK_SVG` use), so it needs the recorded override noted in 02-04.
- **02-14 (showcase):** render each case with `renderNode(kit, scenario.node, scenario.handlers ?? [])` inside `[data-case=<id>]`. `frame: 'viewport'` cases need their own page load.
- **Conversion plans:** add cases to `groups/<group>.ts`. A function-valued prop throws at import, naming the scenario and the prop.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 9 created files exist on disk.
- All 4 task commits (`869d0c2`, `534db01`, `6ed2955`, `5241214`) are in the git log.
