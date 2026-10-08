---
phase: 02-web-foundation-design-system
plan: 06
subsystem: infra
tags: [npm-supply-chain, dependency-registry, license-gate, third-party-notices, license-checker-rseidelsohn, spdx, xunit, vitest, tdd]
created: "2026-10-08T11:24:00-05:00"
updated: "2026-10-08T11:24:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-02)
    provides: "web/ installed at the owner-approved exact pins (package.json, lockfile, overrides), license-checker-rseidelsohn 5.0.1, the license:check / notices / notices:check script names"
  - phase: 02-web-foundation-design-system (plan 02-37)
    provides: "tools/openapi-gen/ installed and locked (openapi-typescript 7.13.0, typescript 5.9.3), tsconfig.node.json covering scripts/"
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "verify.mjs STEPS, the fail-on-console Vitest setup, ESLint/Prettier over web/scripts"
provides:
  - "Dependency registry knows npm: kind `npm` with a `manifest` field (web | tools/openapi-gen), pins keyed `{manifest}:{id}`, ranges rejected as not exact"
  - "PackagePins.ReadNpmManifest(json, manifest): dependencies, devDependencies and overrides; npm: aliases resolved to the real package; WebManifestPath / OpenApiGenManifestPath read by ReadAll()"
  - "docs/dependencies.json: 48 npm entries (46 web, 2 tools/openapi-gen); nuqs moved out of planned; approvals for D-25, the 2026-10-07 security overrides, D-34 and D-36"
  - "web/scripts/license-policy.mjs: evaluateTree, validateNpmExceptions, attributeScopes, registryScopes, isAllowed (SPDX OR/AND/WITH)"
  - "web/scripts/npm-tree.mjs: readTree, readScopes, withScopes, readLicenseText (no network)"
  - "web/scripts/license-gate.mjs: production tree strict (allow-list + OFL-1.1 fonts), dev/build/tool trees with scoped D-26 exceptions, stale license and stale scope failures, --allowed / --exceptions"
  - "docs/license-exceptions.json: npmLicenseExceptions (8 licenses) beside the unchanged NuGet exceptions"
  - "web/scripts/third-party-notices.mjs (renderNotices, firstDifference, --write / --check) and web/THIRD-PARTY-NOTICES.txt (16 shipped packages with full license text)"
  - "npm run verify: typecheck, lint, format:check, test:coverage, build, license:check, notices:check"
affects: [02-15, 02-33, every-later-plan-that-adds-an-npm-package, phase-3-ci, ship]

actuals:
  tokens: 37500    # chars/4 over the added lines of the realized diff (150,054 chars, 15 files)
  tasks: 3
  commits: 6
plan_head_before: bc30b45755010cd8102d751f04712f2235fdd9bd
plan_head_after: 16dc9913f145fb7e3f3a2466f70308cf64d8b687

tech-stack:
  added: []
  patterns:
    - "npm registry ids are manifest-qualified ({manifest}:{id}); the registry is sorted by that key with C# OrdinalIgnoreCase"
    - "Why a package is installed (its scope) comes from package-lock.json plus the registry scope of each direct dependency; only installed lockfile entries count"
    - "An exception license counts for a package when at least one of its scopes is listed by the exception; an unused exception or listed scope is stale"
    - "Gate scripts: pure policy module + thin I/O module + CLI; CLI proofs spawn process.execPath with the JS entry (L-22)"

key-files:
  created:
    - web/scripts/license-policy.mjs
    - web/scripts/license-policy.test.ts
    - web/scripts/npm-tree.mjs
    - web/scripts/license-gate.mjs
    - web/scripts/third-party-notices.mjs
    - web/scripts/third-party-notices.test.ts
    - web/THIRD-PARTY-NOTICES.txt
  modified:
    - tests/Csps.ArchitectureTests/PackagePins.cs
    - tests/Csps.ArchitectureTests/DependencyRegistry.cs
    - tests/Csps.ArchitectureTests/DependencyRegistryTests.cs
    - docs/dependencies.json
    - docs/dependencies.md
    - docs/license-exceptions.json
    - web/scripts/verify.mjs
    - web/scripts/verify.test.ts

