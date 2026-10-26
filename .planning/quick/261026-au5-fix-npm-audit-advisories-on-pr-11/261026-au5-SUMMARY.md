---
created: 2026-10-26T08:33:00-05:00
updated: 2026-10-26T08:33:00-05:00
phase: quick-261026-au5
plan: 01
status: complete
subsystem: dependencies
tags: [npm, audit, zod, vitest, lockfile, OPS-03, QUAL-06]
requirements: [D-63, D-64, D-65, D-66, OPS-03, QUAL-06]
key-files:
  modified:
    - web/package.json
    - web/package-lock.json
    - docs/dependencies.json
    - docs/dependencies.md
    - web/THIRD-PARTY-NOTICES.txt
decisions: [D-63, D-64, D-65, D-66]
commits: 3
plan_head_before: 6f8529031c4ca781c5074648db3bf4e7272a9de2
plan_head_after: 0dc151bc60d74fc0fc564a4b07549195c0baf060
actuals:
  tasks: 3
  commits: 3
---

# Quick 261026-au5: Fix npm audit advisories on PR #11 Summary

*Created: 2026-10-26T08:33:00-05:00 · Updated: 2026-10-26T08:33:00-05:00*

**One-liner:** `npm audit --audit-level=low` is now 0 for `web/` and `tools/openapi-gen/`, using only the owner-approved exact versions (zod 4.6.7 forced tree-wide by one top-level override, vitest and coverage-v8 5.0.4, and lockfile refreshes of undici, fast-uri and ip-address). Nothing was pushed.

## Commits (branch gsd/phase-06-company-expenses)

| Task | Hash | Subject |
|------|------|---------|
| 1 (tracer) | 114296c7 | fix(deps): bump zod to 4.6.7 and override it tree-wide (D-63, D-65) |
| 2 | 3138c377 | fix(deps): bump vitest to 5.0.4 and refresh undici, fast-uri and ip-address (D-63) |
| 3 | 0dc151bc | docs(deps): record the npm audit fixes (D-63 to D-66) |

Commit count is measured: `git rev-list --count 6f8529031c..HEAD` = 3.

## What changed

- `web/package.json`: zod 4.6.7, vitest 5.0.4, @vitest/coverage-v8 5.0.4, and one new top-level override `"zod": "4.6.7"` (last key, after source-map-js). Other overrides unchanged. No nested chromium-bidi override (D-65).
- `web/package-lock.json`: every zod is 4.6.7 and the nested chromium-bidi zod 3.25.76 is gone. undici 8.12.2 (jsdom) and 6.29.1 (node-gyp), fast-uri 3.1.9, ip-address 10.7.4, @vitest/mocker 5.0.4.
- `docs/dependencies.json`: zod, vitest and @vitest/coverage-v8 entries moved, plus one approval record dated 2026-10-26 (D-63, D-65, D-66).
- `web/THIRD-PARTY-NOTICES.txt`: only `zod@4.6.7` and `fast-uri@3.1.9` moved (28 packages, no local paths).
- `docs/dependencies.md`: zod row, override sentence, cool-down count (now five), a new paragraph for the 2026-10-26 fixes and the accepted risk, Updated bumped.
- Unchanged since 6f852903 (checked with `git diff --exit-code`, exit 0): `docs/license-exceptions.json`, `docs/allowed-licenses.json`, `docs/license-guesses.json`, `web/.npmrc`, `tests/`.

## Evidence (quoted)

RED, before any change (Task 1):
- Lockfile zod check, exit 1: `zod not 4.6.7: [ 'node_modules/chromium-bidi/node_modules/zod@3.25.76', 'node_modules/zod@4.6.5' ]`
- Audit check, exit 1: `still flagged: @vitest/coverage-v8, @vitest/mocker, chromium-bidi, fast-uri, ip-address, puppeteer-core, undici, vitest, zod`

After Task 1 (`npm --prefix web install --before=2026-10-13T00:00:00Z`, exit 0):
- `npm --prefix web ls zod --all`: every zod is `zod@4.6.7`, root marked `overridden`, chromium-bidi's `deduped`.
- Smoke: `chromium-bidi parses a valid navigate command` (exit 0).
- `DependencyRegistryTests` run: `Test run summary: Passed! total: 76 failed: 0`. `git status --short tests/` empty.

After Task 2:
- Versions that landed (npm ls): jsdom > undici 8.12.2, node-gyp > undici 6.29.1, fast-uri 3.1.9, ip-address 10.7.4. No retries were needed.
- `npm --prefix web audit --audit-level=low`: `found 0 vulnerabilities` (exit 0). `npm --prefix tools/openapi-gen audit --audit-level=low`: `found 0 vulnerabilities` (exit 0).
- Lockfile check (exit 0) printed only the entries listed below.
- `npm --prefix web run notices:check`: `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`

