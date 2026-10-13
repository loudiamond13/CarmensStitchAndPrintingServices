---
phase: 02-web-foundation-design-system
lane: tooling
created: 2026-10-13T10:03:00-05:00
updated: 2026-10-13T10:03:00-05:00
fixed_at: 2026-10-13T10:03:00-05:00
review_path: .planning/phases/02-web-foundation-design-system/02-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 13
skipped: 2
status: partial
---

# Phase 2: Code Review Fix Report (lane: tooling)

**Fixed at:** 2026-10-13T10:03:00-05:00
**Source review:** .planning/phases/02-web-foundation-design-system/02-REVIEW.md (lane detail: 02-REVIEW-lane-tooling.md)
**Iteration:** 1
**Scope:** TOOL-CR-01 and TOOL-WR-01..14, plus the orchestrator's budget-headroom task (done first).

**Summary:**
- Findings in scope: 15
- Fixed: 13
- Skipped (logged as owner decisions): 2 (TOOL-WR-11, TOOL-WR-13)
- Orchestrator task: done (2 commits), no limit raised

Every behaviour fix was test-first: the new tests were run and failed before the fix, then passed.

## Orchestrator task: dev-route budget headroom

**Commits:** 10ba397 (measurement fix), 30b6e34 (public-route imports)

1. **Measurement fix, as approved.** `web/vite.config.ts` now has a `MODES` table. The `budget` and `e2e` builds have `index.html` as their only entry. A new `parity` mode (`npm run parity`, output `web/.parity-dist`, report `budget.parity.json`) is the only build that has `parity.html`. `budget.ts` and `vite-budget-plugin.ts` take a `build` profile (`production`, `dev-routes` or `parity`) in place of the `devRoutes` flag. The budget and e2e builds now fail on any second entry. Tests prove that the production, budget and parity profiles still fail on an over-budget fixture.
2. **The fix alone was not enough.** It took dev-route public JS from 149.99 KB to only 149.70 KB, because the 02-34 showcase also imports nearly every component. The approved alternative (splitting barrels) was applied in its smallest form. `web/src/app/public/PublicLayout.tsx` now imports `SiteHeader`, `SkipLink` and `ToastProvider` from their own modules instead of the `@/ui/navigation`, `@/ui/entry` and `@/ui/feedback` barrels. Those barrels had pulled Sidebar, Topbar, UserMenu, MobileNavDrawer, the money/OTP inputs, forms, overlays and the HTTP client into the public route's chunks. Nothing looks or behaves differently.
3. **Numbers (gzip -9, 1 KB = 1000 B; no limit changed):**

| Build | Public JS (before → after) | Admin JS | CSS |
|---|---|---|---|
| Production | 130.40 → **126.18 KB** | — | 12.92 KB |
| Budget / e2e | 149.99 → **131.57 KB** | 156.43 KB | 12.92 KB |
| Parity | 149.99 → **131.13 KB** | 155.88 KB | 12.92 KB |

The dev-route builds are back under the 135 KB barrel-split trigger. The parity build is far from its limit, so it is measured the same way as the other builds, with no special rule. `docs/web/budgets.md` is updated, and the deferred item "Dev-route builds: public JS has 0.66 KB of headroom" is resolved in `deferred-items.md`.

## Fixed Issues

### TOOL-CR-01: The production build obeys `VITE_DEV_ROUTES` from the environment and turns off its own D-20 guard

**Files modified:** `web/vite.config.ts`, `web/src/test/build-config.node.test.ts`, `web/src/vite-env.d.ts` (and the budget profile change from 10ba397)
**Commit:** 276e5c8
**Applied fix:**
- Dev routes, the parity entry and the budget profile follow the mode only.
- The production budget profile runs the entry, dev-module and wwwroot-reference checks whatever any flag says.
- A production build throws when `VITE_DEV_ROUTES` is set anywhere: the process environment, or any `.env*` file in `web/`. `.env` files are now read from the web root, not `process.cwd()`.
- Unknown modes throw, including prototype names such as `constructor`.
- Proved by tests that were red before the fix, and by a real `VITE_DEV_ROUTES=true vite build`, which now stops with the D-20 error.

