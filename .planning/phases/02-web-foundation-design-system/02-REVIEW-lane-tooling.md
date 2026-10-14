---
phase: 02-web-foundation-design-system
lane: tooling
created: 2026-10-13T05:36:25-05:00
updated: 2026-10-13T05:36:25-05:00
reviewed: 2026-10-13T10:36:24Z
depth: standard
files_reviewed: 66
files_reviewed_list:
  - tools/openapi-gen/.npmrc
  - tools/openapi-gen/check.mjs
  - web/.npmrc
  - web/.prettierignore
  - web/e2e/fixtures.ts
  - web/e2e/sweep.ts
  - web/eslint.config.mjs
  - web/index.html
  - web/parity.html
  - web/playwright.config.ts
  - web/scripts/budget.ts
  - web/scripts/class-gate.config.mjs
  - web/scripts/class-gate.mjs
  - web/scripts/design-side-by-side.mjs
  - web/scripts/e2e.mjs
  - web/scripts/font-metrics.mjs
  - web/scripts/gen-golden-vectors.mjs
  - web/scripts/golden-math.mjs
  - web/scripts/license-gate.mjs
  - web/scripts/license-policy.mjs
  - web/scripts/lighthouse-assert.mjs
  - web/scripts/lighthouse.mjs
  - web/scripts/npm-tree.mjs
  - web/scripts/owner-review.mjs
  - web/scripts/parity.mjs
  - web/scripts/third-party-notices.mjs
  - web/scripts/verify.mjs
  - web/scripts/vite-budget-plugin.ts
  - web/scripts/vite-preload-font-plugin.ts
  - web/scripts/vite-route-preload-plugin.ts
  - web/visual/compare.ts
  - web/visual/guard.ts
  - web/visual/intentional-differences.ts
  - web/visual/parity-matrix.ts
  - web/visual/playwright.visual.config.ts
  - web/visual/reference/extract-spec.mjs
  - web/visual/reference/fragments/AdminShell.tsx
  - web/visual/reference/fragments/DefinedTotalsNote.tsx
  - web/visual/reference/fragments/DimmedZeroKpi.tsx
  - web/visual/reference/fragments/FailedConfirmDialog.tsx
  - web/visual/reference/fragments/IconSet.tsx
  - web/visual/reference/fragments/KeyboardScrollTable.tsx
  - web/visual/reference/fragments/ListTable.tsx
  - web/visual/reference/fragments/MediaPlaceholderNoChip.tsx
  - web/visual/reference/fragments/OpenedDialog.tsx
  - web/visual/reference/fragments/OpenedSiteDrawer.tsx
  - web/visual/reference/fragments/Overlay.tsx
  - web/visual/reference/fragments/PublicShell.tsx
  - web/visual/reference/fragments/RatedTestimonial.tsx
  - web/visual/reference/fragments/RevealPassword.tsx
  - web/visual/reference/fragments/TabsWithPanel.tsx
  - web/visual/reference/fragments/Toolbar.tsx
  - web/visual/reference/fragments/WalkInOrderCard.tsx
  - web/visual/reference/index.html
  - web/visual/reference/kit.ts
  - web/visual/reference/main.tsx
  - web/visual/reference/reference.css
  - web/visual/reference/rulings.css
  - web/visual/reference/select.ts
  - web/visual/reference/spec-appendix.sha256
  - web/visual/scenarios.ts
  - web/visual/serve.ts
  - web/visual/vite.reference.config.ts
  - web/visual/webkit-style-sync.ts
  - web/vite.config.ts
  - web/vitest.config.ts
findings:
  critical: 1
  warning: 14
  info: 9
  total: 24
status: issues_found
---

# Phase 2: Code Review Report (lane: tooling)

**Reviewed:** 2026-10-13T10:36:24Z
**Depth:** standard
**Files Reviewed:** 66 (of 68 in the lane list)
**Status:** issues_found