Task 3 gates:
- `npm --prefix web ci` in a clean `git archive HEAD` export (see Deviations): `added 583 packages ... found 0 vulnerabilities`, exit 0, no warnings. The export's installed tree (`node_modules/.package-lock.json`) matches the real `web/node_modules` exactly: `entries real/export: 583 583 differences: 0`.
- `npm --prefix web run verify` in the real tree, exit 0: typecheck, `eslint . --max-warnings 0`, `All matched files use Prettier code style!`, `Test Files 203 passed (203)`, `Tests 5995 passed (5995)`, build, build:budget, license gate (`production web/ | 28 | ... | 0` and `dev/build/tool ... | 563 | ... | 0`, `License gate passed.`), `THIRD-PARTY-NOTICES.txt is up to date (28 packages).` No warnings in the log (the only "warning" matches are test names and the `--max-warnings 0` flag).
- `dotnet test --project tests/Csps.ArchitectureTests` (full project): `Passed! total: 241 failed: 0 succeeded: 241 skipped: 0`, exit 0.
- Both audits again: `found 0 vulnerabilities`, exit 0 each.

## Deviations from Plan

**1. [Environment] A CSPS dev server was holding web/node_modules, so the in-place clean `npm ci` was not run.**
- Preflight (before Task 1 and again before Task 3) showed port 5180 IN USE by node pid 5380 (`web\node_modules\.bin\..\vite\bin\vite.js`, started 2026-10-26 05:44, parent `npm --prefix web run dev` pid 12036). It is this project's own dev server, not mine and not TheBETSLLC's. I did not kill it.
- Instead I ran `npm --prefix web ci` in a clean export of the committed tree (`git archive HEAD` into the session scratchpad, since deleted) and proved the real `web/node_modules` is identical to it (583 of 583 entries, version, resolved and integrity). `web/package.json` and `web/package-lock.json` were not changed by this (the working tree is clean for them).
- The full `verify` then ran in the real tree and passed. Inside the export, `verify` stopped at one test, `scripts/license-policy.test.ts > license-gate.mjs > exits 1 on a stricter policy given through --exceptions`, because license-checker said `No packages found in this path...` from the export folder. It reproduced when run alone (so not a flake), but the same file passes in the real tree (`64 passed`) and the whole real-tree run passed, so it is a property of the export location, not of these versions. Every step before the tests (typecheck, lint, format) also passed in the export, and 5994 of 5995 tests passed there.
- If the owner wants a literal in-place `npm ci`, stop the dev server (pid 5380 / 12036) and run `npm --prefix web ci` then `npm --prefix web run verify`.

**2. [Rule 3 - npm output] One npm warning outside "Known npm output" appeared (Task 2 install).**
- Command: `npm --prefix web install -D --save-exact vitest@5.0.4 @vitest/coverage-v8@5.0.4`. Output: `npm warn ERESOLVE overriding peer dependency ... Found: @vitest/coverage-v8@5.0.1 ... peerOptional @vitest/coverage-v8@"5.0.1" from vitest@5.0.1`. It is a transient note about the old pair while both are replaced together (each pins the other exactly). The result was clean: `npm ls --all` exit 0, `vitest@5.0.4` and `@vitest/coverage-v8@5.0.4` deduped, and a clean `npm ci` printed no warnings. The msw peer notice from the known list appeared in Task 1 only. I continued rather than stopping, because no package, version or lockfile entry was outside the plan; flagging it so the owner can say if the stop rule should have applied.

**3. [Registry date check]** `@vitest/coverage-v8@5.0.4` was published 2026-10-12T09:45:32Z (vitest 09:47:02Z), so both entries use `published: 2026-10-12` as planned.

No app code, test code or policy file changed. No fix attempts were needed.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access was added.

## Dependency research notes

| Package | Version | From to | Purpose | License | Maintenance | Legitimacy | Cool-down |
|---------|---------|---------|---------|---------|-------------|------------|-----------|
| zod (direct, runtime) | 4.6.7 | 4.6.5 | Browser form validation (OR-3) | MIT, no deps | Published 2026-10-12T16:29:37Z; github.com/colinhacks/zod | Publisher colinhacks; npm provenance attested (slsa.dev/provenance/v1); no install script; not deprecated; `npm audit` shows no zod advisory after the bump. Fixes GHSA-mrhx-c7xc-m3w5 (high, fixed in 4.6.6) | Installed with one-off `--before=2026-10-13T00:00:00Z` (about 3 hours before it turned 14 days old); `accepted:` in the registry (D-63) |
| zod under chromium-bidi | 4.6.7 | 3.25.76 | Same advisory, no zod 3 fix exists | MIT | as above | Forced by the top-level override (D-65) | as above |
| vitest (dev) | 5.0.4 | 5.0.1 | Test runner; pulls @vitest/mocker 5.0.4 (GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp, fixed in 5.0.3) | MIT | Published 2026-10-12T09:47:02Z; github.com/vitest-dev/vitest | Vitest team; provenance attested; not deprecated; 5.0.5 (2026-10-15) skipped, under the cool-down | aged |
| @vitest/coverage-v8 (dev) | 5.0.4 | 5.0.1 | Coverage; must match vitest exactly | MIT | Published 2026-10-12T09:45:32Z; same repo | as vitest | aged |
| ip-address (dev, lockfile only) | 10.7.4 | 10.7.2 | GHSA-rxp7-6hxx-x8q5; reached via license-checker > arborist > ... > socks | MIT | Published 2026-10-11 | Not a pin; no registry entry | aged (10.7.5 skipped) |
| undici under jsdom (dev, lockfile only) | 8.12.2 | 8.11.2 | GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, GHSA-xjj6-f33q-929c | MIT | Published 2026-10-15 | Not a pin | Skipped, security fix (D-63); 8.12.3 not used |
| undici under node-gyp (dev, lockfile only) | 6.29.1 | 6.28.1 | Same advisories | MIT | Published 2026-10-15 | Not a pin | Skipped, security fix (D-63) |
| fast-uri (lockfile only, via @hookform/resolvers > ajv) | 3.1.9 | 3.1.8 | Four GHSAs | BSD-3-Clause | Published 2026-10-19 | Not a pin; moved in the shipped notices | Skipped, security fix (D-63) |

