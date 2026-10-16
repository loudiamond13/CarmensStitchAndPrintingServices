---
created: "2026-10-15T21:05:00-05:00"
updated: "2026-10-15T21:05:00-05:00"
phase: 03-ci-cd-staging-deploy
kind: patterns
---

# Phase 3: CI/CD & Deploy - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 26 (new and modified)
**Analogs found:** 20 / 26 (every analog path below is git-tracked)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/Csps.ArchitectureTests/CiWorkflowTests.cs` (new) | test (repo text lint) | file-I/O | `tests/Csps.ArchitectureTests/BuildConfigTests.cs` + `HostingRecordTests.cs` | exact |
| `tests/Csps.ArchitectureTests/CiRepoHygieneTests.cs` (new: CODEOWNERS, PR template, dependabot, .gitleaks.toml, .githooks, app_offline not in web/public) | test | file-I/O | `BuildConfigTests.cs` | exact |
| `tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs` (modify: urlCompression, optional rewrite) | test | file-I/O | itself | exact |
| `src/Csps.Server/web.config` (modify, OPS-05) | config | n/a | itself | exact |
| `src/Csps.Server/Csps.Server.csproj` (modify: exclude `logs/**`, `appsettings.Development.json`; `RuntimeIdentifiers`) | config | build | itself (+ `Directory.Build.props`) | exact |
| `src/*/packages.lock.json` (regenerate for win-x64) | config | build | n/a (generated) | n/a |
| `web/playwright.config.ts` (modify: `CSPS_E2E_CONNECTION`) | config | request-response | itself lines 92-97 | exact |
| `web/scripts/e2e.mjs` + `e2e.test.ts` (modify: `--connection`) | utility | batch | itself | exact |
| `web/scripts/merge-gate.mjs` + `.test.ts` (new) | utility (pure decision) | transform | `web/scripts/verify.mjs` / `verify.test.ts` | role-match |
| `web/scripts/smoke.mjs` + `.test.ts` (new) | utility | request-response (fetch injected) | `web/scripts/e2e.mjs` (plan-as-data + injected I/O) | role-match |
| `web/scripts/deploy.mjs` + `.test.ts` (new) | utility (arg builder + orchestrator) | batch (spawn injected) | `web/scripts/e2e.mjs` `planSteps`/`executeSteps` | exact |
| `web/scripts/package-check.mjs` + `.test.ts` (new, optional; or inline pwsh) | utility | file-I/O | `web/scripts/license-gate.mjs` / `verify.mjs` | role-match |
| `web/src/modules/public/pages/HoldingPage.tsx` + `.test.tsx` (new, D-17) | component (page) | n/a | `web/src/modules/public/pages/PublicPlaceholderPage.tsx` + `.test.tsx` | exact |
| `web/src/core/routes/router.tsx` (modify: `*` route to holding page) | route | n/a | itself lines 32-37 | exact |
| `web/src/dev/previews/PublicShell.tsx` (modify if placeholder removed) | component | n/a | itself line 22 | exact |
| `tools/scripts/Merge-PullRequest.ps1` (new) | utility | request-response (gh) | `tools/scripts/Invoke-CoverageGate.ps1` | role-match |
| `tools/scripts/Install-Gitleaks.ps1` (new) | utility | file-I/O | `tools/scripts/Invoke-CoverageGate.ps1` | role-match |
| `tools/scripts/Invoke-CoverageGate.ps1` (modify: path literals for Linux) | utility | batch | itself lines 67-68, 184-186 | exact |
| `docs/operations/cutover-runbook.md`, `deploy.md`, `branch-rules.md` (new) | docs | n/a | `docs/operations/bootstrap-manager.md` | exact |
| `.planning/HOSTING-RECORD.md`, ROADMAP/REQUIREMENTS/PROJECT amendments | docs | n/a | `HostingRecordTests.cs` governs shape | exact |
| `.github/workflows/ci.yml` (new) | config (CI) | batch | none | no analog |
| `.github/workflows/weekly.yml` (new) | config (CI) | batch | none | no analog |
| `.github/workflows/deploy.yml` (new) | config (CI) | batch | none | no analog |
| `.github/dependabot.yml`, `CODEOWNERS`, `pull_request_template.md` (new) | config | n/a | none | no analog |
| `.githooks/pre-commit`, `.gitleaks.toml` (new) | config | n/a | none | no analog |
| `tools/deploy/app_offline.htm` (new, self-contained) | static asset | n/a | none (must NOT use web/public or Tailwind) | no analog |

## Pattern Assignments

### `tests/Csps.ArchitectureTests/CiWorkflowTests.cs` and `CiRepoHygieneTests.cs` (test, file-I/O)

**Analog:** `tests/Csps.ArchitectureTests/BuildConfigTests.cs`, with `RepoRoot.cs` and `HostingRecordTests.cs`.

**Imports + class shape** (BuildConfigTests lines 1-8). The class is `sealed partial` so `[GeneratedRegex]` can be used, with a one-line XML summary naming the requirement IDs:
```csharp
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Csps.ArchitectureTests;