## Summary

This lane covers the web build, verify, budget, license, class-gate, E2E, Lighthouse, owner-review, parity and
OpenAPI-drift tooling, plus the Vite, Vitest, Playwright and ESLint configs. The review looked hardest at gates that
could pass when they should fail.

Most gates fail closed and are written with care. The budget graph walk throws on an unknown chunk. A missing
Lighthouse category or metric counts as a failure. The notices check fails when the tree is empty. The spec extraction
writes nothing when the pin does not match. Path guards protect every script that writes files, and nothing passes
untrusted input to a shell.

The weak spots are where a gate trusts something that it does not check itself:

- **Critical (CR-01):** the switch that turns dev routes on is read from `process.env` and from git-ignored `.env.*`
  files, and production mode honours it. The D-20 guard in the budget plugin is turned off by that same switch, so dev
  and admin routes and `parity.html` can reach `wwwroot` with no error.
- **License policy:** any `X WITH <anything>` passes when X is allowed. Licenses that license-checker only guessed also
  pass.
- **Parity yardstick:** the spec pin hashes the blocks joined with no separator. Fragments can silently shadow frozen
  spec components. The icon mask covers every SVG whose viewBox is `0 0 24 24`, not only icons.
- **Class and colour gates:** they only read literal class positions, and their colour-literal patterns miss most CSS
  colour syntaxes.
- **Shared-machine run scripts:** the preflight only prints a report and never makes a run wait. A crashed run leaves
  the lock in place. On POSIX, Ctrl+C leaves the host running.

Not opened: `web/.env.budget` and `web/.env.e2e`. The secret-file guard blocks reading them. Their role, the
`VITE_DEV_ROUTES` switch, was reviewed through `vite.config.ts`.

## Critical Issues

### CR-01: The production build obeys `VITE_DEV_ROUTES` from the environment and turns off its own D-20 guard

**File:** `web/vite.config.ts:30-31` (also `:48`, `:52`, `:69`, `:84-91`); `web/scripts/budget.ts:196-206`;
`web/scripts/vite-budget-plugin.ts:110-114`

**Issue:** The config computes:

```ts
const env = loadEnv(mode, process.cwd(), 'VITE_');
const devRoutes = mode === 'development' || env.VITE_DEV_ROUTES === 'true';
```

Vite's `loadEnv` merges every `VITE_*` variable from `process.env`. The installed `vite/dist/node/chunks/node.js` has
`for (const key in process.env) if (prefixes.some(...)) env[key] = process.env[key]`, so process variables win over the
files. It also reads `.env`, `.env.local`, `.env.production` and `.env.production.local`. `.gitignore` ignores all of
these through `.env*`, so a developer can have one locally and it never shows up in review.

So a plain production `vite build` with `VITE_DEV_ROUTES=true` in the shell, in CI, or in an untracked `.env.local`
produces this:

- `outDir` is still `../src/Csps.Server/wwwroot`, because that choice depends only on `mode`.
- `__DEV_ROUTES__` is `true`, so the admin preview, `/dev/components` and `src/dev/**` are compiled in.
- `parity.html` becomes a second entry in `wwwroot`.
- `budgetPlugin({ devRoutes: true })` skips exactly the checks meant to catch this: the "unexpected entry" check, the
  `DEV_ONLY_MODULE_PREFIXES` check (`budget.ts:196`) and the wwwroot reference-folder check
  (`vite-budget-plugin.ts:112`).
- `routePreloadPlugin` is dropped as well.

The build passes with no error, and the deployable web root ships dev-only code (CWE-489, D-20). The guard and the
thing it guards depend on the same untrusted flag.

A smaller issue in the same code: `process.cwd()` is not the config directory. Running from the repository root with
`--config web/vite.config.ts` silently drops `.env.e2e` and `.env.budget`.

**Fix:** Decide dev routes from the mode only, refuse the flag in production, and key the production checks to the
mode, not the flag:

```ts
const webRoot = fileURLToPath(new URL('.', import.meta.url));
const DEV_ROUTE_MODES = new Set(['development', 'e2e', 'budget']);
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, webRoot, 'VITE_');
  if (mode === 'production' && env.VITE_DEV_ROUTES !== undefined && env.VITE_DEV_ROUTES !== 'false') {
    throw new Error('VITE_DEV_ROUTES must never be set for a production build (D-20).');
  }
  const devRoutes = DEV_ROUTE_MODES.has(mode) && (mode === 'development' || env.VITE_DEV_ROUTES === 'true');
  // ...
  budgetPlugin({ devRoutes, production: mode === 'production' }),
```

In `evaluateBudgets` and `writeBundle`, run the entry, dev-module and reference-folder checks whenever
`production === true`, whatever `devRoutes` says. Add a test that sets `process.env.VITE_DEV_ROUTES = 'true'` and
expects the production config to throw.

## Warnings

### WR-01: The SPDX `WITH` clause accepts any exception id, so restrictive add-ons pass as the base license

**File:** `web/scripts/license-policy.mjs:118-124`

**Issue:** `atom()` checks only that the token after `WITH` is a plain id, then returns `allowed.has(baseLicense)`.
So `Apache-2.0 WITH Commons-Clause`, or `MIT WITH LicenseRef-NonCommercial`, passes as Apache-2.0 or MIT. The Commons
Clause forbids selling the software, the opposite of the free-only rule (D-00). The license tests cover malformed
expressions but not a hostile exception id.

**Fix:** Keep an explicit list of allowed exception ids (for example `LLVM-exception` and `Classpath-exception-2.0`)
and fail on any other:

```js
const ALLOWED_WITH = new Set(['LLVM-exception', 'Classpath-exception-2.0']);
if (peek() === 'WITH') { take(); const id = take(); if (!isPlain(id)) throw ...; if (!ALLOWED_WITH.has(id)) return false; }
```

### WR-02: Licenses that license-checker only guessed pass the gate and are just printed

**File:** `web/scripts/license-policy.mjs:169-172`, `:186-187`, `:326-328`; `web/scripts/license-gate.mjs:121-124`

**Issue:** license-checker adds a `*` to a license it guessed, often from a README line such as "License: MIT".
`withoutGuessMark` strips the `*` and the package is judged as if it had declared that license. The gate only prints
one "Guessed licenses" line. A new transitive package whose README guess is wrong passes a gate that enforces a binding
owner rule.

**Fix:** Fail on a guessed license unless that exact `name@version` is listed in a reviewed file such as
`docs/license-guesses.json`, with the license text checked. Report a listed guess that no longer appears as stale, the
same way stale exceptions are reported.

### WR-03: The spec-appendix pin cannot see content moved from one appendix to the next

**File:** `web/visual/reference/extract-spec.mjs:107-113`

**Issue:** `hashAppendices` feeds the nine blocks into one SHA-256 with no separator. Every block ends in `\n`, so a
line moved from the end of one appendix to the start of the next leaves the joined bytes, and the hash, unchanged. The
extracted files still change. For example, a rule moved from `components.css` to `screens.css` changes the cascade
layer. The "the yardstick never moves silently" promise breaks.

**Fix:** Hash each block with its file name and length, then re-pin once with the owner:

```js
for (const file of Object.values(APPENDIX_FILES)) {
  const text = blocks.get(file) ?? '';
  hash.update(`${file}\0${Buffer.byteLength(text, 'utf8')}\0`, 'utf8');
  hash.update(text, 'utf8');
}
```

### WR-04: A reference fragment silently replaces a frozen spec component with the same name

**File:** `web/visual/reference/kit.ts:30-33`