key-decisions:
  - "npm exception scopes use 'any in-scope reason' semantics: axe-core is needed for test and also pulled in by eslint-plugin-jsx-a11y-x and lighthouse (tool); it passes because test is listed. Subset semantics would have forced MPL-2.0 to add tool, which the owner did not approve (D-26 says build + test)"
  - "Owner-stated scopes kept exactly (MPL-2.0 build+test, MIT-0 test, CC-BY-3.0 tool, Python-2.0 tool). The D-26 licenses with no owner-stated scope were recorded with the scopes the installed tree really uses, which the stale-scope check then enforces: CC-BY-4.0 build+tool, CC0-1.0 test+tool, BlueOak-1.0.0 test+tool, 0BSD tool (the 74621f5 reference had wider or different scopes)"
  - "Scope attribution counts only installed lockfile entries: the lockfile also lists other platforms' optional bindings (wasm), which would otherwise make tslib look like a build package"
  - "Registry legitimacy text was taken from the npm registry on 2026-10-08 (read-only: publish date, license, repository, provenance, install scripts, deprecation, weekly downloads); adopted = 2026-10-08 (the 02-02 / 02-37 installs)"
  - "Four npm cool-down exceptions are recorded as accepted: vite 8.3.3 (security fix, D-25), lucide-react 1.53.0 (D-11 waiver, D-34), source-map-js 1.2.2 and http-cache-semantics 4.3.0 (security overrides, 2026-10-07)"

patterns-established:
  - "Every npm pin (dependencies, devDependencies, overrides) in web/ and tools/openapi-gen/ needs a docs/dependencies.json entry before DependencyRegistryTests passes"
  - "A production dependency change needs `npm --prefix web run notices` and a commit of web/THIRD-PARTY-NOTICES.txt, or verify fails at notices:check"

requirements-completed: [WEB-01]

coverage:
  - id: D1
    description: "The architecture tests read both npm manifests (deps, devDeps, overrides; aliases resolved; manifest-qualified ids) and fail on any unregistered, mismatched, unsorted or ranged npm pin; the real registry passes"
    requirement: WEB-01
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/DependencyRegistryTests.cs (51 cases, 18 new npm cases)"
        status: pass
      - kind: other
        ref: "dotnet test --project tests/Csps.ArchitectureTests (97/97)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The npm license gate passes only when the shipped tree uses the allow-list plus OFL-1.1 fonts and the dev/build/tool trees add only the D-26 + addendum exceptions within their scopes; a stricter policy, an unused exception or an unused scope fails with exit 1"
    requirement: WEB-01
    verification:
      - kind: unit
        ref: "web/scripts/license-policy.test.ts (51 cases, including the --exceptions CLI proof)"
        status: pass
      - kind: other
        ref: "node web/scripts/license-gate.mjs (exit 0: 16 production, 535 dev/build/tool packages); with an empty npmLicenseExceptions list (exit 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "web/THIRD-PARTY-NOTICES.txt lists every shipped package with exact version, license, repository and full license text; notices:check fails on drift and names the first differing package"
    requirement: WEB-01
    verification:
      - kind: unit
        ref: "web/scripts/third-party-notices.test.ts (11 cases, including --check / --write CLI proofs)"
        status: pass
      - kind: other
        ref: "npm --prefix web run notices:check (up to date, 16 packages)"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run verify runs license:check and notices:check after the build and is green"
    requirement: WEB-01
    verification:
      - kind: unit
        ref: "web/scripts/verify.test.ts#runs typecheck, lint, format:check, test:coverage, build, license:check and notices:check in that order"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0; 15 files, 280 tests; build ok; license gate passed; notices up to date)"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/dependencies.md explains the npm registry and the tool-only licenses in plain words for the owner"
    verification: []
    human_judgment: true
    rationale: "Whether the plain-words explanation reads clearly to the owner is a judgment no test makes."

duration: 22min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 06: npm Registry, License Gate and Third-Party Notices Summary

**Every npm pin in `web/` and `tools/openapi-gen/` is now registered and checked by the architecture tests. A license gate keeps the shipped browser tree on MIT/ISC/Apache/BSD (plus OFL fonts) and holds the tool trees to the owner's D-26 exceptions, scope by scope. A drift-checked `web/THIRD-PARTY-NOTICES.txt` carries the full license text of the 16 shipped packages, and `npm run verify` runs both gates.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-08T16:01:12Z
- **Completed:** 2026-10-08T16:23:31Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- `DependencyRegistryTests` reads both npm manifests. `"typescript": "npm:@typescript/typescript6@6.0.2"` becomes the pin `web:@typescript/typescript6 6.0.2`, overrides are pins, and the two `typescript` pins (`web:typescript` 7.0.2, `tools/openapi-gen:typescript` 5.9.3) never collide. A range such as `^1.0.0` fails with "npm pins must be exact".
- `docs/dependencies.json` has 48 npm entries with purpose, license, publisher, legitimacy, publish date, adoption date and cool-down. nuqs moved from `planned` into `packages`, and `planned` is now empty. The approvals now record D-25, the 2026-10-07 security overrides, D-34 and D-36.
- `node web/scripts/license-gate.mjs` passes in about 3.5 s: 16 production packages on the allow-list plus OFL fonts, and 535 dev/build/tool packages within eight scoped exceptions. With no npm exceptions it exits 1 and names axe-core (MPL-2.0) and argparse (Python-2.0).
- `web/THIRD-PARTY-NOTICES.txt` lists the 16 shipped packages (React, React Router, TanStack Query, nuqs, clsx, lucide-react, the two fonts and their dependencies) with full license text. `notices:check` names the first drifting package.
- `npm --prefix web run verify` is green: typecheck, lint, format, 280 tests with coverage, build, license gate and notices check.