### Test-only moves vitest 5.0.4 and coverage-v8 5.0.4 required (accepted, D-66)

Every entry below is dev-only in the lockfile and traced with `npm explain` to a vitest or coverage-v8 5.0.4 range that the old version did not satisfy. All are MIT unless noted.

| Package | Change | Required by |
|---------|--------|-------------|
| @vitest/mocker | 5.0.1 to 5.0.4 | vitest 5.0.4 (exact) |
| @vitest/spy | 5.0.1 to 5.0.4 | @vitest/mocker 5.0.4 (exact) |
| @vitest/istanbul-lib-coverage | 1.0.1 to 1.0.2 | coverage-v8 5.0.4 (^1.0.2) |
| @vitest/istanbul-lib-report | 1.0.1 to 1.0.2 | coverage-v8 5.0.4 (^1.0.2) |
| chai | 6.2.2 to 6.3.0 | vitest (^6.3.0) |
| obug | 2.2.1 to 3.0.0 (new major) | vitest and coverage-v8 (^3.0.0) |
| std-env | 4.2.0 to 4.3.0 | vitest and coverage-v8 (^4.3.0) |
| tinybench | 6.1.4 to 6.2.2 | vitest (^6.2.2) |
| tinyexec | 1.3.0 to 1.3.1 | vitest (^1.3.1) |
| tinyrainbow | 3.1.1 to 3.2.0 | coverage-v8 (^3.2.0) |
| why-is-node-running | 2.3.0 to 3.2.1 (new major) | vitest (3.2.1 exact) |
| magic-string (two copies, under vitest and under @vitest/mocker) | 1.4.2 to 1.4.3 | @vitest/mocker (^1.4.3) |
| siginfo (ISC), stackback | removed | were dependencies of why-is-node-running 2.x only |

Removed with the zod override: `chromium-bidi/node_modules/zod` 3.25.76.

### Licenses

`docs/license-exceptions.json` needed no entry. Every license in the changed set is on the allow list (MIT, ISC, BSD-3-Clause). The license gate printed `License gate passed.` with 0 problems in both trees (see Evidence).

### Accepted risk: chromium-bidi on zod 4 (D-65, threat T-261026-au5-03)

chromium-bidi 17.0.2 was written against zod 3. With zod 4.6.7 the module and BidiMapper load, and a valid command parses (smoke test passes). A malformed command no longer gives chromium-bidi's own error. Exact result recorded in Task 1, with `BrowsingContext.parseNavigateParams({ context: 1, url: 'https://example.test/' })` run from a scratchpad script:

```
type: TypeError
message: Cannot read properties of undefined (reading 'map')
```

It happens because chromium-bidi's `parseObject` reads `parseResult.error.errors`, which zod 4 does not have. puppeteer-core loads chromium-bidi only through a dynamic import when WebDriver BiDi is requested, and Lighthouse uses the Chrome DevTools Protocol, so no project flow reaches it. The probe script lives only in the session scratchpad. Recorded in `docs/dependencies.md` and in the `docs/dependencies.json` approval.

### Other notes

- The top-level zod override replaced the nested form, and no test code changed (D-65). A future zod bump must change the dependency and the override together.
- Known upstream issues, not new with these versions and not reaching the app today: the zod 4.6 bare `z.any()` / `z.unknown()` object-field regression (planner grep found no use in `web/src` outside tests), and vitest's jsdom FormData file bytes being dropped (web only passes FormData through `core/api/http/httpClient.ts` and nothing uploads files yet).
- The PR's dependency-review check re-runs on the next push. This task did not push.
- Test flake: none. The one failure seen (in the export, Deviation 1) reproduced when run alone and is explained there.

## Self-Check: PASSED

- Files modified exist: web/package.json, web/package-lock.json, docs/dependencies.json, docs/dependencies.md, web/THIRD-PARTY-NOTICES.txt.
- Commits 114296c7, 3138c377 and 0dc151bc are on gsd/phase-06-company-expenses (`git log --oneline 6f852903..HEAD` lists all three).
- `.planning/STATE.md`, `.planning/config.json` and this SUMMARY were not staged or committed.