/// <summary>Strict build configuration rules (QUAL-01) and the forbidden-package list (PC-8).</summary>
public sealed partial class BuildConfigTests
```

**Repo-relative file access** (RepoRoot.cs lines 14-15). Use it, not a private copy as in WebConfigTests:
```csharp
public static string PathOf(string relativePath) =>
    Path.GetFullPath(Path.Combine(Find(), relativePath.Replace('/', Path.DirectorySeparatorChar)));
```

**Line-based text assertion** (BuildConfigTests lines 84-94). Use this for "every `uses:` line is `@<40-hex> # vX`", "`permissions: {}` at the top", "`persist-credentials: false`", and "verify.mjs STEPS appear in order":
```csharp
var lines = File.ReadAllLines(RepoRoot.PathOf(".editorconfig")).Select(line => line.Trim()).ToList();
var section = lines.IndexOf("[src/Csps.Infrastructure/Persistence/Migrations/**.cs]");
section.ShouldBeGreaterThanOrEqualTo(0, "The root-relative migrations section is missing (research Pitfall 4).");
```

**Collect offenders, then one ShouldBeEmpty** (lines 118-129):
```csharp
var offenders = ProjectFiles()
    .SelectMany(path => ...Select(element => $"{ToRepoRelative(path)}: {(string?)element.Attribute("Include")}"))
    .ToList();
offenders.ShouldBeEmpty("Versions belong in Directory.Packages.props only.");
```

**Regex at the bottom** (lines 172-173):
```csharp
[GeneratedRegex(@"^\d+\.\d+\.\d+$", RegexOptions.CultureInvariant)]
private static partial Regex ExactVersion();
```

**Detector-with-sample idea** (HostingRecordTests lines 39-48). Copy it for the SHA-pin regex and the `${{ }}`-inside-`run:` detector, so a broken pattern cannot pass silently:
```csharp
private static readonly (Regex Pattern, string Sample)[] SecretDetectors =
[
    (PasswordAssignment(), "Server=x;Password = hunter2"),
    ...
];
```
Note: these HostingRecordTests samples are gitleaks false positives (RESEARCH Pitfall 11). `.gitleaks.toml` must allowlist this file by path.

**Ordered-steps contract to assert:** `web/scripts/verify.mjs` lines 11-20 (`STEPS`). Import the list by reading the file, or hard-code it and mirror `verify.test.ts` lines 28-39.

---

### `tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs` (modify)

Add one `[Fact]` per new element, using the existing `Load()` helper (lines 46-51) and the same descent style (lines 21-27):
```csharp
var requestFiltering = Load().Descendants("security").Elements("requestFiltering").ShouldHaveSingleItem();
requestFiltering.Attribute("removeServerHeader").ShouldNotBeNull().Value.ShouldBe("true");
```
New fact: `Load().Descendants("urlCompression").ShouldHaveSingleItem()` with `doDynamicCompression="false"` and `doStaticCompression="false"`. Line 17 (`arguments` `.\Csps.Server.dll`) changes only if the self-contained fallback is taken.

### `src/Csps.Server/web.config` (modify)