**Issue:** `kit = { ...components(spec), ...fragments }`, and the comment says "fragments win on a name clash". If
someone adds `fragments/Button.tsx` (or any of the 42 frozen exports), the reference side renders hand-written code in
place of the approved design. Parity then compares the app against a copy anyone can edit, not against the pinned spec,
and no check or registry entry records it. There is no clash today (checked against `.reference-src/ui/index.tsx`).

**Fix:** Throw on a clash unless the name is in an explicit, decision-tagged wrap list:

```ts
const clashes = Object.keys(fragmentComponents).filter((name) => name in specComponents && !WRAPS.has(name));
if (clashes.length > 0) throw new Error(`Fragments shadow frozen spec components: ${clashes.join(', ')}`);
```

### WR-05: The icon mask hides every 24 x 24 SVG drawing, not only lucide icons

**File:** `web/visual/intentional-differences.ts:109-116`; `web/visual/compare.ts:253`, `:388-390`

**Issue:** The D-32 mask is keyed only on `viewBox="0 0 24 24"`. Any SVG with that viewBox has its subtree removed
from the style comparison and its drawing masked in screenshots. That includes spinners, check marks, chevrons inside
components, and the brand mark if it uses that viewBox. A broken path in any of them, or a wrong drawing, is invisible
to parity. D-32 approved new icon drawings, not "any 24 px SVG".

**Fix:** Mark icon wrappers explicitly on both sides (for example `data-icon` on the lucide wrapper and on the
reference `Icon`) and mask only `svg[data-icon][viewBox="0 0 24 24"]`. Add a test that a non-icon 24 x 24 SVG is still
compared.

### WR-06: Class strings held in variables outside `*.recipe.ts` escape both class gates

**File:** `web/scripts/class-gate.mjs:116-150`, `:177-196`; `web/eslint.config.mjs:273-277`

**Issue:** The class gate and `better-tailwindcss` read only `className` literals and branches, `clsx` and `tw`
arguments, and string literals in recipe files. `readClassExpression` ignores identifiers. So the following passes
both gates and compiles to no CSS:

```ts
const x = 'bg-blue-500';
<div className={x} />
```

That is exactly the cleared-default bug the gate exists to catch. The source has 275 `className={identifier}` sites.
Today they all point at `tw()` results in recipes, but only by convention.

**Fix:** Pick one:

- Add a lint rule that a `className={Identifier}` must resolve to an import from a `*.recipe.ts` module or to a `tw()`
  or `clsx()` initialiser.
- Have the class gate resolve identifiers to their initialisers through the TypeScript checker and read those.

### WR-07: The colour-literal gates miss most CSS colour syntaxes

**File:** `web/scripts/class-gate.config.mjs:31`; `web/eslint.config.mjs:287-289`

**Issue:** Both gates ban only `#hex`, `rgb(`, `rgba(` and `oklch(`. These compile under Tailwind v4, so they also pass
the "unknown" check:

- `bg-[hsl(0_0%_50%)]`
- `text-[hwb(...)]`, `lab(`, `lch(`, `oklab(`, `color(`, `color-mix(`
- named colours: `bg-[red]`, `text-[color:tomato]`, `border-[transparent]`

UI-SPEC transcription rule 2 (colours come from tokens) can be bypassed without either gate noticing.

**Fix:** Ban any arbitrary colour value that is not a `var(--…)` token. One option is a single pattern on the bracket
content of colour-taking utilities, e.g. `/\[(?:color:)?(?!var\()[^\]]+\]/` for
`bg-`/`text-`/`border-`/`fill-`/`stroke-`/`ring-`/`outline-`/`shadow-`/`from-`/`via-`/`to-`/`decoration-`/`accent-`/`caret-`.
The simpler option is to add `hsla?\(|hwb\(|lab\(|lch\(|oklab\(|color\(|color-mix\(` plus a named-colour list. Use the
same pattern in both files.

### WR-08: The preflight is report-only, so E2E, Lighthouse, owner-review and parity runs never wait for TheBETSLLC