## Task Commits

1. **Task 1: Tracer, where the architecture tests read both npm manifests and every npm pin is registered**
   - RED `7adf110` (test): 19 of 51 cases failed on assertions against an inert reader (`RED_EVIDENCE_OK`, target `Csps.ArchitectureTests.DependencyRegistryTests.ReadAllIncludesThePinsOfBothNpmManifests`)
   - GREEN `799aee8` (feat): reader, npm kind, 48 registry entries, approvals, docs
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran the verify after the commit (51/51), then expanded.
2. **Task 2: npm license gate, with production strict, dev trees within the owner-approved exceptions and no stale entries**
   - RED `1355fb3` (test): 37 of 50 cases failed against inert placeholders (`RED_EVIDENCE_OK`, target `scripts/license-policy.test.ts`)
   - GREEN `32970f8` (feat): policy, tree reader, gate, npmLicenseExceptions
3. **Task 3: Repository third-party notices with a drift check, wired into verify**
   - RED `7df36f7` (test): 11 of 16 cases failed (`RED_EVIDENCE_OK` for `scripts/third-party-notices.test.ts` and `scripts/verify.test.ts`)
   - GREEN `16dc991` (feat): notices writer, the notices file, the two verify steps, docs

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Files Created/Modified

- `tests/Csps.ArchitectureTests/PackagePins.cs`: `ReadNpmManifest`, `WebManifestPath`, `OpenApiGenManifestPath`, `NpmSource`, `NpmManifests`; `ReadAll()` includes both npm manifests
- `tests/Csps.ArchitectureTests/DependencyRegistry.cs`: kind `npm`, `manifest` field, `{manifest}:{id}` key for matching, order and duplicates, exact-version rule
- `tests/Csps.ArchitectureTests/DependencyRegistryTests.cs`: 18 new npm cases
- `docs/dependencies.json` / `docs/dependencies.md`: the npm entries, approvals and plain-words npm and tool-license sections
- `docs/license-exceptions.json`: `npmLicenseExceptions` and a description covering both gates (NuGet `exceptions` unchanged)
- `web/scripts/license-policy.mjs`, `npm-tree.mjs`, `license-gate.mjs`, `license-policy.test.ts`: the gate
- `web/scripts/third-party-notices.mjs`, `third-party-notices.test.ts`, `web/THIRD-PARTY-NOTICES.txt`: the notices
- `web/scripts/verify.mjs` / `verify.test.ts`: two new steps

## Decisions Made

- **How exception scopes count.** A package may use an exception license when at least one reason it is installed falls in the exception's scopes. Scopes come from the registry scope of the direct dependencies that pull the package in, via `package-lock.json`. axe-core is a test package that the lint and Lighthouse tools also use, so it passes under the owner's MPL-2.0 "build + test" without adding `tool`.
- **Scopes recorded.** I kept the owner's stated scopes. For the original D-26 licenses with no stated scope, I recorded what the tree really uses, and the stale-scope check enforces it. These lists are narrower than the 74621f5 reference, not wider.
- **Only installed packages count.** The lockfile also lists optional wasm bindings for other platforms, and those would otherwise attribute false scopes.
- **Registry facts.** The legitimacy facts come from read-only registry queries on 2026-10-08. All 48 pins have no install scripts and none is deprecated. 30 of the 48 versions carry npm provenance attestations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] license-checker passes `null`, not `undefined`, as the error on success**
- **Found during:** Task 2 (first gate run)
- **Issue:** `if (error !== undefined)` rejected every successful read, and the process died on an uncaught `null`.
- **Fix:** The check is now `error instanceof Error`.
- **Files modified:** `web/scripts/npm-tree.mjs`
- **Committed in:** `32970f8`