The current file (lines 1-22) stays. Line 2's comment ("Phase 3 (OPS-05) adds compression, caching and rewrite rules here") must be rewritten, because caching stays in the app. Insert `<urlCompression doStaticCompression="false" doDynamicCompression="false" />` inside `<system.webServer>` after `<httpProtocol>` (line 19). Add the `<rewrite>` HTTPS rule only after HostProbe proves URL Rewrite is present (RESEARCH Pattern 8). The app-side cache constants live in `src/Csps.Server/Composition/SpaRegistration.cs:45-52`; do not duplicate them in IIS.

### `src/Csps.Server/Csps.Server.csproj` (modify)

Follow the file's convention: each `PropertyGroup`/`ItemGroup` gets a one-line XML comment with the requirement ID (lines 3, 8, 23):
```xml
<!-- QUAL-05: the Testing-only controllers are compiled into Debug builds only, so a Release build cannot contain them. -->
<PropertyGroup Condition="'$(Configuration)' == 'Debug'">
```
Add an `ItemGroup` with `<Content Remove="logs\**" />`, `<None Remove="logs\**" />`, and `<Content Update="appsettings.Development.json" CopyToPublishDirectory="Never" />`. `RuntimeIdentifiers` goes either here or in the `src` block of `Directory.Build.props`, for all four shipping projects. A test analog for the Release publish proof: `tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs` lines 23-40 (it builds Release into a temp dir and inspects the output). Copy it if the package-content check is also pinned as a .NET test.

---

### `web/scripts/deploy.mjs` + `deploy.test.ts` (utility, spawn injected)

**Analog:** `web/scripts/e2e.mjs`.