### TOOL-WR-01: The SPDX `WITH` clause accepts any exception id
**Files modified:** `web/scripts/license-policy.mjs`, `web/scripts/license-policy.test.ts`
**Commit:** e4a3719
**Applied fix:** a `WITH` atom passes only when its base license is allowed and its exception id is in `ALLOWED_WITH_EXCEPTIONS`. That list holds only `LLVM-exception`, matched case-sensitively. No installed package uses `WITH`.

### TOOL-WR-02: Guessed licenses pass the gate
**Files modified:** `web/scripts/license-policy.mjs`, `web/scripts/license-gate.mjs`, `web/scripts/license-policy.test.ts`, `docs/license-guesses.json` (new; an empty list), `docs/dependencies.md`
**Commit:** 1605c80
**Applied fix:**
- A guessed (`*`) license now fails unless `docs/license-guesses.json` lists that exact name@version with the confirmed license, a `checked` date and a note.
- Entries are validated. An entry fails as stale when its package is not installed with a guessed license, or when its recorded license no longer matches the guess.
- No package has a guessed license today.

### TOOL-WR-03: The spec-appendix pin cannot see content moved between appendices
**Files modified:** `web/visual/reference/extract-spec.mjs`, `web/visual/reference/extract-spec.test.ts`, `web/visual/reference/spec-appendix.sha256`, `docs/web/parity.md`
**Commit:** 9e63bab
**Applied fix:**
- The pin file has a second line, `framed <sha256>`. It hashes each block with its file name and UTF-8 length in front, and both lines must match.
- The framed line was added by a scratch script, and only after it checked that today's appendices still match the owner-reviewed 02-38 pin. Line 1 is unchanged.
- `--repin` was never run, and the content was not re-pinned.

### TOOL-WR-04: A reference fragment silently replaces a frozen spec component
**Files modified:** `web/visual/reference/kit.ts`, `web/visual/reference/merge-kit.ts` (new), `web/visual/reference/merge-kit.test.ts` (new)
**Commit:** e0e598a
**Applied fix:** the merge now throws on a fragment/spec name clash unless the name is on the decision-tagged `SPEC_OVERRIDES` map, which is empty. It also throws when two fragments export the same name. There is no clash today (17 fragment names, 42 spec exports).

### TOOL-WR-05: The icon mask hides every 24 x 24 SVG drawing
**Files modified:** `web/visual/intentional-differences.ts`, `web/visual/compare.ts`, `web/visual/parity.spec.ts`, `web/visual/compare.test.ts`, `web/visual/icon-mask.test.ts` (new), `docs/web/parity.md`
**Commit:** 06f7bff
**Applied fix:**
- The D-32 mask now also needs the side's own icon class: `csp-icon` on the reference side (the frozen App. D.3 `Icon`) and `lucide` on the app side (pinned by `Icon.test.tsx`).
- No source markup changed.
- The in-page walker is tested over a fake document, which proves a non-icon 24 x 24 svg is still compared.
- The full parity matrix passed afterwards (452/452).

### TOOL-WR-06: Class strings held in variables escape the class gates
**Files modified:** `web/scripts/class-gate.mjs`, `web/scripts/tailwind-classes.test.ts`, `docs/web/styling.md`
**Commit:** 5724f0f
**Applied fix:**
- An identifier in a class position is now read through its initializer when it is a const in the same file. Cycles are handled.
- `runClassGate` uses the TypeScript checker to follow an imported identifier, through `@/` paths and barrels, to the non-recipe src module that declares it, and checks it there.
- The real source has no findings.