**2. [Rule 2 - Missing critical] Scope enforcement needed a source of truth, and a stale-scope check**
- **Found during:** Task 2
- **Issue:** The plan requires exceptions "only in the listed scopes", but license-checker doesn't say why a package is installed.
- **Fix:** I added `attributeScopes` (lockfile walk with Node resolution, installed entries only), with the registry scope of each direct dependency as the seed. A listed scope that no package needs is reported as stale, alongside the plan's stale-license rule.
- **Files modified:** `web/scripts/license-policy.mjs`, `web/scripts/npm-tree.mjs`, `web/scripts/license-gate.mjs`
- **Committed in:** `32970f8`

**3. [Rule 1 - Bug] A package whose OR alternatives were all out-of-scope exceptions passed silently**
- **Found during:** Task 2 (GREEN review)
- **Fix:** The gate now reports "needs an exception that is not approved for <scopes>", and I added a test for it.
- **Committed in:** `32970f8`

**4. [Rule 3 - Blocking] The notices CLI needed a test seam**
- **Found during:** Task 3
- **Issue:** Proving `--check`/`--write` against the committed file would rewrite it.
- **Fix:** `--file <path>` targets a temporary copy, the same idea as the gate's `--allowed`/`--exceptions`.
- **Committed in:** `16dc991`

**5. [Scope] docs/dependencies.md also changed in Task 3**
- I added a plain-words section on the D-26 tool-only licenses and the notices, and the npm commands in "Adding a dependency". The plan lists the file only under Task 1.

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 1 Rule 2, 1 Rule 3) plus one documentation scope note
**Impact on plan:** The gate is stricter than the plan text (scope attribution and stale scopes). No allow-list was widened and no license was added beyond D-26 and its addendum. No package was installed, upgraded or re-resolved.

## Issues Encountered

- The RED evidence for .NET used `--report-xunit-junit` (xunit.v3 MTP), written to the scratchpad and not committed. Test names in that report are fully qualified, which suits the checker.
- `docs/dependencies.json` is written with LF in the working tree. Git normalizes it, so the warning about LF being replaced by CRLF is cosmetic.

## Conditional Checkpoints

Neither checkpoint fired.
- **Packages:** nothing was installed, upgraded or re-resolved. `package.json` and both lockfiles are unchanged.
- **Licenses:** the gate found only licenses on the allow-list or in D-26 and its addendum. The shipped tree has no exception at all.

## Notes for Later Plans

- **Adding an npm package:** add its `docs/dependencies.json` entry (`kind: npm`, `manifest`, sorted as `{manifest}:{id}`) in the same change, or `DependencyRegistryTests` fails. A new direct dependency without a registry entry gives its transitive packages no scope, so any exception-licensed package under it fails the license gate.
- **Changing a production dependency:** run `npm --prefix web run notices` and commit `web/THIRD-PARTY-NOTICES.txt`, or verify fails at `notices:check`.
- **02-33:** append any new steps after `notices:check` in `STEPS`. `verify.test.ts` pins the full list.
- **Phase 3 CI (ubuntu):** the gate reads installed packages, so lightningcss-linux-* replaces the win32 binding with the same scopes. The scopes are expected to match, but the first CI run should confirm that no stale-scope finding is platform-specific.
- `verify` is about 5 s longer (gate about 3.5 s, notices check about 1.5 s, plus about 4 s for the CLI-proof tests).

## TDD Gate Compliance

Each task has a `test(02-06)` RED commit before its `feat(02-06)` GREEN commit: `7adf110` → `799aee8`, `1355fb3` → `32970f8`, `7df36f7` → `16dc991`. Every RED record returned `RED_EVIDENCE_OK`. No refactor commits were needed.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- WEB-01's build now has a provable supply-chain story (registry, license gate and notices), ready for Phase 3 to wire into CI.
- The registry and license gate are the single place later plans record npm changes.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 7 created files and 8 modified files exist on disk.
- Commits `7adf110`, `799aee8`, `1355fb3`, `32970f8`, `7df36f7` and `16dc991` are on `gsd/phase-2-web-foundation-design-system`.
- I re-ran the acceptance criteria. `"npm"` in DependencyRegistry.cs = 1. `"kind": "npm"` = 48 (at least 40). `"planned"` = 1, and `planned` is empty. `"npmLicenseExceptions"` = 1. `"Python-2.0"` = 1. `docs/allowed-licenses.json` is unchanged. The gate with an empty exception list exits 1. `lucide-react@1.53.0` = 1. `react@19.3.0` = 2. `notices:check` in verify.mjs = 1.
- Plan verification: `dotnet test --project tests/Csps.ArchitectureTests` passes 97/97, `node web/scripts/license-gate.mjs` exits 0, and `npm --prefix web run verify` exits 0.