**Header + imports** (lines 1-15). Start with `// @ts-check` and a short numbered comment describing the run (OR-2: keep it shorter than e2e's):
```js
// @ts-check
// `npm run e2e` (QUAL-04, D-30, research Pattern 11): the only supported way to run the Playwright suite.
//   1. ...
import { spawnSync } from 'node:child_process';
```

**Plan as data** (lines 45-88). JSDoc typedefs for `RunStep | RefuseStep` and `Spawner`, and a pure `planSteps(options)` returning frozen step objects. For deploy this becomes `planDeploy({ sha, dryRun, lastGood, ... })` → offline, sync, online, smoke, release/rollback steps, with msdeploy args built by a pure function:
```js
/**
 * @typedef {{ readonly kind: 'run', readonly name: 'seed' | 'build' | 'playwright', readonly command: string, readonly args: readonly string[], readonly cwd: string }} RunStep
 * @typedef {{ readonly kind: 'refuse', readonly name: 'port-busy', readonly message: string, readonly exitCode: 1 }} RefuseStep
 * @typedef {(command: string, args: readonly string[], options: { cwd: string, stdio: 'inherit' }) => { status: number | null }} Spawner
 */
export function planSteps({ portBusy, extraArgs = [] }) { ... }
```

**Executor with injected spawn** (lines 96-109):
```js
export function executeSteps(steps, spawn = spawnSync) {
  for (const step of steps) {
    if (step.kind === 'refuse') {
      process.stderr.write(`e2e: ${step.message}\n`);
      return step.exitCode;
    }
    const status = spawn(step.command, step.args, { cwd: step.cwd, stdio: 'inherit' }).status ?? 1;
    if (status !== 0) {
      process.stderr.write(`e2e: ${step.name} failed with exit code ${String(status)}.\n`);
      return status;
    }
  }
  return 0;
}
```
Deploy differs: a failing sync/smoke must branch to rollback, not just return. The Spawner options also need `windowsVerbatimArguments: true` (RESEARCH Pattern 4).

**Main guard** (lines 349-352):
```js
const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
```

**Test file** (`e2e.test.ts` lines 1-60): starts with `// @vitest-environment node`, a 2-3 line comment saying what it pins, and a `fakeSpawner(statuses)` that records calls and returns planned exit codes:
```ts
function fakeSpawner(statuses: readonly (number | null)[]) {
  const calls: SpawnCall[] = [];
  const spawn = (command: string, args: readonly string[], options: { cwd?: unknown; stdio?: unknown }) => {
    calls.push({ command, args, cwd: options.cwd, stdio: options.stdio });
    const status = statuses[calls.length - 1];
    return { status: status === undefined ? 0 : status };
  };
  return { calls, spawn };
}
```
`web/vitest.config.ts:13` already includes `scripts/**/*.test.ts`, so no config change is needed. Messages are plain English and must not use long dashes (OR-4 is enforced on web/src; keep it in scripts too for consistency).

### `web/scripts/smoke.mjs` + `smoke.test.ts` (request-response)

Same skeleton as deploy.mjs. Inject `fetch` (default `globalThis.fetch`) and `sleep`/`now` the way `acquireLock` injects them (e2e.mjs lines 195-212):
```js
const {
  timeoutMs = LOCK_TIMEOUT_MS,
  pollMs = LOCK_POLL_MS,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }),
  ...
} = options;
```
Use that for the roughly 90 s `/health` cold-start retry (RESEARCH Pitfall 8). Each check returns `{ name, ok, detail }`, and an exported pure `evaluate(responses)` is what gets unit-tested.

### `web/scripts/merge-gate.mjs` + `merge-gate.test.ts` (pure decision)

**Analog:** `web/scripts/verify.mjs` (an exported frozen constant plus a function with injected deps and defaults, lines 11-48) and `verify.test.ts` (it pins the constant with `toEqual`). The decision core is RESEARCH "Merge-gate decision core" (`decide({ pr, checks, headCommit })` → `{ allowed, reasons }`). The `gh` calls go through an injected `spawnSync`, exactly like `run(spawn = spawnSync, env = process.env)` at verify.mjs line 33. Include the `[ci skip]` planning-only-parent rule and `--local-gate` mode as separate tested branches.

### `web/scripts/e2e.mjs` + `web/playwright.config.ts` (modify)

- `e2e.mjs` lines 64-71: the seed step args become `['run','--project','tools/Csps.DevSeed','--','--connection', value]` when `CSPS_E2E_CONNECTION` is set. Pass `env` into `planSteps` as a parameter (as `verify.mjs` `run(..., env = process.env)` does) so the test does not mutate `process.env`. Update the line-9 header comment and the line-64 guard comment.
- `playwright.config.ts` line 97 (`ConnectionStrings__Csps: 'Server=(localdb)\\MSSQLLocalDB;...'`) becomes `process.env.CSPS_E2E_CONNECTION ?? '<same literal>'`. Keep the env-block comment (lines 89-92) accurate.

---

### `web/src/modules/public/pages/HoldingPage.tsx` + `.test.tsx` (D-17)

**Analog:** `PublicPlaceholderPage.tsx` (lines 1-22) and its test.

- A named export function component, no props, and Tailwind utilities with design tokens (`font-display`, `text-accent-ink`, `text-ink-muted`, `max-w-(--container-max)`, the `pg-phone:` container variant). The pagehead section markup at lines 7-19 is the starting layout.
- Watch line 10: `Custom sublimation · Philippines` uses a middle dot, which is allowed. Avoid em/en dashes everywhere (OR-4, `no-long-dash.node.test.ts`). Hours must use a hyphen (`Mon-Sat`, `9:00 AM - 6:00 PM`).
- Phone and Facebook should be real `<a href="tel:...">` / `<a href="https://...">` links with touch targets of at least 44 px.
- Test (lines 1-31): exactly one h1 with an accessible name, a copy assertion, the React Compiler rerender check (L-13), and `expectNoAxeViolations(container)` from `@/test/axe`.

### `web/src/core/routes/router.tsx` (modify)

Lines 32-37: swap the lazy import target and update the line-7 comment ("Phase 2 has one public page ... (D-21)"):
```tsx
{
  path: '*',
  ErrorBoundary: RouteErrorBoundary,
  lazy: lazyRoute(async () => ({
    Component: (await import('@/modules/public/pages/PublicPlaceholderPage')).PublicPlaceholderPage,
  })),
},
```
`web/src/dev/previews/PublicShell.tsx:22` also renders `<PublicPlaceholderPage />`. Update it, or keep the placeholder file if the preview needs it.

---

### `tools/scripts/Merge-PullRequest.ps1`, `Install-Gitleaks.ps1` (new) and `Invoke-CoverageGate.ps1` (modify)

**Analog:** `tools/scripts/Invoke-CoverageGate.ps1`.
- Comment-based help block `<# .SYNOPSIS ... .DESCRIPTION ... #>` with numbered steps (lines 1-25).
- Repo root: `$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path` (line 67). For Linux CI safety, write new scripts with `Join-Path` segments and no backslash literals passed to native commands.
- The modification is at lines 68, 184 and 186. `'artifacts\coverage'`, `'tests\Csps.Domain.UnitTests'` and `'tests\Csps.Application.UnitTests'` become forward-slash or `Join-Path` segments (RESEARCH Pitfall 3). Line 6 promises "Phase 3 calls this script unchanged", so update that line if the change is made.
- `Merge-PullRequest.ps1` stays thin: it calls `node web/scripts/merge-gate.mjs <n>`, exits on non-zero, then runs `gh pr merge <n> --squash --delete-branch`.
- `Install-Gitleaks.ps1` verifies the pinned SHA-256 from RESEARCH and sets `git config core.hooksPath .githooks` at repo level only. It must never set User or Machine variables (CLAUDE.md).

### `docs/operations/*.md` (new)

**Analog:** `docs/operations/bootstrap-manager.md` lines 1-8: an H1 `# Runbook: ...`, then the timestamp line `*Created: <ISO -05:00> · Updated: <ISO -05:00>*`, a short plain-English purpose paragraph, then `## When to run it` and numbered steps. Use the same form for `cutover-runbook.md` (D-18 steps 1-8), `deploy.md` and `branch-rules.md`.

## Shared Patterns

### Injected I/O for every Node tool
**Source:** `web/scripts/e2e.mjs` lines 96, 195-212; `verify.mjs` line 33.
**Apply to:** merge-gate, smoke, deploy and package-check scripts. Default params are the real `spawnSync`/`fetch`/`Date.now`, and tests pass fakes. The exported pure planners and evaluators are what get the coverage.

### Windows shim rule (L-22)
**Source:** `verify.mjs` lines 26-28, 40; `e2e.mjs` lines 13-14, 75-83.
**Apply to:** any script that runs npm or Node tools. Spawn `process.execPath` with the JS entry (`npm_execpath`, `node_modules/.../cli.js`), never a `.cmd` shim. This matters for deploy.mjs on windows-2025.

### Repo-text tests via RepoRoot
**Source:** `tests/Csps.ArchitectureTests/RepoRoot.cs`.
**Apply to:** CiWorkflowTests and CiRepoHygieneTests. Offenders are collected into one `ShouldBeEmpty("<plain English rule>")`.

### Requirement-tagged one-line comments (OR-2)
**Source:** `Csps.Server.csproj` lines 3, 8, 23; `web.config` line 2.
**Apply to:** workflow YAML, csproj and web.config edits. One line, naming the ID (OPS-0x / D-xx), saying what the code does.

### Markdown timestamps
**Source:** `bootstrap-manager.md` line 3 (italic line) or this file's YAML frontmatter.
**Apply to:** every new .md. `pull_request_template.md` uses an HTML comment instead (RESEARCH constraints; owner-visible choice).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.github/workflows/ci.yml`, `weekly.yml`, `deploy.yml` | CI config | batch | No `.github/` exists. Use the RESEARCH "ci.yml step order" skeleton and Patterns 1-4, with the SHAs from the Standard Stack table. |
| `.github/dependabot.yml` | config | n/a | Use RESEARCH Pattern 7. |
| `.github/CODEOWNERS`, `pull_request_template.md` | config | n/a | CODEOWNERS is `* @loudiamond13`. The DoD list comes from PRD §22. |
| `.githooks/pre-commit`, `.gitleaks.toml` | config | n/a | Use RESEARCH Pitfall 11 for allowlist paths (HostingRecordTests, E2E fixtures, dev-secret scripts). |
| `tools/deploy/app_offline.htm` | static asset | n/a | Must be self-contained (inline CSS/SVG, system fonts), lowercase name, kept outside `web/public` (RESEARCH Pitfall 7). Take the Phase 2 token values from `web/src/ui` by value, not by import. |

## Metadata

**Analog search scope:** `tests/Csps.ArchitectureTests`, `tests/Csps.Server.IntegrationTests/Http`, `web/scripts`, `web/src/modules/public/pages`, `web/src/core/routes`, `tools/scripts`, `tools/Csps.HostProbe`, `docs/operations`, `src/Csps.Server`
**Files scanned:** about 20
**Pattern extraction date:** 2026-10-15