**File:** `web/scripts/e2e.mjs:48-57`; `web/scripts/lighthouse.mjs:66-75`; `web/scripts/owner-review.mjs:186-195`;
`web/scripts/parity.mjs:38-46`

**Issue:** CLAUDE.md is binding: "If a port is IN USE by another project, or TheBETSLLC's test processes are listed,
wait." `C:\Work\dev-tools\preflight.ps1` only prints its report and always exits 0. Each script prints that report and
starts building, seeding and starting a host at once. Only port 5199 is actually checked. A TheBETSLLC Playwright or
test run in progress does not stop or delay anything, and the warning scrolls past in inherited output. On a machine
without the preflight script, the step is skipped with no message.

**Fix:** After the preflight, do the check in the script itself. For example, list processes whose command line
contains `C:\Work\TheBETSLLC` with `Get-CimInstance Win32_Process`. Refuse, or wait under the same 15-minute rule as the
lock, while any are running. Log a line when the preflight script is missing instead of skipping it silently.

### WR-09: A crashed run leaves `.locks/e2e.lock` behind, and every later run waits 15 minutes and then fails

**File:** `web/scripts/e2e.mjs:122-162`

**Issue:** The lock is released by `finally`, on `exit` and on SIGINT/SIGTERM. It is not released when the run is
killed (Task Manager, `taskkill /F`, closing the console, which sends SIGHUP on Windows, or a power loss). The token
already holds the PID, but `acquireLock` never checks whether that process is still alive. Every later e2e, Lighthouse
or owner-review run polls for 15 minutes and then says "Another ... run has held ... Wait for it to finish", which is
wrong, and nothing tells the user how to recover. `parity.lock` has the same problem.

**Fix:** On `EEXIST`, read the token. If its PID is no longer running (`process.kill(pid, 0)` throws `ESRCH`), or the
lock is older than a hard ceiling, remove it with an atomic rename-then-delete and try again. Name the lock file and how
to clear it in the timeout message. Handle `SIGHUP` too.

### WR-10: On Linux and macOS, Ctrl+C leaves the API host running on 5199

**File:** `web/scripts/lighthouse.mjs:214-220`, `:330-336`; `web/scripts/owner-review.mjs:976-982`

**Issue:** `startHost` spawns the host with `detached: true` on non-Windows systems, in its own process group, so the
terminal's SIGINT does not reach it. `onSignal` releases the lock and calls `process.exit(130)` without calling
`host.stop()`. The `finally` that would stop the host never runs after `process.exit`. Result: an orphaned `dotnet`
host on 5199 and a released lock. The next run then refuses with "port busy", or, worse, a run that starts later talks
to the stale host.

**Fix:** Keep a module-level reference to the running host. In `onSignal`, stop it synchronously before exiting (on
POSIX, `process.kill(-pid, 'SIGTERM')`, then `SIGKILL` after a short wait). Alternatively, set a flag and let the
`async` flow unwind instead of calling `process.exit`.

### WR-11: The Barlow Condensed fallback tries Arial Narrow first but is sized for Arial

**File:** `web/scripts/font-metrics.mjs:65-76`; `web/visual/reference/rulings.css:36`; (`web/src/styles/base.css:162`,
other lane)

**Issue:** The fallback face is `src: local("Arial Narrow"), local("Arial")` with `size-adjust: 68.92%`. The recorded
metrics say Arial Narrow "was not installed on the measuring machine, so the display face is matched against Arial".
Arial Narrow ships with Microsoft Office and many Windows installs, and its glyphs are about 18% narrower than Arial's.
On those machines, size-adjust shrinks the already narrow face a second time: display text in the fallback is far too
narrow, and the swap to Barlow Condensed shifts the layout. That is the PERF-05/CLS failure the face exists to prevent.
Lighthouse on the measuring machine cannot see it.

