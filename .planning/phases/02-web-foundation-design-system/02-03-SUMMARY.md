---
phase: 02-web-foundation-design-system
plan: 03
subsystem: supply-chain
tags: [npm, licenses, dependency-registry, third-party-notices, license-checker-rseidelsohn, archunit-tests, vitest]
created: "2026-10-07T23:24:34-05:00"
updated: "2026-10-07T23:24:34-05:00"

# Dependency graph
requires:
  - phase: 02-web-foundation-design-system (plan 02-01)
    provides: web/package.json and tools/openapi-gen/package.json with exact pins, web/.npmrc min-release-age, license-checker-rseidelsohn 5.0.1 installed
  - phase: 02-web-foundation-design-system (plan 02-02)
    provides: web lint/typecheck/test/build `verify` script and scripts/** test include
  - phase: 01 (QUAL-06)
    provides: DependencyRegistry/PackagePins NuGet + dotnet-tool registry test, NuGet license gate and notices
provides:
  - npm-aware PackagePins (folder-qualified ids `web/<name>`, `tools/openapi-gen/<name>`, alias resolution, overrides read as pins)
  - DependencyRegistry kind `npm` and scope-aware license exceptions (license AND scope)
  - 62 npm registry entries in docs/dependencies.json; nuqs moved from planned to packages; D-25/D-11/D-26 approvals
  - docs/license-exceptions.json `npmLicenseExceptions` (D-26, dev/build tree only)
  - web/scripts/license-policy.mjs (isAllowed, evaluateTree, formatNotices, validateNpmExceptions)
  - web/scripts/license-gate.mjs (production strict, dev/build within D-26, stale-exception check; `--allowed`/`--exceptions` proof flags)
  - web/scripts/third-party-notices.mjs + committed web/THIRD-PARTY-NOTICES.txt with `--check` drift detection
affects: [02-16 (wires license:check and notices:check into verify), phase 3 CI and deploy, any plan adding an npm package]

actuals:
  tokens: 24785
  tasks: 2
  commits: 5
plan_head_before: 88912f25c2a3710e609c4573f83d8604cd50af06
plan_head_after: ecfbe48f3df7068b270ab6c999cf0bf50b9f9919

tech-stack:
  added: []
  patterns:
    - "npm pin ids are qualified by manifest folder; an `npm:<name>@x.y.z` alias records x.y.z"
    - "license exceptions match on license AND scope; npm exceptions are license-level and never apply to the production tree"
    - "generated notices file has no timestamp, is sorted, and is drift-checked with --check"

key-files:
  created:
    - web/scripts/license-policy.mjs
    - web/scripts/license-policy.test.ts
    - web/scripts/license-gate.mjs
    - web/scripts/third-party-notices.mjs
    - web/scripts/npm-tree.mjs
    - web/THIRD-PARTY-NOTICES.txt
  modified:
    - tests/Csps.ArchitectureTests/PackagePins.cs
    - tests/Csps.ArchitectureTests/DependencyRegistry.cs
    - tests/Csps.ArchitectureTests/DependencyRegistryTests.cs
    - docs/dependencies.json
    - docs/dependencies.md
    - docs/license-exceptions.json

key-decisions:
  - "package.json `overrides` (the owner-approved exact transitive pins) are registered like direct pins, so the registry has 62 npm entries rather than the 44 direct pins"
  - "D-BL-01 (MIT-0, CC-BY-3.0, Python-2.0 in the dev/build tree) deferred to the owner (backlog 999.1); no license exception added and no package changed"

patterns-established:
  - "Registry id scheme: `<manifest folder>/<package name>` for npm, so the two typescript pins never collide"
  - "License gate refusal text: never widen the allow-list or exceptions; report the package to the owner (D-00, D-26)"

requirements-completed: [WEB-01]

coverage:
  - id: D1
    description: "Every npm pin in web/package.json and tools/openapi-gen/package.json is registered with a folder-qualified id, exact version, kind npm, scope and cool-down status"
    requirement: WEB-01
    verification:
      - kind: unit
        ref: "dotnet test --project tests/Csps.ArchitectureTests (DependencyRegistryTests incl. NpmPinsAreExactVersions, ReadNpmManifestQualifiesIdsAndResolvesAliases) - 102/102"
        status: pass
    human_judgment: false
  - id: D2
    description: "Scope-aware license exceptions: MPL-2.0 accepted for test and build scopes, OFL-1.1 font-only"
    requirement: WEB-01
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/DependencyRegistryTests.cs (scope exception cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SPDX policy evaluation, tree checks, stale-exception detection and notices formatting"
    requirement: WEB-01
    verification:
      - kind: unit
        ref: "web/scripts/license-policy.test.ts (npm --prefix web run verify, 82 vitest tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm license gate: production tree strict (passes, 16 packages); dev/build tree within D-26"
    requirement: WEB-01
    verification:
      - kind: other
        ref: "node web/scripts/license-gate.mjs - exit 1, only the five D-BL-01 packages fail; no production-tree problem"
        status: fail
    human_judgment: true
    rationale: "Owner decision D-BL-01 (backlog 999.1) is open: three free licenses (MIT-0, CC-BY-3.0, Python-2.0) in the dev/build tree are outside D-26. Only the owner can approve or reject them."
  - id: D5
    description: "web/THIRD-PARTY-NOTICES.txt generated, committed and drift-checked"
    requirement: WEB-01
    verification:
      - kind: other
        ref: "node web/scripts/third-party-notices.mjs --check - exit 0 (16 packages)"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-10-07
status: complete
---

# Phase 2 Plan 03: npm Supply-Chain Controls Summary

**Every npm pin (both manifests, plus exact overrides) is in the dependency registry with folder-qualified ids and scope-aware license exceptions. A license-checker-rseidelsohn gate checks the production web tree strictly and the dev/build tree against the D-26 exceptions, and a committed, drift-checked THIRD-PARTY-NOTICES.txt covers the shipped npm packages. The gate's dev/build check stays red until the owner decides D-BL-01.**

## Performance

- **Duration:** about 24 min (two executor sessions with a decision checkpoint between them)
- **Started:** 2026-10-08T03:59:48Z
- **Completed:** 2026-10-08T04:24:34Z
- **Tasks:** 2 of 2
- **Files modified:** 12

## Accomplishments

- `PackagePins.ReadNpmManifest` reads `dependencies`, `devDependencies` and `overrides` of `web/package.json` and `tools/openapi-gen/package.json`. Ids look like `web/react` and `tools/openapi-gen/typescript`, and an alias spec `npm:<name>@x.y.z` records x.y.z. Any non-exact spec (caret, tilde, range, tag, URL, file path) fails `NpmPinsAreExactVersions`.
- `DependencyRegistry` gains kind `npm`. A license exception now matches only when the license AND the scope both match, so MPL-2.0 is accepted for build (lightningcss) and test (axe), and OFL-1.1 stays font-only.
- `docs/dependencies.json` has 62 `"kind": "npm"` entries. `web/nuqs` moved from `planned` to `packages`, and `planned` is now `[]`. The file records the lucide-react D-11 waiver, the vite security-fix acceptance with its three GHSA ids, an MPL-2.0 build-scope policy exception, and the D-25/D-11/D-26 approvals.
- `docs/license-exceptions.json` gains `npmLicenseExceptions` for MPL-2.0, CC-BY-4.0, CC0-1.0, BlueOak-1.0.0 and 0BSD. These are license-level and apply to the dev/build tree only. The NuGet `exceptions` key is unchanged.
- `web/scripts/license-gate.mjs`: the production web tree is gated against the allow-list plus OFL fonts (passes, 16 packages). The dev/build tree of web/ and tools/openapi-gen/ is gated against the allow-list plus the D-26 exceptions. An exception that no package uses fails as stale.
- `web/scripts/third-party-notices.mjs` writes a sorted `web/THIRD-PARTY-NOTICES.txt` with no timestamp, and `--check` exits 1 on drift.

## Task Commits

1. **Task 1 (tracer): DependencyRegistryTests reads both npm manifests; every npm pin registered**
   - `a6a9e87` test(02-03): failing tests for npm pins, the npm kind and scope-aware license exceptions (RED)
   - `c7923eb` feat(02-03): register every npm pin with folder-qualified ids and scope-aware license exceptions (GREEN)
2. **Task 2: npm license gate (production strict, dev tree within D-26) and web notices with a drift check**
   - `155fe48` test(02-03): failing tests for the npm license policy and notices lines (RED)
   - `a6ab200` feat(02-03): npm license gate and web notices with a drift check (GREEN)

The orchestrator made `ecfbe48` (docs: backlog item 999.1, owner decisions deferred during Phase 2). It falls inside the plan's ledger range, so the measured `commits: 5` counts it. Four of the five commits are this plan's task commits.

**Plan metadata:** recorded in the docs(02-03) close-out commit.

## TDD / RED Evidence

- **Task 1 RED:** `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"` exited 2 with 24 of 56 tests failing. For example, `ReadNpmManifestQualifiesIdsAndResolvesAliases` expected `[web/react 19.3.0 npm, web/typescript 6.0.2 npm]` but got `[]`. The evidence checker returned RED_EVIDENCE_OK.
- **Task 2 RED:** `npx vitest run scripts/license-policy.test.ts` exited 1 with 17 of 28 tests failing. For example, `isAllowed > accepts an allowed license` expected true but got false. The evidence checker returned RED_EVIDENCE_OK.
- **Tracer gate (Task 1):** interactive mode, end-of-phase, automated-only verify. ArchitectureTests re-ran 102/102 after GREEN, so the plan moved on to Task 2.

## Gate Proofs (Task 2 acceptance)

- **Without MPL-2.0** (temporary policy via `--exceptions`): exit 1 with 11 problems. Six of them are the MPL-2.0 packages (`@axe-core/playwright@4.13.0`, `axe-core@4.13.0`, `lightningcss@1.32.0`/`1.33.0`, `lightningcss-win32-x64-msvc@1.32.0`/`1.33.0`) and five are the D-BL-01 packages.
- **Stale exception** (temporary file adding EUPL-1.2, which no package uses): exit 1.
- **Production strictness** (temporary allow-list without MIT): 13 production-tree problems even though the dev exceptions were present. This shows the D-26 exceptions never reach the production tree.
- **With the three D-BL-01 licenses added** (a temporary scratch file only, never committed): exit 0, with 16 production and 522 dev/build packages and no stale exceptions.

## Verification (re-run at close-out, 2026-10-07)

| Command | Result |
|---|---|
| `node web/scripts/license-gate.mjs` | **exit 1**. Only the 5 D-BL-01 packages fail (see below), and the production tree has no problems |
| `node web/scripts/third-party-notices.mjs --check` | exit 0 ("up to date (16 packages)") |
| `npm --prefix web run verify` | exit 0 (eslint max-warnings 0, typecheck, 82/82 vitest, build) |
| `dotnet test --project tests/Csps.ArchitectureTests` | 102/102 |
| `dotnet test --solution Csps.slnx` (CSPS_TEST_SQL=localdb, per process, after preflight) | 590/590, 0 warnings |

Acceptance greps: `"kind": "npm"` = 62 (at least 45 required). `"id": "web/nuqs"`, `"id": "web/typescript"` and `"id": "tools/openapi-gen/typescript"` each = 1. THIRD-PARTY-NOTICES.txt has 2 react 19.3.0 lines and 1 lucide-react line. `"npmLicenseExceptions"` = 2, not the expected 1: the key appears once, and the file's `description` text names it a second time (see deviations).

## Open Item: Deferred Owner Decision D-BL-01

**The plan check "`node web/scripts/license-gate.mjs` exits 0" is NOT MET.** It waits on owner decision **D-BL-01**, parked in backlog phase 999.1 at `.planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md` (commit `ecfbe48`). The owner was away. Nobody decided for the owner, no license exception was added, and no package was changed.

The gate fails on exactly five dev/build packages. None of them ships to the browser, and all are free:

| License | Package | Pulled in by |
|---|---|---|
| MIT-0 | @csstools/color-helpers 6.1.1 | jsdom 30.1.1 (test) |
| MIT-0 | @csstools/css-syntax-patches-for-csstree 1.1.14 | jsdom 30.1.1 (test) |
| CC-BY-3.0 | spdx-exceptions 2.5.0 | license-checker-rseidelsohn 5.0.1 (tool) |
| MIT AND CC-BY-3.0 | spdx-ranges 2.1.1 | license-checker-rseidelsohn 5.0.1 (tool) |
| Python-2.0 | argparse 2.0.1 | openapi-typescript 7.13.0 → @redocly/openapi-core → js-yaml (tools/openapi-gen) |

**Downstream dependency:** plan **02-16** wires `license:check` (and `notices:check`) into `npm run verify`. Until D-BL-01 is decided, wiring the gate makes `verify` fail. Plan 02-16 depends on this decision.

**Exact steps for option A (owner approves all three as dev/build-only exceptions):**
1. In `docs/license-exceptions.json`, add three objects to `npmLicenseExceptions`, in the same shape as the D-26 entries (`license`, `scopes`, `examplePackages`, `pulledInBy`, `reason`, `approved`, `approvedBy: "owner"`) and citing decision ID D-BL-01:
   - `MIT-0`: scopes `["test"]`. Example packages: @csstools/color-helpers, @csstools/css-syntax-patches-for-csstree. Pulled in by jsdom.
   - `CC-BY-3.0`: scopes `["tool"]`. Example packages: spdx-exceptions, spdx-ranges. Pulled in by license-checker-rseidelsohn.
   - `Python-2.0`: scopes `["tool"]`. Example package: argparse. Pulled in by openapi-typescript (tools/openapi-gen).
   - Reason in plain words: "free; never shipped to the browser". These remain license-level and dev/build tree only, never production.
2. Add a D-26 addendum line to `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md` that records the approval and its date.
3. Add a line to `docs/dependencies.md` (D-26 exceptions section) and update its `Updated:` timestamp.
4. Re-run `node web/scripts/license-gate.mjs` (expect exit 0, with 16 production and 522 dev/build packages and no stale exceptions) and `npm --prefix web run verify`. Then mark D-BL-01 resolved in the 999.1 DECISIONS.md.

Option B (reject some or all) means replacing jsdom, license-checker-rseidelsohn or openapi-typescript. Each replacement is a new package and needs its own approval.

## Other Open Item (from plan 02-01)

`vite build` with `build.license: true` writes `.vite/license.md` into `src/Csps.Server/wwwroot`. Nobody has checked against a running host whether ASP.NET Core static files serve that dot-folder or whether `dotnet publish` deploys it. This plan's notices header documents that the file is emitted, but no Phase 2 plan moves or excludes it. It is **flagged for the Phase 3 deploy work**: verify the publish output and exclude or relocate the file.

## Files Created/Modified

- `tests/Csps.ArchitectureTests/PackagePins.cs`: npm manifest reader (`WebManifestPath`, `OpenApiGenManifestPath`, `ReadNpmManifest`, `ExactVersionOf`; overrides included)
- `tests/Csps.ArchitectureTests/DependencyRegistry.cs`: kind `npm`, tool/npm/nuget kind mapping, scope-aware `ValidateLicense`
- `tests/Csps.ArchitectureTests/DependencyRegistryTests.cs`: sample-data cases and `NpmPinsAreExactVersions`
- `docs/dependencies.json`: 62 npm entries, nuqs moved, MPL-2.0 build exception, approvals
- `docs/dependencies.md`: npm id scheme, alias handling, scope rules, D-26 exceptions
- `docs/license-exceptions.json`: `npmLicenseExceptions` (D-26) and an updated description
- `web/scripts/license-policy.mjs`: pure SPDX evaluation, tree checks, notices formatting, exception validation
- `web/scripts/license-policy.test.ts`: unit tests (node environment)
- `web/scripts/npm-tree.mjs`: shared license-checker-rseidelsohn tree reader for the gate and the notices script
- `web/scripts/license-gate.mjs`: the gate (with `--allowed` and `--exceptions` proof flags)
- `web/scripts/third-party-notices.mjs`: notices generator with `--check`
- `web/THIRD-PARTY-NOTICES.txt`: generated production-tree notices (16 packages)

## Decisions Made

- Exact `overrides` in package.json are registered as pins: rolldown 1.2.11, 15 `@rolldown/binding-*` packages, source-map-js 1.2.2 and http-cache-semantics 4.3.0. They are owner-approved exact versions in the shipped graph, and the registry should account for every pinned version.
- D-BL-01 deferred (option C). The owner was away, and nothing was decided for them.

## Deviations from Plan

### Auto-fixed / scope adjustments

**1. [Rule 2 - Missing critical] `overrides` read as pins (+18 entries)**
- **Found during:** Task 1
- **Issue:** The plan listed only `dependencies` and `devDependencies`. Exact versions pinned through `overrides` (rolldown, 15 bindings, source-map-js, http-cache-semantics) would then have no registry entry, legitimacy record or cool-down record.
- **Fix:** `NpmSections` includes `overrides`. axe-core is pinned both directly and through an override, so it is deduped to one entry. The result is 62 npm entries against the plan's estimate of about 45 direct pins.
- **Committed in:** `c7923eb`

**2. [Rule 3 - Blocking] 02-01 approvals reduced to decision text**
- **Found during:** Task 1
- **Issue:** The approval entries from plan 02-01 carried structured per-package fields that the registry schema now holds in `packages`.
- **Fix:** Those approvals keep only the decision text. The structured fields moved to the npm package entries.
- **Committed in:** `c7923eb`

**3. [Rule 3 - Blocking] Extra file `web/scripts/npm-tree.mjs` and extra export `validateNpmExceptions`**
- **Found during:** Task 2
- **Issue:** The gate and the notices script both need the same license-checker tree read, and the gate needs to validate the shape of the exception file.
- **Fix:** Added a shared tree reader and a pure `validateNpmExceptions` (unit-tested). No new package.
- **Committed in:** `a6ab200`

**4. [Rule 2 - Correctness] CC0-1.0 and BlueOak-1.0.0 exception entries list every observed package and scope**
- **Found during:** Task 2
- **Issue:** The plan named one example package and scope each, but the real tree has more packages under these licenses.
- **Fix:** `examplePackages` and `scopes` list everything observed. The exceptions are still license-level D-26 entries, and no new license was added.
- **Committed in:** `a6ab200`

**5. [Note] `"npmLicenseExceptions"` grep prints 2, not 1**
- The key appears once. The file's `description` text names it a second time to explain the two gates. The intent of the acceptance check (a single key) is met.

`tools/openapi-gen/*` entries use scope `tool`, as the plan specifies.

---

**Total deviations:** 4 adjustments (2 Rule 2, 2 Rule 3) and 1 note. No new package, no widened allow-list and no license exception beyond D-26.
**Impact on plan:** Coverage and correctness improve. The one unmet check is the deferred owner decision above. It is not caused by a deviation.

## Issues Encountered

- The dev/build tree contains three free licenses outside D-26 (D-BL-01). Execution stopped at a blocking-human decision checkpoint, and the orchestrator deferred the item to backlog 999.1.

## User Setup Required

None. The owner still needs to decide D-BL-01 (see above).

## Next Phase Readiness

- Plans that add npm packages must add registry entries. DependencyRegistryTests fails otherwise.
- **Blocker for 02-16:** D-BL-01 must be decided before `license:check` joins `verify`, or 02-16 must wire it in a way the owner accepts.
- Phase 3: CI calls the same gate and notices commands. The `.vite/license.md` wwwroot placement needs checking at deploy.

## Self-Check: PASSED (with one documented deferred check)

- FOUND: all 12 created or modified files listed above.
- FOUND: commits a6a9e87, c7923eb, 155fe48, a6ab200 (and the orchestrator's ecfbe48).
- PASSED: ArchitectureTests 102/102, full solution 590/590, web verify exit 0, notices --check exit 0, build 0 warnings.
- **NOT PASSED (deferred, D-BL-01):** `node web/scripts/license-gate.mjs` exits 1, failing only on the five D-BL-01 dev/build packages. This SUMMARY does not claim the gate passes.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-07*