### TOOL-WR-07: The colour-literal gates miss most CSS colour syntaxes
**Files modified:** `web/scripts/class-gate.config.mjs`, `web/eslint.config.mjs`, `web/scripts/tailwind-classes.test.ts`, `web/src/test/lint-rules.node.test.ts`, `docs/web/styling.md`
**Commit:** 16530f0
**Applied fix:**
- One `COLOUR_LITERAL_SOURCE` now covers hex, every CSS colour function and the 148 named colours inside a bracket value, in any letter case.
- It still allows `color-mix()` over `var()`, `transparent` and `currentColor`.
- The ESLint `no-restricted-classes` rule uses the same source.
- The real source has no findings.

### TOOL-WR-08: The preflight is report-only
**Files modified:** `web/scripts/shared-machine.mjs` (new), `web/scripts/shared-machine.test.ts` (new), `web/scripts/e2e.mjs`, `parity.mjs`, `lighthouse.mjs`, `owner-review.mjs` and their tests, `docs/web/{e2e,parity,owner-review,release-gates}.md`
**Commit:** dc8ee74
**Applied fix:**
- The shared `C:\Work\dev-tools\preflight.ps1` was **not edited**.
- The new gate runs it with its output captured, echoes the report, and parses it.
- The gate waits (30 s polls, up to 15 minutes, then exit 1 with a plain message) while either:
  - one of this project's ports is in use by a program that is not this project's, or
  - a TheBETSLLC or `BetsLLC.*` dev/test process is listed. Editor helpers such as tsserver are excepted.
- A failing or unrecognisable report counts as busy.
- When the script is missing (CI), the gate logs one line and goes on.
- It never stops or signals anything.
- The four run scripts call the gate in `main()`, after taking their lock.

### TOOL-WR-09: A crashed run leaves its lock behind
**Files modified:** `web/scripts/e2e.mjs`, `e2e.test.ts`, `parity.mjs`, `lighthouse.mjs`, `owner-review.mjs`, `docs/web/e2e.md`, `docs/web/parity.md`
**Commit:** 927c288
**Applied fix:**
- A lock is taken over at once in two cases:
  - its pid is no longer running. This is checked read-only with `tasklist`/`ps`, never with a signal, and a failed check counts as alive.
  - it is older than 3 hours, which covers pid reuse.
- A takeover renames the stale lock aside first. If the renamed file turns out to be a newer lock, it is linked back.
- The timeout message names the file to delete when no run is going on.
- Every run script also releases its lock on SIGHUP.

### TOOL-WR-10: On Linux and macOS, Ctrl+C leaves the API host running
**Files modified:** `web/scripts/lighthouse.mjs`, `web/scripts/owner-review.mjs`, `web/scripts/lighthouse-assert.test.ts`
**Commit:** 33c4963
**Applied fix:**
- `lighthouse.mjs` keeps track of the hosts it started, and exports `stopHostSync` and `stopRunningHostsSync`.
- On Linux and macOS these send SIGTERM to the host's own process group, then SIGKILL after a 3 s grace period. On Windows they run `taskkill /T /F` on that one child, as before.
- The Lighthouse and owner-review signal handlers call it before they release the lock and exit.

### TOOL-WR-12: The CWE-79 lint rule covers only the JSX attribute
**Files modified:** `web/eslint.config.mjs`, `web/src/test/lint-rules.node.test.ts`
**Commit:** 75182f4
**Applied fix:**
- The rule now also bans:
  - `innerHTML`/`outerHTML` assignment
  - `insertAdjacentHTML`, `setHTMLUnsafe`, `parseHTMLUnsafe`, `createContextualFragment`
  - `document`/`ownerDocument` `.write`/`.writeln`
  - `new DOMParser()`
  - a `dangerouslySetInnerHTML` property in `createElement` props
  - iframe `srcDoc`
- Reading `innerHTML` (tests do this) and stream `.write()` stay allowed.
- The whole web tree lints clean.