**Fix:** Either drop `local("Arial Narrow")` from the face (it falls back to Arial, the font it was measured against),
or record Arial Narrow's metrics and use a separate `@font-face` per local source. The `--font-display` stack can keep
"Arial Narrow" after the fallback face, where it is unadjusted.

### WR-12: The lint rule for CWE-79 covers only the JSX `dangerouslySetInnerHTML` attribute

**File:** `web/eslint.config.mjs:102-105`

**Issue:** None of these is banned, so each is a raw-HTML sink that lint lets through:

- `element.innerHTML = …`, `outerHTML`, `insertAdjacentHTML`, `document.write` and `DOMParser`-to-DOM injection
- `createElement(tag, { dangerouslySetInnerHTML })`
- `iframe` `srcdoc`

None is used in `src/` today. The ban exists to keep it that way, and right now it only does that for one syntax.

**Fix:** Add to `syntaxBans`:

```js
{ selector: "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]", message: 'Raw HTML injection is forbidden (CWE-79).' },
{ selector: "CallExpression[callee.property.name=/^(insertAdjacentHTML|write|writeln)$/]", message: 'Raw HTML injection is forbidden (CWE-79).' },
{ selector: "Property[key.name='dangerouslySetInnerHTML']", message: 'Raw HTML injection is forbidden (CWE-79).' },
{ selector: "JSXAttribute[name.name='srcDoc']", message: 'Raw HTML injection is forbidden (CWE-79).' },
```

### WR-13: The `.npmrc` cool-down waivers name a package, have no end date, and outlive the fix they were for

**File:** `web/.npmrc:6-14`

**Issue:** `min-release-age-exclude[]=vite`, `=source-map-js` and `=http-cache-semantics` were approved for one
security version each (vite 8.3.3, source-map-js 1.2.2, http-cache-semantics 4.3.0). The waivers name the package, not
the version, so every future release of these packages, including a compromised one, skips the 14-day cool-down. The
comments give "ages out" dates (2026-10-14 and 2026-10-18), but nothing removes the lines or fails when those dates
pass. CLAUDE.md allows skipping the cool-down only for security fixes, with a recorded reason, and the reason here
applies to one version.

**Fix:** Add a check to `license-gate.mjs`, or a small `npmrc-gate` test, that parses the `min-release-age-exclude`
lines. It should fail when an excluded package's installed version is not the approved one, or when today is past the
recorded age-out date. Remove the source-map-js and http-cache-semantics lines once they age out. Pin the vite waiver to
8.3.3 in that check.

### WR-14: The E2E guard ignores requests that fail with no response, and covers only the default page

**File:** `web/e2e/fixtures.ts:95-126`

**Issue:** The visual guard records `requestfailed` (`visual/guard.ts:270-272`), but the E2E guard does not. A
same-origin script, font, chunk or API call that fails at network level (aborted, reset, `net::ERR_*`) gets no
`response` event. Firefox writes no console line for it either, so the test passes on a page that is missing a
resource. The guard is also attached only to the fixture `page`. A page from `context.newPage()` or a popup (the
sign-in flows later) is not guarded at all.

**Fix:** Add `page.on('requestfailed', …)` for same-origin URLs, with the same `expectStatus`-style opt-out. Guard
every page in the context through `context.on('page', watch)`, as `guard.ts` does for `appPage`.

## Info

### IN-01: The license gate never checks that each tree was actually read

**File:** `web/scripts/license-gate.mjs:80-99`

**Issue:** If `tools/openapi-gen/node_modules`, or a production dependency of `web/`, is missing, license-checker
reports only the root. A license problem in the missing part then cannot be seen. The stale-exception check fails
closed only by accident.

**Fix:** Check that every direct dependency in each `package.json` appears in its tree, and fail if not.

### IN-02: The OpenAPI type-drift check is not part of `npm run verify`

**File:** `web/scripts/verify.mjs:11-20`; `tools/openapi-gen/check.mjs`

