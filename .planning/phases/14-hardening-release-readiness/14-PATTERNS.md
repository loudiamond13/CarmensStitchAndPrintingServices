# Phase 14: Hardening & Release Readiness - Pattern Map

*Created: 2026-11-27T00:30:00-06:00 · Updated: 2026-11-27T00:30:00-06:00*

**Mapped:** 2026-11-27
**Files analyzed:** 38 (new or changed, from 14-RESEARCH.md "Recommended Project Structure" and "Wave 0 Gaps")
**Analogs found:** 34 / 38

All analog paths below are git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/Csps.ArchitectureTests/ZapWorkflowTests.cs` | test (workflow text) | file-I/O | `tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs` + `WorkflowText.cs` | exact |
| `tests/Csps.ArchitectureTests/LiveAuditWorkflowTests.cs` | test (workflow text) | file-I/O | `MaintenanceWorkflowTests.cs` (dispatch + main-only guard) | exact |
| `tests/Csps.ArchitectureTests/RestoreDrillScriptTests.cs` | test (script text) | file-I/O | `tests/Csps.ArchitectureTests/CutoverRunbookTests.cs` | exact |
| `tests/Csps.ArchitectureTests/OperationsRunbookTests.cs` | test (doc shape) | file-I/O | `tests/Csps.ArchitectureTests/HostingRecordTests.cs` | exact |
| `tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs` | test (doc shape) | file-I/O | `HostingRecordTests.cs` (table columns, statuses) | exact |
| `tests/Csps.ArchitectureTests/A11yManualRecordTests.cs` | test (doc shape) | file-I/O | `HostingRecordTests.cs` | exact |
| `.github/workflows/zap.yml` | config (CI) | batch | `.github/workflows/maintenance.yml`, `weekly.yml` (`uses:` call) | role-match |
| `.github/workflows/live-audit.yml` | config (CI) | batch | `.github/workflows/maintenance.yml` (dispatch, `if: github.ref == 'refs/heads/main'`) | role-match |
| `.github/workflows/weekly.yml` (modify) | config (CI) | batch | itself (`all-engines` job) | exact |
| `.github/workflows/zap/*` (plans, rules) | config | batch | none | no analog |
| `tools/scripts/Restore-BackupDrill.ps1` | utility (script) | file-I/O | `tools/scripts/Restore-LegacyReceipt.ps1` | exact |
| `docs/operations/*.md` (security-review, security-checklist, data-requests, breach-response, break-glass-mail, lockout, backup-restore, install-staff-app, a11y-manual-passes) | docs | n/a | `docs/operations/maintenance.md` (title + timestamp line + plain prose) | exact |
| `web/scripts/pwa-config.ts` + `.test.ts` | config as data + test | transform | `web/scripts/vite-brotli-plugin.ts` / `vite-budget-plugin.ts` + tests | role-match |
| `web/scripts/pwa-build.test.ts` | test (post-build) | file-I/O | `web/src/test/build-output.node.test.ts` | role-match |
| `web/scripts/pwa-icons.mjs` + `.test.ts` | utility (render) | file-I/O | `web/scripts/render-email-logo.mjs` | exact |
| `web/scripts/zap-requests.mjs` + `.test.ts` | utility | transform | `web/scripts/lighthouse.mjs` + `lighthouse.test.ts` | role-match |
| `web/scripts/budget.test.ts` / `vite-budget-plugin.ts` (modify: no public chunk with `virtual:pwa-register` / `workbox-window`) | test / build plugin | transform | itself (admin/dev module ban near line 82) | exact |
| `web/vite.config.ts` (modify: add VitePWA) | config | n/a | itself, mode-gated plugin at line 86 | exact |
| `web/public/manifest.webmanifest`, `web/public/pwa/*.png` | static asset | n/a | none | no analog |
| `web/src/hooks/usePrefersReducedMotion.ts` + test | hook | event-driven | `web/src/hooks/usePresence.ts` | role-match |
| `web/src/modules/admin/hooks/useAppUpdate.ts` + test | hook / store | event-driven | `web/src/modules/admin/hooks/useAdminTheme.ts` | role-match |
| `web/src/modules/admin/components/UpdateBanner.tsx` + test | component | event-driven | `web/src/components/feedback/Toast.tsx` (role="status") | role-match |
| `web/src/modules/admin/components/OfflineCard.tsx` + test | component | request-response | `web/src/components/feedback/EmptyState.tsx` | role-match |
| `web/src/modules/admin/components/pwa.recipe.ts` | style recipe | n/a | `web/src/components/feedback/feedback.recipe.ts` | exact |
| `web/src/modules/admin/guard.ts` (modify: offline boot check) | utility (loader) | request-response | itself, `requireSessionLoader` line 57 | exact |
| `web/src/components/actions/UiLink.tsx` (modify: `viewTransition`, `noTransition`) | component | n/a | itself | exact |
| `web/src/test/motion-inventory.node.test.ts` | test (source scan) | file-I/O | `web/src/test/no-long-dash.node.test.ts` | exact |
| `web/e2e/pwa.spec.ts` (`@pwa`) | e2e test | event-driven | `web/e2e/motion.spec.ts` | role-match |
| `web/e2e/motion.spec.ts` (extend `@view-transitions`) | e2e test | event-driven | itself | exact |
| `src/Csps.Domain/Analytics/AnalyticsBots.cs` (modify: ZAP token) | model (domain rule) | transform | itself, `ExtraTokens` line 13 | exact |
| `src/Csps.Server/Endpoints/ShellPage.cs` (modify: admin head manifest, theme-color, apple icon, title) | controller (shell) | request-response | itself, `HeadAsync` Admin case lines 205-207 | exact |
| `src/Csps.Server/Http/SecurityHeadersMiddleware.cs` or `web.config` (X-Frame-Options, Pitfall 10) | middleware | request-response | itself | exact |
| ShellPageTests, SpaHostTests, SecurityHeadersTests, AnalyticsBotsTests (extend) | test | request-response | themselves | exact |
| `docs/license-exceptions.json`, `docs/audit-exceptions.json`, `docs/dependencies.json` (modify, owner yes first) | config | n/a | themselves | exact |

## Pattern Assignments

### `ZapWorkflowTests.cs`, `LiveAuditWorkflowTests.cs` (test, workflow text)

**Analog:** `tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs`. Read workflows with `WorkflowText` (`Lines`, `Section`, `Jobs`, `RunBlocks`). No YAML package.

Class header and constants (lines 5-15):
```csharp
/// <summary>
/// JOB-01 rules for the daily maintenance run (...): a scheduled and manual workflow with no token
/// rights, one repository secret that reaches the script through env only, and the runbooks (threats T-09-54 to T-09-58).
/// </summary>
public sealed class MaintenanceWorkflowTests
{
    private const string WorkflowPath = ".github/workflows/maintenance.yml";
```

Trigger, permissions and branch-guard checks (lines 24-60):
```csharp
var triggers = WorkflowText.Section(lines, "on");
triggers.Where(line => IndentOf(line) == 2).Select(line => line.Trim()).ToList()
    .ShouldBe(["schedule:", "workflow_dispatch:"], "D-21: ...");
...
WorkflowText.Lines(WorkflowPath).ShouldContain("permissions: {}", "The token starts with no rights (T-09-56).");
...
job.Lines.Where(line => line.TrimStart().StartsWith("if:", StringComparison.Ordinal)).Select(line => line.Trim()).ToList()
    .ShouldBe(["if: github.ref == 'refs/heads/main'"], "...");
```
For live-audit: triggers must be exactly `["workflow_dispatch:"]`. For zap: `["workflow_call:", "workflow_dispatch:"]`. Add checks for: no `activeScan`, image pinned by `@sha256:`, Release build, `ASPNETCORE_ENVIRONMENT: Production` on the host step only, gitleaks step before upload. Every `ShouldBe` carries a plain reason string naming the decision id.

### `RestoreDrillScriptTests.cs` (test, script text)

**Analog:** `tests/Csps.ArchitectureTests/CutoverRunbookTests.cs` (lines 10-80). Copy each fact one-for-one, swapping the target name to `CSPS_RestoreDrill`:
```csharp
script.ShouldContain(@"(localdb)\MSSQLLocalDB");
script.ShouldContain("CSPS_Legacy_Restore");
var parameters = ParamBlock(script);
ForbiddenParameter().Matches(parameters)...ShouldBeEmpty("The server and database are fixed in the script; they must never be parameters.");
var drops = DropStatement().Matches(CodeOnly(script))...;
drops.ShouldAllBe(name => string.Equals(name, "[CSPS_Legacy_Restore]", StringComparison.Ordinal));
```
Ordering checks (`'_local'` and `.EndsWith('.bak'` before `.Open()`; `RESTORE VERIFYONLY` before `DROP DATABASE`) use `IndexOf` comparisons as in `ReceiptScriptKeepsTheBakLocal` and `ReceiptScriptValidatesTheBackupBeforeDroppingTheRestore`. Add: the script never names `CSPS_Dev`, `CSPS_Legacy_Restore` or `BetsLLC_` as a target, and it drops the drill DB at the end.

### `OperationsRunbookTests.cs`, `SecurityReviewDocTests.cs`, `A11yManualRecordTests.cs` (test, doc shape)

**Analog:** `tests/Csps.ArchitectureTests/HostingRecordTests.cs`. Pattern: a `sealed partial class` with path constants, an expected-columns array, a list of required rows, a list of valid statuses, and `[GeneratedRegex]` detectors each paired with a sample they must catch (lines 11-46):
```csharp
private static readonly string[] ExpectedColumns = ["Fact", "How to check", "Result", "Status", "Date"];
private static readonly string[] ValidStatuses = ["Verified", "Unverified", "N/A"];
private static readonly (Regex Pattern, string Sample)[] SecretDetectors =
[
    (PasswordAssignment(), "Server=x;Password = hunter2"),
    ...
];
```
Use the same paired-sample idea for the "no email, phone or person name" rule in runbooks. SecurityReviewDocTests parses each table row's test name and checks that a file with that name exists (use `RepoRoot.PathOf`). Every runbook must have the `*Created: ... · Updated: ...*` line.

### `tools/scripts/Restore-BackupDrill.ps1` (utility script)

**Analog:** `tools/scripts/Restore-LegacyReceipt.ps1`. Copy the comment-based help shape (`.SYNOPSIS`, `.DESCRIPTION` with a "Safety rules:" list, lines 1-25), the fixed server and DB (not parameters), the `_local` and `.bak` checks before any connection, `RESTORE FILELISTONLY` and `RESTORE VERIFYONLY` before any `DROP DATABASE`, and a metadata-only receipt into `_local/`. Plain-English safety list, for example:
```
      - It connects ONLY to (localdb)\MSSQLLocalDB and restores ONLY into CSPS_Legacy_Restore. Both are fixed in the
        script. They are not parameters, so a typo cannot point it at CSPS_Dev, CSPS_E2E or a BetsLLC_* database,
```
Pitfall 12: any "app opens" step sets `Smtp__Host=smtp.invalid` on that one process only and never uses the production PFX.

### `docs/operations/*.md` (runbooks)

**Analog:** `docs/operations/maintenance.md` lines 1-12:
```markdown
# Maintenance run: what it does, the key and how to rotate it

*Created: 2026-11-03T12:20:00-06:00 · Updated: 2026-11-25T01:20:00-06:00*

The maintenance run is one web call that ...
```
Title as "topic: what it covers", the timestamp line, then short plain paragraphs. Never show a key, email, phone or person name. Say "the owner".

### `.github/workflows/zap.yml`, `live-audit.yml`, `weekly.yml` change

**Analog:** `weekly.yml` (whole file) and `maintenance.yml`. Header comment names the decision, `permissions: {}` at the top, each job asks for its own minimum rights, `runs-on: ubuntu-24.04`, `timeout-minutes`, actions pinned by SHA. Add the call to weekly.yml in the same shape:
```yaml
jobs:
  all-engines:
    name: weekly all engines
    uses: ./.github/workflows/ci.yml # zizmor: ignore[self-repository] actionlint 1.7.12 rejects the $/ form
    with:
      all-engines: true
    permissions:
      contents: read
```

### `web/scripts/pwa-icons.mjs` + test (render)

**Analog:** `web/scripts/render-email-logo.mjs` lines 1-18: `// @ts-check`, a header comment with the run steps, `node:fs` / `node:path` / `node:url` imports, output paths built with `fileURLToPath(new URL('../...', import.meta.url))`, Playwright Chromium screenshot with a clip at a given device scale. The PNG files are committed.

### `web/scripts/zap-requests.mjs` + test, `pwa-config.ts` + test

**Analog:** `web/scripts/lighthouse.mjs` and `web/scripts/lighthouse.test.ts` lines 1-40. Test files start with `// @vitest-environment node` and a comment naming the decision, import named pure functions and constants from the `.mjs`, and build fake inputs with small helper functions:
```typescript
// @vitest-environment node
// D-28, D-29 (plan 11-36): the Lighthouse run scores ...
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { executeSteps, LIGHTHOUSE_PAGES, ... } from './lighthouse.mjs';
```
Keep side effects behind an injected `deps` object (see `fakeDeps` in lighthouse.test.ts) so the logic is unit-tested without a network. `pwa-config.ts` exports the VitePWA options as plain data (no outside variables inside `urlPattern`, Research Pattern 1).

### `web/vite.config.ts` (add VitePWA)

**Analog:** the mode-gated plugin at line 86, with its `SPEC-DEVIATION` or decision comment above it:
```typescript
// D-28 Brotli twins (plan 11-36). The builds a host serves (production and e2e) get a quality-11 .br next to every
// .js, .css and .svg over 1 KB; the budget and parity builds are only measured, so they skip the slow pass.
...(mode === 'production' || mode === 'e2e' ? [brotliPlugin()] : []),
```
VitePWA is on for `production`, `e2e` and `budget` and disabled for `development`, `test` and `parity` (Research Pattern 1).

### `web/scripts/vite-budget-plugin.ts` / `budget.test.ts` (public-chunk ban)

**Analog:** the existing admin/dev module ban in `vite-budget-plugin.ts` (around line 82). Add `virtual:pwa-register` and `workbox-window` to the list of modules a public chunk may not hold. Limits never move (D-42).

### `web/src/hooks/usePrefersReducedMotion.ts`

**Analog:** `web/src/hooks/usePresence.ts` lines 1-20: a top comment naming the decisions, named React imports, an exported interface with doc comments, one exported `function useX()`. Subscribe to `matchMedia('(prefers-reduced-motion: reduce)')` change events and clean up in the effect return. Keep it tiny: it lands in the public entry chunk through UiLink (Pitfall 7). `useSyncExternalStore` fits the "one shared module" rule.

### `web/src/modules/admin/hooks/useAppUpdate.ts`

**Analog:** `web/src/modules/admin/hooks/useAdminTheme.ts` lines 1-50: a header comment that names the decision and where state lives, `@/modules/admin/...` imports, a split between the store side and the page side, and a type guard instead of a cast. Call `registerSW` once from a module-level store (Research Pattern 2), always pass `onNeedReload`, and reload only the tab that pressed Reload. Load `virtual:pwa-register` with a dynamic import, and add a Vitest stub for the virtual module (Wave 0 gap).

### `UpdateBanner.tsx`, `OfflineCard.tsx`, `pwa.recipe.ts`

**Analog:** `web/src/components/feedback/Toast.tsx` (role="status" for polite notices; the header comment explains that a status inside a live region must not double-announce, lines 3-6) and `EmptyState.tsx` for a card with a heading. Looks go in a `.recipe.ts`, as in `web/src/components/feedback/feedback.recipe.ts`: each tone is one complete class literal. UpdateBanner never takes focus. OfflineCard focuses its h1. Copy text comes from the module `copy.ts`, with no long dash (OR-4).

### `web/src/components/actions/UiLink.tsx` (modify)

**Analog:** itself. Props are explicit (L-13: no `{...rest}` spread). Add `noTransition?: boolean | undefined` to `UiLinkProps` with a doc comment, and pass `viewTransition={canTransition}` only on the `<Link>` branch (lines 72-90), never on the plain anchor branch (lines 53-71). `canTransition = !reduce && typeof document.startViewTransition === 'function'`, so jsdom prints no React Router warning (Research Pattern 3).

### `web/src/test/motion-inventory.node.test.ts`

**Analog:** `web/src/test/no-long-dash.node.test.ts` lines 1-35. Copy the walker and the "list of hits equals []" shape:
```typescript
// @vitest-environment node
const srcDir = fileURLToPath(new URL('../', import.meta.url));
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
...
expect(hits).toEqual([]);
```
Hits are `file:line` for each `animate-csp-*` without a `motion-reduce:` partner (button spinner excepted, D-30).

### `web/e2e/pwa.spec.ts` and `motion.spec.ts` changes

**Analog:** `web/e2e/motion.spec.ts` lines 1-30: a long header comment listing what is proven, imports from `./auth.ts`, `./fixtures.ts` (`expect`, `test`, `Guard`) and `./testing-api.ts`, constants for timings, and page scripts as strings (the e2e program has no DOM types). Tag tests `@pwa` / `@view-transitions`. PWA specs set `serviceWorkers: 'allow'` (Pitfall 8).

### `src/Csps.Domain/Analytics/AnalyticsBots.cs` (modify)

Line 13. Add one token that matches the ZAP plan user agent. No regex (CWE-1333):
```csharp
private static readonly string[] ExtraTokens = ["HeadlessChrome", "Lighthouse", "PTST"];
```
Update the summary ("three analytics-only tokens") to the new count.

### `src/Csps.Server/Endpoints/ShellPage.cs` (modify)

Admin head is built at lines 205-207:
```csharp
case PublicRouteKind.Admin:
    var head = new StringBuilder(parts.DefaultHead);
    PublicHeadWriter.AppendRobots(head);
    return head.ToString();
```
Add the manifest link, theme-color, apple-touch-icon and app title here only, through a `PublicHeadWriter`-style append helper. Public pages and the 404 must stay without a manifest link (Pitfall 1). Test in ShellPageTests for both sides.

### `SecurityHeadersMiddleware.cs` / `web.config` (X-Frame-Options)

Pick one place (Pitfall 10), with a CodeQL PR run as proof. Keep `StrictCsp` (lines 19-20) unchanged. Extend `SecurityHeadersTests`.

## Shared Patterns

### Header comments name the decision
**Source:** every analog above (for example `vite.config.ts` line 84, `usePresence.ts` line 1).
**Apply to:** all new files. One short comment naming the decision id (D-xx, PERF-06, SEC-05) and the reason. No history narration. No em or en dash in `web/src`.

### Fixed targets, never parameters
**Source:** `Restore-LegacyReceipt.ps1` and `CutoverRunbookTests.cs`.
**Apply to:** the drill script, the ZAP workflows (fixed host, main only) and their tests.

### Least-privilege workflows
**Source:** `maintenance.yml`, `weekly.yml`, `MaintenanceWorkflowTests.cs`.
**Apply to:** zap.yml and live-audit.yml: `permissions: {}`, main-only guard on dispatch, secrets through `env:` only, actions and images pinned.

### Pure logic plus injected side effects in node scripts
**Source:** `web/scripts/lighthouse.mjs` + test.
**Apply to:** `zap-requests.mjs`, `pwa-icons.mjs`, `pwa-config.ts`.

### Doc-lint tests with paired samples
**Source:** `HostingRecordTests.cs`.
**Apply to:** all runbook, security-review and a11y record tests.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.github/workflows/zap/*.yaml` (ZAP automation plans, rules file) | config | batch | No ZAP use yet. Use Research Pattern 4 and Pitfall 11. Note: `WorkflowText.UnreadFiles()` flags `.yaml` in the workflows folder itself, so keep plans in the `zap/` subfolder and check that the scan does not recurse, or name them differently |
| `web/public/manifest.webmanifest` | static asset | n/a | First manifest. Use UI-SPEC W1 values with scope `/admin` (Pitfall 3) |
| `web/public/pwa/*.png` | static asset | n/a | Generated by `pwa-icons.mjs` |
| Vitest stub for `virtual:pwa-register` | test harness | n/a | No virtual-module stub exists yet. Put it under `web/src/test/` and alias it in `vitest.config.ts` |

## Metadata

**Analog search scope:** `tests/Csps.ArchitectureTests`, `.github/workflows`, `tools/scripts`, `docs/operations`, `web/scripts`, `web/src/{hooks,components,modules/admin,test}`, `web/e2e`, `src/Csps.Server`, `src/Csps.Domain/Analytics`
**Files scanned:** about 40
**Pattern extraction date:** 2026-11-27