### TOOL-WR-14: The E2E guard ignores requests that fail with no response, and covers only the default page
**Files modified:** `web/e2e/fixtures.ts`, `web/e2e/fixture-selftest.spec.ts`, `docs/web/e2e.md`
**Commit:** c7d6bc7
**Applied fix:**
- The guard now records same-origin `requestfailed` events. Cancellations (by a navigation or an AbortController) are not counted.
- `guard.expectFailure(urlPart)` lets a test declare an expected network failure. It also covers the browser's "Failed to load resource" console line.
- Listeners now cover every page in the context (`context.on('page')`), and the CSP binding and init script are context-wide.
- Two new `@fixture` self-tests were red before the fix. They pass in chromium, firefox and webkit (18/18 `@fixture`).
- The full E2E run shows no false findings (518/518).

## Skipped Issues

### TOOL-WR-11: The Barlow Condensed fallback tries Arial Narrow first but is sized for Arial

**File:** `web/src/styles/base.css:162` (also `web/visual/reference/rulings.css:36`, `web/scripts/font-metrics.mjs`)
**Reason:** skipped because it needs an owner decision, and it is now logged in `deferred-items.md` under "Owner decisions pending" (commit 5035ef5).
- `src: local("Arial Narrow"), local("Arial")` is one of the UI-SPEC's exact values, which `font-metrics.test.ts` pins.
- Dropping it would change the font-loading look on machines that have Arial Narrow.
- The other option, recording Arial Narrow's own metrics, needs a machine with that font. It is not installed here.

The entry gives the options (a) drop the local source, (b) add a second, measured face, (c) keep the values as they are.

**Original issue:** with Arial Narrow installed, the 68.92% size-adjust shrinks an already-narrow face. This causes a layout shift when Barlow Condensed arrives.

### TOOL-WR-13: The `.npmrc` cool-down waivers name a package, have no end date, and outlive the fix they were for

**File:** `web/.npmrc:6-14`
**Reason:** skipped because npm cannot do what the brief asked. It is logged as an owner decision (commit 5035ef5).
- npm 11.19 matches `min-release-age-exclude` against package **names** only: exact names or globs (`@npmcli/arborist/lib/release-age-exclude.js`). A waiver cannot be narrowed to a version.
- The brief allowed the change only if npm's syntax supports it, and package policy is the owner's.
- The installed versions are exactly the approved ones: vite 8.3.3, source-map-js 1.2.2, http-cache-semantics 4.3.0, lucide-react 1.53.0.
- Nothing was installed or resolved.

The entry gives the options: remove the aged-out lines after 2026-10-14 and 2026-10-18, remove the vite line, and/or add a dated waiver gate to verify.

**Original issue:** a waiver keyed on a package name lets every future release skip the 14-day cool-down.

## Verification

All gates ran in the **main checkout** (`C:/Work/CarmensStitchAndPrintingServices`, branch `gsd/phase-2-web-foundation-design-system`), not in a worktree. They can be reproduced from this tree.

| Gate | Result |
|---|---|
| `npm --prefix web run verify` | exit 0. Vitest 106 files / 2950 tests passed. Typecheck, lint (`--max-warnings 0`), format, coverage thresholds, production and budget builds, license gate and notices all passed. |
| `npm --prefix tools/openapi-gen run check` | exit 0 (generated types match the snapshot) |
| `npm --prefix tools/openapi-gen run test` | exit 0 (9 passed) |
| `npm --prefix web run e2e` (full, 5 projects; the shared-machine gate ran first and was clear) | **518 passed** (28.3 min) |
| `npm --prefix web run parity` (full matrix, 3 engines; the gate ran first) | **452 passed** (26.3 min) |

The preflight was clear before every run: ports 5180, 5115, 7028 and 5199 were free, and no other project's processes were listed.

## Notes for later work

- The parity implementation build now runs `vite build --mode parity` (output `.parity-dist`). The budget and e2e builds no longer contain `parity.html`, and they fail if it comes back.
- `web/.env.e2e` and `web/.env.budget` no longer control the dev-route switch, because the mode decides it. They are kept, and are harmless.
- `deferred-items.md` was also edited concurrently by the orchestrator (commit a1b2fe0). Only this lane's lines were changed.

---

_Fixed: 2026-10-13T10:03:00-05:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