**Issue:** D-16 drift is caught only when someone runs `npm --prefix tools/openapi-gen run check` by hand
(`docs/web/release-gates.md`). No CI workflow exists yet.

**Fix:** Add a verify step, or a root script that runs both, so the generated types cannot drift between releases.

### IN-03: The comment says E2E and parity share a lock, but they don't

**File:** `web/scripts/e2e.mjs:3-4`, `:111`; `web/scripts/parity.mjs:23`

**Issue:** The E2E header says the lock is "shared with the parity ... runs", but parity takes `parity.lock`. Parity's
`build-app` and E2E's `build` both run `--mode e2e` and write `artifacts/budget/budget.e2e.json`, so the two can run at
the same time and overwrite each other's file.

**Fix:** Correct the comment, and give the parity build its own report mode or folder.

### IN-04: Builds in a custom mode write to output folders nothing ignores

**File:** `web/vite.config.ts:69`

**Issue:** `.${mode}-dist` is ignored only for `e2e` and `budget`. `vite build --mode development` or `--mode staging`
writes `.development-dist` or `.staging-dist`, which git, ESLint and Prettier all pick up.

**Fix:** Allow only the known modes (throw otherwise), or ignore `web/.*-dist/`.

### IN-05: `openReviewPage` leaks its browser context on failure

**File:** `web/scripts/owner-review.mjs:793-824`

**Issue:** If `goto`, the status check or the `h1` wait throws, the context created at `:795` is never closed. Only
`browser.close()` cleans it up later.

**Fix:** Wrap the steps after `newContext` in `try`, and call `context.close()` in `catch` before rethrowing.

### IN-06: The side-by-side "every network request is blocked" promise is broader than the code

**File:** `web/scripts/design-side-by-side.mjs:306-314`

**Issue:** `context.route('**/*')` does not intercept WebSockets (that needs `routeWebSocket`) or service-worker
fetches (that needs `serviceWorkers: 'block'`), and DNS prefetch and preconnect bypass it too.

**Fix:** Add `serviceWorkers: 'block'` to `newContext`, add a `routeWebSocket(/.*/, ws => ws.close())`, or reword the
promise.

### IN-07: The WebKit screenshot discount can hide a real inline-style CSP violation

**File:** `web/visual/webkit-style-sync.ts:41-50`

**Issue:** The discount removes up to N matching violations for N screenshots. If Playwright skips its style toggle for
a screenshot, the page's own blocked `<style>` is discounted in its place. Chromium and Firefox would usually still
catch it, unless the violation happens only in WebKit.

**Fix:** Pair each discount with a timestamp window around the screenshot call.

### IN-08: `check.mjs` argument parsing and working directory

**File:** `tools/openapi-gen/check.mjs:80-91`, `:66`

**Issue:** `--snapshot --generated` takes `--generated` as the path. `spawnSync` inherits the caller's working
directory, so a `redocly.yaml` there can change the output of openapi-typescript.

**Fix:** Use `node:util` `parseArgs`, and pass `cwd: fileURLToPath(new URL('.', import.meta.url))`.

### IN-09: The Lighthouse gate scores the production bundle on a Development-environment host, from one run

**File:** `web/scripts/lighthouse.mjs:84-93`, `:161-175`; `web/scripts/lighthouse-assert.mjs:69-123`

**Issue:** `ASPNETCORE_ENVIRONMENT=Development` can change headers, compression, caching and error handling compared
with production. The score comes from a single run. `runtimeError` and `finalDisplayedUrl` are not checked, so a
redirect to another page would be scored as `/`.

**Fix:** Run the host in Production with the dev certificate passed per process, or record the difference in
`docs/web/release-gates.md`. Fail when `runtimeError` is present or `finalDisplayedUrl` is not `LIGHTHOUSE_URL`.
Consider the median of 3 runs.

---

_Reviewed: 2026-10-13T10:36:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
